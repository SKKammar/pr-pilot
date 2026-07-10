import { createClient } from "@/lib/supabase";

async function getReviews() {
  try {
    const supabase = createClient();
    if (!supabase) return [];
    
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .order("reviewed_at", { ascending: false })
      .limit(50);
    return data ?? [];
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return [];
  }
}

async function getStats() {
  try {
    const supabase = createClient();
    if (!supabase) return { totalReviews: 0, totalIssues: 0 };
    
    const { count: totalReviews } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true });
      
    const { data: issueData } = await supabase
      .from("reviews")
      .select("total_issues");
      
    const totalIssues = issueData?.reduce((sum, r) => sum + r.total_issues, 0) ?? 0;
    return { totalReviews: totalReviews ?? 0, totalIssues };
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return { totalReviews: 0, totalIssues: 0 };
  }
}

export default async function DashboardPage() {
  const [reviews, stats] = await Promise.all([getReviews(), getStats()]);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      <nav className="border-b border-[#1e1e2e] px-6 py-4">
        <span className="font-mono text-sm text-[#6366f1] font-semibold tracking-widest uppercase">
          PR Pilot / Dashboard
        </span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Stats bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Total Reviews", value: stats.totalReviews },
            { label: "Issues Found", value: stats.totalIssues },
            { label: "Repos Monitored", value: new Set(reviews.map(r => r.repo_full_name)).size },
            { label: "Avg Issues / PR", value: stats.totalReviews ? Math.round(stats.totalIssues / stats.totalReviews) : 0 },
          ].map((s) => (
            <div key={s.label} className="border border-[#1e1e2e] rounded-xl p-6 bg-[#12121a]">
              <div className="text-3xl font-bold text-[#6366f1] font-mono">{s.value}</div>
              <div className="text-xs text-[#64748b] mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Review list */}
        <h2 className="text-lg font-semibold mb-4">Recent Reviews</h2>
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="text-sm text-[#64748b]">No reviews found. Is Supabase configured?</div>
          ) : (
            reviews.map((review: any) => (
              <div key={review.id}
                className="border border-[#1e1e2e] rounded-xl p-5 bg-[#12121a] 
                           hover:border-[#6366f1]/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-sm text-[#6366f1]">
                      {review.repo_full_name} <span className="text-[#64748b]">#{review.pr_number}</span>
                    </div>
                    <div className="text-sm text-[#e2e8f0] mt-1">{review.pr_title}</div>
                    <div className="text-xs text-[#64748b] mt-1">
                      by {review.pr_author} · {new Date(review.reviewed_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {review.error_count > 0 && (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 
                                       px-2 py-1 rounded-full">
                        🔴 {review.error_count}
                      </span>
                    )}
                    {review.warning_count > 0 && (
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 
                                       px-2 py-1 rounded-full">
                        🟡 {review.warning_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
