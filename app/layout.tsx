import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter, Urbanist } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Kognito: KI-Rechercheassistent',
  description:
    'Quellen hochladen, Fragen mit belegten Antworten stellen und Audio-Übersichten, Briefings sowie Lernhilfen erzeugen. NotebookLM-Klon (MVP).',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    // Browser extensions write their own attributes onto <html> before React
    // hydrates, a translator leaves trancy-version there. The mismatch is
    // theirs, and the suppression covers this element's attributes only.
    <html
      lang="de"
      suppressHydrationWarning
      className={`bg-background ${inter.variable} ${urbanist.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  )
}
