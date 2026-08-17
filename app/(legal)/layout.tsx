import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppLogo } from '@/components/app-logo'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white">
      <nav className="border-b border-border px-4 py-4 md:px-16">
        <div className="mx-auto max-w-3xl">
          <Link href="/">
            <AppLogo />
          </Link>
        </div>
      </nav>

      <main
        className="mx-auto max-w-3xl px-4 py-16 text-base/7 text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary [&_h1]:mb-10 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5"
      >
        {children}
      </main>

      <footer className="border-t border-border bg-gray-50 px-4 py-8 md:px-16">
        <div className="mx-auto flex max-w-3xl gap-4 text-sm text-muted-foreground">
          <Link href="/impressum" className="hover:text-primary">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-primary">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  )
}
