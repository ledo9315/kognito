import { AppLogo } from '@/components/app-logo'
import { NotebookGrid } from '@/components/notebook-grid'
import { UserMenu } from '@/components/user-menu'
import { requireSession } from '@/lib/session'

// Reads the session, so it must never be prerendered.
export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await requireSession()
  
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <AppLogo />
          <UserMenu user={session.user} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-14">
        <NotebookGrid />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Kognito: NotebookLM-Klon als MVP-Prototyp</span>
          <span>Alle Antworten und Quellen sind simuliert.</span>
        </div>
      </footer>
    </div>
  )
}
