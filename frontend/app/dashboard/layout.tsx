"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  CheckCircle2, 
  ExternalLink, 
  FolderGit2, 
  Github, 
  Home, 
  Layers, 
  Menu, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  X,
  GitPullRequest,
  Grid
} from "lucide-react";
import cachedRepositories from "@/data/repositories.json";

function SidebarContent() {
  const [repos, setRepos] = useState<string[]>(() => 
    cachedRepositories.map((r) => r.full_name)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get("tab") || "repos";
  const currentRepo = searchParams?.get("repo") || "all";

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch("/api/repos");
        if (res.ok) {
          const data = await res.json();
          if (data.repositories && data.repositories.length > 0) {
            setRepos(data.repositories);
          }
        }
      } catch {}
    }

    loadRepos();
  }, []);

  const selectRepo = (repoName: string) => {
    setMobileMenuOpen(false);
    if (repoName === "all") {
      router.push("/dashboard?tab=repos");
    } else {
      router.push(`/dashboard?tab=reviews&repo=${encodeURIComponent(repoName)}`);
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-5 h-14 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--accent-dim)] border border-[var(--accent)]/40 flex items-center justify-center font-mono font-bold text-[var(--accent)] text-xs">
            PR
          </div>
          <span className="font-mono font-medium text-sm text-[var(--text-primary)]">pr-pilot</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-30 h-screen w-64 md:min-w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Header */}
          <div className="p-5 border-b border-[var(--border)] hidden md:flex items-center justify-between shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-md bg-[var(--accent-dim)] border border-[var(--accent)]/40 flex items-center justify-center font-mono font-bold text-[var(--accent)] text-xs group-hover:scale-105 transition-transform">
                PR
              </div>
              <span className="font-mono font-semibold text-sm tracking-tight text-[var(--text-primary)]">
                pr-pilot
              </span>
            </Link>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--accent)] border border-[var(--border)]">
              v2.0
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 shrink-0">
            <Link
              href="/dashboard?tab=repos"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                currentTab === "repos" && currentRepo === "all"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Grid className="w-4 h-4" />
                <span>Repositories</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg)] text-[var(--accent)] border border-[var(--border)]">
                {repos.length}
              </span>
            </Link>

            <Link
              href="/dashboard?tab=reviews"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                currentTab === "reviews" && currentRepo === "all"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>All Reviews</span>
            </Link>

            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home & Overview</span>
            </Link>

            <a
              href="https://github.com/apps/pilot-by-santosh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Github className="w-4 h-4" />
                <span>GitHub App Config</span>
              </div>
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
            </a>
          </nav>

          {/* Repositories Section */}
          <div className="p-3 border-t border-[var(--border)] flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Your Repositories
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg)] text-[var(--accent)] border border-[var(--border)]">
                {repos.length}
              </span>
            </div>

            {/* Quick Repo Search */}
            <div className="relative mb-2">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter repositories..."
                className="w-full pl-7 pr-2 py-1 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* Scrollable Repo List */}
            <div className="space-y-0.5 overflow-y-auto flex-1 pr-1">
              <button
                onClick={() => selectRepo("all")}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center justify-between ${
                  currentRepo === "all" && currentTab === "repos"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span>All Repositories</span>
                <span className="text-[10px] text-[var(--text-muted)]">{repos.length}</span>
              </button>

              {filteredRepos.map((repo) => {
                const shortName = repo.split("/")[1] || repo;
                const isSelected = currentRepo.toLowerCase() === repo.toLowerCase();
                return (
                  <button
                    key={repo}
                    onClick={() => selectRepo(repo)}
                    title={repo}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors flex items-center gap-2 truncate ${
                      isSelected
                        ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-subtle)] shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-[var(--text-secondary)] truncate">
                @SKKammar ({repos.length} Connected)
              </span>
            </div>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <Suspense fallback={<aside className="hidden md:block w-64 min-w-64 border-r border-[var(--border)] bg-[var(--surface)] h-screen" />}>
        <SidebarContent />
      </Suspense>
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
