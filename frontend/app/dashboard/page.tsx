// REQUIRED Vercel env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { createClient } from "@/lib/supabase";
import { DashboardClient } from "./DashboardClient";

export const revalidate = 0; // Disable caching so dashboard is real-time on refresh

async function getReviews() {
  try {
    const supabase = createClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from("pr_pilot_reviews")
      .select("*")
      .order("reviewed_at", { ascending: false })
      .limit(50);
      
    if (error) console.error("Supabase error:", error.message);
    return data ?? [];
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return [];
  }
}

async function getStats() {
  try {
    const supabase = createClient();
    if (!supabase) return { totalReviews: 0, totalIssues: 0, errorCount: 0 };
    
    const { count: totalReviews, error } = await supabase
      .from("pr_pilot_reviews")
      .select("*", { count: "exact", head: true });
      
    if (error) console.error("Supabase error:", error.message);
      
    const { data: issueData } = await supabase
      .from("pr_pilot_reviews")
      .select("total_issues, error_count");
      
    const totalIssues = issueData?.reduce((sum, r) => sum + (r.total_issues ?? 0), 0) ?? 0;
    const errorCount = issueData?.reduce((sum, r) => sum + (r.error_count ?? 0), 0) ?? 0;
    return { totalReviews: totalReviews ?? 0, totalIssues, errorCount };
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return { totalReviews: 0, totalIssues: 0, errorCount: 0 };
  }
}

export default async function DashboardPage() {
  const [reviews, stats] = await Promise.all([getReviews(), getStats()]);
  return <DashboardClient reviews={reviews} stats={stats} />;
}
