import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })

  // Always return success to prevent email enumeration
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: true })
  }

  // Delete any existing tokens for this email
  await db.passwordResetToken.deleteMany({ where: { email } })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.passwordResetToken.create({
    data: { email, token, expires },
  })

  await sendPasswordResetEmail(email, token)

  return NextResponse.json({ success: true })
}
