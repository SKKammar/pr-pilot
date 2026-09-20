"use client";
import { useState, useEffect } from "react";
import { 
  Play, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  ExternalLink, 
  FolderGit2, 
  GitPullRequest, 
  Search, 
  Zap,
  Terminal,
  Server
} from "lucide-react";
import { useRouter } from "next/navigation";
import cachedRepositories from "@/data/repositories.json";

interface ManualReviewTriggerProps {
  defaultRepo?: string;
  defaultPrNumber?: number | string;
  onSuccess?: () => void;
}

export function ManualReviewTrigger({ 
  defaultRepo, 
  defaultPrNumber, 
  onSuccess 
}: ManualReviewTriggerProps) {
  const [mode, setMode] = useState<"select" | "url">("select");
  const [selectedRepo, setSelectedRepo] = useState(
    defaultRepo && defaultRepo !== "all" ? defaultRepo : "SKKammar/pr-pilot"
  );
  const [prNumber, setPrNumber] = useState(defaultPrNumber ? String(defaultPrNumber) : "142");
  const [prUrl, setPrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [showBackendCmd, setShowBackendCmd] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    message: string; 
    repo?: string; 
    pr?: number;
    deliveryId?: string;
    is_live?: boolean;
    is_simulated?: boolean;
    hint?: string;
  } | null>(null);

  const router = useRouter();

  // Check backend status on load
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch("/api/backend-status");
        if (res.ok) {
          const data = await res.json();
          setBackendOnline(Boolean(data.online));
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    }
    checkBackend();
  }, []);

  // Keep selectedRepo in sync if defaultRepo changes
  useEffect(() => {
    if (defaultRepo && defaultRepo !== "all") {
      setSelectedRepo(defaultRepo);
    }
  }, [defaultRepo]);

  const setPreset = (repo: string, pr: number) => {
    setMode("select");
    setSelectedRepo(repo);
    setPrNumber(String(pr));
    setResult(null);
  };

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setProgressStep(1);

    // Step animation ticker
    const timer1 = setTimeout(() => setProgressStep(2), 700);
    const timer2 = setTimeout(() => setProgressStep(3), 1600);

    try {
      const payload = mode === "url" 
        ? { pr_url: prUrl } 
        : { repo_full_name: selectedRepo, pr_number: parseInt(prNumber, 10) || 1 };

      const res = await fetch("/api/trigger-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setProgressStep(4);

      const data = await res.json();
      if (res.ok || data.status === "success") {
        setResult({
          success: true,
          message: data.message || "Review successfully completed!",
          repo: selectedRepo,
          pr: parseInt(prNumber, 10) || 1,
          deliveryId: data.delivery_id,
          is_live: data.is_live,
          is_simulated: data.is_simulated,
          hint: data.hint,
        });
        if (onSuccess) onSuccess();
      } else {
        setResult({
          success: false,
          message: data.detail || data.error || "Could not trigger review.",
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: "Failed to connect to backend review service. Ensure backend is running.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-sm text-left">
      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="w-5 h-5 rounded bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">Instant Review Runner</span>
          <span className="text-[var(--text-muted)]">•</span>
          
          {/* Backend Status indicator */}
          <button
            type="button"
            onClick={() => setShowBackendCmd(!showBackendCmd)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono transition-colors hover:bg-[var(--bg)]"
            title="Click to toggle backend startup instructions"
          >
            {backendOnline === true ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                <span className="text-[var(--success)]">Backend Online (Port 8000)</span>
              </>
            ) : backendOnline === false ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />
                <span className="text-[var(--warning)]">Backend Offline (Click for command)</span>
              </>
            ) : (
              <span className="text-[var(--text-muted)]">Checking backend...</span>
            )}
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-[var(--bg)] p-0.5 rounded-lg border border-[var(--border)] text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "select"
                ? "bg-[var(--surface)] text-[var(--accent)] font-medium shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Select Repo & PR
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "url"
                ? "bg-[var(--surface)] text-[var(--accent)] font-medium shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Paste PR Link
          </button>
        </div>
      </div>

      {/* Backend Command Accordion if toggled */}
      {showBackendCmd && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              Run PR Pilot Python Backend:
            </span>
            <button
              onClick={() => setShowBackendCmd(false)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
          <div className="p-2 rounded bg-black/40 text-[var(--accent)] select-all overflow-x-auto text-[11px]">
            cd backend && .\venv\Scripts\uvicorn app.main:app --port 8000
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            PR Pilot automatically uses demo evaluation mode if the local Python server is not active.
          </p>
        </div>
      )}

      {/* Form Input */}
      <form onSubmit={handleTrigger} className="space-y-3">
        {mode === "select" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Repository Select */}
            <div className="sm:col-span-2 relative">
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer appearance-none"
              >
                {cachedRepositories.map((repo) => (
                  <option key={repo.full_name} value={repo.full_name}>
                    {repo.full_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-mono">
                ▼
              </div>
            </div>

            {/* PR Number */}
            <div className="relative">
              <input
                type="number"
                min="1"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                placeholder="PR #"
                className="w-full px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                required
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/SKKammar/pr-pilot/pull/1"
              className="w-full px-3.5 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              required
            />
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[var(--accent)]" />
              Quick demo:
            </span>
            <button
              type="button"
              onClick={() => setPreset("SKKammar/pr-pilot", 142)}
              className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
            >
              SQL Injection #142
            </button>
            <button
              type="button"
              onClick={() => setPreset("SKKammar/SecretShield", 1)}
              className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
            >
              Token Leak #1
            </button>
            <button
              type="button"
              onClick={() => setPreset("SKKammar/FlowMind", 89)}
              className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
            >
              Race Condition #89
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (mode === "url" ? !prUrl.trim() : !prNumber.trim())}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[var(--accent)] text-[#0A0A0C] font-mono text-xs font-medium hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Autonomous Review In Progress...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Autonomous Review</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Live multi-step execution tracker */}
      {loading && (
        <div className="mt-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
            <span>Execution Pipeline</span>
            <span className="text-[var(--accent)]">Step {progressStep} of 4</span>
          </div>

          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${progressStep >= 1 ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
            <span className={progressStep === 1 ? "text-[var(--accent)] font-medium" : ""}>
              1. Verifying GitHub App credentials for @SKKammar
            </span>
          </div>

          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${progressStep >= 2 ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
            <span className={progressStep === 2 ? "text-[var(--accent)] font-medium" : ""}>
              2. Fetching PR git unified diff and filtering noise files
            </span>
          </div>

          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${progressStep >= 3 ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--border)]"}`} />
            <span className={progressStep === 3 ? "text-[var(--accent)] font-medium" : ""}>
              3. Gemini 2.0 Flash analyzing AST syntax, security & logic
            </span>
          </div>

          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${progressStep >= 4 ? "bg-[var(--success)]" : "bg-[var(--border)]"}`} />
            <span className={progressStep === 4 ? "text-[var(--success)] font-medium" : ""}>
              4. Compiling inline feedback & syncing with telemetry
            </span>
          </div>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div
          className={`mt-3.5 p-3.5 rounded-lg text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            result.success
              ? result.is_simulated
                ? "bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/30"
                : "bg-[var(--success-dim)] text-[var(--success)] border border-[var(--success)]/30"
              : "bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]/30"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {result.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">{result.message}</div>
              {result.hint && (
                <div className="text-[11px] opacity-90 mt-1">
                  💡 {result.hint}
                </div>
              )}
            </div>
          </div>

          {result.success && (
            <button
              onClick={() => {
                router.push(`/dashboard?tab=reviews&repo=${encodeURIComponent(result.repo || selectedRepo)}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0"
            >
              <span>View in Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
