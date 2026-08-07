import { AppLogo } from '@/components/app-logo'
import { NotebookGrid } from '@/components/notebook-grid'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <AppLogo />
          <div className="flex items-center gap-3">
            <Avatar className="size-7">
              <AvatarFallback className="text-[11px]">LK</AvatarFallback>
            </Avatar>
          </div>
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
