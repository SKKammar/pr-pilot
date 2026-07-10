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
