"use client";
import { useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/timeAgo";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const DEMO_REVIEWS = [
  {
    id: "demo-1",
    pr_number: 42,
    repo_full_name: "SKKammar/pr-pilot",
    pr_title: "Add webhook signature verification",
    pr_author: "SKKammar",
    error_count: 1,
    warning_count: 2,
    suggestion_count: 3,
    total_issues: 6,
    reviewed_at: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    id: "demo-2",
    pr_number: 38,
    repo_full_name: "SKKammar/InventoryManagement",
    pr_title: "Fix SQL injection in order search endpoint",
    pr_author: "SKKammar",
    error_count: 2,
    warning_count: 1,
    suggestion_count: 0,
    total_issues: 3,
    reviewed_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "demo-3",
    pr_number: 15,
    repo_full_name: "SKKammar/CANID",
    pr_title: "Add pgvector similarity search for nose embeddings",
    pr_author: "SKKammar",
    error_count: 0,
    warning_count: 1,
    suggestion_count: 2,
    total_issues: 3,
    reviewed_at: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
  },
];

export function DashboardClient({ reviews, stats }: { reviews: any[], stats: any }) {
  const isDemo = reviews.length === 0;
  const displayReviews = isDemo ? DEMO_REVIEWS : reviews;
  const reposCount = new Set(displayReviews.map(r => r.repo_full_name)).size;
  const displayStats = isDemo ? {
    totalReviews: 3,
    totalIssues: 12,
    errorCount: 3,
  } : stats;

  const uniqueRepos = Array.from(new Set(displayReviews.map(r => r.repo_full_name)));
  const [selectedRepo, setSelectedRepo] = useState<string>("All Repos");

  const filteredReviews = selectedRepo === "All Repos" 
    ? displayReviews 
    : displayReviews.filter(r => r.repo_full_name === selectedRepo);

  const chartData = displayReviews.slice(0, 10).reverse().map(r => ({
    name: `#${r.pr_number}`,
    errors: r.error_count || 0,
    warnings: r.warning_count || 0,
    suggestions: r.suggestion_count || 0,
  }));

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <nav className="border-b border-[#1e1e2e] px-6 py-4 flex items-center justify-between">
        <div className="font-mono text-sm text-[#6366f1] font-semibold tracking-widest uppercase">
          PR Pilot
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-mono text-[#4ade80]">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse-dot" />
            Bot Active
          </div>
          <Link href="/" className="text-sm text-[#64748b] hover:text-[#e2e8f0] transition-colors">
            ← Home
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Review History</h1>
          <p className="text-[#64748b]">Every PR reviewed, logged in real time.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Total PRs Reviewed", value: displayStats.totalReviews },
            { label: "Issues Found", value: displayStats.totalIssues },
            { label: "Errors Caught", value: displayStats.errorCount },
            { label: "Repos Monitored", value: reposCount },
          ].map((s) => (
            <div key={s.label} className="border border-[#1e1e2e] border-l-2 border-l-[#6366f1] rounded-xl p-6 bg-[#12121a]">
              <div className="text-4xl font-bold text-[#6366f1] font-mono mb-2">
                <AnimatedCounter value={s.value} />
              </div>
              <div className="text-xs text-[#64748b] uppercase tracking-wider font-semibold">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="border border-[#1e1e2e] rounded-xl p-6 bg-[#12121a] mb-12">
          <div className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-6">
            Issues Per Review
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#1e1e2e' }}
                  contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                />
                <Bar dataKey="errors" stackId="a" fill="#ef4444" radius={[0, 0, 4, 4]} />
                <Bar dataKey="warnings" stackId="a" fill="#f59e0b" />
                <Bar dataKey="suggestions" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedRepo("All Repos")}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              selectedRepo === "All Repos"
                ? "bg-[#6366f1] border-[#6366f1] text-white"
                : "bg-[#12121a] border-[#1e1e2e] text-[#64748b] hover:border-[#6366f1]"
            }`}
          >
            All Repos
          </button>
          {uniqueRepos.map((repo) => (
            <button
              key={repo as string}
              onClick={() => setSelectedRepo(repo as string)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                selectedRepo === repo
                  ? "bg-[#6366f1] border-[#6366f1] text-white"
                  : "bg-[#12121a] border-[#1e1e2e] text-[#64748b] hover:border-[#6366f1]"
              }`}
            >
              {repo as string}
            </button>
          ))}
        </div>

        {isDemo && (
          <div className="bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="text-sm text-[#e2e8f0]">
              ⚡ Demo Mode — Install PR Pilot on your repo to see real reviews here
            </div>
            <a href="https://github.com/apps/pilot-by-santosh" className="text-sm font-semibold text-[#6366f1] hover:underline">
              Install Now →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div key={review.id}
              className="border border-[#1e1e2e] rounded-xl p-5 bg-[#12121a] 
                         hover:border-[#6366f1]/30 transition-all duration-200">
              <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="w-full">
                  <div className="flex justify-between items-center w-full mb-1">
                    <div className="font-mono text-sm text-[#6366f1]">
                      {review.repo_full_name} <span className="text-[#64748b]">#{review.pr_number}</span>
                    </div>
                    <div className="text-xs text-[#64748b]">
                      {timeAgo(review.reviewed_at)}
                    </div>
                  </div>
                  <div className="text-base font-medium text-[#e2e8f0] mb-2">{review.pr_title}</div>
                  <div className="text-xs text-[#64748b] mb-4">
                    by {review.pr_author}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {review.error_count > 0 && (
                      <span className="text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full">
                        🔴 {review.error_count} errors
                      </span>
                    )}
                    {review.warning_count > 0 && (
                      <span className="text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full">
                        🟡 {review.warning_count} warnings
                      </span>
                    )}
                    {review.suggestion_count > 0 && (
                      <span className="text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">
                        🔵 {review.suggestion_count} suggestions
                      </span>
                    )}
                    {(review.error_count === 0 && review.warning_count === 0 && review.suggestion_count === 0) && (
                      <span className="text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full">
                        ✅ Clean
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
