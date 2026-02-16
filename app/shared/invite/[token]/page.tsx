'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    // Not logged in -> redirect to login with callback
    if (!session?.user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/shared/invite/${token}`)}`)
      return
    }

    // Logged in -> accept invitation
    if (accepting) return
    setAccepting(true)

    fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          router.replace(`/shared/${data.shareId}`)
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Failed to accept invitation')
        }
      })
      .catch(() => setError('Failed to accept invitation'))
  }, [session, status, token, router, accepting])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <p className="text-xs text-muted-foreground">
            Make sure you are logged in with the correct account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Accepting invitation...
      </div>
    </div>
  )
}
