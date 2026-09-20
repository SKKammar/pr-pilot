import Link from "next/link";
import { DiffSimulator } from "@/components/DiffSimulator";
import { ManualReviewTrigger } from "@/components/ManualReviewTrigger";
import cachedRepositories from "@/data/repositories.json";
import { 
  ArrowRight, 
  CheckCircle2, 
  Code2, 
  Cpu, 
  ExternalLink, 
  FolderGit2, 
  Github, 
  Layers, 
  Play, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Zap,
  Grid,
  GitPullRequest
} from "lucide-react";

export default function LandingPage() {
  const totalRepos = cachedRepositories.length || 34;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex flex-col selection:bg-[var(--accent-dim)] selection:text-[var(--accent)]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 text-decoration-none group">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/40 flex items-center justify-center font-mono font-bold text-[var(--accent)] text-sm group-hover:scale-105 transition-transform">
                PR
              </div>
              <span className="font-mono font-semibold text-base tracking-tight text-[var(--text-primary)]">
                pr-pilot
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-[var(--surface)] text-[var(--accent)] border border-[var(--border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Connected to @SKKammar ({totalRepos} Repos)
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/dashboard?tab=repos"
              className="text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--surface-hover)] flex items-center gap-1.5"
            >
              <Grid className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Repositories</span>
            </Link>

            <Link
              href="/dashboard?tab=reviews"
              className="text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--surface-hover)] flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Reviews</span>
            </Link>

            <a
              href="https://github.com/apps/pilot-by-santosh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono font-medium px-3.5 py-1.5 rounded-md bg-[var(--accent)] text-[#0A0A0C] hover:bg-[var(--accent-hover)] transition-all shadow-sm hover:shadow-[0_0_15px_rgba(200,241,105,0.3)]"
            >
              <Github className="w-3.5 h-3.5" />
              <span>App Settings</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(200,241,105,0.08),transparent_70%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)] mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>
              Autonomous Gemini 2.0 Flash • {totalRepos} GitHub Repositories Monitored
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-sans font-medium tracking-tight text-[var(--text-primary)] leading-[1.1] mb-5">
            Your PRs, reviewed before <br />
            <span className="text-[var(--accent)] font-mono">the first human comment.</span>
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed mb-8 font-sans">
            Autonomous, high-speed pull request code reviews. Catches SQL injection risks, token leaks, and race conditions with line-by-line inline GitHub feedback in seconds.
          </p>

          {/* Direct CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs mb-10">
            <Link
              href="/dashboard?tab=repos"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[#0A0A0C] font-semibold hover:bg-[var(--accent-hover)] transition-all shadow-md hover:shadow-[0_0_20px_rgba(200,241,105,0.4)]"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>Open Repositories Dashboard ({totalRepos})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/dashboard?tab=reviews"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Layers className="w-4 h-4 text-[var(--accent)]" />
              <span>Review Feed & Telemetry</span>
            </Link>

            <a
              href="#simulator"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Code2 className="w-4 h-4" />
              <span>Diff Inspector Demo</span>
            </a>
          </div>
        </div>

        {/* Convenient Instant Review Box in Hero */}
        <div className="max-w-3xl mx-auto mb-12">
          <ManualReviewTrigger />
        </div>

        {/* Connected Repositories Quick Strip */}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3 px-1 font-mono text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <FolderGit2 className="w-4 h-4 text-[var(--accent)]" />
              <span>Installed Repositories ({totalRepos} Connected to GitHub App):</span>
            </span>
            <Link
              href="/dashboard?tab=repos"
              className="text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all in Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 font-mono text-xs">
            {cachedRepositories.slice(0, 12).map((repo) => (
              <Link
                key={repo.full_name}
                href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo.full_name)}`}
                className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hover)] transition-all flex items-center justify-between group"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                    {repo.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    @SKKammar
                  </div>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0">
                  Review →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-3 text-center">
            <Link
              href="/dashboard?tab=repos"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              <span>+ {totalRepos - 12} more repositories connected. Browse full directory in dashboard →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Step Pipeline Workflow */}
      <section className="py-16 px-6 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--accent)]">
              Automated Review Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-sans font-medium text-[var(--text-primary)] mt-1.5">
              How PR Pilot guards your codebase
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 max-w-lg mx-auto">
              From git push to line-by-line review comments in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center font-mono font-bold text-xs mb-3">
                  01
                </div>
                <h3 className="text-xs font-mono font-semibold text-[var(--text-primary)] mb-1">
                  Webhook Ingestion
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Sub-350ms FastAPI response verifies HMAC SHA-256 signature and enqueues PR event to background queue.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--accent)] mt-3">● Instant Acknowledgment</span>
            </div>

            <div className="p-5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-[var(--suggestion-dim)] text-[var(--suggestion)] flex items-center justify-center font-mono font-bold text-xs mb-3">
                  02
                </div>
                <h3 className="text-xs font-mono font-semibold text-[var(--text-primary)] mb-1">
                  Diff Chunking & Filtering
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Partitions git unified diffs per file. Automatically strips lockfiles, minified bundles, and images to conserve token budget.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--suggestion)] mt-3">● Zero Noise Files</span>
            </div>

            <div className="p-5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-[var(--warning-dim)] text-[var(--warning)] flex items-center justify-center font-mono font-bold text-xs mb-3">
                  03
                </div>
                <h3 className="text-xs font-mono font-semibold text-[var(--text-primary)] mb-1">
                  Gemini 2.0 Flash Review
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Deep AST reasoning evaluates SQL injection vulnerabilities, auth leak risks, and concurrent state race conditions.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--warning)] mt-3">● Structured JSON Diagnostics</span>
            </div>

            <div className="p-5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-[var(--success-dim)] text-[var(--success)] flex items-center justify-center font-mono font-bold text-xs mb-3">
                  04
                </div>
                <h3 className="text-xs font-mono font-semibold text-[var(--text-primary)] mb-1">
                  Inline GitHub Comments
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Publishes line-by-line review comments with 1-click suggested diffs and logs telemetry in Supabase dashboard.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--success)] mt-3">● GitHub Inline API</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section id="simulator" className="py-16 px-6 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--accent)]">
              Interactive Diff Inspector
            </span>
            <h2 className="text-2xl sm:text-3xl font-sans font-medium text-[var(--text-primary)] mt-1.5">
              Experience the live review workflow
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 max-w-lg mx-auto">
              Toggle between vulnerability types to see exact inline comments and 1-click suggested fixes.
            </p>
          </div>

          <DiffSimulator />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] py-8 px-6 font-mono text-xs text-[var(--text-secondary)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--accent-dim)] border border-[var(--accent)]/40 flex items-center justify-center font-bold text-[var(--accent)] text-[10px]">
              PR
            </div>
            <span className="text-[var(--text-primary)] font-medium">pr-pilot</span>
            <span>— Autonomous PR reviewer for @SKKammar</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard?tab=repos" className="hover:text-[var(--text-primary)] transition-colors">
              Repositories ({totalRepos})
            </Link>
            <Link href="/dashboard?tab=reviews" className="hover:text-[var(--text-primary)] transition-colors">
              Review Feed
            </Link>
            <a
              href="https://github.com/SKKammar/pr-pilot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
