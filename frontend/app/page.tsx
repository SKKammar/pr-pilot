import Link from "next/link";
import { StatsBar } from "@/components/StatsBar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] font-sans">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center pt-32 pb-16 px-6 text-center gap-8">
        <div className="animate-fade-up font-mono text-xs text-[#6366f1] border border-[#6366f1]/30 
                        bg-[#6366f1]/10 px-4 py-1.5 rounded-full tracking-widest"
             style={{ animationDelay: "0ms" }}>
          AI-POWERED · GITHUB APP · FREE
        </div>

        <h1 className="animate-fade-up text-6xl md:text-8xl font-bold tracking-tight leading-tight
                       bg-gradient-to-r from-[#6366f1] via-[#a78bfa] to-[#e2e8f0] 
                       bg-clip-text text-transparent animate-gradient-x"
            style={{ animationDelay: "100ms" }}>
          Code reviews,<br />
          on autopilot.
        </h1>

        <p className="animate-fade-up max-w-2xl text-[#64748b] text-lg md:text-xl leading-relaxed"
           style={{ animationDelay: "200ms" }}>
          PR Pilot reviews every pull request the moment it opens — spotting bugs, security holes, and logic errors before they hit main.
        </p>

        <div className="animate-fade-up flex flex-col sm:flex-row gap-4 mt-4" style={{ animationDelay: "300ms" }}>
          <a
            href="https://github.com/apps/pilot-by-santosh"
            className="px-8 py-4 bg-[#6366f1] text-white rounded-lg font-medium
                       hover:bg-[#4f46e5] transition-colors flex items-center justify-center gap-2"
          >
            Install on GitHub →
          </a>
          <Link
            href="/dashboard"
            className="px-8 py-4 border border-[#1e1e2e] text-[#e2e8f0] rounded-lg 
                       font-medium hover:border-[#6366f1]/50 transition-colors flex items-center justify-center gap-2"
          >
            View Dashboard →
          </Link>
        </div>
        
        <p className="animate-fade-up text-xs text-[#64748b] mt-4" style={{ animationDelay: "400ms" }}>
          Built with Gemini 2.0 Flash · Deployed on Render & Vercel
        </p>
      </section>

      {/* Live Stats */}
      <StatsBar />

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex-1">
            <div className="text-[#6366f1] font-mono text-xl mb-2">① PR Opened</div>
            <div className="font-bold text-lg mb-1">GitHub fires webhook</div>
            <div className="text-sm text-[#64748b]">Triggered immediately on PR open or sync</div>
          </div>
          <div className="hidden md:block text-[#1e1e2e]">→</div>
          <div className="flex-1">
            <div className="text-[#6366f1] font-mono text-xl mb-2">② Bot Reviews</div>
            <div className="font-bold text-lg mb-1">Gemini reads diff</div>
            <div className="text-sm text-[#64748b]">Each file is analyzed independently</div>
          </div>
          <div className="hidden md:block text-[#1e1e2e]">→</div>
          <div className="flex-1">
            <div className="text-[#6366f1] font-mono text-xl mb-2">③ Comments Posted</div>
            <div className="font-bold text-lg mb-1">Inline on exact diff lines</div>
            <div className="text-sm text-[#64748b]">Just like a real human reviewer</div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: "⚡", title: "Instant", desc: "Reviews post within 30 seconds" },
          { icon: "🎯", title: "Precise", desc: "Inline comments on exact diff positions, not the whole file" },
          { icon: "🔒", title: "Secure", desc: "Webhook signatures verified with HMAC-SHA256. No code stored." },
          { icon: "🧠", title: "Smart", desc: "Skips generated files, lock files, binary files automatically" },
          { icon: "🚦", title: "Filtered", desc: "Ignores draft PRs, bot authors, and PRs over 2000 lines" },
          { icon: "📊", title: "Logged", desc: "Every review stored in Supabase with full audit trail" },
        ].map((f) => (
          <div key={f.title} className="border border-[#1e1e2e] rounded-xl p-6 
                                        bg-[#12121a] hover:border-[#6366f1]/40 transition-colors group">
            <div className="text-2xl mb-4 opacity-80 group-hover:opacity-100 transition-opacity">{f.icon}</div>
            <div className="font-semibold mb-2 text-[#e2e8f0]">{f.title}</div>
            <div className="text-sm text-[#64748b] leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] py-8 text-center">
        <p className="text-xs text-[#64748b] font-mono">
          PR Pilot · Built by Santosh K Kammar · github.com/SKKammar/pr-pilot
        </p>
      </footer>
    </main>
  );
}
