import Link from "next/link";
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  ExternalLink, 
  Filter, 
  GitPullRequest, 
  Lightbulb, 
  Search 
} from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";

interface ReviewItem {
  id: string;
  pr_number: number;
  repo_full_name: string;
  pr_title: string;
  pr_author: string;
  total_issues: number;
  error_count: number;
  warning_count: number;
  suggestion_count: number;
  summary: string;
  status: string;
  reviewed_at: string;
}

// Rich fallback reviews for demo evaluation if Supabase has no data
const DEMO_REVIEWS: ReviewItem[] = [
  {
    id: "rev-demo-01",
    pr_number: 142,
    repo_full_name: "SKKammar/pr-pilot",
    pr_title: "feat(auth): add OAuth2 token exchange with refresh rotation",
    pr_author: "santosh",
    total_issues: 2,
    error_count: 1,
    warning_count: 1,
    suggestion_count: 0,
    summary: "Identified a potential token leak in error response headers and missing clock skew tolerance.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "rev-demo-02",
    pr_number: 89,
    repo_full_name: "facebook/react",
    pr_title: "fix(hooks): prevent state desynchronization in concurrent transitions",
    pr_author: "gaearon",
    total_issues: 3,
    error_count: 1,
    warning_count: 0,
    suggestion_count: 2,
    summary: "Critical race condition identified when batch updates are interrupted by higher priority user events.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: "rev-demo-03",
    pr_number: 312,
    repo_full_name: "vercel/next.js",
    pr_title: "perf(router): memoize route segment manifests on edge runtime",
    pr_author: "timneutkens",
    total_issues: 2,
    error_count: 0,
    warning_count: 1,
    suggestion_count: 1,
    summary: "Missing cache eviction policy under high worker concurrency; suggested TTL bounded LRU map.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "rev-demo-04",
    pr_number: 45,
    repo_full_name: "pallets/flask",
    pr_title: "refactor(session): harden cookie encryption and secure samesite defaults",
    pr_author: "davidism",
    total_issues: 1,
    error_count: 0,
    warning_count: 0,
    suggestion_count: 1,
    summary: "Clean implementation. Suggested adding explicit Strict-Transport-Security header test case.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
  },
  {
    id: "rev-demo-05",
    pr_number: 28,
    repo_full_name: "SKKammar/pr-pilot",
    pr_title: "fix(db): wrap batch review insertion in atomic transaction",
    pr_author: "santosh",
    total_issues: 0,
    error_count: 0,
    warning_count: 0,
    suggestion_count: 0,
    summary: "All changes verified. Flawless database migration and rollback handling.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 750).toISOString(),
  },
];

function formatTimeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function getDashboardData(repo?: string, severityFilter?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    let filtered = DEMO_REVIEWS;
    if (repo && repo !== "all") {
      filtered = filtered.filter((r) => r.repo_full_name.toLowerCase() === repo.toLowerCase());
    }
    if (severityFilter === "errors") {
      filtered = filtered.filter((r) => r.error_count > 0);
    } else if (severityFilter === "warnings") {
      filtered = filtered.filter((r) => r.warning_count > 0);
    } else if (severityFilter === "clean") {
      filtered = filtered.filter((r) => r.error_count === 0 && r.warning_count === 0);
    }

    return {
      reviews: filtered,
      stats: {
        total_reviews: DEMO_REVIEWS.length,
        total_errors: DEMO_REVIEWS.reduce((s, r) => s + r.error_count, 0),
        total_warnings: DEMO_REVIEWS.reduce((s, r) => s + r.warning_count, 0),
        repos_monitored: new Set(DEMO_REVIEWS.map((r) => r.repo_full_name)).size,
      },
      isFallback: true,
    };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key);

    let query = supabase
      .from("pr_pilot_reviews")
      .select("*")
      .order("reviewed_at", { ascending: false })
      .limit(50);

    if (repo && repo !== "all") {
      query = query.eq("repo_full_name", repo);
    }

    const { data: reviewsData, error } = await query;

    if (error || !reviewsData || reviewsData.length === 0) {
      return {
        reviews: DEMO_REVIEWS,
        stats: {
          total_reviews: DEMO_REVIEWS.length,
          total_errors: DEMO_REVIEWS.reduce((s, r) => s + r.error_count, 0),
          total_warnings: DEMO_REVIEWS.reduce((s, r) => s + r.warning_count, 0),
          repos_monitored: new Set(DEMO_REVIEWS.map((r) => r.repo_full_name)).size,
        },
        isFallback: true,
      };
    }

    const totalReviews = reviewsData.length;
    const totalErrors = reviewsData.reduce((s, r) => s + (r.error_count || 0), 0);
    const totalWarnings = reviewsData.reduce((s, r) => s + (r.warning_count || 0), 0);
    const reposMonitored = new Set(reviewsData.map((r) => r.repo_full_name)).size;

    let reviews = reviewsData;
    if (severityFilter === "errors") {
      reviews = reviews.filter((r) => r.error_count > 0);
    } else if (severityFilter === "warnings") {
      reviews = reviews.filter((r) => r.warning_count > 0);
    } else if (severityFilter === "clean") {
      reviews = reviews.filter((r) => r.error_count === 0 && r.warning_count === 0);
    }

    return {
      reviews,
      stats: {
        total_reviews: totalReviews,
        total_errors: totalErrors,
        total_warnings: totalWarnings,
        repos_monitored: reposMonitored,
      },
      isFallback: false,
    };
  } catch {
    return {
      reviews: DEMO_REVIEWS,
      stats: {
        total_reviews: DEMO_REVIEWS.length,
        total_errors: DEMO_REVIEWS.reduce((s, r) => s + r.error_count, 0),
        total_warnings: DEMO_REVIEWS.reduce((s, r) => s + r.warning_count, 0),
        repos_monitored: new Set(DEMO_REVIEWS.map((r) => r.repo_full_name)).size,
      },
      isFallback: true,
    };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { repo?: string; filter?: string; q?: string };
}) {
  const repo = searchParams?.repo || "all";
  const filter = searchParams?.filter || "all";
  const { reviews, stats, isFallback } = await getDashboardData(repo, filter);

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg)]">
      {/* Telemetry Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-[var(--border)] bg-[var(--surface)] divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
        {/* Reviews */}
        <div className="p-6 flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
            Total Reviews
          </span>
          <div className="text-3xl font-mono font-semibold text-[var(--text-primary)]">
            <AnimatedCounter value={stats.total_reviews} />
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
            Autonomous PR checks
          </span>
        </div>

        {/* Errors Caught */}
        <div className="p-6 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--error)]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--error)]">
              Errors Prevented
            </span>
          </div>
          <div className="text-3xl font-mono font-semibold text-[var(--error)]">
            <AnimatedCounter value={stats.total_errors} />
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
            Security & logic bugs
          </span>
        </div>

        {/* Warnings */}
        <div className="p-6 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--warning)]">
              Warnings Caught
            </span>
          </div>
          <div className="text-3xl font-mono font-semibold text-[var(--warning)]">
            <AnimatedCounter value={stats.total_warnings} />
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
            Edge cases & unhandled risks
          </span>
        </div>

        {/* Repositories */}
        <div className="p-6 flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
            Active Repositories
          </span>
          <div className="text-3xl font-mono font-semibold text-[var(--text-primary)]">
            <AnimatedCounter value={stats.repos_monitored} />
          </div>
          <span className="text-[11px] text-[var(--accent)] font-mono mt-1">
            ● Real-time webhook listening
          </span>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-mono font-medium text-[var(--text-primary)] flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-[var(--accent)]" />
            <span>{repo === "all" ? "All Pull Request Reviews" : `Reviews — ${repo}`}</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
            Showing {reviews.length} reviews {isFallback && "(Sample Data for Evaluation)"}
          </p>
        </div>

        {/* Severity filter pills */}
        <div className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]">
          <Link
            href={`/dashboard?repo=${repo}&filter=all`}
            className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
              filter === "all"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            All
          </Link>
          <Link
            href={`/dashboard?repo=${repo}&filter=errors`}
            className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
              filter === "errors"
                ? "bg-[var(--error-dim)] text-[var(--error)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Errors
          </Link>
          <Link
            href={`/dashboard?repo=${repo}&filter=warnings`}
            className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
              filter === "warnings"
                ? "bg-[var(--warning-dim)] text-[var(--warning)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Warnings
          </Link>
          <Link
            href={`/dashboard?repo=${repo}&filter=clean`}
            className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
              filter === "clean"
                ? "bg-[var(--success-dim)] text-[var(--success)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Clean
          </Link>
        </div>
      </div>

      {/* Review Feed List */}
      <div className="flex-1 divide-y divide-[var(--border)]">
        {reviews.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
              <Filter className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-mono font-medium text-[var(--text-primary)] mb-1">
              No matching reviews
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mb-4">
              No pull request reviews matched your filter. Try selecting "All" or open a new pull request in your GitHub repository.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              Reset Filters
            </Link>
          </div>
        ) : (
          reviews.map((rev) => {
            const hasErrors = rev.error_count > 0;
            const hasWarnings = rev.warning_count > 0;
            const repoShort = rev.repo_full_name.split("/")[1] || rev.repo_full_name;

            return (
              <Link
                key={rev.id}
                href={`/dashboard/review/${rev.id}`}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 hover:bg-[var(--surface-hover)] transition-all gap-4 text-decoration-none"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Status indicator dot */}
                  <div className="mt-1 flex items-center justify-center shrink-0">
                    {hasErrors ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--error)] ring-4 ring-[var(--error-dim)]" />
                    ) : hasWarnings ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--warning)] ring-4 ring-[var(--warning-dim)]" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)] ring-4 ring-[var(--success-dim)]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Header line */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-1.5">
                      <span className="text-[var(--text-muted)] font-medium">{repoShort}</span>
                      <span className="text-[var(--border-hover)]">#</span>
                      <span className="text-[var(--accent)] font-semibold">{rev.pr_number}</span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="text-[var(--text-secondary)]">{rev.pr_author}</span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="text-[var(--text-muted)]">{formatTimeAgo(rev.reviewed_at)}</span>
                    </div>

                    {/* Title */}
                    <h2 className="text-sm font-sans font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 mb-1.5">
                      {rev.pr_title}
                    </h2>

                    {/* Summary */}
                    {rev.summary && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                        {rev.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges & Action */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="flex items-center gap-1.5">
                    {rev.error_count > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]/30 font-medium">
                        {rev.error_count} err
                      </span>
                    )}
                    {rev.warning_count > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/30 font-medium">
                        {rev.warning_count} warn
                      </span>
                    )}
                    {rev.suggestion_count > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--suggestion-dim)] text-[var(--suggestion)] border border-[var(--suggestion)]/30 font-medium">
                        {rev.suggestion_count} hint
                      </span>
                    )}
                    {rev.total_issues === 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--success-dim)] text-[var(--success)] border border-[var(--success)]/30 font-medium">
                        clean ✓
                      </span>
                    )}
                  </div>

                  <div className="w-7 h-7 rounded-md bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)]/40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
