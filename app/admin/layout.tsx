import { AdminSidebar } from '@/components/admin-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AnimatedContent } from '@/components/ui/animated-content'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AdminSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-[var(--cream)]">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="font-serif text-[1.05rem] font-medium tracking-[-0.01em] text-[var(--ink)]">
              Admin
            </span>
          </div>
        </header>
        <ScrollArea className="flex-1 min-h-0">
          <AnimatedContent>{children}</AnimatedContent>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}
