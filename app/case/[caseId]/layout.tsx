import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { db } from '@/lib/db'
import { AnimatedContent } from '@/components/ui/animated-content'

export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { name: true, createdAt: true },
  })

  const displayName = caseRecord?.name || "Case Builder"
  const dateStr = caseRecord?.createdAt
    ? new Date(caseRecord.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " " + new Date(caseRecord.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-[var(--cream)]">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="grid text-left leading-tight">
              <span className="font-serif text-[1.05rem] font-medium tracking-[-0.01em] text-[var(--ink)]">
                {displayName}
              </span>
              {dateStr && (
                <span className="font-mono text-[0.65rem] tabular-nums text-[var(--ash)]">
                  {dateStr}
                </span>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatedContent>{children}</AnimatedContent>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
