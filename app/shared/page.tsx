'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface SharedDoc {
  id: string
  permission: 'VIEW' | 'EDIT' | 'FULL'
  document: {
    id: string
    name: string
    category: string | null
    status: string
    updatedAt: string
  }
  caseName: string
  inviter: { name: string | null; email: string | null }
  updatedAt: string
}

const PERM_LABELS = { VIEW: 'View', EDIT: 'Edit', FULL: 'Full' } as const

export default function SharedPage() {
  const [shares, setShares] = useState<SharedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/shared')
      .then((res) => (res.ok ? res.json() : []))
      .then(setShares)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (shares.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No documents shared with you yet</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-3">
      <h1 className="text-lg font-semibold">Shared Documents</h1>
      {shares.map((s) => (
        <button
          key={s.id}
          onClick={() => router.push(`/shared/${s.id}`)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{s.document.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {s.caseName} -- shared by {s.inviter.name || s.inviter.email}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {PERM_LABELS[s.permission]}
          </Badge>
        </button>
      ))}
    </div>
  )
}
