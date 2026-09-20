"use client";
import { useState } from "react";
import { AlertCircle, AlertTriangle, Check, Copy, FileCode, Sparkles, Terminal } from "lucide-react";

interface Scenario {
  id: string;
  filename: string;
  badge: string;
  title: string;
  summary: string;
  severity: "error" | "warning";
  line: number;
  diffLines: {
    type: "context" | "del" | "add";
    numOld?: number;
    numNew?: number;
    code: string;
    hasComment?: boolean;
  }[];
  comment: {
    rule: string;
    message: string;
    suggestion: string;
  };
}

const SCENARIOS: Scenario[] = [
  {
    id: "sql-injection",
    filename: "backend/auth/queries.py",
    badge: "Security",
    title: "SQL Injection via string interpolation",
    summary: "Unescaped user input passed directly into database execution string.",
    severity: "error",
    line: 14,
    diffLines: [
      { type: "context", numOld: 11, numNew: 11, code: "def fetch_user_by_id(db_conn, user_id: str):" },
      { type: "context", numOld: 12, numNew: 12, code: "    cursor = db_conn.cursor()" },
      { type: "del", numOld: 13, code: "-    query = f\"SELECT * FROM users WHERE id = '{user_id}'\"" },
      { type: "add", numNew: 13, code: "+    query = f\"SELECT * FROM users WHERE id = '{user_id}' AND is_active = 1\"" },
      { type: "add", numNew: 14, code: "+    cursor.execute(query)", hasComment: true },
      { type: "context", numOld: 15, numNew: 15, code: "    return cursor.fetchone()" },
    ],
    comment: {
      rule: "CWE-89: SQL Injection Vulnerability",
      message: "Directly formatting raw `user_id` into SQL query string allows SQL injection. An attacker can craft malicious inputs (e.g. `' OR '1'='1`) to bypass authentication and dump table data.",
      suggestion: "cursor.execute(\"SELECT * FROM users WHERE id = %s AND is_active = 1\", (user_id,))",
    },
  },
  {
    id: "resource-leak",
    filename: "internal/worker/indexer.go",
    badge: "Reliability",
    title: "Unclosed database connection pool leak",
    summary: "Acquired database connection is never closed, leading to connection exhaustion.",
    severity: "error",
    line: 42,
    diffLines: [
      { type: "context", numOld: 39, numNew: 39, code: "func ProcessBatch(ctx context.Context, pool *pgxpool.Pool) error {" },
      { type: "add", numNew: 40, code: "+    conn, err := pool.Acquire(ctx)" },
      { type: "add", numNew: 41, code: "+    if err != nil {" },
      { type: "add", numNew: 42, code: "+        return fmt.Errorf(\"acquire failed: %w\", err)", hasComment: true },
      { type: "add", numNew: 43, code: "+    }" },
      { type: "context", numOld: 41, numNew: 44, code: "    // process batch records" },
    ],
    comment: {
      rule: "Resource Leak: Missing Connection Release",
      message: "Connection acquired from pgxpool is never released. If any subsequent operations fail or return early, the database pool will be rapidly exhausted under load.",
      suggestion: "conn, err := pool.Acquire(ctx)\nif err != nil {\n    return fmt.Errorf(\"acquire failed: %w\", err)\n}\ndefer conn.Release()",
    },
  },
  {
    id: "null-reference",
    filename: "services/billing/checkout.ts",
    badge: "Runtime Bug",
    title: "Unchecked nested property access",
    summary: "Dereferencing undefined object properties causes runtime TypeError crashes.",
    severity: "warning",
    line: 28,
    diffLines: [
      { type: "context", numOld: 25, numNew: 25, code: "export async function getCustomerInvoice(user: UserProfile) {" },
      { type: "context", numOld: 26, numNew: 26, code: "  const stripeId = user.stripeCustomerId;" },
      { type: "add", numNew: 27, code: "+  // Fetch latest billing account settings" },
      { type: "add", numNew: 28, code: "+  const taxExempt = user.billingSettings.taxExemptionStatus;", hasComment: true },
      { type: "context", numOld: 28, numNew: 29, code: "  return generateInvoice(stripeId, taxExempt);" },
    ],
    comment: {
      rule: "Null Dereference Risk",
      message: "`user.billingSettings` can be null or undefined for recently signed up users who have not completed checkout onboarding. Accessing `.taxExemptionStatus` will throw an unhandled TypeError.",
      suggestion: "const taxExempt = user.billingSettings?.taxExemptionStatus ?? false;",
    },
  },
];

export function DiffSimulator() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("sql-injection");
  const [copied, setCopied] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xl">
      {/* Simulator Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--bg-subtle)] gap-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/60 border border-[#EF4444]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/60 border border-[#F59E0B]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/60 border border-[#10B981]" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-medium text-[var(--text-primary)]">Live Diff Inspector</span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-[var(--text-muted)]">Gemini 2.0 Flash Simulation</span>
          </div>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)] w-full sm:w-auto overflow-x-auto">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveScenarioId(s.id);
                setCopied(false);
              }}
              className={`px-3 py-1 text-xs rounded-md font-mono transition-all whitespace-nowrap ${
                activeScenarioId === s.id
                  ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium border border-[var(--accent)]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {s.badge}
            </button>
          ))}
        </div>
      </div>

      {/* File Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface)] font-mono text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-[var(--text-primary)] font-medium">{scenario.filename}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-muted)]">Review latency: ~1.2s</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]/20">
            1 issue detected
          </span>
        </div>
      </div>

      {/* Diff Content Area */}
      <div className="p-0 font-mono text-xs overflow-x-auto divide-y divide-[var(--border-subtle)]/40">
        {scenario.diffLines.map((line, idx) => (
          <div key={idx}>
            <div
              className={`flex items-center py-1 px-4 leading-relaxed transition-colors ${
                line.type === "add"
                  ? "bg-[var(--diff-add-bg)] text-[var(--diff-add-text)]"
                  : line.type === "del"
                  ? "bg-[var(--diff-del-bg)] text-[var(--diff-del-text)] opacity-80"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div className="w-8 select-none text-[var(--text-muted)] text-right pr-2">
                {line.numOld || ""}
              </div>
              <div className="w-8 select-none text-[var(--text-muted)] text-right pr-3 border-r border-[var(--border)]/40">
                {line.numNew || ""}
              </div>
              <div className="w-5 select-none text-center font-bold">
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </div>
              <div className="flex-1 pl-2 font-mono whitespace-pre">{line.code}</div>
            </div>

            {/* Inline AI Review Comment Card */}
            {line.hasComment && (
              <div className="my-2 mx-4 sm:ml-20 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--error)]" />

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[var(--error-dim)] flex items-center justify-center">
                      <AlertCircle className="w-3.5 h-3.5 text-[var(--error)]" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-[var(--error)] tracking-wide uppercase">
                      PR Pilot • Senior Code Review
                    </span>
                    <span className="text-[var(--text-muted)] text-[11px]">• Line {scenario.line}</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    {scenario.comment.rule}
                  </span>
                </div>

                <p className="text-[13px] text-[var(--text-primary)] font-sans leading-relaxed mb-3">
                  {scenario.comment.message}
                </p>

                {/* Suggested Fix Box */}
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-[var(--accent)] font-medium">
                      Suggested Fix (GitHub 1-click apply):
                    </span>
                    <button
                      onClick={() => handleCopy(scenario.comment.suggestion)}
                      className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-[var(--success)]" />
                          <span className="text-[var(--success)]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Fix</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-[var(--success)] overflow-x-auto whitespace-pre p-1">
                    {scenario.comment.suggestion}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Simulator Footer Status */}
      <div className="border-t border-[var(--border)] px-4 py-2.5 bg-[var(--bg-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span>Webhook Engine: 200 OK (&lt; 350ms)</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span>Concurrency Semaphore: 3</span>
          <span>Diff Position Mapping: 100% Accurate</span>
        </div>
      </div>
    </div>
  );
}
