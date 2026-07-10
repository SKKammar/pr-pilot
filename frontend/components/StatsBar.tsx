"use client";
import { useEffect, useState } from "react";

export function StatsBar() {
  const [stats, setStats] = useState({ totalReviews: 0, totalIssues: 0, reposCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="w-full border-y border-[#1e1e2e] py-6 bg-[#0a0a0f] my-12">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 font-mono text-sm">
        <div className="flex gap-2">
          <span className="text-[#6366f1]">{stats.totalReviews || "—"}</span>
          <span className="text-[#64748b]">PRs Reviewed</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#6366f1]">{stats.totalIssues || "—"}</span>
          <span className="text-[#64748b]">Issues Found</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#6366f1]">{stats.reposCount || "—"}</span>
          <span className="text-[#64748b]">Repos Active</span>
        </div>
      </div>
    </div>
  );
}
