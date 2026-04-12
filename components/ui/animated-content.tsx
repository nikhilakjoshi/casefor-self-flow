"use client"

import { usePathname } from "next/navigation"

/**
 * Wraps children with a subtle fade-in + slide-up animation that
 * re-triggers on every route change. Uses tw-animate-css classes.
 *
 * IMPORTANT: This component passes through flex layout constraints
 * (flex-1, min-h-0, flex-col, overflow-hidden) so it doesn't break
 * the parent's height chain. Without these, children lose their
 * scroll context and overflow doesn't work.
 */
export function AnimatedContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      key={pathname}
      className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
    >
      {children}
    </div>
  )
}
