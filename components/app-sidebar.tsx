"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  ChevronsUpDown,
  Pencil,
  Trash2,
  LayoutDashboard,
  ListChecks,
  FileStack,
  MessageSquare,
  Settings,
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

  // Extract current caseId from path
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-foreground text-background flex aspect-square size-8 items-center justify-center rounded-lg">
                  <FileText className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">EB-1A Builder</span>
                  <span className="truncate text-xs">Case Manager</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Your Cases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cases.map((c) => (
                <ContextMenu key={c.id}>
                  <ContextMenuTrigger asChild>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        size="lg"
                        isActive={c.id === currentCaseId}
                      >
                        <Link href={`/case/${c.id}`}>
                          <FolderOpen className="size-4" />
                          <div className="grid flex-1 text-left leading-tight min-w-0">
                            <span className="truncate text-sm">{getCaseName(c)}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleRename(c)}>
                      <Pencil className="size-4 mr-2" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleDelete(c)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/onboard">
                    <Plus className="size-4" />
                    <span>New Case</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[
                { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
                { title: "Criteria", href: "/admin/criteria", icon: ListChecks },
                { title: "Templates", href: "/admin/templates", icon: FileStack },
                { title: "Prompts", href: "/admin/prompts", icon: MessageSquare },
                { title: "Application Types", href: "/admin/application-types", icon: Settings },
              ].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
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
                    <ChevronsUpDown className="ml-auto size-4" />
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
            Are you sure you want to delete "{selectedCase ? getCaseName(selectedCase) : ''}"? This action cannot be undone.
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
