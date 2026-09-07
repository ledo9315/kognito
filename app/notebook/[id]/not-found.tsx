import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import illustration from '@/public/notebook-not-found.png'

/** Same layout as the 404 page in `app/not-found.tsx`. */
export default function NotebookNotFound() {
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
        Notizbuch nicht gefunden
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#1c3557]/70">
        Dieses Notizbuch existiert nicht, wurde entfernt oder gehört zu einem
        anderen Konto.
      </p>

      <Button
        render={<Link href="/" />}
        nativeButton={false}
        className="mt-6"
      >
        <ArrowLeft data-icon="inline-start" />
        Zur Übersicht
      </Button>
    </main>
  )
}
