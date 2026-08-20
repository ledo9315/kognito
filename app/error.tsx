'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

/**
 * Anything that throws on the server without being caught lands here. The
 * message itself is not shown: it is written for a log, not for a reader,
 * and it can carry details that do not belong on a screen.
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
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-md border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="text-base font-medium">Da ist etwas schiefgelaufen</h1>
          </EmptyTitle>
          <EmptyDescription>
            Die Seite konnte nicht geladen werden. Deine Notizbücher und Quellen
            sind davon nicht betroffen.
          </EmptyDescription>
        </EmptyHeader>
        <Button className="mx-auto" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Erneut versuchen
        </Button>
      </Empty>
    </div>
  )
}
