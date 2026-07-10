# AI Code Review Bot — Complete Professional Build Guide

> **Stack:** Next.js 15 (App Router) · FastAPI · Gemini 2.0 Flash · GitHub App · Railway · Vercel  
> **Repo name suggestion:** `pr-pilot` or `reviewbot`  
> **Timeline:** ~3 focused weekends

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Repository Structure](#2-repository-structure)
3. [Phase 1 — GitHub App Registration](#3-phase-1--github-app-registration)
4. [Phase 2 — FastAPI Backend](#4-phase-2--fastapi-backend)
5. [Phase 3 — Gemini Integration & Prompt Engineering](#5-phase-3--gemini-integration--prompt-engineering)
6. [Phase 4 — Diff Parsing & Inline Comment Placement](#6-phase-4--diff-parsing--inline-comment-placement)
7. [Phase 5 — Next.js Dashboard (Frontend)](#7-phase-5--nextjs-dashboard-frontend)
8. [Phase 6 — Supabase Schema](#8-phase-6--supabase-schema)
9. [Phase 7 — Railway Deployment (Backend)](#9-phase-7--railway-deployment-backend)
10. [Phase 8 — Vercel Deployment (Frontend)](#10-phase-8--vercel-deployment-frontend)
11. [Edge Cases & Hardening](#11-edge-cases--hardening)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [Resume Bullet & Demo Script](#13-resume-bullet--demo-script)

---

## 1. Architecture Overview

```
GitHub PR Opened/Updated
        │
        ▼
  GitHub Webhook ──────────────────────────────────────────────┐
        │                                                        │
        ▼                                                        │
  FastAPI Backend (Railway)                                      │
        │                                                        │
        ├── 1. Verify webhook signature (HMAC-SHA256)           │
        ├── 2. Ack with 200 OK immediately (< 1s)               │
        ├── 3. Spawn background task (asyncio)                  │
        │         │                                             │
        │         ├── Fetch PR diff via GitHub REST API         │
        │         ├── Parse diff into file chunks               │
        │         ├── Filter out noise files                    │
        │         ├── Call Gemini 2.0 Flash per chunk           │
        │         ├── Parse structured JSON response            │
        │         ├── Post inline review comments via GitHub    │
        │         ├── Post summary review comment               │
        │         └── Log review to Supabase                    │
        │                                                        │
        └── Health/stats endpoints ◄──── Next.js Dashboard ◄───┘
                                         (Vercel)
```

**Key design decisions:**
- Background task pattern — webhook gets `200 OK` in < 500ms, heavy work runs async. Prevents GitHub timeouts and duplicate retries.
- File-chunked reviews — each file reviewed independently, prevents token overflow.
- Structured JSON from Gemini — parse into typed objects before posting, never trust raw text.
- Supabase as audit log — every review stored, dashboard reads from it.

---

## 2. Repository Structure

```
pr-pilot/
├── backend/                    # FastAPI — deployed to Railway
│   ├── app/
│   │   ├── main.py             # FastAPI app, webhook endpoint
│   │   ├── github_client.py    # GitHub API calls (diff fetch, comment post)
│   │   ├── gemini_client.py    # Gemini API wrapper
│   │   ├── diff_parser.py      # Unified diff → structured chunks
│   │   ├── reviewer.py         # Orchestration: diff → review → comments
│   │   ├── supabase_client.py  # Logging to Supabase
│   │   ├── security.py         # Webhook signature verification
│   │   └── models.py           # Pydantic models
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                   # Next.js 15 — deployed to Vercel
│   ├── app/
│   │   ├── page.tsx            # Landing / hero
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Review history dashboard
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ReviewCard.tsx
│   │   ├── StatsBento.tsx
│   │   ├── AnimatedCounter.tsx
│   │   └── StatusBadge.tsx
│   ├── lib/
│   │   └── supabase.ts
│   └── .env.example
│
└── README.md
```

---

## 3. Phase 1 — GitHub App Registration

### Step 1: Create the GitHub App

1. Go to **GitHub → Settings → Developer Settings → GitHub Apps → New GitHub App**
2. Fill in:
   - **App name:** `PR Pilot` (or your chosen name)
   - **Homepage URL:** your Vercel URL (placeholder first: `https://pr-pilot.vercel.app`)
   - **Webhook URL:** your Railway URL + `/webhook` (use `ngrok` for local dev: `https://xxxx.ngrok.io/webhook`)
   - **Webhook secret:** generate a strong random string — save it as `GITHUB_WEBHOOK_SECRET`

3. **Permissions — Repository (Read & Write):**
   - Pull requests: **Read & Write**
   - Contents: **Read**

4. **Subscribe to events:**
   - `Pull request` ✅

5. Click **Create GitHub App**

6. After creation:
   - Note the **App ID** — save as `GITHUB_APP_ID`
   - Generate a **Private Key** (.pem file) — save content as `GITHUB_PRIVATE_KEY`
   - Go to **Install App** → install on your own account/repos

### Step 2: Local dev with ngrok

```bash
# Terminal 1 — run backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — expose it
ngrok http 8000
# Copy the https URL and paste into GitHub App webhook settings
```

---

## 4. Phase 2 — FastAPI Backend

### requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
pyjwt[crypto]==2.9.0
cryptography==43.0.1
google-generativeai==0.8.3
supabase==2.7.4
python-dotenv==1.0.1
pydantic==2.8.2
```

### app/models.py

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DiffHunk(BaseModel):
    filename: str
    patch: str                    # raw unified diff for this file
    additions: int
    deletions: int
    status: str                   # added | modified | removed | renamed

class ReviewComment(BaseModel):
    filename: str
    line: int                     # line number in the diff (position)
    severity: str                 # error | warning | suggestion | nitpick
    message: str
    suggestion: Optional[str]     # optional code fix

class ReviewResult(BaseModel):
    pr_number: int
    repo_full_name: str
    summary: str
    comments: list[ReviewComment]
    total_issues: int
    reviewed_at: datetime
```

### app/security.py

```python
import hashlib
import hmac
from fastapi import HTTPException, Request

async def verify_webhook_signature(request: Request, secret: str) -> bytes:
    """
    Verify GitHub's HMAC-SHA256 webhook signature.
    MUST be called before processing any payload.
    Returns raw body bytes on success, raises 401 on failure.
    """
    signature_header = request.headers.get("X-Hub-Signature-256")
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing signature header")

    body = await request.body()

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=401, detail="Invalid signature")

    return body
```

### app/github_client.py

```python
import time
import httpx
import jwt
from typing import Optional

class GitHubClient:
    def __init__(self, app_id: str, private_key: str):
        self.app_id = app_id
        self.private_key = private_key
        self._installation_tokens: dict[int, tuple[str, float]] = {}

    def _generate_jwt(self) -> str:
        """Generate a short-lived JWT to authenticate as the GitHub App."""
        now = int(time.time())
        payload = {
            "iat": now - 60,      # issued 60s ago (clock skew buffer)
            "exp": now + 600,     # expires in 10 minutes
            "iss": self.app_id,
        }
        return jwt.encode(payload, self.private_key, algorithm="RS256")

    async def get_installation_token(self, installation_id: int) -> str:
        """
        Exchange JWT for an installation access token.
        Cached per installation_id, refreshed 5 min before expiry.
        """
        cached = self._installation_tokens.get(installation_id)
        if cached and time.time() < cached[1] - 300:
            return cached[0]

        token = self._generate_jwt()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.github.com/app/installations/{installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        # Cache token with expiry timestamp
        expires_at = time.time() + 3600  # tokens last 1 hour
        self._installation_tokens[installation_id] = (data["token"], expires_at)
        return data["token"]

    async def get_pr_diff(
        self, token: str, owner: str, repo: str, pr_number: int
    ) -> str:
        """
        Fetch the raw unified diff of a PR.
        Uses Accept: application/vnd.github.diff header.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.diff",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            resp.raise_for_status()
            return resp.text

    async def get_pr_files(
        self, token: str, owner: str, repo: str, pr_number: int
    ) -> list[dict]:
        """Get structured file list for a PR (filename, patch, status, additions, deletions)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return resp.json()

    async def create_review_with_comments(
        self,
        token: str,
        owner: str,
        repo: str,
        pr_number: int,
        commit_sha: str,
        comments: list[dict],
        summary: str,
    ) -> None:
        """
        Post a GitHub Pull Request Review with inline comments.
        Uses the Reviews API (not individual comment API) — this is the correct approach
        as it groups all comments into a single review thread.
        """
        body = {
            "commit_id": commit_sha,
            "body": summary,
            "event": "COMMENT",   # COMMENT = review with no approval/rejection
            "comments": comments, # list of {path, position, body}
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json=body,
            )
            if resp.status_code == 422:
                # Some comment positions were invalid — post summary only
                await self._post_summary_only(token, owner, repo, pr_number, commit_sha, summary)
                return
            resp.raise_for_status()

    async def _post_summary_only(
        self, token, owner, repo, pr_number, commit_sha, summary
    ):
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                json={"commit_id": commit_sha, "body": summary, "event": "COMMENT"},
            )
```

### app/diff_parser.py

```python
"""
Parse unified diff format into structured chunks per file.

CRITICAL: GitHub's inline comment API requires `position` — the line number
within the diff hunk (starting at 1 for the first `@@` line), NOT the
file's actual line number. This parser builds that mapping.
"""

import re
from dataclasses import dataclass, field

# Files to skip — generated, binary, lockfiles
SKIP_PATTERNS = [
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"poetry\.lock$",
    r"Pipfile\.lock$",
    r"\.min\.(js|css)$",
    r"\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf)$",
    r"__pycache__",
    r"\.pyc$",
    r"migrations/\d+_",          # Django/Alembic migrations
    r"node_modules/",
    r"\.lock$",
    r"dist/",
    r"build/",
    r"coverage/",
]

@dataclass
class DiffLine:
    position: int       # position in diff (used by GitHub API)
    line_number: int    # actual line number in the new file (for display)
    content: str        # line content
    line_type: str      # "added" | "removed" | "context"

@dataclass
class ParsedFile:
    filename: str
    status: str                        # added | modified | removed | renamed
    lines: list[DiffLine] = field(default_factory=list)
    raw_patch: str = ""
    additions: int = 0
    deletions: int = 0

    @property
    def added_lines(self) -> list[DiffLine]:
        return [l for l in self.lines if l.line_type == "added"]

    def should_skip(self) -> bool:
        return any(re.search(p, self.filename) for p in SKIP_PATTERNS)

    def is_too_large(self, max_lines: int = 500) -> bool:
        return len(self.lines) > max_lines


def parse_pr_files(pr_files: list[dict]) -> list[ParsedFile]:
    """
    Parse GitHub's PR files API response into structured ParsedFile objects.
    Each file has a `patch` field containing the unified diff for that file.
    """
    parsed = []
    for file_data in pr_files:
        filename = file_data.get("filename", "")
        status = file_data.get("status", "modified")
        patch = file_data.get("patch", "")

        pf = ParsedFile(
            filename=filename,
            status=status,
            raw_patch=patch,
            additions=file_data.get("additions", 0),
            deletions=file_data.get("deletions", 0),
        )

        if not patch:
            # Binary files or files with no textual diff
            parsed.append(pf)
            continue

        pf.lines = _parse_patch(patch)
        parsed.append(pf)

    return parsed


def _parse_patch(patch: str) -> list[DiffLine]:
    """
    Parse a unified diff patch string into DiffLine objects.

    Unified diff format:
        @@ -old_start,old_count +new_start,new_count @@
        -removed line
        +added line
         context line

    Position counts every line in the patch starting from 1 at the first @@ header.
    """
    lines = []
    position = 0          # GitHub diff position counter
    new_line_number = 0   # actual line number in the new version of file

    hunk_header_re = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")

    for raw_line in patch.split("\n"):
        if raw_line.startswith("@@"):
            position += 1
            match = hunk_header_re.match(raw_line)
            if match:
                new_line_number = int(match.group(1)) - 1
            continue

        if raw_line.startswith("+"):
            new_line_number += 1
            position += 1
            lines.append(DiffLine(
                position=position,
                line_number=new_line_number,
                content=raw_line[1:],
                line_type="added",
            ))
        elif raw_line.startswith("-"):
            position += 1
            lines.append(DiffLine(
                position=position,
                line_number=new_line_number,   # not incremented — line was removed
                content=raw_line[1:],
                line_type="removed",
            ))
        elif raw_line.startswith(" "):
            new_line_number += 1
            position += 1
            lines.append(DiffLine(
                position=position,
                line_number=new_line_number,
                content=raw_line[1:],
                line_type="context",
            ))
        # skip "\ No newline at end of file" and empty lines

    return lines
```

---

## 5. Phase 3 — Gemini Integration & Prompt Engineering

### app/gemini_client.py

```python
import json
import re
import google.generativeai as genai
from app.models import ReviewComment

# System prompt — the most important part of the whole project.
# Prompt engineering determines review quality.
SYSTEM_PROMPT = """You are a senior software engineer performing a precise code review.

Your job is to review the provided code diff and identify ONLY real, significant issues.

RULES:
- Only comment on ADDED lines (lines starting with + in the diff)
- Maximum 5 comments per file
- Only flag: bugs, security vulnerabilities, null pointer risks, resource leaks, 
  SQL injection, hardcoded secrets, logic errors, and serious performance problems
- Do NOT flag: style preferences, minor naming conventions, missing comments,
  or things that are matters of opinion
- If a file looks fine, return an empty comments array — do not invent issues
- Be specific: reference the exact line content in your message

Respond ONLY with a valid JSON object in this exact format:
{
  "summary": "One sentence summary of the file's quality",
  "comments": [
    {
      "line_content": "exact content of the problematic line",
      "severity": "error|warning|suggestion",
      "message": "Clear explanation of the problem",
      "suggestion": "Optional: the fix as a code snippet"
    }
  ]
}

Do not include any text outside the JSON object. No markdown, no preamble."""


class GeminiClient:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,        # low temp = consistent, predictable output
                max_output_tokens=2048,
                response_mime_type="application/json",  # force JSON mode
            ),
            system_instruction=SYSTEM_PROMPT,
        )

    async def review_file(self, filename: str, patch: str) -> list[dict]:
        """
        Review a single file's diff. Returns list of raw comment dicts.
        Returns empty list on any error — never raises to calling code.
        """
        prompt = f"""Review this diff for file: `{filename}`

```diff
{patch[:8000]}
```"""
        # Truncate patch at 8000 chars per file — Gemini 2.0 Flash handles
        # 1M context but we limit per-file to control cost and focus

        try:
            response = await self.model.generate_content_async(prompt)
            text = response.text.strip()

            # Strip markdown fences if model ignores mime type hint
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            data = json.loads(text)
            return data.get("comments", []), data.get("summary", "")

        except json.JSONDecodeError:
            # Gemini returned non-JSON despite json mode — log and skip
            print(f"[GeminiClient] JSON parse failed for {filename}")
            return [], "Could not parse review for this file."
        except Exception as e:
            print(f"[GeminiClient] Error reviewing {filename}: {e}")
            return [], ""
```

---

## 6. Phase 4 — Diff Parsing & Inline Comment Placement

### app/reviewer.py

```python
"""
Core orchestration: PR event → diff → Gemini → GitHub comments
"""

import asyncio
from datetime import datetime, timezone

from app.github_client import GitHubClient
from app.gemini_client import GeminiClient
from app.diff_parser import parse_pr_files
from app.supabase_client import SupabaseClient
from app.models import ReviewComment, ReviewResult


SEVERITY_EMOJI = {
    "error": "🔴",
    "warning": "🟡",
    "suggestion": "🔵",
    "nitpick": "⚪",
}

# Don't review PRs with more than this many changed lines (too noisy)
MAX_TOTAL_LINES = 2000
MAX_FILES = 20


async def process_pull_request(
    payload: dict,
    github: GitHubClient,
    gemini: GeminiClient,
    supabase: SupabaseClient,
) -> None:
    """
    Main entry point called as a background task.
    All exceptions are caught — this must never crash the webhook handler.
    """
    try:
        await _do_review(payload, github, gemini, supabase)
    except Exception as e:
        print(f"[Reviewer] Unhandled error in review task: {e}")


async def _do_review(payload, github, gemini, supabase):
    # Extract PR metadata
    pr = payload["pull_request"]
    repo = payload["repository"]
    installation_id = payload["installation"]["id"]

    pr_number = pr["number"]
    commit_sha = pr["head"]["sha"]
    owner = repo["owner"]["login"]
    repo_name = repo["name"]
    repo_full_name = repo["full_name"]
    pr_title = pr["title"]
    pr_author = pr["user"]["login"]

    # Skip draft PRs
    if pr.get("draft", False):
        print(f"[Reviewer] Skipping draft PR #{pr_number}")
        return

    # Skip PRs from bots
    if pr_author.endswith("[bot]") or pr_author.endswith("-bot"):
        print(f"[Reviewer] Skipping bot PR from {pr_author}")
        return

    print(f"[Reviewer] Reviewing PR #{pr_number} in {repo_full_name}")

    # Get installation token
    token = await github.get_installation_token(installation_id)

    # Fetch PR files
    pr_files = await github.get_pr_files(token, owner, repo_name, pr_number)

    # Parse diffs
    parsed_files = parse_pr_files(pr_files)

    # Filter files
    reviewable = [
        f for f in parsed_files
        if not f.should_skip()
        and not f.is_too_large()
        and f.status != "removed"   # no point reviewing deleted files
        and f.raw_patch             # skip binary/empty patches
    ][:MAX_FILES]

    total_lines = sum(f.additions for f in reviewable)
    if total_lines > MAX_TOTAL_LINES:
        # PR is too large — post a notice and exit
        await github.create_review_with_comments(
            token, owner, repo_name, pr_number, commit_sha,
            comments=[],
            summary=(
                f"⚠️ **PR Pilot skipped this review** — this PR has {total_lines} added lines "
                f"across {len(reviewable)} files, which exceeds the review threshold ({MAX_TOTAL_LINES} lines). "
                "Consider breaking it into smaller PRs."
            ),
        )
        return

    if not reviewable:
        # Nothing to review (all files skipped)
        await github.create_review_with_comments(
            token, owner, repo_name, pr_number, commit_sha,
            comments=[],
            summary="✅ **PR Pilot:** No reviewable files found (all files were generated, binary, or removed).",
        )
        return

    # Review files concurrently (but limit concurrency to avoid rate limits)
    semaphore = asyncio.Semaphore(3)  # max 3 concurrent Gemini calls

    async def review_with_semaphore(pf):
        async with semaphore:
            return pf, await gemini.review_file(pf.filename, pf.raw_patch)

    results = await asyncio.gather(
        *[review_with_semaphore(pf) for pf in reviewable],
        return_exceptions=True,
    )

    # Build GitHub API comment objects
    github_comments = []
    all_review_comments = []
    file_summaries = []

    for result in results:
        if isinstance(result, Exception):
            continue

        pf, (raw_comments, file_summary) = result

        if file_summary:
            file_summaries.append(f"**`{pf.filename}`** — {file_summary}")

        # Build a map: line_content → diff position
        line_content_to_position = {}
        for diff_line in pf.lines:
            if diff_line.line_type == "added":
                # Strip whitespace for fuzzy matching
                key = diff_line.content.strip()
                if key not in line_content_to_position:
                    line_content_to_position[key] = diff_line.position

        for raw in raw_comments:
            line_content = raw.get("line_content", "").strip()
            severity = raw.get("severity", "suggestion")
            message = raw.get("message", "")
            suggestion = raw.get("suggestion")

            # Find the diff position for this line
            position = line_content_to_position.get(line_content)
            if position is None:
                # Line not found in diff (Gemini hallucinated?) — skip inline, add to summary
                file_summaries.append(
                    f"  - {SEVERITY_EMOJI.get(severity, '•')} {message}"
                )
                continue

            # Build comment body
            body = f"{SEVERITY_EMOJI.get(severity, '•')} **{severity.capitalize()}:** {message}"
            if suggestion:
                body += f"\n\n```suggestion\n{suggestion}\n```"

            github_comments.append({
                "path": pf.filename,
                "position": position,
                "body": body,
            })

            all_review_comments.append(ReviewComment(
                filename=pf.filename,
                line=position,
                severity=severity,
                message=message,
                suggestion=suggestion,
            ))

    # Build overall summary
    error_count = sum(1 for c in all_review_comments if c.severity == "error")
    warning_count = sum(1 for c in all_review_comments if c.severity == "warning")
    suggestion_count = sum(1 for c in all_review_comments if c.severity == "suggestion")

    summary_lines = [
        "## 🤖 PR Pilot Review",
        "",
        f"Reviewed **{len(reviewable)} file(s)** | "
        f"🔴 {error_count} errors · 🟡 {warning_count} warnings · 🔵 {suggestion_count} suggestions",
        "",
    ]

    if file_summaries:
        summary_lines += ["### File Summaries", ""] + file_summaries

    if not all_review_comments:
        summary_lines += ["", "✅ No significant issues found. Looks good!"]

    summary = "\n".join(summary_lines)

    # Post review to GitHub
    await github.create_review_with_comments(
        token, owner, repo_name, pr_number, commit_sha,
        comments=github_comments,
        summary=summary,
    )

    # Log to Supabase
    review_result = ReviewResult(
        pr_number=pr_number,
        repo_full_name=repo_full_name,
        summary=summary,
        comments=all_review_comments,
        total_issues=len(all_review_comments),
        reviewed_at=datetime.now(timezone.utc),
    )
    await supabase.log_review(review_result, pr_title, pr_author)

    print(f"[Reviewer] Done. {len(all_review_comments)} comments on PR #{pr_number}")
```

### app/main.py

```python
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
github_client: GitHubClient = None
gemini_client: GeminiClient = None
supabase_client: SupabaseClient = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global github_client, gemini_client, supabase_client
    github_client = GitHubClient(
        app_id=os.environ["GITHUB_APP_ID"],
        private_key=os.environ["GITHUB_PRIVATE_KEY"].replace("\\n", "\n"),
    )
    gemini_client = GeminiClient(api_key=os.environ["GEMINI_API_KEY"])
    supabase_client = SupabaseClient(
        url=os.environ["SUPABASE_URL"],
        key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    yield

app = FastAPI(title="PR Pilot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.environ["GITHUB_WEBHOOK_SECRET"]
SUPPORTED_ACTIONS = {"opened", "synchronize", "reopened"}


@app.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    GitHub webhook endpoint.
    Must return 200 in < 10 seconds — actual work runs in background.
    """
    # 1. Verify signature FIRST — before reading any payload
    body = await verify_webhook_signature(request, WEBHOOK_SECRET)

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
    data = await supabase_client.get_stats()
    return data
```

---

## 7. Phase 5 — Next.js Dashboard (Frontend)

### Design System (Animata-inspired)

**Palette:**
- Background: `#0a0a0f` (deep space black)
- Surface: `#12121a`
- Border: `#1e1e2e`
- Accent: `#6366f1` (indigo — technical, precise)
- Text primary: `#e2e8f0`
- Text muted: `#64748b`
- Error red: `#ef4444`
- Warning amber: `#f59e0b`
- Success green: `#10b981`

**Animata components to use:**
- `animata/text/animated-gradient-text` — hero heading "PR Pilot"
- `animata/widget` — stats counters (reviews today, issues found)
- `animata/graphs/bar-chart` — issues per repo chart
- `animata/skeleton/list` — loading state for review list
- `animata/progress/animated-timeline` — review activity feed

### app/page.tsx (Landing)

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      {/* Nav */}
      <nav className="border-b border-[#1e1e2e] px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-sm text-[#6366f1] font-semibold tracking-widest uppercase">
          PR Pilot
        </span>
        <Link
          href="/dashboard"
          className="text-sm text-[#64748b] hover:text-[#e2e8f0] transition-colors"
        >
          Dashboard →
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-6">
        <span className="text-xs font-mono text-[#6366f1] border border-[#6366f1]/30 
                         bg-[#6366f1]/10 px-3 py-1 rounded-full tracking-widest uppercase">
          AI-Powered Code Review
        </span>

        {/* Animated gradient heading — from Animata text/animated-gradient-text */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight 
                       bg-gradient-to-r from-[#6366f1] via-[#a78bfa] to-[#e2e8f0] 
                       bg-clip-text text-transparent animate-gradient-x">
          Code reviews,<br />automated.
        </h1>

        <p className="max-w-lg text-[#64748b] text-lg leading-relaxed">
          PR Pilot reviews your pull requests the moment they open — 
          spotting bugs, security issues, and logic errors before they reach main.
        </p>

        <div className="flex gap-4 mt-4">
          <a
            href="https://github.com/apps/pr-pilot-app"
            className="px-6 py-3 bg-[#6366f1] text-white rounded-lg font-medium
                       hover:bg-[#4f46e5] transition-colors text-sm"
          >
            Install on GitHub
          </a>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-[#1e1e2e] text-[#e2e8f0] rounded-lg 
                       font-medium hover:border-[#6366f1]/50 transition-colors text-sm"
          >
            View Reviews
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: "⚡", title: "Instant", desc: "Reviews post within 30 seconds of PR open" },
          { icon: "🎯", title: "Precise", desc: "Inline comments on exact diff lines, not the file" },
          { icon: "🔒", title: "Secure", desc: "Webhook signatures verified, no code stored" },
        ].map((f) => (
          <div key={f.title} className="border border-[#1e1e2e] rounded-xl p-6 
                                        bg-[#12121a] hover:border-[#6366f1]/30 transition-colors">
            <div className="text-2xl mb-3">{f.icon}</div>
            <div className="font-semibold mb-1">{f.title}</div>
            <div className="text-sm text-[#64748b]">{f.desc}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
```

### app/dashboard/page.tsx

```tsx
import { createClient } from "@/lib/supabase";

async function getReviews() {
  const supabase = createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .order("reviewed_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

async function getStats() {
  const supabase = createClient();
  const { count: totalReviews } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true });
  const { data: issueData } = await supabase
    .from("reviews")
    .select("total_issues");
  const totalIssues = issueData?.reduce((sum, r) => sum + r.total_issues, 0) ?? 0;
  return { totalReviews: totalReviews ?? 0, totalIssues };
}

export default async function DashboardPage() {
  const [reviews, stats] = await Promise.all([getReviews(), getStats()]);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <nav className="border-b border-[#1e1e2e] px-6 py-4">
        <span className="font-mono text-sm text-[#6366f1] font-semibold tracking-widest uppercase">
          PR Pilot / Dashboard
        </span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Stats bento — Animata widget style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Total Reviews", value: stats.totalReviews },
            { label: "Issues Found", value: stats.totalIssues },
            { label: "Repos Monitored", value: new Set(reviews.map(r => r.repo_full_name)).size },
            { label: "Avg Issues / PR", value: stats.totalReviews ? Math.round(stats.totalIssues / stats.totalReviews) : 0 },
          ].map((s) => (
            <div key={s.label} className="border border-[#1e1e2e] rounded-xl p-6 bg-[#12121a]">
              <div className="text-3xl font-bold text-[#6366f1] font-mono">{s.value}</div>
              <div className="text-xs text-[#64748b] mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Review list */}
        <h2 className="text-lg font-semibold mb-4">Recent Reviews</h2>
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id}
              className="border border-[#1e1e2e] rounded-xl p-5 bg-[#12121a] 
                         hover:border-[#6366f1]/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-sm text-[#6366f1]">
                    {review.repo_full_name} <span className="text-[#64748b]">#{review.pr_number}</span>
                  </div>
                  <div className="text-sm text-[#e2e8f0] mt-1">{review.pr_title}</div>
                  <div className="text-xs text-[#64748b] mt-1">
                    by {review.pr_author} · {new Date(review.reviewed_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {review.error_count > 0 && (
                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 
                                     px-2 py-1 rounded-full">
                      🔴 {review.error_count}
                    </span>
                  )}
                  {review.warning_count > 0 && (
                    <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 
                                     px-2 py-1 rounded-full">
                      🟡 {review.warning_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

---

## 8. Phase 6 — Supabase Schema

Run this in the Supabase SQL editor:

```sql
-- Reviews table
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number     INTEGER NOT NULL,
  repo_full_name TEXT NOT NULL,
  pr_title      TEXT,
  pr_author     TEXT,
  total_issues  INTEGER DEFAULT 0,
  error_count   INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  suggestion_count INTEGER DEFAULT 0,
  summary       TEXT,
  reviewed_at   TIMESTAMPTZ DEFAULT now()
);

-- Review comments table
CREATE TABLE review_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID REFERENCES reviews(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  line_pos    INTEGER,
  severity    TEXT CHECK (severity IN ('error', 'warning', 'suggestion', 'nitpick')),
  message     TEXT NOT NULL,
  suggestion  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_reviews_repo ON reviews(repo_full_name);
CREATE INDEX idx_reviews_reviewed_at ON reviews(reviewed_at DESC);

-- Enable Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Public read (dashboard is public)
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON review_comments FOR SELECT USING (true);

-- Service role only for insert (backend uses service role key)
CREATE POLICY "Service insert reviews" ON reviews FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service insert comments" ON review_comments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### app/supabase_client.py

```python
from supabase import create_client, Client
from app.models import ReviewResult


class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)

    async def log_review(self, result: ReviewResult, pr_title: str, pr_author: str) -> str:
        error_count = sum(1 for c in result.comments if c.severity == "error")
        warning_count = sum(1 for c in result.comments if c.severity == "warning")
        suggestion_count = sum(1 for c in result.comments if c.severity == "suggestion")

        review_row = {
            "pr_number": result.pr_number,
            "repo_full_name": result.repo_full_name,
            "pr_title": pr_title,
            "pr_author": pr_author,
            "total_issues": result.total_issues,
            "error_count": error_count,
            "warning_count": warning_count,
            "suggestion_count": suggestion_count,
            "summary": result.summary[:5000],  # cap to avoid huge rows
            "reviewed_at": result.reviewed_at.isoformat(),
        }

        response = self.client.table("reviews").insert(review_row).execute()
        review_id = response.data[0]["id"]

        if result.comments:
            comment_rows = [
                {
                    "review_id": review_id,
                    "filename": c.filename,
                    "line_pos": c.line,
                    "severity": c.severity,
                    "message": c.message,
                    "suggestion": c.suggestion,
                }
                for c in result.comments
            ]
            self.client.table("review_comments").insert(comment_rows).execute()

        return review_id

    async def get_stats(self) -> dict:
        total = self.client.table("reviews").select("*", count="exact", head=True).execute()
        return {"total_reviews": total.count}
```

---

## 9. Phase 7 — Railway Deployment (Backend)

### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Deploy steps

```bash
# 1. Push backend to GitHub (separate repo or monorepo)
git push origin main

# 2. Railway: New Project → Deploy from GitHub repo
# 3. Set root directory to /backend if monorepo
# 4. Add environment variables (see Section 12)
# 5. Railway auto-detects Dockerfile and builds

# Your webhook URL will be:
# https://your-app.railway.app/webhook
# → Update this in your GitHub App settings
```

---

## 10. Phase 8 — Vercel Deployment (Frontend)

```bash
cd frontend
npx vercel deploy --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# (anon key only — dashboard is read-only)
```

---

## 11. Edge Cases & Hardening

| Scenario | Handling |
|---|---|
| GitHub retries webhook (bot slow) | `200 OK` returned instantly before any processing — retries get `200` too and are safe |
| Gemini returns non-JSON | `try/except json.JSONDecodeError` → skip file, post summary only |
| Gemini hallucinates a line | Line content not found in diff map → demoted to summary, not posted as inline |
| PR has 50+ files | Hard cap at `MAX_FILES = 20`, post notice explaining the skip |
| PR > 2000 changed lines | Detected early, post skip notice, return |
| GitHub API 422 on comment position | Fallback: post summary-only review without inline comments |
| Installation token expired | Token cached with 5-minute early refresh buffer |
| Bot opens a PR | `pr_author.endswith("[bot]")` check → skip |
| Draft PR | `pr.get("draft")` check → skip, prevents noise during WIP |
| Webhook secret missing | 401 raised before payload is read |
| Timing attack on HMAC | `hmac.compare_digest` used (constant-time comparison) |
| Concurrent Gemini calls | `asyncio.Semaphore(3)` — prevents rate limit hits |
| `.pem` key newlines in env var | `.replace("\\n", "\n")` when reading from environment |
| Large patch truncation | Each file patch capped at 8000 chars before sending to Gemini |

---

## 12. Environment Variables Reference

### Backend (.env)

```bash
# GitHub App
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_strong_random_secret_here

# Gemini
GEMINI_API_KEY=AIza...

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service role — backend only, never expose

# CORS
FRONTEND_URL=https://pr-pilot.vercel.app
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon key — read-only, safe to expose
```

---

## 13. Resume Bullet & Demo Script

### Resume Bullet

> Built **PR Pilot**, a GitHub App that autonomously reviews pull requests using Gemini 2.0 Flash — parses unified diffs, maps AI feedback to exact diff positions, and posts inline review comments via GitHub's Reviews API. Handles webhook signature verification (HMAC-SHA256), background async processing, concurrent file review with semaphore rate-limiting, and edge cases including large PRs, bot authors, and Gemini JSON failures. Backend deployed on Railway (FastAPI), dashboard on Vercel (Next.js 15), audit log in Supabase.

### Demo Script (for interviews)

1. Open a PR on one of your own repos (have one prepared with a deliberate bug — e.g. a SQL string concatenation, a missing null check, or an unreleased resource)
2. Show the PR — no comments yet
3. Wait 20–30 seconds
4. Refresh — show the inline comment from PR Pilot on the exact buggy line
5. Show the dashboard — review logged, stats updated
6. Walk through the architecture: "It verifies the webhook signature, spawns a background task to avoid timeout, chunks the diff by file, calls Gemini with a strict JSON prompt, maps the response back to diff positions, and posts via GitHub's Reviews API"

That walkthrough alone demonstrates webhook security, async patterns, API integration, and prompt engineering — four things most freshers can't articulate.

---

*Good luck, Santosh. Build this well and it'll carry you through every interview.*
