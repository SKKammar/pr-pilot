import Link from "next/link";
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  ExternalLink, 
  Filter, 
  FolderGit2, 
  GitPullRequest, 
  Grid, 
  Layers, 
  Lightbulb, 
  Play, 
  Search, 
  ShieldCheck, 
  Sparkles 
} from "lucide-react";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { RepositoryGrid } from "@/components/RepositoryGrid";
import { ManualReviewTrigger } from "@/components/ManualReviewTrigger";
import cachedRepositories from "@/data/repositories.json";
import { RepositoryItem } from "@/app/api/repos/route";

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

// Sample reviews for evaluation
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
    repo_full_name: "SKKammar/FlowMind",
    pr_title: "fix(hooks): prevent state desynchronization in concurrent transitions",
    pr_author: "santosh",
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
    pr_number: 12,
    repo_full_name: "SKKammar/SecretShield",
    pr_title: "perf(scanner): memoize regex AST patterns on high-concurrency stream",
    pr_author: "santosh",
    total_issues: 2,
    error_count: 0,
    warning_count: 1,
    suggestion_count: 1,
    summary: "Missing bounded cache eviction policy under high worker concurrency; suggested TTL bounded LRU map.",
    status: "posted",
    reviewed_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "rev-demo-04",
    pr_number: 45,
    repo_full_name: "SKKammar/UptimeGuard",
    pr_title: "refactor(session): harden cookie encryption and secure samesite defaults",
    pr_author: "santosh",
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
  const isAll = !repo || repo === "all";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let allReviews: ReviewItem[] = DEMO_REVIEWS;
  let isFallback = true;

  if (url && key) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(url, key);

      let query = supabase
        .from("pr_pilot_reviews")
        .select("*")
        .order("reviewed_at", { ascending: false })
        .limit(50);

      const { data: reviewsData, error } = await query;

      if (!error && reviewsData && reviewsData.length > 0) {
        allReviews = reviewsData;
        isFallback = false;
      }
    } catch {
      // Use demo reviews
    }
  }

  // Filter reviews
  let filtered = allReviews;

  if (!isAll) {
    // Exact match for the selected repository
    filtered = allReviews.filter(
      (r) => r.repo_full_name.toLowerCase() === repo.toLowerCase()
    );
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
      total_reviews: allReviews.length,
      total_errors: allReviews.reduce((s, r) => s + (r.error_count || 0), 0),
      total_warnings: allReviews.reduce((s, r) => s + (r.warning_count || 0), 0),
      repos_monitored: cachedRepositories.length || 34,
    },
    isFallback,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string; repo?: string; filter?: string };
}) {
  const repo = searchParams?.repo || "all";
  const filter = searchParams?.filter || "all";
  
  // If a specific repo is passed, default to reviews view for that repo; otherwise default to "repos"
  const defaultTab = repo !== "all" ? "reviews" : (searchParams?.tab || "repos");
  const tab = searchParams?.tab || defaultTab;

  const { reviews, stats, isFallback } = await getDashboardData(repo, filter);
  const repositories = cachedRepositories as RepositoryItem[];

  // Find info about the currently selected repository if any
  const currentRepoInfo = repo !== "all" 
    ? repositories.find((r) => r.full_name.toLowerCase() === repo.toLowerCase())
    : null;

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg)]">
      {/* Top View Navigation Bar */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Tab switchers */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard?tab=repos${repo !== "all" ? `&repo=${encodeURIComponent(repo)}` : ""}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              tab === "repos"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Connected Repositories ({repositories.length})</span>
          </Link>

          <Link
            href={`/dashboard?tab=reviews${repo !== "all" ? `&repo=${encodeURIComponent(repo)}` : ""}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              tab === "reviews"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>
              {repo === "all" ? "Pull Request Reviews" : `Reviews: ${repo.split("/")[1] || repo}`}
            </span>
          </Link>
        </div>

        {/* Global Connection Tag */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span>GitHub App Active • @SKKammar (34 Repos Monitored)</span>
        </div>
      </div>

      {/* Main Content Area */}
      {tab === "repos" ? (
        <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Header section for Repositories */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-mono font-semibold text-[var(--text-primary)] flex items-center gap-2.5">
                <FolderGit2 className="w-5 h-5 text-[var(--accent)]" />
                <span>Installed Repositories ({repositories.length})</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">
                PR Pilot is installed across all 34 repositories for @SKKammar. Real-time webhooks inspect every PR diff autonomously.
              </p>
            </div>

            <a
              href="https://github.com/apps/pilot-by-santosh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors shrink-0"
            >
              <span>Manage GitHub App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Quick Runner Prompt */}
          <ManualReviewTrigger defaultRepo={repo !== "all" ? repo : undefined} />

          {/* Repositories Directory Grid */}
          <RepositoryGrid repositories={repositories} />
        </div>
      ) : (
        /* Reviews View */
        <div className="flex flex-col flex-1">
          {/* Telemetry Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-[var(--border)] bg-[var(--surface)] divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
            <div className="p-5 flex flex-col">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Total Reviews
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-semibold text-[var(--text-primary)]">
                <AnimatedCounter value={stats.total_reviews} />
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
                Autonomous PR checks
              </span>
            </div>

            <div className="p-5 flex flex-col">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-[var(--error)]" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--error)]">
                  Errors Prevented
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-semibold text-[var(--error)]">
                <AnimatedCounter value={stats.total_errors} />
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
                Security & logic bugs
              </span>
            </div>

            <div className="p-5 flex flex-col">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--warning)]">
                  Warnings Caught
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-semibold text-[var(--warning)]">
                <AnimatedCounter value={stats.total_warnings} />
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono mt-1">
                Edge cases & race conditions
              </span>
            </div>

            <div className="p-5 flex flex-col">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Active Repositories
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-semibold text-[var(--text-primary)]">
                <AnimatedCounter value={stats.repos_monitored} />
              </div>
              <span className="text-[11px] text-[var(--accent)] font-mono mt-1">
                ● Real-time webhook active
              </span>
            </div>
          </div>

          {/* Selected Repository Header Banner if filtered */}
          {repo !== "all" && (
            <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-mono font-semibold text-[var(--text-primary)]">
                        {repo}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--bg)] text-[var(--accent)] border border-[var(--border)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                        Monitored
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                      {currentRepoInfo?.description || "GitHub repository monitored by PR Pilot"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://github.com/${repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span>Open GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <Link
                    href="/dashboard?tab=reviews&repo=all"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span>View All Reviews</span>
                  </Link>
                </div>
              </div>

              {/* Instant review trigger embedded for this repository */}
              <ManualReviewTrigger defaultRepo={repo} />
            </div>
          )}

          {/* Filter Bar */}
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-mono font-medium text-[var(--text-primary)] flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-[var(--accent)]" />
                <span>
                  {repo === "all" 
                    ? "All Pull Request Reviews" 
                    : `Reviews for ${repo.split("/")[1] || repo}`
                  }
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                Showing {reviews.length} reviews {isFallback && repo === "all" && "(Sample Data for Evaluation)"}
              </p>
            </div>

            {/* Severity filter pills */}
            <div className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]">
              <Link
                href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo)}&filter=all`}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                  filter === "all"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                All
              </Link>
              <Link
                href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo)}&filter=errors`}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                  filter === "errors"
                    ? "bg-[var(--error-dim)] text-[var(--error)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Errors
              </Link>
              <Link
                href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo)}&filter=warnings`}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                  filter === "warnings"
                    ? "bg-[var(--warning-dim)] text-[var(--warning)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Warnings
              </Link>
              <Link
                href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo)}&filter=clean`}
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
                <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--accent)]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-mono font-medium text-[var(--text-primary)] mb-1">
                  {repo !== "all" 
                    ? `No reviews recorded for ${repo} yet` 
                    : "No matching reviews found"}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-mono max-w-md mx-auto mb-5 leading-relaxed">
                  {repo !== "all" 
                    ? `PR Pilot is connected to ${repo} and actively waiting for webhook events. Open a PR on GitHub or run an on-demand review above to inspect your first pull request.` 
                    : "No reviews matched the current filter. Try resetting filters or running an instant review."}
                </p>
                <div className="flex items-center justify-center gap-3 font-mono text-xs">
                  <Link
                    href={`/dashboard?tab=reviews&repo=all&filter=all`}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    View All Reviews
                  </Link>
                  <Link
                    href={`/dashboard?tab=repos`}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-[#0A0A0C] font-medium hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Browse All 34 Repositories
                  </Link>
                </div>
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
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-1.5">
                          <span className="text-[var(--text-muted)] font-medium">{repoShort}</span>
                          <span className="text-[var(--border-hover)]">#</span>
                          <span className="text-[var(--accent)] font-semibold">{rev.pr_number}</span>
                          <span className="text-[var(--text-muted)]">•</span>
                          <span className="text-[var(--text-secondary)]">{rev.pr_author}</span>
                          <span className="text-[var(--text-muted)]">•</span>
                          <span className="text-[var(--text-muted)]">{formatTimeAgo(rev.reviewed_at)}</span>
                        </div>

                        <h3 className="text-sm font-sans font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 mb-1.5">
                          {rev.pr_title}
                        </h3>

                        {rev.summary && (
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {rev.summary}
                          </p>
                        )}
                      </div>
                    </div>

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
      )}
    </div>
  );
}
