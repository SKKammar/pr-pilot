import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const urlsToTry = [backendUrl, "http://127.0.0.1:8000", "http://localhost:8000"];

  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${url}/health`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return NextResponse.json({
          online: true,
          url,
          message: "FastAPI Backend is running",
        });
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({
    online: false,
    message: "FastAPI Backend not detected. Run: cd backend && .\\venv\\Scripts\\uvicorn app.main:app --port 8000",
  });
}
