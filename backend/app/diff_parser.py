"""
Parse unified diff format into structured chunks per file.

CRITICAL: GitHub's inline comment API requires `position` — the line number
within the diff hunk (starting at 1 for the first `@@` line), NOT the
file's actual line number. This parser builds that mapping.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

# Files to skip — generated, binary, lockfiles
SKIP_PATTERNS = [
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"pnpm-lock\.yaml$",
    r"poetry\.lock$",
    r"Pipfile\.lock$",
    r"composer\.lock$",
    r"Cargo\.lock$",
    r"\.min\.(js|css)$",
    r"\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf|zip|tar|gz|mp4|mov)$",
    r"__pycache__",
    r"\.pyc$",
    r"migrations/\d+_",          # Django/Alembic migrations
    r"node_modules/",
    r"\.lock$",
    r"dist/",
    r"build/",
    r"\.next/",
    r"coverage/",
]


@dataclass
class DiffLine:
    position: int       # position in diff hunk (used by GitHub Review API)
    line_number: int    # actual line number in the new file (for display)
    content: str        # line content
    line_type: str      # "added" | "removed" | "context"


@dataclass
class ParsedFile:
    filename: str
    status: str = "modified"           # added | modified | removed | renamed
    lines: list[DiffLine] = field(default_factory=list)
    raw_patch: str = ""
    additions: int = 0
    deletions: int = 0

    @property
    def added_lines(self) -> list[DiffLine]:
        return [l for l in self.lines if l.line_type == "added"]

    def should_skip(self) -> bool:
        return any(re.search(p, self.filename, re.IGNORECASE) for p in SKIP_PATTERNS)

    def is_too_large(self, max_lines: int = 500) -> bool:
        return len(self.lines) > max_lines


def is_file_noise(filename: str) -> bool:
    """Check if a filename matches any noise/skip pattern."""
    return any(re.search(p, filename, re.IGNORECASE) for p in SKIP_PATTERNS)


def parse_diff_to_file_chunks(diff_text: str) -> dict[str, str]:
    """
    Split a raw unified git diff (containing one or more files) into a dictionary
    mapping each filename to its unified diff text.
    Handles 'diff --git a/... b/...' headers.
    """
    if not diff_text or not diff_text.strip():
        return {}

    file_chunks: dict[str, str] = {}
    current_file: Optional[str] = None
    current_lines: list[str] = []

    # Match 'diff --git a/path b/path' or '--- a/path\n+++ b/path'
    diff_header_re = re.compile(r"^diff --git a/(.+?) b/(.+?)$")
    plus_header_re = re.compile(r"^\+\+\+ (?:b/)?(.+)$")

    for line in diff_text.splitlines(keepends=True):
        match_diff = diff_header_re.match(line.strip())
        if match_diff:
            if current_file and current_lines:
                file_chunks[current_file] = "".join(current_lines).strip()
            current_file = match_diff.group(2)
            current_lines = [line]
            continue

        # If diff --git was not present, try +++ b/filename
        if not current_file:
            match_plus = plus_header_re.match(line.strip())
            if match_plus:
                target = match_plus.group(1).strip()
                if target != "/dev/null":
                    current_file = target
                    current_lines = [line]
                    continue

        if current_file:
            current_lines.append(line)

    if current_file and current_lines:
        file_chunks[current_file] = "".join(current_lines).strip()

    # Fallback: if no diff --git header found, treat whole text as single diff
    if not file_chunks and diff_text.strip():
        # Look for +++ b/...
        match_fallback = re.search(r"^\+\+\+ (?:b/)?([^\s\n]+)", diff_text, re.MULTILINE)
        fallback_name = match_fallback.group(1) if match_fallback else "unknown_file"
        file_chunks[fallback_name] = diff_text.strip()

    return file_chunks


def filter_noise_files(file_chunks: dict[str, str]) -> dict[str, str]:
    """
    Filter out files that should not be reviewed (lockfiles, generated, minified, etc.).
    """
    return {
        filename: patch
        for filename, patch in file_chunks.items()
        if not is_file_noise(filename) and patch.strip()
    }


def parse_pr_files(pr_files: list[dict]) -> list[ParsedFile]:
    """
    Parse GitHub's PR files API response into structured ParsedFile objects.
    Each file dict has: filename, status, patch, additions, deletions.
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
            parsed.append(pf)
            continue

        pf.lines = _parse_patch(patch)
        parsed.append(pf)

    return parsed


def parse_unified_diff(diff_text: str) -> list[ParsedFile]:
    """
    Parse a full raw unified diff string into a list of ParsedFile objects.
    """
    chunks = parse_diff_to_file_chunks(diff_text)
    parsed_files: list[ParsedFile] = []

    for filename, patch in chunks.items():
        # Count additions/deletions
        lines = _parse_patch(patch)
        additions = sum(1 for l in lines if l.line_type == "added")
        deletions = sum(1 for l in lines if l.line_type == "removed")
        parsed_files.append(ParsedFile(
            filename=filename,
            status="modified",
            lines=lines,
            raw_patch=patch,
            additions=additions,
            deletions=deletions,
        ))

    return parsed_files


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

    for raw_line in patch.splitlines():
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
                line_number=new_line_number,
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
        elif raw_line.startswith("\\"):
            # e.g. "\ No newline at end of file"
            position += 1

    return lines


def build_diff_position_map(patch: str) -> dict[int, int]:
    """
    Builds a mapping from new_file line_number -> GitHub diff position.
    """
    lines = _parse_patch(patch)
    mapping = {}
    for line in lines:
        if line.line_type == "added" and line.line_number > 0:
            mapping[line.line_number] = line.position
    return mapping
