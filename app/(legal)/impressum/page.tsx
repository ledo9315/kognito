import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impressum: Kognito',
  description: 'Anbieterkennzeichnung nach § 5 DDG für Kognito.',
}

export default function ImpressumPage() {
  return (
    <>
      <h1>Impressum</h1>

      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        Leonid Domahalskyy
        <br />
        Rude 13
        <br />
        24941 Flensburg
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail:{' '}
        <a href="mailto:leonid.domagalsky@gmail.com">
          leonid.domagalsky@gmail.com
        </a>
        <br />
        Telefon: <a href="tel:+4915205892880">015205892880</a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Leonid Domahalskyy, Anschrift wie oben.
      </p>

      <h2>Art des Angebots</h2>
      <p>
        Kognito ist ein privates, nicht kommerzielles Projekt und als
        Arbeitsprobe entstanden. Es gibt keine Bezahlfunktion, kein Abo und
        keinen Anspruch auf Verfügbarkeit der Anwendung oder der darin
        gespeicherten Inhalte.
      </p>

      <h2>Streitbeilegung</h2>
      <p>
        Zur Teilnahme an einem Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle bin ich weder bereit noch verpflichtet.
      </p>

      <h2>Haftung für Inhalte und Links</h2>
      <p>
        Für eigene Inhalte auf diesen Seiten bin ich nach den allgemeinen
        Gesetzen verantwortlich. Für Inhalte, die Nutzerinnen und Nutzer selbst
        hochladen oder schreiben, sowie für die Inhalte verlinkter externer
        Seiten ist jeweils deren Anbieter verantwortlich. Wird mir eine
        Rechtsverletzung bekannt, entferne ich den betreffenden Inhalt
        umgehend.
      </p>

      <h2>Antworten der KI</h2>
      <p>
        Kognito beantwortet Fragen mit Hilfe von Sprachmodellen. Antworten
        können trotz Belegstellen falsch oder unvollständig sein. Sie ersetzen
        keine fachliche, rechtliche oder medizinische Beratung, und die
        angegebenen Quellen sollten vor einer Weiterverwendung geprüft werden.
      </p>
    </>
  )
}
