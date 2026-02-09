import Link from "next/link"

const FEATURES = [
  {
    title: "AI-Powered Analysis",
    description:
      "Upload your resume and documents. Our AI evaluates your profile against all 10 EB-1A criteria instantly.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 5.608a1.26 1.26 0 01-1.219 1.592h-2.558a1.003 1.003 0 01-.948-.683l-.467-1.4a6.3 6.3 0 00-6.02 0l-.467 1.4a1.003 1.003 0 01-.948.683H6.017a1.26 1.26 0 01-1.219-1.592L5 14.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Document Generation",
    description:
      "Auto-generate personal statements, recommendation letter drafts, and petition narratives tailored to your profile.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Evidence Tracking",
    description:
      "Organize supporting documents per criterion. The AI identifies gaps and suggests what evidence to gather next.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Strength Evaluation",
    description:
      "Get a realistic assessment of where you stand. Each criterion rated Strong, Weak, or None with actionable guidance.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const STEPS = [
  { number: "01", label: "Upload your resume or CV" },
  { number: "02", label: "AI analyzes against 10 EB-1A criteria" },
  { number: "03", label: "Strengthen weak areas with guidance" },
  { number: "04", label: "Generate petition-ready documents" },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">CaseFor</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/onboard"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 sm:px-10 lg:px-16 pt-20 sm:pt-28 lg:pt-36 pb-20 sm:pb-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              EB-1A Extraordinary Ability
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-foreground">
            Build your immigration
            <br />
            case with
            <span className="text-primary"> precision AI</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            CaseFor analyzes your profile against all 10 EB-1A criteria,
            identifies strengths and gaps, and generates petition-ready documents
            -- so you can focus on what matters.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/onboard"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start Your Case
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Sign In to Existing Case
            </Link>
          </div>
        </div>

        {/* Decorative element */}
        <div className="absolute top-20 right-10 lg:right-16 hidden lg:block">
          <div className="w-64 h-64 relative">
            {/* Criteria visualization */}
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
              const radius = 100
              const x = Math.cos(angle) * radius + 120
              const y = Math.sin(angle) * radius + 120
              const size = i < 4 ? "w-3 h-3" : i < 7 ? "w-2.5 h-2.5" : "w-2 h-2"
              const color = i < 4 ? "bg-emerald-500" : i < 7 ? "bg-amber-400" : "bg-muted-foreground/30"
              return (
                <div
                  key={i}
                  className={`absolute rounded-full ${size} ${color}`}
                  style={{ left: `${x}px`, top: `${y}px`, transform: "translate(-50%, -50%)" }}
                />
              )
            })}
            {/* Center */}
            <div
              className="absolute w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center"
              style={{ left: "120px", top: "120px", transform: "translate(-50%, -50%)" }}
            >
              <span className="text-xs font-bold text-primary font-[family-name:var(--font-jetbrains-mono)]">
                4/10
              </span>
            </div>
            {/* Connecting lines */}
            <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 240 240">
              {Array.from({ length: 10 }).map((_, i) => {
                const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
                const radius = 100
                const x = Math.cos(angle) * radius + 120
                const y = Math.sin(angle) * radius + 120
                return (
                  <line key={i} x1="120" y1="120" x2={x} y2={y} stroke="currentColor" strokeWidth="1" />
                )
              })}
            </svg>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 sm:px-10 lg:px-16 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {STEPS.map((step) => (
              <div key={step.number} className="group">
                <span className="text-3xl font-bold text-primary/20 font-[family-name:var(--font-jetbrains-mono)] group-hover:text-primary/40 transition-colors">
                  {step.number}
                </span>
                <p className="mt-3 text-sm font-medium text-foreground leading-relaxed">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 sm:px-10 lg:px-16 py-20 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Everything you need to build a strong case
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mb-14">
            From initial screening to petition-ready documents, CaseFor guides you
            through every step of the EB-1A process.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-lg border border-border bg-background hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/15 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / social proof */}
      <section className="relative z-10 px-6 sm:px-10 lg:px-16 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-4">
                Built for serious applicants
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                CaseFor is designed for researchers, engineers, artists, and
                professionals who want a data-driven approach to their EB-1A
                petition. No guesswork.
              </p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { value: "10", label: "EB-1A criteria analyzed" },
                { value: "< 2min", label: "Initial screening time" },
                { value: "100%", label: "AI-guided process" },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-lg border border-border bg-muted/20">
                  <div className="text-2xl font-bold text-primary font-[family-name:var(--font-jetbrains-mono)]">
                    {stat.value}
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 sm:px-10 lg:px-16 py-24 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to build your case?
          </h2>
          <p className="text-muted-foreground text-base mb-10 max-w-lg mx-auto">
            Upload your resume and get an instant AI assessment of your EB-1A
            eligibility. Free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboard"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get Started
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-border px-8 py-3.5 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-10 lg:px-16 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span>CaseFor</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Not legal advice. Consult an immigration attorney for your specific situation.
          </p>
        </div>
      </footer>
    </div>
  )
}
