import pytest
from app.diff_parser import (
    parse_diff_to_file_chunks,
    filter_noise_files,
    is_file_noise,
    _parse_patch,
    build_diff_position_map,
    parse_unified_diff,
)

SAMPLE_MULTI_DIFF = """diff --git a/app/main.py b/app/main.py
index abc1234..def5678 100644
--- a/app/main.py
+++ b/app/main.py
@@ -1,5 +1,6 @@
 import os
+import sys
 
 def run():
-    print("old")
+    print("new")
diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,3 +1,3 @@
 {
-  "version": "1.0.0"
+  "version": "1.0.1"
 }
diff --git a/assets/icon.png b/assets/icon.png
new file mode 100644
Binary files /dev/null and b/assets/icon.png differ
"""

def test_parse_diff_to_file_chunks():
    chunks = parse_diff_to_file_chunks(SAMPLE_MULTI_DIFF)
    assert len(chunks) == 3
    assert "app/main.py" in chunks
    assert "package-lock.json" in chunks
    assert "assets/icon.png" in chunks
    assert "import sys" in chunks["app/main.py"]


def test_filter_noise_files():
    chunks = parse_diff_to_file_chunks(SAMPLE_MULTI_DIFF)
    filtered = filter_noise_files(chunks)
    assert len(filtered) == 1
    assert "app/main.py" in filtered
    assert "package-lock.json" not in filtered
    assert "assets/icon.png" not in filtered


def test_is_file_noise():
    assert is_file_noise("package-lock.json") is True
    assert is_file_noise("yarn.lock") is True
    assert is_file_noise("poetry.lock") is True
    assert is_file_noise("vendor/bundle.min.js") is True
    assert is_file_noise("src/styles.min.css") is True
    assert is_file_noise("images/banner.jpg") is True
    assert is_file_noise("db/migrations/0001_initial.py") is True
    assert is_file_noise("app/auth/service.py") is False
    assert is_file_noise("frontend/app/page.tsx") is False


def test_parse_patch_positions():
    patch = """@@ -10,4 +10,5 @@
 context 1
-removed 1
+added 1
+added 2
 context 2"""

    lines = _parse_patch(patch)
    # Line 0: @@ header -> position 1
    # Line 1: context 1 -> position 2, line_num 10
    # Line 2: -removed 1 -> position 3
    # Line 3: +added 1 -> position 4, line_num 11
    # Line 4: +added 2 -> position 5, line_num 12
    # Line 5: context 2 -> position 6, line_num 13
    assert len(lines) == 5
    added_lines = [l for l in lines if l.line_type == "added"]
    assert len(added_lines) == 2
    assert added_lines[0].content == "added 1"
    assert added_lines[0].position == 4
    assert added_lines[0].line_number == 11
    assert added_lines[1].content == "added 2"
    assert added_lines[1].position == 5
    assert added_lines[1].line_number == 12


def test_build_diff_position_map():
    patch = """@@ -1,3 +1,4 @@
 a
+b
 c"""
    pos_map = build_diff_position_map(patch)
    # line 2 in new file is 'b' which is at diff position 3
    assert 2 in pos_map
    assert pos_map[2] == 3


def test_parse_unified_diff():
    parsed = parse_unified_diff(SAMPLE_MULTI_DIFF)
    assert len(parsed) == 3
    main_file = next(f for f in parsed if f.filename == "app/main.py")
    assert main_file.additions > 0
    assert not main_file.should_skip()
