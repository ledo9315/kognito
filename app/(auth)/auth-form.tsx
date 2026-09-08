'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState } from 'react'
import { AppLogo } from '@/components/app-logo'
import { GoogleLogo } from '@/app/(auth)/google-logo'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  signInAction,
  signInWithGoogleAction,
  signUpAction,
  verifyOtpAction,
  type AuthFormState,
} from '@/app/(auth)/actions'
import illustration from '@/public/auth-illustration.png'

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
  verify: {
    title: 'Code eingeben',
    description: 'Wir haben dir einen sechsstelligen Code per E-Mail gesendet.',
    submit: 'Code bestätigen',
    switchText: 'Keine E-Mail erhalten?',
    switchLabel: 'Zurück zur Anmeldung',
    switchHref: '/sign-in',
  },
} as const

export function AuthForm({
  mode,
  next,
  googleEnabled,
  email,
  name,
}: {
  mode: keyof typeof authFormText
  next: string
  googleEnabled: boolean
  email?: string
  name?: string
}) {
  
  const text = authFormText[mode]

  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === 'sign-in'
      ? signInAction
      : mode === 'sign-up'
        ? signUpAction
        : verifyOtpAction,
    null,
  )

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside
        aria-hidden
        className="relative hidden flex-col justify-end overflow-hidden p-10 lg:flex"
      >
        <Image
          src={illustration}
          alt=""
          sizes="(min-width: 1024px) 50vw, 1px"
          quality={90}
          className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
        />

        <div className="relative max-w-sm">
          <p className="font-display text-2xl tracking-tight text-[#1c3557]">
            Deine Notizbücher, nur für dich.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#1c3557]/70">
            Jedes Notizbuch gehört dem Konto, das es angelegt hat. Quellen,
            Fragen und Antworten sieht niemand sonst.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <AppLogo className="justify-center" />

          <div className="flex flex-col gap-1 text-center">
            <h1 className="text-xl font-medium tracking-tight">{text.title}</h1>
            <p className="text-sm text-muted-foreground">{text.description}</p>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            {mode === 'verify' ? (
              <>
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="name" value={name} />
              </>
            ) : null}

            <FieldGroup>
              {mode === 'sign-up' ? (
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" autoComplete="name" />
                </Field>
              ) : null}

              {mode === 'verify' ? (
                <Field>
                  <FieldLabel htmlFor="otp">Bestätigungscode für {email}</FieldLabel>
                  <Input
                    id="otp"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="email">E-Mail</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </Field>
              )}
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

          {googleEnabled && mode !== 'verify' ? (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                oder
                <span className="h-px flex-1 bg-border" />
              </div>

              <form action={signInWithGoogleAction}>
                <input type="hidden" name="next" value={next} />
                <Button type="submit" variant="outline" className="w-full">
                  <GoogleLogo />
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
      </main>
    </div>
  )
}
