'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react'

interface SignerInput {
  email: string
  name: string
  role: string
}

const ROLE_OPTIONS = ['Applicant', 'Attorney', 'Paralegal', 'Recommender', 'Other']

interface SignRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  docId: string
  docName: string
  currentUserEmail?: string
  currentUserName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (data?: any) => void
}

export function SignRequestDialog({
  open,
  onOpenChange,
  caseId,
  docId,
  docName,
  currentUserEmail,
  currentUserName,
  onSuccess,
}: SignRequestDialogProps) {
  const [signers, setSigners] = useState<SignerInput[]>([
    { email: '', name: '', role: 'Applicant' },
  ])
  const [sending, setSending] = useState(false)

  const updateSigner = (idx: number, field: keyof SignerInput, value: string) => {
    setSigners((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  const addSigner = () => {
    setSigners((prev) => [...prev, { email: '', name: '', role: 'Applicant' }])
  }

  const addMyself = () => {
    if (!currentUserEmail) return
    const alreadyAdded = signers.some(
      (s) => s.email.toLowerCase() === currentUserEmail.toLowerCase()
    )
    if (alreadyAdded) {
      toast('You are already added as a signer')
      return
    }
    setSigners((prev) => [
      ...prev,
      { email: currentUserEmail, name: currentUserName || '', role: 'Applicant' },
    ])
  }

  const removeSigner = (idx: number) => {
    if (signers.length <= 1) return
    setSigners((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSubmit = signers.every((s) => s.email.trim() && s.name.trim())
  const validSignerCount = signers.filter((s) => s.email.trim() && s.name.trim()).length

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/case/${caseId}/documents/${docId}/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signers }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        toast.success('Signature request sent')
        onOpenChange(false)
        setSigners([{ email: '', name: '', role: 'Applicant' }])
        onSuccess?.(data)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to create signature request')
      }
    } catch {
      toast.error('Failed to create signature request')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Request Signature: {docName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {signers.map((signer, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Email"
                    type="email"
                    value={signer.email}
                    onChange={(e) => updateSigner(idx, 'email', e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Name"
                    value={signer.name}
                    onChange={(e) => updateSigner(idx, 'name', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Select
                  value={signer.role}
                  onValueChange={(value) => updateSigner(idx, 'role', value)}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role} className="text-xs">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {signers.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSigner(idx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addSigner}
            >
              <Plus className="w-3 h-3" />
              Add signer
            </Button>
            {currentUserEmail && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addMyself}
              >
                <UserPlus className="w-3 h-3" />
                Add myself
              </Button>
            )}
          </div>

          {validSignerCount > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {validSignerCount} signer{validSignerCount !== 1 ? 's' : ''} will receive email requests
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !canSubmit}>
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                Sending...
              </>
            ) : (
              'Send for Signature'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
