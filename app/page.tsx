import { AppLogo } from '@/components/app-logo'
import { Landing } from '@/components/landing'
import { NotebookGrid } from '@/features/notebooks/components/notebook-grid'
import { UserMenu } from '@/components/user-menu'
import { listNotebooks } from '@/features/notebooks/notebooks'
import { updatedLabel } from '@/lib/relative-time'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  // The one route that serves two pages: the landing page to a visitor, the
  // overview to an account. Everything else stays behind requireSession().
  const session = await getSession()
  if (!session) return <Landing />

  const rows = await listNotebooks(session.user.id)

  const notebooks = rows.map((row) => ({
    ...row,
    updatedLabel: updatedLabel(row.updatedAt),
  }))

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <AppLogo />
          <UserMenu user={session.user} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-14">
        <NotebookGrid notebooks={notebooks} />
      </main>

    </div>
  )
}
