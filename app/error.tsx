'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import * as Sentry from '@sentry/nextjs'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import illustration from '@/public/error.png'

/**
 * Anything that throws on the server without being caught lands here. The
 * message itself is not shown: it is written for a log, not for a reader,
 * and it can carry details that do not belong on a screen. Same layout as
 * the 404 page in `app/not-found.tsx`.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center">
      {/* The picture brings its own pale blue ground; the radial mask fades
          the square's edges into the page. */}
      <Image
        src={illustration}
        alt=""
        priority
        quality={90}
        sizes="(min-width: 640px) 26rem, 80vw"
        className="w-full max-w-[26rem] [mask-image:radial-gradient(circle_at_center,black_55%,transparent_72%)]"
      />

      <h1 className="text-2xl font-medium tracking-tight text-[#1c3557]">
        Da ist etwas schiefgelaufen
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#1c3557]/70">
        Die Seite konnte nicht geladen werden. Deine Notizbücher und Quellen
        sind davon nicht betroffen.
      </p>

      <Button className="mt-6" onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        Erneut versuchen
      </Button>
    </main>
  )
}
