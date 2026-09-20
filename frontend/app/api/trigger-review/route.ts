import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const urlsToTry = [backendUrl, "http://127.0.0.1:8000", "http://localhost:8000"];

  const body = await req.json();

  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${url}/api/trigger-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(data, { status: res.status });
      }
      return NextResponse.json({ ...data, is_live: true });
    } catch {
      // Try next url
    }
  }

  // Graceful fallback when local backend is not yet started
  const repoName = body.repo_full_name || "SKKammar/pr-pilot";
  const prNum = body.pr_number || 1;

  return NextResponse.json({
    status: "success",
    is_live: false,
    is_simulated: true,
    message: `Review completed for ${repoName}#${prNum} (Demo Mode). Backend not running locally.`,
    delivery_id: `demo_${Date.now()}`,
    hint: "To enable live GitHub posting, start the backend with: cd backend && .\\venv\\Scripts\\uvicorn app.main:app --port 8000",
  });
}

