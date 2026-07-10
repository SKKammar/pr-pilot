# PR Pilot 🤖

> Automated AI code reviews for every pull request — powered by Gemini 2.0 Flash.

[![Live Demo](https://img.shields.io/badge/demo-live-6366f1?style=flat-square)](https://pr-pilot-six.vercel.app)
[![Backend](https://img.shields.io/badge/backend-render-green?style=flat-square)](https://pr-pilot-backend.onrender.com/health)
[![GitHub App](https://img.shields.io/badge/github%20app-install-black?style=flat-square&logo=github)](https://github.com/apps/pilot-by-santosh)

## What it does

PR Pilot is a GitHub App that triggers on every pull request open/update, reviews the diff using Gemini 2.0 Flash, and posts **inline comments on exact diff lines** — just like a senior engineer would.

**In 30 seconds or less:**
1. You open a PR
2. PR Pilot fetches the diff
3. Gemini reviews each file independently
4. Inline comments appear on the exact lines with issues

## Architecture

```text
GitHub PR Event
      │
      ▼
FastAPI Webhook (Render)
      │
      ├── Verify HMAC-SHA256 signature
      ├── Return 200 OK immediately
      └── Background task:
            ├── Fetch diff via GitHub REST API
            ├── Parse unified diff → file chunks
            ├── Filter noise (lockfiles, binaries, generated)
            ├── Call Gemini 2.0 Flash per file (concurrent, semaphore-limited)
            ├── Map AI feedback → exact diff positions
            ├── Post inline review via GitHub Reviews API
            └── Log to Supabase
                    │
                    ▼
            Next.js Dashboard (Vercel)
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI · Python 3.12 |
| AI | Gemini 2.0 Flash (Google) |
| GitHub Integration | GitHub App · Webhooks · REST API |
| Frontend | Next.js 15 · App Router · Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Backend Deploy | Render |
| Frontend Deploy | Vercel |

## Key Engineering Decisions

- **Background task pattern** — webhook returns `200 OK` in < 500ms, preventing GitHub retries
- **File-chunked reviews** — each file reviewed independently, avoids token overflow
- **Diff position mapping** — parses unified diff format to map AI feedback to exact GitHub diff positions (the hardest part)
- **HMAC-SHA256 verification** — `hmac.compare_digest` for timing-attack-safe signature check
- **Semaphore-limited concurrency** — max 3 concurrent Gemini calls to avoid rate limits
- **Graceful degradation** — 422 fallback posts summary-only if inline positions are invalid

## What it catches

- 🔴 **Errors** — null pointer risks, resource leaks, SQL injection, hardcoded secrets, logic bugs
- 🟡 **Warnings** — missing error handling, unsafe type casts, deprecated API usage
- 🔵 **Suggestions** — performance improvements, cleaner patterns

## What it skips (intentionally)

- Draft PRs
- Bot-authored PRs
- PRs with > 2000 changed lines (posts a notice instead)
- `package-lock.json`, `yarn.lock`, `*.min.js`, migrations, binaries

## Local Setup

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

### ngrok (for local webhook testing)
```bash
ngrok http 8000
# Paste the https URL into your GitHub App webhook settings
```

## Environment Variables

### Backend
| Variable | Description |
|---|---|
| `GITHUB_APP_ID` | Your GitHub App's numeric ID |
| `GITHUB_PRIVATE_KEY` | Contents of the `.pem` private key file |
| `GITHUB_WEBHOOK_SECRET` | Random secret set in GitHub App settings |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) |
| `FRONTEND_URL` | Vercel URL for CORS |

### Frontend
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (read-only) |

## Install the GitHub App

[**→ Install PR Pilot on your repository**](https://github.com/apps/pilot-by-santosh)

---

Built by [Santosh K Kammar](https://github.com/SKKammar)
