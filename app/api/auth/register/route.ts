import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { linkPendingCase } from '@/lib/link-case'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    // Check existing user
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: { email, passwordHash, name },
    })

    // Link pending case if exists
    const cookieStore = await cookies()
    const pendingCaseId = cookieStore.get('pendingCaseId')?.value
    if (pendingCaseId) {
      await linkPendingCase(user.id, pendingCaseId)
      cookieStore.delete('pendingCaseId')
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
