'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong')
    }

    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for {email}, we sent a reset link.
          </p>
        </div>

        <div className="p-3 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
          Check your inbox and spam folder.
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}
