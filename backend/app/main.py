import json
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.security import verify_webhook_signature
from app.github_client import GitHubClient
from app.gemini_client import GeminiClient
from app.supabase_client import SupabaseClient
from app.reviewer import process_pull_request

load_dotenv()

# Initialize clients at startup (singleton pattern)
github_client: GitHubClient | None = None
gemini_client: GeminiClient | None = None
supabase_client: SupabaseClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global github_client, gemini_client, supabase_client
    github_client = GitHubClient(
        app_id=os.environ.get("GITHUB_APP_ID", ""),
        private_key=os.environ.get("GITHUB_PRIVATE_KEY", "").replace("\\n", "\n"),
    )
    gemini_client = GeminiClient(api_key=os.environ.get("GEMINI_API_KEY", ""))
    supabase_client = SupabaseClient(
        url=os.environ.get("SUPABASE_URL", ""),
        key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    )
    yield

app = FastAPI(title="PR Pilot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SUPPORTED_ACTIONS = {"opened", "synchronize", "reopened"}


@app.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    GitHub webhook endpoint.
    Must return 200 in < 10 seconds — actual work runs in background.
    """
    webhook_secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    
    # 1. Verify signature FIRST — before reading any payload
    body = await verify_webhook_signature(request, webhook_secret)

    # 2. Parse event type
    event = request.headers.get("X-GitHub-Event")
    if event != "pull_request":
        return {"status": "ignored", "reason": f"event={event}"}

    # 3. Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action")
    if action not in SUPPORTED_ACTIONS:
        return {"status": "ignored", "reason": f"action={action}"}

    # 4. Acknowledge immediately
    background_tasks.add_task(
        process_pull_request,
        payload,
        github_client,
        gemini_client,
        supabase_client,
    )

    return {"status": "accepted", "action": action}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/stats")
async def stats():
    """Public stats endpoint for dashboard."""
    if not supabase_client:
        return {"error": "Supabase client not initialized"}
    data = await supabase_client.get_stats()
    return data
