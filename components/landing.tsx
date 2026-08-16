import Image from 'next/image'
import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  ArrowUpRight,
  AudioLines,
  ChevronDown,
  CircleHelp,
  FileText,
  GitBranch,
  MessageSquareQuote,
  NotebookPen,
  Route,
  Sparkles,
  Upload,
} from 'lucide-react'
import { AppLogo } from '@/components/app-logo'
import { SmoothScroll } from '@/components/smooth-scroll'
import { buttonVariants } from '@/components/ui/button'
import dashboard from '@/public/dashboard.webp'

const features: {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
}[] = [
  {
    title: 'Quellen an einem Ort',
    description:
      'PDFs, Textdateien und eingefügte Ausschnitte landen in einem Notizbuch. Kognito liest alles und behält, wo etwas steht.',
    icon: Upload,
  },
  {
    title: 'Antworten mit Belegstelle',
    description:
      'Jede Aussage trägt eine Nummer. Ein Klick darauf springt in die Quelle und markiert den Satz, auf dem sie beruht.',
    icon: MessageSquareQuote,
  },
  {
    title: 'Audio-Übersicht',
    description:
      'Ein Erzähler fasst die ausgewählten Quellen zusammen. Zum Hören, während du etwas anderes machst.',
    icon: AudioLines,
  },
  {
    title: 'Briefing, FAQ und Zeitleiste',
    description:
      'Aus denselben Quellen entsteht eine strukturierte Zusammenfassung, ein Frage-Antwort-Satz oder eine Chronologie.',
    icon: FileText,
  },
  {
    title: 'Mindmap und Lernkarten',
    description:
      'Themen und ihre Verzweigungen als Karte, und eine Abfrage für alles, was hängen bleiben soll.',
    icon: GitBranch,
  },
  {
    title: 'Notizen als Quelle',
    description:
      'Was du selbst schreibst, zählt wie eine hochgeladene Datei: durchsuchbar, zitierbar, Teil der nächsten Antwort.',
    icon: NotebookPen,
  },
]

const steps = [
  {
    title: 'Notizbuch anlegen',
    description:
      'Ein Notizbuch pro Thema, Seminararbeit oder Projekt. Mit Titel und Symbol, damit die Übersicht lesbar bleibt.',
  },
  {
    title: 'Quellen hinzufügen',
    description:
      'Dateien hochladen oder Text einfügen. Ausgewählte Quellen bestimmen, worauf sich die nächste Antwort stützt.',
  },
  {
    title: 'Fragen stellen',
    description:
      'Frag im Chat, lies die Antwort mit Belegen und lass daraus Briefing, Mindmap oder Audio erzeugen.',
  },
]

const faqs = [
  {
    question: 'Welche Quellen kann ich hochladen?',
    answer:
      'PDF- und Textdateien sowie eingefügte Ausschnitte. Notizen, die du in Kognito schreibst, werden genauso behandelt.',
  },
  {
    question: 'Woher kommen die Antworten?',
    answer:
      'Ausschließlich aus den Quellen, die du im Notizbuch ausgewählt hast. Was dort nicht steht, sagt Kognito auch nicht.',
  },
  {
    question: 'Wer sieht meine Notizbücher?',
    answer:
      'Nur du. Jedes Notizbuch hängt an deinem Konto, und jede Abfrage wird serverseitig darauf geprüft.',
  },
  {
    question: 'Was kostet Kognito?',
    answer:
      'Nichts. Kognito ist ein offenes Projekt und entstand als Arbeitsprobe, keine Zahlungsdaten, kein Abo.',
  },
]

function SectionIcon({
  icon: Icon,
  direction = 'left',
}: {
  icon: ComponentType<{ className?: string }>
  direction?: 'left' | 'right'
}) {
  return (
    <span
      className={`inline-flex aspect-square rounded-xl bg-primary p-2 text-primary-foreground shadow-[inset_0_4px_4px_rgb(255_255_255/0.25),0_4px_10px_rgb(0_0_0/0.15)] ${
        direction === 'left' ? '-rotate-12' : 'rotate-12'
      }`}
    >
      <Icon className="size-6" aria-hidden="true" />
    </span>
  )
}

function SectionTitle({
  icon,
  title,
  subtitle,
  align = 'center',
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle: string
  align?: 'center' | 'left'
}) {
  return (
    <div
      className={`flex flex-col gap-5 ${align === 'center' ? 'items-center text-center' : 'items-center md:items-start md:text-left'}`}
    >
      <div className="flex flex-col items-center gap-4 md:flex-row">
        <SectionIcon icon={icon} />
        <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
      </div>
      <p
        className={`text-base/7 text-muted-foreground ${align === 'center' ? 'max-w-lg text-center' : 'max-w-sm text-center md:text-left'}`}
      >
        {subtitle}
      </p>
    </div>
  )
}

const pagePadding = 'px-4 md:px-16 lg:px-24 xl:px-32'

export function Landing() {
  return (
    <div className="bg-white">
      <SmoothScroll />

      <nav
        className={`sticky top-0 z-50 border-b border-border bg-white/80 py-4 backdrop-blur ${pagePadding}`}
      >
        <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <AppLogo />

          {/* Out of the flow, so the links sit in the middle of the page
              instead of in the gap the logo and the buttons leave. */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm md:flex">
            <a href="#funktionen" className="px-3 py-1 hover:text-primary">
              Funktionen
            </a>
            <a href="#ablauf" className="px-3 py-1 hover:text-primary">
              So läuft es
            </a>
            <a href="#fragen" className="px-3 py-1 hover:text-primary">
              Fragen
            </a>
          </div>

          <div className="flex items-center gap-2">
            {/* Links, not buttons: Base UI stamps role="button" on whatever
                it renders, and these navigate. */}
            <Link href="/sign-in" className={buttonVariants({ variant: 'ghost' })}>
              Anmelden
            </Link>
            <Link href="/sign-up" className={buttonVariants({ size: 'lg' })}>
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

      <section
        className={`hero-mesh ${pagePadding}`}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center py-20 md:py-24">
          <span className="flex items-center gap-2 rounded-full border border-white bg-white/50 py-1 pr-4 pl-3 text-sm shadow-[0_2px_12px_rgb(0_0_0/0.06)]">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Recherche mit Quellen, die man nachschlagen kann
          </span>

          <h1 className="mt-5 max-w-3xl text-center text-5xl/tight font-bold text-balance md:text-6xl/tight">
            Deine Quellen. Deine Fragen. Belegte Antworten.
          </h1>

          <p className="mt-5 max-w-xl text-center text-base/7 text-muted-foreground">
            Kognito liest deine Dokumente, beantwortet Fragen dazu und zeigt zu
            jeder Aussage die Stelle, aus der sie stammt.
          </p>

          <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/sign-up"
              className={buttonVariants({
                size: 'lg',
                className: 'h-11 w-full px-8 text-[15px] sm:w-auto',
              })}
            >
              Notizbuch anlegen
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className:
                  'h-11 w-full border-white bg-white px-8 text-[15px] shadow-[0_2px_12px_rgb(0_0_0/0.06)] hover:bg-gray-50 sm:w-auto',
              })}
            >
              Ich habe schon ein Konto
            </Link>
          </div>

          <Image
            src={dashboard}
            alt="Ein Notizbuch in Kognito: links die Quellen, in der Mitte der Chat, rechts die erzeugten Formate"
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="mt-14 w-full max-w-6xl rounded-2xl shadow-[0_40px_80px_-30px_rgb(15_23_42/0.35)]"
          />
        </div>
      </section>

      <section id="funktionen" className={pagePadding}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 border-x border-border md:grid-cols-2 md:divide-x md:divide-border">
          <div className="flex flex-col items-start p-4 pt-16 md:sticky md:top-24 md:h-max md:p-16">
            <SectionTitle
              align="left"
              icon={Sparkles}
              title="Was Kognito kann"
              subtitle="Alles, was zwischen einem Stapel Dokumente und einer Antwort liegt, auf die du dich berufen kannst."
            />

            <div className="mt-10 w-full rounded-xl bg-primary p-6 text-primary-foreground">
              <p className="text-lg text-balance">
                Für Seminararbeiten, Einarbeitung und alles, was man später
                belegen muss.
              </p>
              <Link
                href="/sign-up"
                className="mt-6 flex w-max items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-medium text-foreground hover:bg-gray-100"
              >
                Loslegen
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="space-y-6 p-4 pt-16 md:p-16">
            {features.map((feature) => (
              <div
                key={feature.title}
                // Each card sticks under the navbar, so the next one slides
                // over it and they end up stacked, like the reference site.
                className="flex flex-col items-start rounded-xl bg-indigo-100 p-6 md:sticky md:top-24"
              >
                <span
                  className="rounded-md bg-primary p-2 text-primary-foreground"
                >
                  <feature.icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm/6 text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ablauf" className={`border-t border-border ${pagePadding}`}>
        <div className="mx-auto flex max-w-7xl flex-col items-center border-x border-border p-4 py-20 md:p-20">
          <SectionTitle
            icon={Route}
            title="So läuft es"
            subtitle="Drei Schritte vom leeren Notizbuch zur ersten belegten Antwort."
          />

          <ol className="mt-14 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-xl border border-border bg-gray-50 p-6"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-medium">{step.title}</h3>
                <p className="mt-2 text-sm/6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="fragen" className={`border-t border-border ${pagePadding}`}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 border-x border-border md:grid-cols-2 md:divide-x md:divide-border">
          <div className="p-4 pt-20 md:p-20">
            <SectionTitle
              align="left"
              icon={CircleHelp}
              title="Häufige Fragen"
              subtitle="Was Kognito macht, woher die Antworten kommen und wer sie sieht."
            />
          </div>

          <div className="space-y-4 p-4 pb-20 md:p-20">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                open={index === 0}
                className="group rounded-xl border border-border bg-gray-50"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 select-none">
                  <h3 className="text-[15px] font-medium">{faq.question}</h3>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="p-5 pt-0 text-sm/6 text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className={`border-t border-border bg-gray-50 ${pagePadding}`}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <AppLogo />
        </div>
      </footer>
    </div>
  )
}
