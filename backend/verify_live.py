import asyncio
import os
import sys

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv()

from app.gemini_client import review_all_files
from app.diff_parser import parse_diff_to_file_chunks, filter_noise_files
from app import supabase_client as db

SAMPLE_DIFF = """diff --git a/backend/auth/queries.py b/backend/auth/queries.py
index 1234567..89abcdef 100644
--- a/backend/auth/queries.py
+++ b/backend/auth/queries.py
@@ -10,4 +10,6 @@ def get_user_profile(user_id: str, db):
     cursor = db.cursor()
-    cursor.execute("SELECT id, name FROM users WHERE id = %s", (user_id,))
+    raw_query = f"SELECT * FROM users WHERE id = '{user_id}' AND is_active = 1"
+    cursor.execute(raw_query)
     return cursor.fetchone()
"""

async def main():
    print("========================================")
    print("      PR PILOT LIVE PIPELINE TEST       ")
    print("========================================")

    # 1. Diff parsing
    chunks = parse_diff_to_file_chunks(SAMPLE_DIFF)
    clean_chunks = filter_noise_files(chunks)
    print(f"[OK] Parsed files: {list(clean_chunks.keys())}")

    # 2. Gemini Review
    print("\nCalling Gemini AI code review engine...")
    comments, summary, version = await review_all_files(clean_chunks)
    print(f"[OK] Review completed (version {version})")
    print(f"[OK] Summary: {summary}")
    print(f"[OK] Issues detected: {len(comments)}")
    for c in comments:
        print(f"   [{c.severity.upper()}] {c.filename}:L{c.line_pos} - {c.message}")
        if c.suggestion:
            print(f"      Suggested Fix: {c.suggestion}")

    # 3. Supabase connectivity check
    print("\nChecking Supabase...")
    db_ok = db.health_check()
    print(f"[OK] Supabase connection: {'CONNECTED' if db_ok else 'FALLBACK MODE (Tables need schema/permissions)'}")

    print("\n========================================")
    print("         ALL CHECKS COMPLETED           ")
    print("========================================")

if __name__ == "__main__":
    asyncio.run(main())
