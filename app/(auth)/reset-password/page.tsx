'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Invalid link
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This reset link is invalid or has expired.
          </p>
        </div>

        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          Please request a new reset link.
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-foreground hover:underline underline-offset-2">
            Request new link
          </Link>
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Password reset
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password has been updated.
          </p>
        </div>

        <div className="p-3 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
          You can now sign in with your new password.
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            New password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="********"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset password'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
