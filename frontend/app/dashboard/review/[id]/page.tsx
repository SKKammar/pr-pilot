import Link from "next/link";
import { notFound } from "next/navigation";
import { 
  AlertCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Check, 
  ChevronRight, 
  Copy, 
  ExternalLink, 
  FileCode, 
  GitPullRequest, 
  Lightbulb, 
  Sparkles 
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

interface ReviewRecord {
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

interface ReviewCommentRecord {
  id: string;
  filename: string;
  line_pos: number;
  severity: "error" | "warning" | "suggestion";
  message: string;
  suggestion?: string | null;
}

const DEMO_DETAIL_MAP: Record<string, { review: ReviewRecord; comments: ReviewCommentRecord[] }> = {
  "rev-demo-01": {
    review: {
      id: "rev-demo-01",
      pr_number: 142,
      repo_full_name: "SKKammar/pr-pilot",
      pr_title: "feat(auth): add OAuth2 token exchange with refresh rotation",
      pr_author: "santosh",
      total_issues: 2,
      error_count: 1,
      warning_count: 1,
      suggestion_count: 0,
      summary: "Identified a potential token leak in error response headers and missing clock skew tolerance during JWT validation.",
      status: "posted",
      reviewed_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    comments: [
      {
        id: "c1",
        filename: "backend/app/security.py",
        line_pos: 47,
        severity: "error",
        message: "Token exposure in unhandled exception traceback: When validation fails, the raw token string is echoed in the HTTP 400 detail response.",
        suggestion: "raise HTTPException(status_code=401, detail=\"Authentication failed: invalid credentials\")",
      },
      {
        id: "c2",
        filename: "backend/app/auth.py",
        line_pos: 82,
        severity: "warning",
        message: "Missing clock skew leeway in JWT expiration check. Distributed servers with minor time drift may reject valid tokens.",
        suggestion: "jwt.decode(token, secret, algorithms=[\"HS256\"], leeway=60)",
      },
    ],
  },
  "rev-demo-02": {
    review: {
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
    comments: [
      {
        id: "c3",
        filename: "packages/react-reconciler/src/ReactFiberWorkLoop.js",
        line_pos: 1204,
        severity: "error",
        message: "Stale closure in concurrent transition lane: Interrupted render phase does not reset pending lane masks, causing dropped actions.",
        suggestion: "workInProgressRootExitStatus = RootIncomplete;\nresetContextDependencies();",
      },
      {
        id: "c4",
        filename: "packages/react-reconciler/src/ReactFiberHooks.js",
        line_pos: 340,
        severity: "suggestion",
        message: "Inline allocation inside hot loop can trigger garbage collection churn on low-end devices.",
        suggestion: "const memoizedAction = update.action;",
      },
    ],
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getReviewData(id: string) {
  if (DEMO_DETAIL_MAP[id]) {
    return DEMO_DETAIL_MAP[id];
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return first demo if id not found
    return DEMO_DETAIL_MAP["rev-demo-01"];
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key);

    const [reviewRes, commentsRes] = await Promise.all([
      supabase.from("pr_pilot_reviews").select("*").eq("id", id).single(),
      supabase
        .from("pr_pilot_review_comments")
        .select("*")
        .eq("review_id", id)
        .order("filename"),
    ]);

    if (!reviewRes.data) {
      return DEMO_DETAIL_MAP[id] || DEMO_DETAIL_MAP["rev-demo-01"];
    }

    return {
      review: reviewRes.data as ReviewRecord,
      comments: (commentsRes.data || []) as ReviewCommentRecord[],
    };
  } catch {
    return DEMO_DETAIL_MAP[id] || DEMO_DETAIL_MAP["rev-demo-01"];
  }
}

export default async function ReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getReviewData(params.id);
  if (!data) notFound();

  const { review, comments } = data;

  // Group comments by file
  const byFile: Record<string, ReviewCommentRecord[]> = {};
  for (const c of comments) {
    if (!byFile[c.filename]) byFile[c.filename] = [];
    byFile[c.filename].push(c);
  }

  const githubPrUrl = `https://github.com/${review.repo_full_name}/pull/${review.pr_number}`;
  const repoShort = review.repo_full_name.split("/")[1] || review.repo_full_name;

  return (
    <div className="min-h-full bg-[var(--bg)] pb-16">
      {/* Header Bar */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-5">
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)] mb-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Reviews</span>
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)]">{repoShort}</span>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">#{review.pr_number}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-[var(--bg)] text-[var(--accent)] border border-[var(--border)] font-semibold">
                PR #{review.pr_number}
              </span>
              <span className="text-[var(--text-secondary)]">by {review.pr_author}</span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="text-[var(--text-muted)]">{formatDate(review.reviewed_at)}</span>
            </div>
            <h1 className="text-xl font-mono font-semibold text-[var(--text-primary)] tracking-tight">
              {review.pr_title}
            </h1>
          </div>

          <a
            href={githubPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-hover)] text-xs font-mono text-[var(--text-primary)] transition-colors shrink-0 self-start sm:self-center"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </a>
        </div>
      </div>

      {/* Stats Summary Tally */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 px-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Total Issues
          </span>
          <div className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-0.5">
            {review.total_issues}
          </div>
        </div>

        <div className="p-4 px-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--error)]">
            Errors
          </span>
          <div className="text-2xl font-mono font-semibold text-[var(--error)] mt-0.5">
            {review.error_count}
          </div>
        </div>

        <div className="p-4 px-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--warning)]">
            Warnings
          </span>
          <div className="text-2xl font-mono font-semibold text-[var(--warning)] mt-0.5">
            {review.warning_count}
          </div>
        </div>

        <div className="p-4 px-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--suggestion)]">
            Suggestions
          </span>
          <div className="text-2xl font-mono font-semibold text-[var(--suggestion)] mt-0.5">
            {review.suggestion_count}
          </div>
        </div>
      </div>

      {/* Overall AI Summary Banner */}
      {review.summary && (
        <div className="mx-6 mt-6 p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase tracking-wider">Senior Engineer Diagnosis</span>
          </div>
          <p className="text-sm text-[var(--text-primary)] font-sans leading-relaxed">
            {review.summary}
          </p>
        </div>
      )}

      {/* Issues By File */}
      <div className="px-6 mt-6 space-y-6">
        {comments.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="w-10 h-10 rounded-full bg-[var(--success-dim)] border border-[var(--success)]/30 flex items-center justify-center mx-auto mb-3 text-[var(--success)]">
              <Check className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-mono font-medium text-[var(--text-primary)]">
              No Issues Found
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              PR Pilot reviewed all files in this pull request and found zero bugs or security flaws.
            </p>
          </div>
        ) : (
          Object.entries(byFile).map(([filename, fileComments]) => {
            const fileErrors = fileComments.filter((c) => c.severity === "error").length;
            const fileWarnings = fileComments.filter((c) => c.severity === "warning").length;

            return (
              <div
                key={filename}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm"
              >
                {/* File Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[var(--accent)]" />
                    <span className="font-medium text-[var(--text-primary)]">{filename}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {fileErrors > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]/30">
                        {fileErrors} error{fileErrors > 1 ? "s" : ""}
                      </span>
                    )}
                    {fileWarnings > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/30">
                        {fileWarnings} warning{fileWarnings > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* File Comments */}
                <div className="divide-y divide-[var(--border)]">
                  {fileComments.map((c) => (
                    <div key={c.id} className="p-5 flex flex-col sm:flex-row items-start gap-4">
                      {/* Line Number indicator */}
                      <div className="shrink-0 w-16">
                        <span className="inline-block px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] font-mono text-xs text-[var(--text-muted)] font-medium">
                          Line {c.line_pos}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              c.severity === "error"
                                ? "bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]/30"
                                : c.severity === "warning"
                                ? "bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/30"
                                : "bg-[var(--suggestion-dim)] text-[var(--suggestion)] border border-[var(--suggestion)]/30"
                            }`}
                          >
                            {c.severity}
                          </span>
                        </div>

                        <p className="text-sm text-[var(--text-primary)] font-sans leading-relaxed mb-3">
                          {c.message}
                        </p>

                        {/* Suggestion block */}
                        {c.suggestion && (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3.5 font-mono text-xs">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] text-[var(--accent)] font-medium">
                                Suggested Replacement:
                              </span>
                              <CopyButton text={c.suggestion} />
                            </div>
                            <pre className="text-[var(--diff-add-text)] overflow-x-auto whitespace-pre p-1">
                              {c.suggestion}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
