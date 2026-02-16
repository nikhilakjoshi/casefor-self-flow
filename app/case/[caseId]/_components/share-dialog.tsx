'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Send, Trash2, Copy } from 'lucide-react'

interface ShareItem {
  id: string
  token: string
  inviteeEmail: string
  permission: 'VIEW' | 'EDIT' | 'FULL'
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED'
  createdAt: string
  invitee?: { name: string | null; image: string | null } | null
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  docId: string
  docName: string
}

export function ShareDialog({ open, onOpenChange, caseId, docId, docName }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareItem[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'VIEW' | 'EDIT' | 'FULL'>('VIEW')
  const [sending, setSending] = useState(false)

  const fetchShares = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}/shares`)
      if (res.ok) setShares(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [caseId, docId])

  useEffect(() => {
    if (open) fetchShares()
  }, [open, fetchShares])

  const buildInviteUrl = (token: string) =>
    `${window.location.origin}/shared/invite/${token}`

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token))
      toast.success('Invite link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleInvite = async () => {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission }),
      })
      if (res.ok) {
        const share = await res.json()
        toast.success(`Invitation sent to ${email}`, {
          action: {
            label: 'Copy link',
            onClick: () => copyInviteLink(share.token),
          },
        })
        setEmail('')
        fetchShares()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to send invitation')
      }
    } catch {
      toast.error('Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const handleRevoke = async (shareId: string) => {
    try {
      const res = await fetch(`/api/case/${caseId}/documents/${docId}/shares/${shareId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Access revoked')
        fetchShares()
      }
    } catch {
      toast.error('Failed to revoke')
    }
  }

  const handleUpdatePermission = async (shareId: string, newPerm: string) => {
    try {
      await fetch(`/api/case/${caseId}/documents/${docId}/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: newPerm }),
      })
      fetchShares()
    } catch {
      toast.error('Failed to update permission')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Share "{docName}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite form */}
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="flex-1 h-8 text-xs"
            />
            <Select value={permission} onValueChange={(v) => setPermission(v as 'VIEW' | 'EDIT' | 'FULL')}>
              <SelectTrigger className="w-[90px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW">View</SelectItem>
                <SelectItem value="EDIT">Edit</SelectItem>
                <SelectItem value="FULL">Full</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleInvite} disabled={sending || !email.trim()}>
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Invite
            </Button>
          </div>

          {/* Existing shares */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No one has access yet
              </p>
            ) : (
              shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg border border-border/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.inviteeEmail}</p>
                    {s.invitee?.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{s.invitee.name}</p>
                    )}
                  </div>
                  <Badge variant={s.status === 'ACCEPTED' ? 'default' : 'secondary'} className="text-[9px] h-4">
                    {s.status === 'PENDING' ? 'Pending' : 'Active'}
                  </Badge>
                  <Select
                    value={s.permission}
                    onValueChange={(v) => handleUpdatePermission(s.id, v)}
                  >
                    <SelectTrigger className="w-[80px] h-6 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEW">View</SelectItem>
                      <SelectItem value="EDIT">Edit</SelectItem>
                      <SelectItem value="FULL">Full</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => copyInviteLink(s.token)}
                    title="Copy invite link"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevoke(s.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
