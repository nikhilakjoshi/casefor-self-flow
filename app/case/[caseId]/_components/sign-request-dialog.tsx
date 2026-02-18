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
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface SignerInput {
  email: string
  name: string
  role: string
}

interface SignRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  docId: string
  docName: string
  onSuccess?: () => void
}

export function SignRequestDialog({
  open,
  onOpenChange,
  caseId,
  docId,
  docName,
  onSuccess,
}: SignRequestDialogProps) {
  const [signers, setSigners] = useState<SignerInput[]>([
    { email: '', name: '', role: 'Signer' },
  ])
  const [sending, setSending] = useState(false)

  const updateSigner = (idx: number, field: keyof SignerInput, value: string) => {
    setSigners((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  const addSigner = () => {
    setSigners((prev) => [...prev, { email: '', name: '', role: 'Signer' }])
  }

  const removeSigner = (idx: number) => {
    if (signers.length <= 1) return
    setSigners((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSubmit = signers.every((s) => s.email.trim() && s.name.trim())

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
        toast.success('Signature request sent')
        onOpenChange(false)
        setSigners([{ email: '', name: '', role: 'Signer' }])
        onSuccess?.()
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
                <Input
                  placeholder="Role (e.g. Applicant, Attorney)"
                  value={signer.role}
                  onChange={(e) => updateSigner(idx, 'role', e.target.value)}
                  className="h-7 text-[11px]"
                />
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

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={addSigner}
          >
            <Plus className="w-3 h-3" />
            Add signer
          </Button>
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
