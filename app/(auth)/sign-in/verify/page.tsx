import { redirect } from 'next/navigation'
import { AuthForm } from '@/features/auth/components/auth-form'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function VerifySignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; next?: string }>
}) {
  if (await getSession()) redirect('/')

  const { email, name, next } = await searchParams
  if (!email) redirect('/sign-in')

  return (
    <AuthForm
      mode="verify"
      next={next ?? '/'}
      email={email}
      name={name}
      googleEnabled={false}
    />
  )
}
