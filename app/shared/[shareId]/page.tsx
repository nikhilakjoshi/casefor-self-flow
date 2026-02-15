'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { SharedDraftingPanel } from '../_components/shared-drafting-panel'

interface ShareData {
  id: string
  permission: 'VIEW' | 'EDIT' | 'FULL'
  caseName: string
  document: {
    id: string
    name: string
    content: string | null
    category: string | null
    status: string
  }
}

export default function SharedDocPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/shared/${shareId}`)
      .then(async (res) => {
        if (res.ok) {
          setData(await res.json())
        } else {
          setError(res.status === 403 ? 'Access denied' : 'Document not found')
        }
      })
      .catch(() => setError('Failed to load'))
  }, [shareId])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SharedDraftingPanel
      shareId={data.id}
      permission={data.permission}
      document={data.document}
      caseName={data.caseName}
    />
  )
}
