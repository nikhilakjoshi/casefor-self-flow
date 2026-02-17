"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LogOut,
  Plus,
  ChevronsUpDown,
  Pencil,
  Trash2,
  ListChecks,
  FileStack,
  MessageSquare,
  Copy,
  Download,
  Share2,
  Archive,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar"

interface CaseItem {
  id: string
  name: string | null
  status: string
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [cases, setCases] = useState<CaseItem[]>([])
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [newName, setNewName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentCaseId = pathname.match(/\/case\/([^/]+)/)?.[1]

  const fetchCases = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/cases')
      if (res.ok) {
        const data = await res.json()
        setCases(data.cases || [])
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err)
    }
  }, [session?.user])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const handleRename = (caseItem: CaseItem) => {
    setSelectedCase(caseItem)
    setNewName(caseItem.name || `Case ${caseItem.id.slice(-6)}`)
    setRenameDialogOpen(true)
  }

  const handleDelete = (caseItem: CaseItem) => {
    setSelectedCase(caseItem)
    setDeleteDialogOpen(true)
  }

  const submitRename = async () => {
    if (!selectedCase || !newName.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/case/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        await fetchCases()
        setRenameDialogOpen(false)
      }
    } catch (err) {
      console.error('Failed to rename case:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitDelete = async () => {
    if (!selectedCase) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/case/${selectedCase.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchCases()
        setDeleteDialogOpen(false)
        if (currentCaseId === selectedCase.id) {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      console.error('Failed to delete case:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCaseName = (c: CaseItem) => c.name || `Case ${c.id.slice(-6)}`

  const user = session?.user

  return (
    <Sidebar variant="inset" {...props}>
      {/* -- Header: brand mark -- */}
      <SidebarHeader className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-sidebar-border">
                  <span className="text-[11px] font-black tracking-tighter" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    1A
                  </span>
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-sm font-semibold tracking-tight">Case for AI</span>
                  <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    EB-1A
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* -- Nav links -- */}
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                  <Link href="/dashboard">
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/shared")}>
                  <Link href="/shared">
                    <span>Shared with me</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* -- Cases: scrollable list -- */}
        <SidebarGroup className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <SidebarGroupLabel className="shrink-0 flex items-center justify-between pr-1">
            <span>Cases</span>
            <Link
              href="/onboard"
              className="flex items-center justify-center size-5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="size-3.5" />
            </Link>
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto">
            <SidebarMenu>
              {cases.map((c) => {
                const isActive = c.id === currentCaseId
                return (
                  <ContextMenu key={c.id}>
                    <ContextMenuTrigger asChild>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="h-auto py-2"
                        >
                          <Link href={`/case/${c.id}`}>
                            <div className="grid flex-1 text-left leading-tight min-w-0 gap-0.5">
                              <span className="truncate text-[13px]">{getCaseName(c)}</span>
                              <span
                                className="truncate text-[10px] text-sidebar-foreground/35"
                                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                              >
                                {formatDate(c.createdAt)}
                              </span>
                            </div>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => handleRename(c)}>
                        <Pencil className="size-3.5 mr-2" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem disabled>
                        <Copy className="size-3.5 mr-2" />
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem disabled>
                        <Share2 className="size-3.5 mr-2" />
                        Share
                      </ContextMenuItem>
                      <ContextMenuItem disabled>
                        <Download className="size-3.5 mr-2" />
                        Export
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem disabled>
                        <Archive className="size-3.5 mr-2" />
                        Archive
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleDelete(c)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* -- Admin -- */}
        <SidebarGroup className="shrink-0 border-t border-sidebar-border pt-2 mt-0">
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[
                { title: "Criteria", href: "/admin/criteria", icon: ListChecks },
                { title: "Templates", href: "/admin/templates", icon: FileStack },
                { title: "Prompts", href: "/admin/prompts", icon: MessageSquare },
              ].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-3.5 opacity-50" />
                      <span className="text-sidebar-foreground/70">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* -- Footer: user -- */}
      <SidebarFooter className="border-t border-sidebar-border">
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-7 w-7 rounded-full ring-1 ring-sidebar-border">
                      <AvatarImage src={user.image ?? ''} alt={user.name ?? ''} />
                      <AvatarFallback className="rounded-full text-[11px] bg-sidebar-accent text-sidebar-accent-foreground">
                        {user.name?.charAt(0) ?? user.email?.charAt(0) ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                      <span className="truncate text-[13px] font-medium">
                        {user.name || 'User'}
                      </span>
                      <span className="truncate text-[11px] text-sidebar-foreground/40">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-3.5 text-sidebar-foreground/30" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user.image ?? ''} alt={user.name ?? ''} />
                        <AvatarFallback className="rounded-lg">
                          {user.name?.charAt(0) ?? user.email?.charAt(0) ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                          {user.name || 'User'}
                        </span>
                        <span className="truncate text-xs">{user.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                    <LogOut className="size-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/login">Sign in</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Case</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter case name"
            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={isSubmitting || !newName.trim()}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Case</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{selectedCase ? getCaseName(selectedCase) : ''}&rdquo;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
