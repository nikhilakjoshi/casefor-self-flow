import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const resetToken = await db.passwordResetToken.findUnique({ where: { token } })

  if (!resetToken || resetToken.expires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.user.update({
    where: { email: resetToken.email },
    data: { passwordHash },
  })

  await db.passwordResetToken.delete({ where: { id: resetToken.id } })

  return NextResponse.json({ success: true })
}
