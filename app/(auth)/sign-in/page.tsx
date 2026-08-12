import { redirect } from 'next/navigation'
import { AuthForm } from '@/app/(auth)/auth-form'
import { getSession } from '@/lib/session'

// Never prerendered: the page reads the session cookie, so it depends on the
// request. Without this Next builds a static shell and the build fails wherever
// database credentials are absent, which is exactly the case in CI.
export const dynamic = 'force-dynamic'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await getSession()) redirect('/')
  const { next } = await searchParams

  return (
    <AuthForm
      mode="sign-in"
      next={next ?? '/'}
      googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
    />
  )
}
