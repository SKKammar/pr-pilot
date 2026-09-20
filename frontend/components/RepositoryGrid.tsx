"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  ExternalLink, 
  FolderGit2, 
  Github, 
  Play, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  X,
  Layers,
  ArrowRight,
  GitPullRequest
} from "lucide-react";
import { RepositoryItem } from "@/app/api/repos/route";
import { ManualReviewTrigger } from "@/components/ManualReviewTrigger";

interface RepositoryGridProps {
  repositories: RepositoryItem[];
}

export function RepositoryGrid({ repositories }: RepositoryGridProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeRepoForReview, setActiveRepoForReview] = useState<string | null>(null);

  // Categorize repositories based on names and descriptions
  const categorizedRepos = useMemo(() => {
    return repositories.map((repo) => {
      const name = repo.name.toLowerCase();
      const desc = (repo.description || "").toLowerCase();
      let category = "other";

      if (
        name.includes("shield") || 
        name.includes("auth") || 
        name.includes("pilot") || 
        name.includes("guard") ||
        name.includes("safe") ||
        name.includes("sos") ||
        name.includes("anomaly")
      ) {
        category = "security-ai";
      } else if (
        name.includes("api") || 
        name.includes("flow") || 
        name.includes("arbiter") || 
        name.includes("scraper") ||
        name.includes("inventory") ||
        name.includes("boot")
      ) {
        category = "backend-systems";
      } else if (
        name.includes("portfolio") || 
        name.includes("widget") || 
        name.includes("game") || 
        name.includes("toe") || 
        name.includes("ladder") ||
        name.includes("markdown")
      ) {
        category = "frontend-apps";
      }

      return { ...repo, category };
    });
  }, [repositories]);

  const filteredRepos = useMemo(() => {
    return categorizedRepos.filter((repo) => {
      const matchesSearch = 
        repo.name.toLowerCase().includes(search.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(search.toLowerCase())) ||
        repo.full_name.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = 
        selectedCategory === "all" || repo.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [categorizedRepos, search, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or description (e.g. SecretShield, UptimeGuard, FlowMind)..."
            className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 font-mono text-xs">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === "all"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            All ({repositories.length})
          </button>
          <button
            onClick={() => setSelectedCategory("security-ai")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === "security-ai"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            Security & AI
          </button>
          <button
            onClick={() => setSelectedCategory("backend-systems")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === "backend-systems"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            Backends & APIs
          </button>
          <button
            onClick={() => setSelectedCategory("frontend-apps")}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === "frontend-apps"
                ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
            }`}
          >
            Web Apps & UI
          </button>
        </div>
      </div>

      {/* Quick Active Review Modal/Drawer if triggered */}
      {activeRepoForReview && (
        <div className="p-4 rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              <h3 className="text-xs font-mono font-medium text-[var(--text-primary)]">
                Trigger On-Demand Review: <span className="text-[var(--accent)]">{activeRepoForReview}</span>
              </h3>
            </div>
            <button
              onClick={() => setActiveRepoForReview(null)}
              className="p-1 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ManualReviewTrigger defaultRepo={activeRepoForReview} />
        </div>
      )}

      {/* Repositories Grid */}
      {filteredRepos.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <FolderGit2 className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-3" />
          <h4 className="text-sm font-mono font-medium text-[var(--text-primary)] mb-1">
            No repositories matched "{search}"
          </h4>
          <p className="text-xs text-[var(--text-secondary)] font-mono mb-4">
            Try clearing your search query or choosing another filter category.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
            }}
            className="px-3 py-1.5 rounded-md font-mono text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRepos.map((repo) => {
            const isReviewOpen = activeRepoForReview === repo.full_name;

            return (
              <div
                key={repo.full_name}
                className={`group flex flex-col justify-between p-4 rounded-xl border bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all ${
                  isReviewOpen 
                    ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30" 
                    : "border-[var(--border)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0">
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-mono font-semibold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {repo.name}
                        </h4>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {repo.owner}
                        </span>
                      </div>
                    </div>

                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open on GitHub"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-3 min-h-[2.5rem]">
                    {repo.description || "Active GitHub repository monitored by PR Pilot autonomous review bot."}
                  </p>
                </div>

                {/* Status & Actions */}
                <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      Webhook Active
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveRepoForReview(isReviewOpen ? null : repo.full_name)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        isReviewOpen
                          ? "bg-[var(--accent)] text-[#0A0A0C]"
                          : "bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isReviewOpen ? "Close Runner" : "Review PR"}</span>
                    </button>

                    <Link
                      href={`/dashboard?tab=reviews&repo=${encodeURIComponent(repo.full_name)}`}
                      className="flex items-center justify-center p-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
                      title="View reviews for this repository"
                    >
                      <GitPullRequest className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
