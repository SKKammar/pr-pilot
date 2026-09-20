"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[11px] font-mono"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-[var(--success)]" />
          <span className="text-[var(--success)] font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Copy Fix</span>
        </>
      )}
    </button>
  );
}
