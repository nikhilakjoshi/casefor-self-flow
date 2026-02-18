'use client'

import { useEffect, useState, useCallback } from 'react'
import { DocusealForm } from '@docuseal/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Loader2,
  RotateCw,
  X,
  Send,
  Ban,
  FileDown,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignerData {
  id: string
  slug: string
  role: string
  email: string
  name: string
  status: 'PENDING' | 'SENT' | 'OPENED' | 'COMPLETED' | 'DECLINED'
  signedAt: string | null
}

interface SignatureRequestData {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'VOIDED'
  signedDocumentS3Url: string | null
  completedAt: string | null
  createdAt: string
  signers: SignerData[]
}

interface SigningViewProps {
  caseId: string
  docId: string
  docName: string
  currentUserEmail?: string
  onClose: () => void
}

const SIGNER_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-stone-500/10 text-stone-600 border-stone-500/20',
    icon: <Clock className="w-3 h-3" />,
  },
  SENT: {
    label: 'Sent',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: <Send className="w-3 h-3" />,
  },
  OPENED: {
    label: 'Opened',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    icon: <Clock className="w-3 h-3" />,
  },
  COMPLETED: {
    label: 'Signed',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  DECLINED: {
    label: 'Declined',
    className: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    icon: <XCircle className="w-3 h-3" />,
  },
}

const REQUEST_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Signing in Progress', variant: 'secondary' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  DECLINED: { label: 'Declined', variant: 'destructive' },
  EXPIRED: { label: 'Expired', variant: 'outline' },
  VOIDED: { label: 'Voided', variant: 'outline' },
}

export function SigningView({
  caseId,
  docId,
  docName,
  currentUserEmail,
  onClose,
}: SigningViewProps) {
  const [requests, setRequests] = useState<SignatureRequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/case/${caseId}/documents/${docId}/sign`
      )
      if (res.ok) setRequests(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [caseId, docId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleVoid = async (requestId: string) => {
    setVoidingId(requestId)
    try {
      const res = await fetch(
        `/api/case/${caseId}/documents/${docId}/sign/${requestId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('Signature request voided')
        fetchRequests()
      } else {
        toast.error('Failed to void request')
      }
    } catch {
      toast.error('Failed to void request')
    } finally {
      setVoidingId(null)
    }
  }

  const handleResend = async (requestId: string) => {
    setResendingId(requestId)
    try {
      const res = await fetch(
        `/api/case/${caseId}/documents/${docId}/sign/${requestId}/resend`,
        { method: 'POST' }
      )
      if (res.ok) {
        const data = await res.json()
        toast.success(`Resent to ${data.sent} signer(s)`)
      } else {
        toast.error('Failed to resend')
      }
    } catch {
      toast.error('Failed to resend')
    } finally {
      setResendingId(null)
    }
  }

  // Find if current user is a pending signer
  const currentSigner = currentUserEmail
    ? requests
        .filter((r) => r.status === 'PENDING')
        .flatMap((r) => r.signers)
        .find(
          (s) =>
            s.email.toLowerCase() === currentUserEmail.toLowerCase() &&
            s.status !== 'COMPLETED' &&
            s.status !== 'DECLINED'
        )
    : null

  // Show embedded signing form if current user needs to sign
  if (currentSigner) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border">
          <h3 className="text-sm font-medium truncate">
            Sign: {docName}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <DocusealForm
            src={`https://docuseal.com/s/${currentSigner.slug}`}
            email={currentSigner.email}
            name={currentSigner.name}
            withTitle={false}
            withDecline={true}
            onComplete={() => {
              toast.success('Document signed')
              fetchRequests()
            }}
            onDecline={() => {
              toast.info('Signing declined')
              fetchRequests()
            }}
            className="w-full h-full"
          />
        </div>
      </div>
    )
  }

  // Status view
  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border">
        <h3 className="text-sm font-medium truncate">
          Signatures: {docName}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchRequests}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No signature requests
          </p>
        ) : (
          requests.map((req) => {
            const statusConfig = REQUEST_STATUS_CONFIG[req.status]
            return (
              <div
                key={req.id}
                className="rounded-lg border border-border p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={statusConfig?.variant || 'secondary'}>
                    {statusConfig?.label || req.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Signer timeline */}
                <div className="space-y-2">
                  {req.signers.map((signer) => {
                    const sc = SIGNER_STATUS_CONFIG[signer.status]
                    return (
                      <div
                        key={signer.id}
                        className="flex items-center gap-2 py-1"
                      >
                        <span
                          className={cn(
                            'flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border',
                            sc?.className
                          )}
                        >
                          {sc?.icon}
                          {sc?.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {signer.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {signer.email} ({signer.role})
                          </p>
                        </div>
                        {signer.signedAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(signer.signedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  {req.status === 'PENDING' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleResend(req.id)}
                        disabled={resendingId === req.id}
                      >
                        {resendingId === req.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                        onClick={() => handleVoid(req.id)}
                        disabled={voidingId === req.id}
                      >
                        {voidingId === req.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        Void
                      </Button>
                    </>
                  )}
                  {req.signedDocumentS3Url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() =>
                        window.open(req.signedDocumentS3Url!, '_blank')
                      }
                    >
                      <FileDown className="w-3 h-3" />
                      Download Signed
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
