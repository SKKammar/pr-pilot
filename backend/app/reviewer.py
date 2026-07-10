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
    github: GitHubClient | None,
    gemini: GeminiClient | None,
    supabase: SupabaseClient | None,
) -> None:
    """
    Main entry point called as a background task.
    All exceptions are caught — this must never crash the webhook handler.
    """
    if not github or not gemini or not supabase:
        print("[Reviewer] Clients not initialized properly.")
        return
        
    try:
        await _do_review(payload, github, gemini, supabase)
    except Exception as e:
        print(f"[Reviewer] Unhandled error in review task: {e}")


async def _do_review(payload: dict, github: GitHubClient, gemini: GeminiClient, supabase: SupabaseClient):
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
