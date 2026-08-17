import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutz: Kognito',
  description:
    'Welche Daten Kognito verarbeitet, an wen sie gehen und welche Rechte du hast.',
}

export default function DatenschutzPage() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>

      <p>
        Kognito ist ein privates Projekt. Es gibt keine Werbung, kein Tracking
        über Seiten hinweg und keinen Verkauf von Daten. Verarbeitet wird, was
        nötig ist, damit ein Konto funktioniert und Fragen zu deinen Quellen
        beantwortet werden können.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Leonid Domahalskyy
        <br />
        Rude 13
        <br />
        24941 Flensburg
        <br />
        Deutschland
        <br />
        E-Mail:{' '}
        <a href="mailto:leonid.domagalsky@gmail.com">
          leonid.domagalsky@gmail.com
        </a>
      </p>
      <p>
        Eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten gibt es
        nicht, die Voraussetzungen dafür liegen nicht vor.
      </p>

      <h2>2. Welche Daten verarbeitet werden</h2>

      <h3>Konto</h3>
      <p>
        Bei der Registrierung mit E-Mail und Passwort werden Name, E-Mail-Adresse
        und das Passwort als Hash gespeichert. Bei der Anmeldung mit Google
        übermittelt Google Name, E-Mail-Adresse, Profilbild und die
        Zugangs-Token des verknüpften Kontos. Grundlage ist Art. 6 Abs. 1 lit. b
        DSGVO, ohne Konto ist die Anwendung nicht nutzbar.
      </p>

      <h3>Anmeldung und Sitzung</h3>
      <p>
        Zu jeder Sitzung werden ein Sitzungstoken, dessen Ablaufzeitpunkt sowie
        IP-Adresse und Browserkennung gespeichert. Das dient der Sicherheit des
        Kontos, etwa um fremde Sitzungen zu erkennen, Grundlage ist Art. 6
        Abs. 1 lit. f DSGVO.
      </p>

      <h3>Inhalte in Notizbüchern</h3>
      <p>
        Was du in Kognito anlegst, wird gespeichert: Notizbücher, hochgeladene
        Dateien, eingefügte Ausschnitte, Notizen, verlinkte Webseiten, deine
        Fragen, die Antworten mit Belegstellen und die daraus erzeugten Formate
        wie Briefing, Zeitleiste oder Lernkarten. Von hochgeladenen Dateien
        wird der ausgelesene Text gespeichert, nicht die Datei selbst.
        Grundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>
      <p>
        Lade keine Daten hoch, die du nicht hochladen darfst. Für
        personenbezogene Daten Dritter in deinen Quellen bist du selbst
        verantwortlich.
      </p>

      <h3>Audio-Übersichten</h3>
      <p>
        Erzeugte Audiodateien liegen in einem privaten Dateispeicher. Sie sind
        nicht über eine öffentliche Adresse erreichbar, der Server prüft bei
        jedem Abruf, ob das Notizbuch dir gehört, und gibt eine Adresse aus,
        die nach kurzer Zeit abläuft.
      </p>

      <h3>Server-Protokolle</h3>
      <p>
        Der Hoster protokolliert technisch bedingt Zugriffe, unter anderem
        IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserkennung. Das ist
        für den Betrieb und die Sicherheit erforderlich, Art. 6 Abs. 1 lit. f
        DSGVO.
      </p>

      <h2>3. Cookies</h2>
      <p>
        Kognito setzt nur ein Cookie, das die Anmeldung aufrechterhält. Es ist
        für den ausdrücklich gewünschten Dienst unbedingt erforderlich, § 25
        Abs. 2 Nr. 2 TDDDG, und braucht deshalb keine Einwilligung. Cookies zu
        Werbe- oder Analysezwecken gibt es nicht.
      </p>

      <h2>4. Empfänger und Dienstleister</h2>
      <p>
        Die folgenden Anbieter verarbeiten Daten in meinem Auftrag oder als
        eigene Verantwortliche. Soweit dabei Daten in die USA gelangen, stützt
        sich die Übermittlung auf Standardvertragsklauseln nach Art. 46 DSGVO
        beziehungsweise auf die Zertifizierung des Anbieters unter dem EU-US
        Data Privacy Framework.
      </p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789,
          USA: Hosting der Anwendung, Ausführung der Serverfunktionen, Speicher
          für Audiodateien und die Weiterleitung der Anfragen an die
          KI-Anbieter.
        </li>
        <li>
          <strong>Neon Inc.</strong>, 209 Orange St, Wilmington, DE 19801, USA:
          Datenbank, in der Konto, Notizbücher, Quellen und Antworten liegen.
        </li>
        <li>
          <strong>OpenAI</strong> (über das KI-Gateway von Vercel): erzeugt die
          Antworten, die Zusammenfassungen und die gesprochenen Übersichten und
          berechnet die Vektoren für die Suche in langen Quellen.
        </li>
        <li>
          <strong>Google Ireland Limited</strong>, Gordon House, Barrow Street,
          Dublin 4, Irland: nur wenn du dich mit Google anmeldest.
        </li>
      </ul>

      <h3>Was an die KI-Anbieter geht</h3>
      <p>
        Um eine Frage zu beantworten, gehen deine Frage und der Text der
        ausgewählten Quellen an das Sprachmodell. Für eine Audio-Übersicht geht
        zusätzlich der erzeugte Sprechtext an das Sprachmodell für Sprache. Die
        Anfragen laufen über das Gateway von Vercel, ohne Speicherung beim
        Anbieter und ohne Verwendung zum Training der Modelle. Übertragen wird
        nur, was in den ausgewählten Quellen steht, nicht dein Name oder deine
        E-Mail-Adresse.
      </p>

      <h2>5. Reichweitenmessung</h2>
      <p>
        Für die Zählung der Seitenaufrufe wird Vercel Web Analytics eingesetzt.
        Es setzt keine Cookies, legt keine Kennung im Browser ab und
        verarbeitet keine IP-Adressen im Klartext, die Auswertung ist
        aggregiert und lässt keinen Rückschluss auf einzelne Personen zu.
        Grundlage ist Art. 6 Abs. 1 lit. f DSGVO, das berechtigte Interesse an
        einer datensparsamen Statistik über die Nutzung.
      </p>

      <h2>6. Schriften</h2>
      <p>
        Die verwendeten Schriften werden vom eigenen Server ausgeliefert. Beim
        Aufruf der Seite entsteht keine Verbindung zu Google Fonts.
      </p>

      <h2>7. Speicherdauer</h2>
      <p>
        Notizbücher, Quellen, Antworten und Audiodateien bleiben gespeichert,
        bis du sie löschst. Löschst du ein Notizbuch, werden die daran
        hängenden Quellen, Nachrichten und erzeugten Formate mit gelöscht.
        Sitzungen laufen von selbst ab. Auf Wunsch lösche ich dein Konto mit
        allen daran hängenden Daten, eine E-Mail an die oben genannte Adresse
        genügt.
      </p>

      <h2>8. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16),
        Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
        Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf
        Grundlage berechtigter Interessen (Art. 21). Eine erteilte Einwilligung
        kannst du jederzeit mit Wirkung für die Zukunft widerrufen.
      </p>
      <p>
        Außerdem kannst du dich bei einer Aufsichtsbehörde beschweren.
        Zuständig ist das Unabhängige Landeszentrum für Datenschutz
        Schleswig-Holstein, Holstenstraße 98, 24103 Kiel.
      </p>

      <h2>9. Änderungen</h2>
      <p>
        Ändert sich die Anwendung, ändert sich diese Erklärung mit. Stand:
        August 2026.
      </p>
    </>
  )
}
