import json
import re
import google.generativeai as genai

# System prompt — the most important part of the whole project.
# Prompt engineering determines review quality.
SYSTEM_PROMPT = """You are a senior software engineer performing a precise code review.

Your job is to review the provided code diff and identify ONLY real, significant issues.

RULES:
- Only comment on ADDED lines (lines starting with + in the diff)
- Maximum 5 comments per file
- Only flag: bugs, security vulnerabilities, null pointer risks, resource leaks, 
  SQL injection, hardcoded secrets, logic errors, and serious performance problems
- Do NOT flag: style preferences, minor naming conventions, missing comments,
  or things that are matters of opinion
- If a file looks fine, return an empty comments array — do not invent issues
- Be specific: reference the exact line content in your message

Respond ONLY with a valid JSON object in this exact format:
{
  "summary": "One sentence summary of the file's quality",
  "comments": [
    {
      "line_content": "exact content of the problematic line",
      "severity": "error|warning|suggestion",
      "message": "Clear explanation of the problem",
      "suggestion": "Optional: the fix as a code snippet"
    }
  ]
}

Do not include any text outside the JSON object. No markdown, no preamble."""


class GeminiClient:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,        # low temp = consistent, predictable output
                max_output_tokens=2048,
                response_mime_type="application/json",  # force JSON mode
            ),
            system_instruction=SYSTEM_PROMPT,
        )

    async def review_file(self, filename: str, patch: str) -> tuple[list[dict], str]:
        """
        Review a single file's diff. Returns list of raw comment dicts and a summary.
        Returns empty list on any error — never raises to calling code.
        """
        prompt = f"""Review this diff for file: `{filename}`

```diff
{patch[:8000]}
```"""
        # Truncate patch at 8000 chars per file — Gemini 2.0 Flash handles
        # 1M context but we limit per-file to control cost and focus

        try:
            response = await self.model.generate_content_async(prompt)
            text = response.text.strip()

            # Strip markdown fences if model ignores mime type hint
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            data = json.loads(text)
            return data.get("comments", []), data.get("summary", "")

        except json.JSONDecodeError:
            # Gemini returned non-JSON despite json mode — log and skip
            print(f"[GeminiClient] JSON parse failed for {filename}")
            return [], "Could not parse review for this file."
        except Exception as e:
            print(f"[GeminiClient] Error reviewing {filename}: {e}")
            return [], ""
