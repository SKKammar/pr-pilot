"""
Parse unified diff format into structured chunks per file.

CRITICAL: GitHub's inline comment API requires `position` — the line number
within the diff hunk (starting at 1 for the first `@@` line), NOT the
file's actual line number. This parser builds that mapping.
"""

import re
from dataclasses import dataclass, field

# Files to skip — generated, binary, lockfiles
SKIP_PATTERNS = [
    r"package-lock\.json$",
    r"yarn\.lock$",
    r"poetry\.lock$",
    r"Pipfile\.lock$",
    r"\.min\.(js|css)$",
    r"\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf)$",
    r"__pycache__",
    r"\.pyc$",
    r"migrations/\d+_",          # Django/Alembic migrations
    r"node_modules/",
    r"\.lock$",
    r"dist/",
    r"build/",
    r"coverage/",
]

@dataclass
class DiffLine:
    position: int       # position in diff (used by GitHub API)
    line_number: int    # actual line number in the new file (for display)
    content: str        # line content
    line_type: str      # "added" | "removed" | "context"

@dataclass
class ParsedFile:
    filename: str
    status: str                        # added | modified | removed | renamed
    lines: list[DiffLine] = field(default_factory=list)
    raw_patch: str = ""
    additions: int = 0
    deletions: int = 0

    @property
    def added_lines(self) -> list[DiffLine]:
        return [l for l in self.lines if l.line_type == "added"]

    def should_skip(self) -> bool:
        return any(re.search(p, self.filename) for p in SKIP_PATTERNS)

    def is_too_large(self, max_lines: int = 500) -> bool:
        return len(self.lines) > max_lines


def parse_pr_files(pr_files: list[dict]) -> list[ParsedFile]:
    """
    Parse GitHub's PR files API response into structured ParsedFile objects.
    Each file has a `patch` field containing the unified diff for that file.
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
            # Binary files or files with no textual diff
            parsed.append(pf)
            continue

        pf.lines = _parse_patch(patch)
        parsed.append(pf)

    return parsed


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

    for raw_line in patch.split("\n"):
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
                line_number=new_line_number,   # not incremented — line was removed
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
        # skip "\ No newline at end of file" and empty lines

    return lines
