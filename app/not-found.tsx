import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import illustration from '@/public/404.png'

/**
 * Catches every route Next cannot match. The notebook route keeps its own
 * not-found page, because there the reason is a missing or foreign notebook,
 * not a mistyped address.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[linear-gradient(180deg,#f3f8fe_0%,#e6f2fe_100%)] px-6 py-12 text-center">
      {/*
        The picture already spells out 404 and carries its own light blue
        background. The page repeats that tone and a radial mask fades the
        square's edges into it.
      */}
      <Image
        src={illustration}
        alt=""
        priority
        quality={90}
        sizes="(min-width: 640px) 26rem, 80vw"
        className="w-full max-w-[26rem] [mask-image:radial-gradient(circle_at_center,black_55%,transparent_72%)]"
      />

      <h1 className="text-2xl font-medium tracking-tight text-[#1c3557]">
        Diese Seite gibt es nicht
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#1c3557]/70">
        Die Adresse ist falsch geschrieben oder die Seite wurde entfernt. Deine
        Notizbücher sind davon nicht betroffen.
      </p>

      <Button
        render={<Link href="/" />}
        nativeButton={false}
        className="mt-6"
      >
        <ArrowLeft data-icon="inline-start" />
        Zur Startseite
      </Button>
    </main>
  )
}
