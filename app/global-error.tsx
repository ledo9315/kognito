'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Catches errors in the root layout itself. Rendered without the layout,
 * so no globals.css and no shadcn components here, plain markup only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          display: 'flex',
          minHeight: '100svh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 500 }}>
            Da ist etwas schiefgelaufen
          </h1>
          <p style={{ color: '#666' }}>Die Seite konnte nicht geladen werden.</p>
          <button onClick={reset}>Erneut versuchen</button>
        </div>
      </body>
    </html>
  )
}
