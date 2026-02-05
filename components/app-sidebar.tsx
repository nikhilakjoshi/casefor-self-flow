"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  ChevronsUpDown,
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
  status: string
  createdAt: string
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const [cases, setCases] = useState<CaseItem[]>([])

  // Extract current caseId from path
  const currentCaseId = pathname.match(/\/case\/([^/]+)/)?.[1]

  useEffect(() => {
    async function fetchCases() {
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
    }
    fetchCases()
  }, [session?.user])

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
          <SidebarGroupLabel>Your Cases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cases.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={c.id === currentCaseId}
                  >
                    <Link href={`/case/${c.id}`}>
                      <FolderOpen className="size-4" />
                      <span className="truncate">
                        Case {c.id.slice(-6)}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
    </Sidebar>
  )
}
