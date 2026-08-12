'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  type AuthFormState,
} from '@/app/(auth)/actions'

const authFormText = {
  'sign-in': {
    title: 'Anmelden',
    description: 'Melde dich an, um deine Notizbücher zu öffnen.',
    submit: 'Anmelden',
    switchText: 'Noch kein Konto?',
    switchLabel: 'Registrieren',
    switchHref: '/sign-up',
  },
  'sign-up': {
    title: 'Konto erstellen',
    description: 'Lege ein Konto an, um Quellen abzulegen und zu befragen.',
    submit: 'Konto erstellen',
    switchText: 'Schon registriert?',
    switchLabel: 'Anmelden',
    switchHref: '/sign-in',
  },
} as const

export function AuthForm({
  mode,
  next,
  googleEnabled,
}: {
  mode: keyof typeof authFormText
  next: string
  googleEnabled: boolean
}) {
  
  const text = authFormText[mode]

  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === 'sign-in' ? signInAction : signUpAction,
    null,
  )

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AppLogo className="justify-center" />

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-medium tracking-tight">{text.title}</h1>
          <p className="text-sm text-muted-foreground">{text.description}</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <FieldGroup>
            {mode === 'sign-up' ? (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input 
                  id="name"
                  name="name"
                  autoComplete="name"
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="email">E-Mail</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Passwort</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'sign-up' ? 'new-password' : 'current-password'
                }
                minLength={8}
              />
            </Field>
          </FieldGroup>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'Einen Moment…' : text.submit}
          </Button>
        </form>

        {googleEnabled ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              oder
              <span className="h-px flex-1 bg-border" />
            </div>

            <form action={signInWithGoogleAction}>
              <input type="hidden" name="next" value={next} />
              <Button type="submit" variant="outline" className="w-full">
                Mit Google fortfahren
              </Button>
            </form>
          </>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          {text.switchText}{' '}
          <Link href={text.switchHref} className="text-foreground underline">
            {text.switchLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
