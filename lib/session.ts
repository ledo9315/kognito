import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth'

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() })
}

export async function requireOwnerId() {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  return session.user.id
}

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  return session
}
