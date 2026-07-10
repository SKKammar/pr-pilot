import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { count: totalReviews } = await supabase
      .from("pr_pilot_reviews")
      .select("*", { count: "exact", head: true });

    const { data: issueData } = await supabase
      .from("pr_pilot_reviews")
      .select("total_issues, error_count, warning_count");

    const totalIssues = issueData?.reduce((s, r) => s + (r.total_issues ?? 0), 0) ?? 0;
    const reposCount = new Set(
      (await supabase.from("pr_pilot_reviews").select("repo_full_name")).data?.map(r => r.repo_full_name)
    ).size;

    return NextResponse.json({ totalReviews, totalIssues, reposCount });
  } catch {
    return NextResponse.json({ totalReviews: 0, totalIssues: 0, reposCount: 0 });
  }
}
