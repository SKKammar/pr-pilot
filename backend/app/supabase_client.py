import os
import logging
from typing import Optional, List, Dict, Any

try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    Client = Any

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_client: Optional[Client] = None
_in_memory_reviews: list[dict] = []
_in_memory_comments: list[dict] = []
_in_memory_jobs: list[dict] = []


def get_client() -> Optional[Client]:
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL", SUPABASE_URL)
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY)

    if not url or not key or not HAS_SUPABASE:
        logger.debug("[supabase] Credentials not configured or package missing. Running in fallback mode.")
        return None

    try:
        _client = create_client(url, key)
        return _client
    except Exception as e:
        logger.warning(f"[supabase] Failed to initialize Supabase client: {e}")
        return None


# ── Idempotency ──────────────────────────────────────────────────────────────

def delivery_already_processed(delivery_id: str) -> bool:
    """Return True if this GitHub delivery UUID has already been handled."""
    client = get_client()
    if not client:
        return any(r.get("delivery_id") == delivery_id for r in _in_memory_reviews)

    try:
        result = client.table("pr_pilot_reviews") \
            .select("id") \
            .eq("delivery_id", delivery_id) \
            .limit(1) \
            .execute()
        return len(result.data or []) > 0
    except Exception as e:
        logger.warning(f"[supabase] Idempotency check failed: {e}")
        return False


# ── Webhook Job Queue ────────────────────────────────────────────────────────

def enqueue_webhook_job(delivery_id: str, payload: dict) -> Optional[str]:
    """Write raw webhook payload to job queue. Returns job id or fallback id."""
    import uuid
    client = get_client()
    if not client:
        job_id = str(uuid.uuid4())
        _in_memory_jobs.append({
            "id": job_id,
            "delivery_id": delivery_id,
            "payload": payload,
            "status": "pending",
            "attempts": 0
        })
        return job_id

    try:
        result = client.table("pr_pilot_webhook_jobs").insert({
            "delivery_id": delivery_id,
            "payload": payload,
            "status": "pending",
            "attempts": 0
        }).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        logger.error(f"[supabase] Failed to enqueue job: {e}")
        # Fallback in-memory
        job_id = str(uuid.uuid4())
        _in_memory_jobs.append({
            "id": job_id,
            "delivery_id": delivery_id,
            "payload": payload,
            "status": "pending",
            "attempts": 0
        })
        return job_id


def fetch_pending_jobs(limit: int = 5) -> list:
    """Fetch oldest pending jobs for the worker loop."""
    client = get_client()
    if not client:
        pending = [j for j in _in_memory_jobs if j.get("status") == "pending"]
        return pending[:limit]

    try:
        result = client.table("pr_pilot_webhook_jobs") \
            .select("*") \
            .eq("status", "pending") \
            .order("created_at", desc=False) \
            .limit(limit) \
            .execute()
        return result.data or []
    except Exception as e:
        logger.debug(f"[supabase] Could not fetch pending jobs: {e}")
        pending = [j for j in _in_memory_jobs if j.get("status") == "pending"]
        return pending[:limit]


def mark_job_processing(job_id: str):
    client = get_client()
    if not client:
        for j in _in_memory_jobs:
            if j.get("id") == job_id:
                j["status"] = "processing"
                j["attempts"] = j.get("attempts", 0) + 1
        return

    try:
        client.table("pr_pilot_webhook_jobs").update({
            "status": "processing",
            "attempts": 1
        }).eq("id", job_id).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to mark job processing: {e}")


def mark_job_completed(job_id: str):
    from datetime import datetime, timezone
    client = get_client()
    if not client:
        for j in _in_memory_jobs:
            if j.get("id") == job_id:
                j["status"] = "completed"
                j["processed_at"] = datetime.now(timezone.utc).isoformat()
        return

    try:
        client.table("pr_pilot_webhook_jobs").update({
            "status": "completed",
            "processed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to mark job completed: {e}")


def mark_job_failed(job_id: str, reason: str):
    from datetime import datetime, timezone
    client = get_client()
    if not client:
        for j in _in_memory_jobs:
            if j.get("id") == job_id:
                j["status"] = "failed"
                j["error_reason"] = reason[:1000]
                j["processed_at"] = datetime.now(timezone.utc).isoformat()
        return

    try:
        client.table("pr_pilot_webhook_jobs").update({
            "status": "failed",
            "error_reason": reason[:1000],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", job_id).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to mark job failed: {e}")


# ── Reviews ──────────────────────────────────────────────────────────────────

def insert_review(data: dict) -> Optional[str]:
    """Insert a review record. Returns the new review UUID or None on error."""
    import uuid
    from datetime import datetime, timezone

    row = {
        "id": str(uuid.uuid4()),
        "installation_id": data.get("installation_id", 0),
        "pr_number": data.get("pr_number", 0),
        "repo_full_name": data.get("repo_full_name", ""),
        "pr_title": data.get("pr_title", ""),
        "pr_author": data.get("pr_author", ""),
        "total_issues": data.get("total_issues", 0),
        "error_count": data.get("error_count", 0),
        "warning_count": data.get("warning_count", 0),
        "suggestion_count": data.get("suggestion_count", 0),
        "summary": data.get("summary", "")[:5000],
        "delivery_id": data.get("delivery_id", ""),
        "status": data.get("status", "posted"),
        "error_reason": str(data.get("error_reason") or "")[:1000] if data.get("error_reason") else None,
        "prompt_version": data.get("prompt_version", "v1"),
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }

    client = get_client()
    if not client:
        _in_memory_reviews.insert(0, row)
        return row["id"]

    try:
        insert_payload = {k: v for k, v in row.items() if k != "id"}
        result = client.table("pr_pilot_reviews").insert(insert_payload).execute()
        return result.data[0]["id"] if result.data else row["id"]
    except Exception as e:
        logger.warning(f"[supabase] Failed to insert review to database: {e}. Storing locally.")
        _in_memory_reviews.insert(0, row)
        return row["id"]


def update_review_status(review_id: str, status: str, error_reason: Optional[str] = None):
    client = get_client()
    if not client:
        for r in _in_memory_reviews:
            if r.get("id") == review_id:
                r["status"] = status
                if error_reason:
                    r["error_reason"] = error_reason[:1000]
        return

    try:
        update_data = {"status": status}
        if error_reason:
            update_data["error_reason"] = error_reason[:1000]
        client.table("pr_pilot_reviews").update(update_data).eq("id", review_id).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to update review status: {e}")


def insert_review_comments(review_id: str, comments: list):
    """Bulk insert all comments for a review."""
    if not comments:
        return

    import uuid
    rows = []
    for c in comments:
        rows.append({
            "id": str(uuid.uuid4()),
            "review_id": review_id,
            "filename": c.get("filename", ""),
            "line_pos": c.get("line_pos", 0),
            "severity": c.get("severity", "suggestion"),
            "message": c.get("message", ""),
            "suggestion": c.get("suggestion")
        })

    client = get_client()
    if not client:
        _in_memory_comments.extend(rows)
        return

    try:
        insert_payload = [{k: v for k, v in r.items() if k != "id"} for r in rows]
        client.table("pr_pilot_review_comments").insert(insert_payload).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to insert comments to database: {e}")
        _in_memory_comments.extend(rows)


def fetch_reviews(repo: Optional[str] = None, limit: int = 50, offset: int = 0) -> list:
    client = get_client()
    if not client:
        filtered = _in_memory_reviews
        if repo:
            filtered = [r for r in filtered if r.get("repo_full_name") == repo]
        return filtered[offset : offset + limit]

    try:
        query = client.table("pr_pilot_reviews") \
            .select("*") \
            .order("reviewed_at", desc=True) \
            .range(offset, offset + limit - 1)
        if repo:
            query = query.eq("repo_full_name", repo)
        result = query.execute()
        return result.data or []
    except Exception as e:
        logger.warning(f"[supabase] fetch_reviews query failed: {e}")
        return _in_memory_reviews[offset : offset + limit]


def fetch_review_by_id(review_id: str) -> Optional[dict]:
    client = get_client()
    if not client:
        for r in _in_memory_reviews:
            if r.get("id") == review_id:
                return r
        return None

    try:
        result = client.table("pr_pilot_reviews") \
            .select("*") \
            .eq("id", review_id) \
            .limit(1) \
            .execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.warning(f"[supabase] fetch_review_by_id failed: {e}")
        for r in _in_memory_reviews:
            if r.get("id") == review_id:
                return r
        return None


def fetch_comments_for_review(review_id: str) -> list:
    client = get_client()
    if not client:
        return [c for c in _in_memory_comments if c.get("review_id") == review_id]

    try:
        result = client.table("pr_pilot_review_comments") \
            .select("*") \
            .eq("review_id", review_id) \
            .order("filename", desc=False) \
            .execute()
        return result.data or []
    except Exception as e:
        logger.warning(f"[supabase] fetch_comments_for_review failed: {e}")
        return [c for c in _in_memory_comments if c.get("review_id") == review_id]


def fetch_stats() -> dict:
    """Aggregate stats for dashboard header."""
    client = get_client()
    if not client:
        rows = _in_memory_reviews
        return {
            "total_reviews": len(rows),
            "total_errors": sum(r.get("error_count", 0) for r in rows),
            "total_warnings": sum(r.get("warning_count", 0) for r in rows),
            "total_suggestions": sum(r.get("suggestion_count", 0) for r in rows),
            "repos_monitored": len(set(r["repo_full_name"] for r in rows if r.get("repo_full_name")))
        }

    try:
        reviews = client.table("pr_pilot_reviews") \
            .select("error_count, warning_count, suggestion_count, repo_full_name") \
            .execute()
        rows = reviews.data or []
        total_reviews = len(rows)
        total_errors = sum(r.get("error_count", 0) for r in rows)
        total_warnings = sum(r.get("warning_count", 0) for r in rows)
        total_suggestions = sum(r.get("suggestion_count", 0) for r in rows)
        repos = len(set(r["repo_full_name"] for r in rows if r.get("repo_full_name")))
        return {
            "total_reviews": total_reviews,
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "total_suggestions": total_suggestions,
            "repos_monitored": repos
        }
    except Exception as e:
        logger.warning(f"[supabase] fetch_stats failed: {e}")
        return {"total_reviews": 0, "total_errors": 0, "total_warnings": 0, "total_suggestions": 0, "repos_monitored": 0}


# ── Installations ────────────────────────────────────────────────────────────

def upsert_installation(installation_id: int, account_login: str, account_type: str):
    client = get_client()
    if not client:
        return
    try:
        client.table("pr_pilot_installations").upsert({
            "installation_id": installation_id,
            "account_login": account_login,
            "account_type": account_type,
            "suspended": False
        }).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to upsert installation: {e}")


def mark_installation_uninstalled(installation_id: int):
    from datetime import datetime, timezone
    client = get_client()
    if not client:
        return
    try:
        client.table("pr_pilot_installations").update({
            "suspended": True,
            "uninstalled_at": datetime.now(timezone.utc).isoformat()
        }).eq("installation_id", installation_id).execute()
    except Exception as e:
        logger.warning(f"[supabase] Failed to mark uninstall: {e}")


def health_check() -> bool:
    """Ping Supabase. Returns True if reachable."""
    client = get_client()
    if not client:
        return False
    try:
        client.table("pr_pilot_reviews").select("id").limit(1).execute()
        return True
    except Exception:
        return False


class SupabaseClient:
    """Backwards-compatible class wrapper."""
    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        self.client = get_client()

    async def log_review(self, review_result: Any, pr_title: str, pr_author: str, installation_id: int):
        data = {
            "installation_id": installation_id,
            "pr_number": getattr(review_result, "pr_number", 0),
            "repo_full_name": getattr(review_result, "repo_full_name", ""),
            "pr_title": pr_title,
            "pr_author": pr_author,
            "total_issues": getattr(review_result, "total_issues", 0),
            "error_count": sum(1 for c in getattr(review_result, "comments", []) if getattr(c, "severity", "") == "error"),
            "warning_count": sum(1 for c in getattr(review_result, "comments", []) if getattr(c, "severity", "") == "warning"),
            "suggestion_count": sum(1 for c in getattr(review_result, "comments", []) if getattr(c, "severity", "") == "suggestion"),
            "summary": getattr(review_result, "summary", ""),
            "delivery_id": getattr(review_result, "delivery_id", ""),
            "status": "posted"
        }
        review_id = insert_review(data)
        comments = getattr(review_result, "comments", [])
        if review_id and comments:
            insert_review_comments(review_id, [c.model_dump() if hasattr(c, "model_dump") else c for c in comments])
        return review_id

    async def get_stats(self) -> dict:
        return fetch_stats()
