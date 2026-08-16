import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Renamed from middleware.ts in Next.js 16.
 *
 * This is an optimistic check only: it looks at the cookie, never at the
 * database. Proxy runs on every request including prefetches, so a database
 * round trip here would be paid on navigations that never happen.
 *
 * The real check lives in the pages and server actions, through
 * requireSession() and requireOwnerId(). A forged cookie gets past this
 * redirect and is rejected there.
 */
export function proxy(request: NextRequest) {

  const hasSession = Boolean(getSessionCookie(request))
  const { pathname } = request.nextUrl

  if (!hasSession) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', pathname)
    return NextResponse.redirect(signIn)
  }

  return NextResponse.next()
}

export const config = {
  // `/` is public: it serves the landing page without a session and the
  // overview with one, so only the notebooks are redirected away from.
  matcher: ['/notebook/:path*'],
}
