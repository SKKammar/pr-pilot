import os
import json
import asyncio
import logging
import re
from typing import List, Optional, Tuple, Any
from pydantic import ValidationError

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

from app.models import GeminiFileReview, ReviewComment, Severity

logger = logging.getLogger(__name__)

# ── Prompt versioning ────────────────────────────────────────────────────────
PROMPT_VERSION = "v1"

SYSTEM_PROMPT_V1 = """You are a world-class principal software engineer performing an automated code review on a pull request.
You will receive a unified diff for a single file.
Your job is to identify real, high-impact issues only — not stylistic preferences or bikeshedding.

You MUST respond with valid JSON only. No prose. No markdown fences. No explanation outside the JSON.

Return this exact JSON structure:
{
  "comments": [
    {
      "filename": "<exact filename from diff header>",
      "line_pos": <integer, line number in the new version of the file or diff position>,
      "severity": "<error|warning|suggestion>",
      "message": "<concise description of the issue and why it matters>",
      "suggestion": "<optional: replacement code block or null>"
    }
  ],
  "file_summary": "<one concise sentence summarizing code quality or null>"
}

Severity classification rules:
- error: null pointer risk, resource leak, SQL injection, hardcoded secret, logic bug, security vulnerability, data loss
- warning: missing error handling, unhandled edge cases, unsafe cast, deprecated API, race condition, missing transaction
- suggestion: performance optimization, cleaner idiomatic pattern, readability, simplification

If you find no issues, return: {"comments": [], "file_summary": null}
Do not invent imaginary issues. Focus on correctness, safety, and reliability."""

# ── Token budget guard ───────────────────────────────────────────────────────
MAX_DIFF_CHARS = 80_000  # ~20k tokens, safe for Gemini Flash

_genai_configured = False


def _ensure_genai_configured(api_key: Optional[str] = None):
    """Lazily configure Google Generative AI."""
    global _genai_configured
    if _genai_configured:
        return

    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if key and HAS_GENAI:
        try:
            genai.configure(api_key=key)
            _genai_configured = True
        except Exception as e:
            logger.warning(f"[gemini] Could not configure genai: {e}")


def _truncate_diff(diff_chunk: str, filename: str) -> str:
    if len(diff_chunk) <= MAX_DIFF_CHARS:
        return diff_chunk
    truncated = diff_chunk[:MAX_DIFF_CHARS]
    logger.warning(f"[gemini] Diff for {filename} truncated from {len(diff_chunk)} to {MAX_DIFF_CHARS} chars")
    return truncated + f"\n\n[TRUNCATED: diff exceeded {MAX_DIFF_CHARS} chars. Review partial diff above only.]"


# ── Retry logic ──────────────────────────────────────────────────────────────
async def _call_gemini_with_retry(model, prompt: str, max_retries: int = 3) -> Optional[str]:
    delay = 1.0
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(model.generate_content, prompt)
            return response.text
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate" in err_str or "resourceexhausted" in err_str:
                if attempt < max_retries - 1:
                    wait = delay * (2 ** attempt) + (asyncio.get_event_loop().time() % 0.5)
                    logger.warning(f"[gemini] Rate limited, retrying in {wait:.1f}s (attempt {attempt + 1})")
                    await asyncio.sleep(wait)
                    continue
            logger.error(f"[gemini] API error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                raise
    return None


# ── Output parser ────────────────────────────────────────────────────────────
def _extract_json_text(raw: str) -> str:
    """Extract valid JSON string from raw text that might include markdown fences or preamble."""
    cleaned = raw.strip()
    # If wrapped in markdown code blocks: ```json ... ``` or ``` ... ```
    if "```" in cleaned:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    # Find first { and last }
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return cleaned[first_brace : last_brace + 1]

    return cleaned


def _parse_gemini_response(raw: str, filename: str) -> GeminiFileReview:
    """
    Parse and validate Gemini JSON output.
    Recovers valid comments individually if any single comment fails validation.
    Never raises — returns empty review on fatal parse failure.
    """
    if not raw or not raw.strip():
        logger.warning(f"[gemini] Empty response for {filename}")
        return GeminiFileReview()

    json_str = _extract_json_text(raw)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"[gemini] JSON parse error for {filename}: {e}\nRaw preview: {raw[:300]}")
        return GeminiFileReview()

    if not isinstance(data, dict):
        return GeminiFileReview()

    raw_comments = data.get("comments", [])
    valid_comments: List[ReviewComment] = []

    for item in raw_comments:
        if not isinstance(item, dict):
            continue
        try:
            # Ensure line_pos is positive int
            line_pos = item.get("line_pos", 1)
            try:
                line_pos = int(line_pos)
            except (ValueError, TypeError):
                line_pos = 1
            if line_pos < 1:
                line_pos = 1

            # Ensure severity
            sev = str(item.get("severity", "suggestion")).lower()
            if sev not in ("error", "warning", "suggestion"):
                sev = "suggestion"

            msg = str(item.get("message", "")).strip()
            if not msg:
                continue

            valid_comments.append(ReviewComment(
                filename=item.get("filename") or filename,
                line_pos=line_pos,
                severity=Severity(sev),
                message=msg,
                suggestion=item.get("suggestion") or None,
            ))
        except (ValidationError, Exception) as val_err:
            logger.debug(f"[gemini] Skipped invalid comment in {filename}: {val_err}")

    file_summary = data.get("file_summary")
    if file_summary and not isinstance(file_summary, str):
        file_summary = str(file_summary)

    return GeminiFileReview(comments=valid_comments, file_summary=file_summary)


# ── Public API ───────────────────────────────────────────────────────────────
async def review_file(
    filename: str,
    diff_chunk: str,
    semaphore: Optional[asyncio.Semaphore] = None,
    api_key: Optional[str] = None,
) -> GeminiFileReview:
    """Review a single file diff. Returns a validated GeminiFileReview."""
    _ensure_genai_configured(api_key)

    if not HAS_GENAI:
        logger.warning("[gemini] google-generativeai is not installed")
        return GeminiFileReview()

    safe_diff = _truncate_diff(diff_chunk, filename)
    prompt = f"File: {filename}\n\nDiff:\n{safe_diff}"

    candidate_models = ["gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"]

    async def _execute():
        for model_name in candidate_models:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=SYSTEM_PROMPT_V1,
                )
                raw = await _call_gemini_with_retry(model, prompt)
                if raw:
                    return _parse_gemini_response(raw, filename)
            except Exception as e:
                logger.warning(f"[gemini] Model {model_name} failed: {e}. Trying fallback.")
                continue
        return GeminiFileReview()

    try:
        if semaphore:
            async with semaphore:
                return await _execute()
        else:
            return await _execute()
    except Exception as e:
        logger.error(f"[gemini] Failed to review {filename}: {e}")
        return GeminiFileReview()


async def review_all_files(file_diffs: dict) -> Tuple[List[ReviewComment], str, str]:
    """
    Review all files concurrently with semaphore limiting.
    Returns: (all_comments, combined_summary, prompt_version)
    """
    if not file_diffs:
        return [], "No reviewable files provided.", PROMPT_VERSION

    semaphore = asyncio.Semaphore(3)
    tasks = {
        filename: review_file(filename, diff_chunk, semaphore)
        for filename, diff_chunk in file_diffs.items()
    }

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    all_comments: List[ReviewComment] = []
    summaries: list[str] = []

    for filename, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.error(f"[gemini] Unhandled exception for {filename}: {result}")
            continue
        if isinstance(result, GeminiFileReview):
            all_comments.extend(result.comments)
            if result.file_summary:
                summaries.append(f"**`{filename}`**: {result.file_summary}")

    combined_summary = (
        "\n".join(summaries)[:5000]
        if summaries
        else "PR Pilot completed file-by-file code review."
    )
    return all_comments, combined_summary, PROMPT_VERSION


class GeminiClient:
    """Backwards-compatible client wrapper for existing code/tests."""
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        _ensure_genai_configured(self.api_key)

    async def review_file(self, filename: str, diff_chunk: str) -> Tuple[list, Optional[str]]:
        sem = asyncio.Semaphore(1)
        res = await review_file(filename, diff_chunk, sem, self.api_key)
        raw_comments = [c.model_dump() for c in res.comments]
        return raw_comments, res.file_summary
