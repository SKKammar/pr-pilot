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
        if not self.app_id or not self.private_key:
            raise ValueError("GitHub App ID and Private Key must be configured")
        
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
        self, token: str, owner: str, repo: str, pr_number: int, commit_sha: str, summary: str
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
