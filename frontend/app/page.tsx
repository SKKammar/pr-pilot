import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      {/* Nav */}
      <nav className="border-b border-[#1e1e2e] px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-sm text-[#6366f1] font-semibold tracking-widest uppercase">
          Pilot by Santosh
        </span>
        <Link
          href="/dashboard"
          className="text-sm text-[#64748b] hover:text-[#e2e8f0] transition-colors"
        >
          Dashboard →
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-6">
        <span className="text-xs font-mono text-[#6366f1] border border-[#6366f1]/30 
                         bg-[#6366f1]/10 px-3 py-1 rounded-full tracking-widest uppercase">
          AI-Powered Code Review
        </span>

        {/* Animated gradient heading */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight 
                       bg-gradient-to-r from-[#6366f1] via-[#a78bfa] to-[#e2e8f0] 
                       bg-clip-text text-transparent animate-gradient-x">
          Code reviews,<br />automated.
        </h1>

        <p className="max-w-lg text-[#64748b] text-lg leading-relaxed">
          Pilot by Santosh reviews your pull requests the moment they open — 
          spotting bugs, security issues, and logic errors before they reach main.
        </p>

        <div className="flex gap-4 mt-4">
          <a
            href="https://github.com/apps/pilot-by-santosh"
            className="px-6 py-3 bg-[#6366f1] text-white rounded-lg font-medium
                       hover:bg-[#4f46e5] transition-colors text-sm"
          >
            Install on GitHub
          </a>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-[#1e1e2e] text-[#e2e8f0] rounded-lg 
                       font-medium hover:border-[#6366f1]/50 transition-colors text-sm"
          >
            View Reviews
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: "⚡", title: "Instant", desc: "Reviews post within 30 seconds of PR open" },
          { icon: "🎯", title: "Precise", desc: "Inline comments on exact diff lines, not the file" },
          { icon: "🔒", title: "Secure", desc: "Webhook signatures verified, no code stored" },
        ].map((f) => (
          <div key={f.title} className="border border-[#1e1e2e] rounded-xl p-6 
                                        bg-[#12121a] hover:border-[#6366f1]/30 transition-colors">
            <div className="text-2xl mb-3">{f.icon}</div>
            <div className="font-semibold mb-1">{f.title}</div>
            <div className="text-sm text-[#64748b]">{f.desc}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
