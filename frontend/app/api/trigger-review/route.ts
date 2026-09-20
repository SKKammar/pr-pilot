import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const urlsToTry = [backendUrl, "http://127.0.0.1:8000", "http://localhost:8000"];

  const body = await req.json();

  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const res = await fetch(`${url}/api/trigger-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(data, { status: res.status });
      }
      return NextResponse.json(data);
    } catch {
      // Try next url
    }
  }

  return NextResponse.json(
    { error: "Could not connect to PR Pilot backend. Ensure backend is running." },
    { status: 503 }
  );
}
