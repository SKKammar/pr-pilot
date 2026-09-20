import asyncio
import hashlib
import hmac
import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app import supabase_client as db
from app.gemini_client import review_all_files, PROMPT_VERSION
from app.github_client import (
    fetch_pr_diff,
    post_inline_review,
    post_summary_comment,
    get_pr_metadata
)
from app.diff_parser import parse_diff_to_file_chunks, filter_noise_files

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# ── Rate limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Worker loop ──────────────────────────────────────────────────────────────
async def job_worker():
    """Background worker that processes pending webhook jobs from Supabase or queue."""
    logger.info("[worker] PR Pilot job worker started")
    while True:
        try:
            jobs = db.fetch_pending_jobs(limit=3)
            for job in jobs:
                job_id = job.get("id")
                delivery_id = job.get("delivery_id", "")
                payload = job.get("payload", {})
                if not job_id:
                    continue

                db.mark_job_processing(job_id)
                try:
                    await process_pr_review(payload, delivery_id)
                    db.mark_job_completed(job_id)
                except Exception as e:
                    logger.error(f"[worker] Job {job_id} failed: {e}")
                    db.mark_job_failed(job_id, str(e))
        except asyncio.CancelledError:
            logger.info("[worker] Job worker received cancellation")
            break
        except Exception as e:
            logger.error(f"[worker] Worker loop error: {e}")

        await asyncio.sleep(5)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = asyncio.create_task(job_worker())
    logger.info("[lifespan] Worker task started")
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        logger.info("[lifespan] Worker task cancelled cleanly")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="PR Pilot", description="Automated AI PR reviews powered by Gemini 2.0 Flash", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── HMAC verification ─────────────────────────────────────────────────────────
def verify_signature(body: bytes, signature_header: str) -> bool:
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", WEBHOOK_SECRET)
    # If no secret is configured in development, bypass
    if not secret:
        logger.warning("[security] GITHUB_WEBHOOK_SECRET not configured. Allowing webhook without verification.")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ── Review processor ──────────────────────────────────────────────────────────
async def process_pr_review(payload: dict, delivery_id: str):
    """Core review logic. Called by the worker loop for durability."""

    # Idempotency — skip if already processed
    if delivery_id and db.delivery_already_processed(delivery_id):
        logger.info(f"[processor] Delivery {delivery_id} already processed, skipping")
        return

    pr = payload.get("pull_request")
    if not pr:
        logger.warning("[processor] Missing pull_request object in payload")
        return

    repo = payload.get("repository", {})
    repo_full_name = repo.get("full_name", "")
    pr_number = pr.get("number")
    pr_title = pr.get("title", f"PR #{pr_number}")
    pr_author = pr.get("user", {}).get("login", "unknown")
    installation = payload.get("installation", {})
    installation_id = installation.get("id")
    commit_sha = pr.get("head", {}).get("sha", "")

    if not installation_id:
        logger.error(f"[processor] Missing installation_id for {repo_full_name}#{pr_number}")
        return

    is_draft = pr.get("draft", False)
    pr_author_type = pr.get("user", {}).get("type", "User")

    # Skip drafts and bots
    if is_draft:
        logger.info(f"[processor] Skipping draft PR {repo_full_name}#{pr_number}")
        return
    if pr_author_type == "Bot" or pr_author.endswith("[bot]") or pr_author.endswith("-bot"):
        logger.info(f"[processor] Skipping bot PR {repo_full_name}#{pr_number}")
        return

    # Fetch diff
    try:
        diff_text = await fetch_pr_diff(installation_id, repo_full_name, pr_number)
    except Exception as e:
        logger.error(f"[processor] Could not fetch diff for {repo_full_name}#{pr_number}: {e}")
        return

    if not diff_text or not diff_text.strip():
        logger.warning(f"[processor] Empty diff for {repo_full_name}#{pr_number}")
        return

    # Size guard
    changed_lines = sum(
        1 for line in diff_text.splitlines()
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    )
    if changed_lines > 2000:
        await post_summary_comment(
            installation_id, repo_full_name, pr_number,
            "⚠️ **PR Pilot skipped this review** — this PR has over 2,000 changed lines.\n\n"
            "Break it into smaller, atomic pull requests to receive inline code review."
        )
        return

    # Parse diff into file chunks and filter noisy/generated files
    file_chunks = parse_diff_to_file_chunks(diff_text)
    file_chunks = filter_noise_files(file_chunks)
    if not file_chunks:
        logger.info(f"[processor] No reviewable files in {repo_full_name}#{pr_number}")
        await post_summary_comment(
            installation_id, repo_full_name, pr_number,
            "✅ **PR Pilot:** No reviewable code files found (all changes were binary, lockfiles, or generated assets)."
        )
        return

    # Run Gemini 2.0 Flash review
    all_comments, summary, prompt_ver = await review_all_files(file_chunks)

    error_count = sum(1 for c in all_comments if getattr(c, "severity", "") == "error")
    warning_count = sum(1 for c in all_comments if getattr(c, "severity", "") == "warning")
    suggestion_count = sum(1 for c in all_comments if getattr(c, "severity", "") == "suggestion")

    # Post review to GitHub
    try:
        if all_comments:
            await post_inline_review(
                installation_id=installation_id,
                repo_full_name=repo_full_name,
                pr_number=pr_number,
                diff_text=diff_text,
                comments=all_comments,
                summary=summary,
                commit_sha=commit_sha,
            )
        else:
            await post_summary_comment(
                installation_id, repo_full_name, pr_number,
                f"**PR Pilot reviewed this PR** — no issues found! ✨\n\n{summary}"
            )
    except Exception as e:
        logger.error(f"[processor] Failed to post GitHub review: {e}")
        # Log to database as failed review
        db.insert_review({
            "installation_id": installation_id,
            "pr_number": pr_number,
            "repo_full_name": repo_full_name,
            "pr_title": pr_title,
            "pr_author": pr_author,
            "total_issues": len(all_comments),
            "error_count": error_count,
            "warning_count": warning_count,
            "suggestion_count": suggestion_count,
            "summary": summary,
            "delivery_id": delivery_id,
            "status": "failed",
            "error_reason": str(e)[:1000],
            "prompt_version": prompt_ver
        })
        return

    # Write review to Supabase / store
    review_id = db.insert_review({
        "installation_id": installation_id,
        "pr_number": pr_number,
        "repo_full_name": repo_full_name,
        "pr_title": pr_title,
        "pr_author": pr_author,
        "total_issues": len(all_comments),
        "error_count": error_count,
        "warning_count": warning_count,
        "suggestion_count": suggestion_count,
        "summary": summary,
        "delivery_id": delivery_id,
        "status": "posted",
        "prompt_version": prompt_ver
    })

    if review_id and all_comments:
        db.insert_review_comments(
            review_id,
            [c.model_dump() if hasattr(c, "model_dump") else c for c in all_comments]
        )

    logger.info(f"[processor] Review complete for {repo_full_name}#{pr_number} — {len(all_comments)} issues recorded")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    supabase_ok = db.health_check()
    return JSONResponse(
        content={
            "status": "ok",
            "service": "PR Pilot",
            "database": "connected" if supabase_ok else "fallback_mode",
            "model": "gemini-2.0-flash",
        },
        status_code=200
    )


@app.get("/stats")
async def stats():
    """Stats endpoint for dashboard header."""
    return db.fetch_stats()


@app.post("/webhook")
@limiter.limit("60/minute")
async def webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    delivery_id = request.headers.get("X-GitHub-Delivery", "")
    event_type = request.headers.get("X-GitHub-Event", "")

    # Handle GitHub Ping event immediately
    if event_type == "ping":
        return JSONResponse(content={"status": "pong", "message": "PR Pilot webhook active"})

    # Verify HMAC signature
    if not verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action", "")

    # Handle installation events
    if event_type == "installation":
        installation = payload.get("installation", {})
        account = installation.get("account", {})
        if action == "created":
            db.upsert_installation(
                installation_id=installation.get("id", 0),
                account_login=account.get("login", ""),
                account_type=account.get("type", "User")
            )
        elif action in ("deleted", "suspend"):
            db.mark_installation_uninstalled(installation.get("id", 0))
        return JSONResponse(content={"status": "ok", "event": "installation", "action": action})

    # Handle pull_request events
    if event_type == "pull_request" and action in ("opened", "synchronize", "reopened"):
        if not delivery_id:
            logger.warning("[webhook] No X-GitHub-Delivery header on PR event")
            delivery_id = f"gen_{os.urandom(8).hex()}"

        # Enqueue job for durable processing
        enqueued = db.enqueue_webhook_job(delivery_id, payload)
        if not enqueued:
            logger.error(f"[webhook] Failed to enqueue job for delivery {delivery_id}")
            return JSONResponse(content={"status": "error", "message": "Queue failed"}, status_code=500)

        return JSONResponse(content={"status": "queued", "delivery_id": delivery_id})

    return JSONResponse(content={"status": "ignored", "event": event_type, "action": action})
