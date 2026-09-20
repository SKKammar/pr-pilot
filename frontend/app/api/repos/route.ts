import { NextResponse } from "next/server";
import cachedRepositories from "@/data/repositories.json";

export interface RepositoryItem {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  html_url: string;
  description: string | null;
  open_issues_count?: number;
  installation_id?: number;
}

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  // Try backend first for live updates
  try {
    const urlsToTry = [backendUrl, "http://127.0.0.1:8000", "http://localhost:8000"];
    for (const url of Array.from(new Set(urlsToTry))) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${url}/api/repos`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.repositories && data.repositories.length > 0) {
            const repoList = data.repositories;
            const repoNames = repoList.map((r: any) =>
              typeof r === "string" ? r : r.full_name || r.name
            );
            return NextResponse.json({
              count: repoNames.length,
              repositories: repoNames,
              detailed: repoList,
              source: "github-app-live",
            });
          }
        }
      } catch {
        // Continue to next fallback
      }
    }
  } catch {
    // Fallback to cached dataset
  }

  const detailedList = cachedRepositories as RepositoryItem[];
  const repoNames = detailedList.map((r) => r.full_name);

  return NextResponse.json({
    count: detailedList.length,
    repositories: repoNames,
    detailed: detailedList,
    source: "installed-cached",
  });
}

