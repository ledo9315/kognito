'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import { getAuth } from '@/lib/auth'

export type AuthFormState = { error: string } | null

const Credentials = z.object({
  email: z.email('Bitte gib eine gültige E-Mail-Adresse ein.'),
  password: z
    .string()
    .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
})

const Registration = Credentials.extend({
  name: z.string().trim().min(1, 'Bitte gib einen Namen ein.'),
})

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

function messageFor(error: unknown) {
  if (error instanceof APIError) {
    return error.message || 'Anmeldung fehlgeschlagen.'
  }
  throw error
}

export async function signUpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = Registration.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  
  try {
    await getAuth().api.signUpEmail({ body: parsed.data, headers: await headers() })
  } catch (error) {
    return { error: messageFor(error) }
  }

  redirect(safeNext(formData.get('next')))
}

export async function signInAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = Credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() })
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
