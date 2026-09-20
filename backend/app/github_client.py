import base64
import logging
import os
import time
from typing import Optional, List, Dict, Any
from pathlib import Path

import httpx
import jwt

logger = logging.getLogger(__name__)


def _load_private_key(explicit_key: Optional[str] = None) -> Optional[str]:
    """
    Load the GitHub App private key from explicit arg, env var (base64 or raw PEM),
    or by looking for a local .pem file in the workspace.
    """
    if explicit_key:
        return explicit_key

    # 1. Check env var
    env_key = os.environ.get("GITHUB_PRIVATE_KEY", "")
    if env_key:
        env_key_clean = env_key.strip()
        # If raw PEM text
        if "BEGIN " in env_key_clean and "PRIVATE KEY" in env_key_clean:
            return env_key_clean
        # Try base64 decode
        try:
            decoded = base64.b64decode(env_key_clean).decode("utf-8")
            if "BEGIN " in decoded and "PRIVATE KEY" in decoded:
                return decoded
        except Exception:
            pass
        # If env_key is a file path to a .pem file
        if os.path.exists(env_key_clean) and os.path.isfile(env_key_clean):
            try:
                content = Path(env_key_clean).read_text(encoding="utf-8")
                if "BEGIN " in content:
                    return content
            except Exception:
                pass

    # 2. Check path env var or default workspace pem file
    key_path = os.environ.get("GITHUB_PRIVATE_KEY_PATH", "")
    if key_path and os.path.exists(key_path):
        with open(key_path, "r", encoding="utf-8") as f:
            return f.read()

    # Look for any .pem file in parent directories
    for search_dir in [Path.cwd(), Path.cwd().parent]:
        for pem in search_dir.glob("*.pem"):
            try:
                content = pem.read_text(encoding="utf-8")
                if "PRIVATE KEY" in content:
                    return content
            except Exception:
                continue

    return None


class GitHubClient:
    def __init__(self, app_id: Optional[str] = None, private_key: Optional[str] = None):
        self.app_id = app_id or os.environ.get("GITHUB_APP_ID", "")
        self.private_key = _load_private_key(private_key)
        self._installation_tokens: dict[int, tuple[str, float]] = {}

    def _generate_jwt(self) -> str:
        """Generate a short-lived RS256 JWT to authenticate as the GitHub App."""
        if not self.app_id:
            raise ValueError("GITHUB_APP_ID is not configured")
        if not self.private_key:
            raise ValueError("GITHUB_PRIVATE_KEY is not configured")

        now = int(time.time())
        payload = {
            "iat": now - 60,      # issued 60s ago for clock skew buffer
            "exp": now + 500,     # expires in 500s (exp - iat = 560s <= 600s max allowed by GitHub)
            "iss": str(self.app_id),
        }
        return jwt.encode(payload, self.private_key, algorithm="RS256")

    async def get_installation_token(self, installation_id: int) -> str:
        """
        Exchange App JWT for an installation access token.
        Cached per installation_id and refreshed 5 min before expiry.
        """
        cached = self._installation_tokens.get(installation_id)
        if cached and time.time() < cached[1] - 300:
            return cached[0]

        jwt_token = self._generate_jwt()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.github.com/app/installations/{installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {jwt_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        token = data["token"]
        expires_at = time.time() + 3600
        self._installation_tokens[installation_id] = (token, expires_at)
        return token

    async def get_installations(self) -> list[dict]:
        """Fetch all installations of this GitHub App."""
        jwt_token = self._generate_jwt()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://api.github.com/app/installations",
                headers={
                    "Authorization": f"Bearer {jwt_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            if resp.status_code != 200:
                logger.warning(f"[github] Could not fetch installations: {resp.status_code}")
                return []
            return resp.json()

    async def get_all_installed_repositories(self) -> list[dict]:
        """Fetch all repositories across all installations of the GitHub App."""
        installations = await self.get_installations()
        all_repos = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for inst in installations:
                inst_id = inst.get("id")
                if not inst_id:
                    continue
                try:
                    token = await self.get_installation_token(inst_id)
                    resp = await client.get(
                        "https://api.github.com/installation/repositories",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/vnd.github+json",
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                        params={"per_page": 100},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for repo in data.get("repositories", []):
                            all_repos.append({
                                "full_name": repo.get("full_name"),
                                "name": repo.get("name"),
                                "owner": repo.get("owner", {}).get("login"),
                                "private": repo.get("private", False),
                                "html_url": repo.get("html_url"),
                                "description": repo.get("description"),
                                "open_issues_count": repo.get("open_issues_count", 0),
                                "installation_id": inst_id,
                            })
                except Exception as e:
                    logger.warning(f"[github] Could not fetch repos for installation {inst_id}: {e}")
        return all_repos

    async def get_pr_diff(self, token: str, owner: str, repo: str, pr_number: int) -> str:
        """Fetch the raw unified diff of a PR using Accept: application/vnd.github.diff."""
        async with httpx.AsyncClient(timeout=45.0) as client:
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

    async def get_pr_metadata(self, token: str, owner: str, repo: str, pr_number: int) -> dict:
        """Fetch PR details (head sha, title, state, base)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def get_pr_files(self, token: str, owner: str, repo: str, pr_number: int) -> list[dict]:
        """Get structured file list for a PR."""
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

    async def post_summary_comment(self, token: str, owner: str, repo: str, pr_number: int, body: str) -> dict:
        """Post a general markdown comment to the PR issue thread."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json={"body": body},
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
    ) -> dict:
        """
        Post a GitHub PR Review with inline comments using the Reviews API.
        Includes 422 fallback: if inline positions are invalid, gracefully
        posts the review with formatted line comments in the review summary body.
        """
        payload: Dict[str, Any] = {
            "commit_id": commit_sha,
            "body": summary,
            "event": "COMMENT",
        }
        if comments:
            payload["comments"] = comments

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json=payload,
            )

            # If GitHub rejects comments (422 Unprocessable Entity for invalid diff positions)
            if resp.status_code == 422:
                logger.warning(
                    f"[github] Received 422 when posting inline comments on {owner}/{repo}#{pr_number}. "
                    "Falling back to summary review with structured comments."
                )
                fallback_summary = summary + "\n\n### 📝 Review Feedback\n"
                for c in comments:
                    path = c.get("path", "file")
                    pos = c.get("position") or c.get("line") or "?"
                    body = c.get("body", "")
                    fallback_summary += f"\n- **`{path}` (line/pos {pos})**:\n  {body}\n"

                fallback_payload = {
                    "commit_id": commit_sha,
                    "body": fallback_summary,
                    "event": "COMMENT",
                }
                fallback_resp = await client.post(
                    f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    json=fallback_payload,
                )
                fallback_resp.raise_for_status()
                return fallback_resp.json()

            resp.raise_for_status()
            return resp.json()


# ── Global singleton and convenience functions ─────────────────────────────────

_default_client: Optional[GitHubClient] = None


def get_github_client() -> GitHubClient:
    global _default_client
    if _default_client is None:
        _default_client = GitHubClient()
    return _default_client


def _split_repo(repo_full_name: str) -> tuple[str, str]:
    parts = repo_full_name.split("/")
    if len(parts) == 2:
        return parts[0], parts[1]
    return repo_full_name, repo_full_name


async def fetch_pr_diff(installation_id: int, repo_full_name: str, pr_number: int) -> str:
    """Convenience helper to fetch diff for a PR."""
    client = get_github_client()
    token = await client.get_installation_token(installation_id)
    owner, repo = _split_repo(repo_full_name)
    return await client.get_pr_diff(token, owner, repo, pr_number)


async def get_pr_metadata(installation_id: int, repo_full_name: str, pr_number: int) -> dict:
    """Convenience helper to fetch PR metadata."""
    client = get_github_client()
    token = await client.get_installation_token(installation_id)
    owner, repo = _split_repo(repo_full_name)
    return await client.get_pr_metadata(token, owner, repo, pr_number)


async def post_summary_comment(installation_id: int, repo_full_name: str, pr_number: int, body: str) -> dict:
    """Convenience helper to post a comment to a PR issue thread."""
    client = get_github_client()
    token = await client.get_installation_token(installation_id)
    owner, repo = _split_repo(repo_full_name)
    return await client.post_summary_comment(token, owner, repo, pr_number, body)


async def post_inline_review(
    installation_id: int,
    repo_full_name: str,
    pr_number: int,
    diff_text: str,
    comments: list,
    summary: str,
    commit_sha: Optional[str] = None,
) -> dict:
    """
    Format comments and post as an inline review via GitHub Reviews API.
    If commit_sha is not provided, it is fetched automatically.
    """
    from app.diff_parser import parse_diff_to_file_chunks, _parse_patch

    client = get_github_client()
    token = await client.get_installation_token(installation_id)
    owner, repo = _split_repo(repo_full_name)

    if not commit_sha:
        meta = await client.get_pr_metadata(token, owner, repo, pr_number)
        commit_sha = meta.get("head", {}).get("sha", "")

    # Build map of (filename, line_pos) -> diff position
    chunks = parse_diff_to_file_chunks(diff_text)
    file_patch_positions: dict[str, dict[int, int]] = {}
    for filename, patch in chunks.items():
        parsed_lines = _parse_patch(patch)
        # Map line_number -> position
        file_patch_positions[filename] = {
            l.line_number: l.position for l in parsed_lines if l.line_type == "added"
        }

    formatted_comments: list[dict] = []
    unplaced_comments: list[str] = []

    for c in comments:
        # Support both Pydantic model and dict
        c_dict = c.model_dump() if hasattr(c, "model_dump") else (c if isinstance(c, dict) else c.__dict__)
        filename = c_dict.get("filename", "")
        line_pos = c_dict.get("line_pos", 1)
        severity = c_dict.get("severity", "suggestion")
        message = c_dict.get("message", "")
        suggestion = c_dict.get("suggestion")

        sev_emoji = {"error": "🔴", "warning": "🟡", "suggestion": "🔵"}.get(severity, "💡")
        body = f"{sev_emoji} **{severity.upper()}:** {message}"
        if suggestion:
            body += f"\n\n```suggestion\n{suggestion}\n```"

        pos_map = file_patch_positions.get(filename, {})
        # If line_pos directly maps to a diff position
        diff_pos = pos_map.get(line_pos)

        # Fallback: if line_pos is already a diff position within range
        if diff_pos is None:
            # Check if line_pos is valid position
            diff_pos = line_pos if line_pos > 0 else 1

        if filename:
            formatted_comments.append({
                "path": filename,
                "position": diff_pos,
                "body": body,
            })
        else:
            unplaced_comments.append(f"- **{severity.upper()}**: {message}")

    review_body = summary
    if unplaced_comments:
        review_body += "\n\n### Additional Feedback\n" + "\n".join(unplaced_comments)

    return await client.create_review_with_comments(
        token=token,
        owner=owner,
        repo=repo,
        pr_number=pr_number,
        commit_sha=commit_sha,
        comments=formatted_comments,
        summary=review_body,
    )
