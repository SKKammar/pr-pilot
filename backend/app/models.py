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
    suggestion: Optional[str] = None     # optional code fix

class ReviewResult(BaseModel):
    pr_number: int
    repo_full_name: str
    summary: str
    comments: list[ReviewComment]
    total_issues: int
    reviewed_at: datetime
