import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Grid background */}
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
        <Link
          href="/onboard"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
        >
          Get Started
        </Link>
      </nav>

      {/* Main content */}
      <div className="relative z-10 px-6 sm:px-10 lg:px-16 pt-8 sm:pt-16 lg:pt-24 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Left: branding */}
            <div className="hidden lg:block">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                  EB-1A Extraordinary Ability
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-foreground">
                Your case,
                <br />
                <span className="text-primary">built with AI</span>
              </h2>

              <p className="mt-4 text-base text-muted-foreground max-w-sm leading-relaxed">
                CaseFor evaluates your profile, identifies strengths, and generates
                petition-ready documents for your EB-1A application.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  { value: "10", label: "Criteria evaluated by AI" },
                  { value: "< 2min", label: "Initial screening" },
                  { value: "Free", label: "To get started" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary/30 font-[family-name:var(--font-jetbrains-mono)] w-12">
                      {stat.value}
                    </span>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: form card */}
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:pt-4">
              <div className="rounded-lg border border-border bg-card p-6 sm:p-8 shadow-sm">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
