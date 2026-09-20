from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import datetime, timezone
from enum import Enum


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    SUGGESTION = "suggestion"


class ReviewComment(BaseModel):
    filename: str
    line_pos: int = 1
    severity: Severity = Severity.SUGGESTION
    message: str
    suggestion: Optional[str] = None

    def __init__(self, **data):
        # Support both 'line' and 'line_pos'
        if "line" in data and "line_pos" not in data:
            data["line_pos"] = data.pop("line")
        super().__init__(**data)

    @field_validator("line_pos")
    @classmethod
    def line_pos_must_be_positive(cls, v):
        try:
            val = int(v)
            return val if val >= 1 else 1
        except Exception:
            return 1

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v):
        if not v or not str(v).strip():
            raise ValueError("message must not be empty")
        return str(v).strip()


class GeminiFileReview(BaseModel):
    comments: List[ReviewComment] = []
    file_summary: Optional[str] = None


class ReviewResult(BaseModel):
    """Result model used by reviewer orchestration."""
    pr_number: int
    repo_full_name: str
    summary: str
    comments: List[ReviewComment] = []
    total_issues: int = 0
    delivery_id: Optional[str] = ""
    reviewed_at: Optional[datetime] = None


class ReviewRecord(BaseModel):
    installation_id: int
    pr_number: int
    repo_full_name: str
    pr_title: str
    pr_author: str
    total_issues: int
    error_count: int
    warning_count: int
    suggestion_count: int
    summary: str
    delivery_id: str
    status: str = "posted"
    error_reason: Optional[str] = None
    prompt_version: str = "v1"


class WebhookJob(BaseModel):
    delivery_id: str
    payload: dict
    status: str = "pending"


class InstallationRecord(BaseModel):
    installation_id: int
    account_login: str
    account_type: str
    installed_at: Optional[datetime] = None
    suspended: bool = False
