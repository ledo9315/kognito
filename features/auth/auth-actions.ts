'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import { getAuth } from '@/lib/auth'

export type AuthFormState = { error: string } | null

const Credentials = z.object({ email: z.email('Bitte gib eine gültige E-Mail-Adresse ein.') })

const Registration = Credentials.extend({
  name: z.string().trim().min(1, 'Bitte gib einen Namen ein.'),
})

const OtpConfirmation = Credentials.extend({
  name: z.string().trim().min(1).optional(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Bitte gib den sechsstelligen Code ein.'),
})

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

function messageFor(error: unknown) {
  if (error instanceof APIError) {
    return error.message || 'Anmeldung fehlgeschlagen.'
  }
  return 'Das hat nicht funktioniert. Bitte versuche es erneut.'
}

function verificationUrl({ email, name, next }: { email: string; name?: string; next: string }) {
  const params = new URLSearchParams({ email, next })
  if (name) params.set('name', name)
  return `/sign-in/verify?${params}`
}

export async function signUpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  
  const parsed = Registration.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  
  try {
    await getAuth().api.sendVerificationOTP({
      body: { email: parsed.data.email, type: 'sign-in' },
    })
  } catch (error) {
    return { error: messageFor(error) }
  }

  redirect(
    verificationUrl({
      email: parsed.data.email,
      name: parsed.data.name,
      next: safeNext(formData.get('next')),
    }),
  )
}

export async function signInAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {

  const parsed = Credentials.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await getAuth().api.sendVerificationOTP({
      body: { email: parsed.data.email, type: 'sign-in' },
    })
  } catch (error) {
    return { error: messageFor(error) }
  }

  redirect(
    verificationUrl({
      email: parsed.data.email,
      next: safeNext(formData.get('next')),
    }),
  )
}

export async function verifyOtpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = OtpConfirmation.safeParse({
    email: formData.get('email'),
    name: formData.get('name') || undefined,
    otp: formData.get('otp'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await getAuth().api.signInEmailOTP({
      body: parsed.data,
      headers: await headers(),
    })
  } catch (error) {
    return { error: messageFor(error) }
  }

  redirect(safeNext(formData.get('next')))
}

export async function signInWithGoogleAction(formData: FormData) {
  const { url } = await getAuth().api.signInSocial({
    body: {
      provider: 'google',
      callbackURL: safeNext(formData.get('next')),
    },
    headers: await headers(),
  })
  if (!url) throw new Error('Google returned no authorization URL')
  redirect(url)
}

export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() })
  redirect('/sign-in')
}
