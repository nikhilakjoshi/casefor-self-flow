import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { db } from '@/lib/db'

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
      <SidebarInset className="overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="grid text-left leading-tight">
              <span className="text-sm font-medium text-stone-600 dark:text-stone-400">
                {displayName}
              </span>
              {dateStr && (
                <span className="text-xs text-muted-foreground">{dateStr}</span>
              )}
            </div>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
