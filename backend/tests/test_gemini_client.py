import pytest
from app.gemini_client import (
    _extract_json_text,
    _parse_gemini_response,
    _truncate_diff,
    MAX_DIFF_CHARS,
)
from app.models import Severity

def test_extract_json_with_markdown_fences():
    raw = """Here is your review:
```json
{
  "comments": [
    {
      "filename": "auth.py",
      "line_pos": 14,
      "severity": "error",
      "message": "Potential SQL injection vulnerability",
      "suggestion": "cursor.execute('SELECT * FROM users WHERE id = %s', (uid,))"
    }
  ],
  "file_summary": "Security risk identified in user queries."
}
```
Hope this helps!"""

    extracted = _extract_json_text(raw)
    assert extracted.startswith("{")
    assert extracted.endswith("}")
    assert "Potential SQL injection vulnerability" in extracted


def test_parse_gemini_response_valid():
    raw = """{
        "comments": [
            {
                "filename": "server.py",
                "line_pos": 5,
                "severity": "warning",
                "message": "Missing timeout in HTTP request",
                "suggestion": "httpx.get(url, timeout=10.0)"
            }
        ],
        "file_summary": "Clean code with minor warning."
    }"""
    review = _parse_gemini_response(raw, "server.py")
    assert len(review.comments) == 1
    c = review.comments[0]
    assert c.filename == "server.py"
    assert c.line_pos == 5
    assert c.severity == Severity.WARNING
    assert c.message == "Missing timeout in HTTP request"
    assert c.suggestion == "httpx.get(url, timeout=10.0)"
    assert review.file_summary == "Clean code with minor warning."


def test_parse_gemini_response_salvages_partial_errors():
    raw = """{
        "comments": [
            {
                "filename": "good.py",
                "line_pos": 10,
                "severity": "error",
                "message": "Resource leak: file not closed",
                "suggestion": null
            },
            {
                "filename": "bad.py",
                "line_pos": -5,
                "severity": "invalid_severity",
                "message": ""
            }
        ],
        "file_summary": null
    }"""
    review = _parse_gemini_response(raw, "good.py")
    # Bad comment has empty message, should be skipped; good comment should be retained
    assert len(review.comments) == 1
    assert review.comments[0].message == "Resource leak: file not closed"


def test_parse_gemini_response_invalid_json():
    raw = "This is not json at all"
    review = _parse_gemini_response(raw, "foo.py")
    assert len(review.comments) == 0
    assert review.file_summary is None


def test_truncate_diff():
    short_diff = "diff --git a/x b/x\n+print(1)"
    assert _truncate_diff(short_diff, "x.py") == short_diff

    huge_diff = "a" * (MAX_DIFF_CHARS + 1000)
    truncated = _truncate_diff(huge_diff, "huge.py")
    assert len(truncated) < len(huge_diff)
    assert "[TRUNCATED" in truncated
