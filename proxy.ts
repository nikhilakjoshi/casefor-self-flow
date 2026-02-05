import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = [
  '/',
  '/onboard',
  '/login',
  '/register',
  '/api/auth',
  '/api/analyze',
]

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Allow static files and _next
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
