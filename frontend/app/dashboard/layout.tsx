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
  ShieldCheck, 
  X 
} from "lucide-react";

function SidebarContent() {
  const [repos, setRepos] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRepo = searchParams?.get("repo") || "all";

  useEffect(() => {
    async function loadRepos() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        setIsDemoMode(true);
        setRepos(["SKKammar/pr-pilot", "facebook/react", "vercel/next.js", "pallets/flask"]);
        return;
      }

      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key);
        const { data, error } = await supabase
          .from("pr_pilot_reviews")
          .select("repo_full_name");
        
        if (error || !data || data.length === 0) {
          setIsDemoMode(true);
          setRepos(["SKKammar/pr-pilot", "facebook/react", "vercel/next.js", "pallets/flask"]);
        } else {
          const unique = Array.from(new Set(data.map((r) => r.repo_full_name).filter(Boolean))).sort() as string[];
          setRepos(unique.length > 0 ? unique : ["SKKammar/pr-pilot"]);
        }
      } catch {
        setIsDemoMode(true);
        setRepos(["SKKammar/pr-pilot", "facebook/react", "vercel/next.js", "pallets/flask"]);
      }
    }

    loadRepos();
  }, []);

  const selectRepo = (repoName: string) => {
    setMobileMenuOpen(false);
    if (repoName === "all") {
      router.push("/dashboard");
    } else {
      router.push(`/dashboard?repo=${encodeURIComponent(repoName)}`);
    }
  };

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

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-30 h-screen w-64 md:min-w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col justify-between transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Logo Header */}
          <div className="p-5 border-b border-[var(--border)] hidden md:flex items-center justify-between">
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

          {/* Main Navigation */}
          <nav className="p-4 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] px-3 py-1.5">
              Menu
            </div>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                pathname === "/dashboard" && currentRepo === "all"
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
              <span>Home & Demo</span>
            </Link>

            <a
              href="https://github.com/apps/pilot-by-santosh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Github className="w-4 h-4" />
                <span>Install GitHub App</span>
              </div>
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
            </a>
          </nav>

          {/* Repositories Filter */}
          <div className="p-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Repositories
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {repos.length}
              </span>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => selectRepo("all")}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center justify-between ${
                  currentRepo === "all"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span>All Repositories</span>
              </button>

              {repos.map((repo) => {
                const shortName = repo.split("/")[1] || repo;
                const isSelected = currentRepo === repo;
                return (
                  <button
                    key={repo}
                    onClick={() => selectRepo(repo)}
                    title={repo}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-2 truncate ${
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

        {/* Sidebar Footer: System Status */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-[var(--text-secondary)]">
                {isDemoMode ? "Live Demo Mode" : "Supabase Connected"}
              </span>
            </div>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
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
