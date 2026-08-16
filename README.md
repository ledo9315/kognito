# Kognito

Ein Notizbuch für eigene Quellen. PDFs, Texte und Webseiten hochladen, Fragen dazu stellen, und jede Aussage der Antwort trägt eine Belegstelle, die zurück in den Quelltext springt. Dazu ein Studio, das aus derselben Auswahl ein Briefing, ein FAQ, eine Zeitleiste, eine Mindmap, Lernkarten oder eine gesprochene Übersicht erzeugt.

Gebaut als Bewerbungsprojekt, deshalb ist der Weg Teil des Ergebnisses: jede Änderung hat ein Issue, einen Branch, einen Pull Request und einen grünen CI-Lauf hinter sich.

<img width="5088" height="3384" alt="dashboard" src="https://github.com/user-attachments/assets/2faf8a95-93c5-4e3c-975b-17700fada738" />

## Was es kann

- **Quellen**: PDF, TXT und Markdown als Datei, Webseiten über die Adresse, eingefügter Text, und Notizen, die in der App selbst entstehen.
- **Chat mit Belegen**: Jede Antwort verweist auf nummerierte Passagen. Ein Klick öffnet die Quelle an genau der Stelle.
- **Auswahl**: Beantwortet wird nur aus den Quellen, die angehakt sind. Die Auswahl gilt auch für das Studio.
- **Studio**: sechs Artefaktarten aus der Auswahl, gespeichert und wieder aufrufbar.
- **Konten**: E-Mail mit Passwort oder Google. Alles, was einem Konto gehört, hängt an der Notizbuch-Zeile und wird bei jeder Abfrage nach der Besitzer-Id gefiltert.

## Architektur

Next.js 16 mit dem App Router, React 19, Tailwind 4 und shadcn/ui auf Base UI. Die Daten liegen in Neon Postgres mit pgvector, angesprochen über Drizzle. Better Auth macht die Konten. Alle Modellaufrufe laufen über das AI SDK gegen das Vercel AI Gateway, die Audiodateien liegen in Vercel Blob.

Geschrieben wird über Server Actions. Eigene Routen gibt es nur zweimal, und beide Male aus einem Grund: `/api/chat` streamt, `/api/audio/[artifactId]` liefert eine Datei aus.

Autorisierung passiert serverseitig. `proxy.ts`, der Nachfolger von `middleware.ts`, prüft nur optimistisch das Cookie und trifft keine Entscheidung. Die echte Prüfung steht in `lib/session.ts` und wird von jeder Seite und jeder Action aufgerufen, die Nutzerdaten anfasst.

Eine Notiz ist keine eigene Tabelle, sondern eine Quelle der Art `note`. Damit gelten Auswahl, Zerlegung in Passagen, Suche und Belegstellen für sie unverändert, ohne dass irgendwo ein zweiter Fall entsteht.

## Entscheidungen

### Voller Kontext statt RAG, mit einer Grenze

Solange die gewählten Quellen zusammen unter 120.000 Zeichen bleiben, geht der gesamte Text in den Prompt. Kein Suchen, kein Sortieren nach Ähnlichkeit, keine Passage, die verloren geht, weil ein Suchverfahren sie für nebensächlich hielt. Für die Größenordnung, um die es hier geht, also ein paar Dokumente statt eines Archivs, ist das die genauere und die einfachere Lösung zugleich.

Darüber schaltet `getContextChunks` in `lib/context.ts` auf Suche um: Passagen werden eingebettet, nach Kosinusabstand zur Frage geholt und in Lesereihenfolge zurückgegeben. Beides liegt hinter derselben Funktion, die Aufrufer merken vom Wechsel nichts.

Das Studio geht bewusst einen anderen Weg. Ein Artefakt hat keine Frage, mit der man suchen könnte, und was eine Suche als themenfremd wegwirft, ist genau das, was eine Zusammenfassung dem Leser noch schuldet. Artefakte lesen deshalb immer jede Passage und zahlen dafür mit einem Modellaufruf je Fenster statt einem insgesamt.

### Better Auth statt Clerk oder NextAuth

Clerk hätte einen fremden Dienst zwischen Nutzer und Datenbank gestellt und Konten außerhalb des eigenen Postgres gehalten. NextAuth ist stark bei fremden Anbietern und schwach genau dort, wo dieses Projekt anfängt, nämlich bei E-Mail mit Passwort und einer eigenen Nutzertabelle.

Better Auth legt seine vier Tabellen in dasselbe Schema wie alles andere, `user`, `session`, `account` und `verification` stehen in `lib/db/schema.ts` neben `notebook` und `source`. Fremdschlüssel und Kaskaden gelten damit durchgehend, und ein gelöschtes Konto nimmt seine Notizbücher wirklich mit.

Google-Anmeldung ist zugeschaltet, Kontoverknüpfung nur für Google. Bewusst nicht abgeschaltet ist die Prüfung, ob die lokale E-Mail bestätigt sein muss, bevor ein fremdes Konto darauf verknüpft werden darf: ohne sie kann sich jemand mit fremder Adresse anmelden und das bestehende Konto übernehmen.

### pglite für Datenbanktests

Datenbanktests laufen gegen ein Postgres, das im selben Prozess startet, siehe `lib/db/test-db.ts`. Kein Docker, keine Testdatenbank in der Cloud, keine Zugangsdaten für den Testlauf.

Der entscheidende Teil ist, dass darauf die echten Migrationsdateien angewendet werden. Eine kaputte Migration lässt damit die Unit-Tests scheitern und nicht erst das Deployment. pgvector kommt als eigenes Paket dazu, weil die Migration die Erweiterung anlegt.

### Ein Gateway statt Provider-SDKs

Alle Modelle, also Chat, Artefakte, Einbettungen und Sprache, laufen über das AI Gateway. Ein Schlüssel, ein Ort für Kosten, und ein Modellwechsel ist eine Zeichenkette in einer Umgebungsvariablen statt eines neuen Pakets.

Das hat einen sichtbaren Preis: Ein Modell, das im Gateway nicht geführt wird, ist nicht erreichbar. Für die Audio-Übersicht heißt das `openai/tts-1-hd` statt `gpt-4o-mini-tts`, und damit keine Regieanweisungen an die Stimme.

### Eine mp3 statt einer Playlist

Ein Syntheseaufruf nimmt gut 4000 Zeichen, zehn Minuten gesprochener Text sind mehr. Der naheliegende Ausweg wäre eine Playlist im Browser gewesen, um ffmpeg in einer Serverless-Funktion zu vermeiden.

Nachgemessen war das unnötig: Die Modelle liefern mp3 ohne ID3-Kopf und mit konstanter Bitrate, also folgen die Frames der zweiten Datei einfach auf die der ersten. Zwei Aufnahmen von 29,016 und 29,160 Sekunden ergeben zusammengehängt exakt 58,176 Sekunden. Es bleibt eine Datei, ein Regler über die ganze Folge und keine Pause an den Nahtstellen.

### Private Ablage mit signierter URL

Eine Audio-Übersicht ist der Inhalt fremder Quellen. Eine öffentliche Blob-Adresse wäre die einzige Stelle im Projekt gewesen, an der das Kennen einer URL als Erlaubnis zählt. Der Store ist deshalb privat, gespeichert wird nur der Pfad, und `/api/audio/[artifactId]` prüft Sitzung und Besitzer und leitet dann auf eine URL weiter, die nach einer Stunde verfällt. Die Datei selbst läuft nicht durch die Funktion, weshalb Vorspulen normal funktioniert.

## Lokal starten

Vorausgesetzt sind Node 24 (steht in `.nvmrc`) und pnpm 11.

```bash
pnpm install
vercel env pull .env.local   # oder die Datei von Hand anlegen, siehe Tabelle
pnpm db:migrate
pnpm dev
```

In `.env.local` gehören:

| Variable | Wofür |
| --- | --- |
| `DATABASE_URL` | Neon Postgres, gepoolte Verbindung |
| `BETTER_AUTH_SECRET` | Signatur der Sitzungen |
| `AI_GATEWAY_API_KEY` | Chat, Artefakte, Einbettungen, Sprache |
| `BLOB_READ_WRITE_TOKEN` | Ablage der Audiodateien |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, ohne sie fehlt nur die Google-Anmeldung |
| `AI_GATEWAY_MODEL`, `AI_EMBEDDING_MODEL`, `AI_SPEECH_MODEL`, `AI_SPEECH_VOICE` | optional, überschreiben die Voreinstellungen |

Die Werte kommen aus Neon und Vercel.

## Tests

```bash
pnpm test        # Vitest, ein Durchlauf
pnpm test:e2e    # Playwright, Chromium
pnpm lint
pnpm typecheck
pnpm build
```

224 Unit-Tests in 17 Dateien, dazu eine achtzehnte, die nur mit `pnpm test:live` gegen ein echtes Modell läuft. Kein jsdom und keine Testing Library: getestet wird, was rechnet und was speichert, nicht wie es aussieht. Datenbanktests laufen gegen pglite, Modellaufrufe gegen die Mock-Modelle des AI SDK, sodass der ganze Lauf ohne Netz und ohne Zugangsdaten auskommt.

Playwright fährt drei Projekte: `setup` meldet ein frisches Konto an und legt die Sitzung ab, `chromium` fährt die angemeldeten Specs dagegen, `anonymous` die abgemeldeten ohne sie. Lokal gegen `pnpm dev`, auf CI gegen `pnpm build && pnpm start`.

CI läuft in zwei parallelen Jobs. `checks` bekommt bewusst keine einzige Zugangsdatengabe: dass Lint, Typen, Unit-Tests und Build ohne `DATABASE_URL` durchlaufen, ist der Beweis, dass Datenbank und Auth wirklich erst beim ersten Aufruf gebaut werden und nicht beim Import. `e2e` läuft gegen einen eigenen Neon-Branch und wendet vorher die Migrationen an.

Ein bekannter Haken: Startet Vitest alle Dateien gleichzeitig, kippen die pglite-Tests auf schwächeren Maschinen reihenweise in Hook-Timeouts. `pnpm exec vitest run --fileParallelism=false` läuft durch.

## Was bewusst offen blieb

- **Kein Dialog mit zwei Stimmen.** Die Audio-Übersicht hat einen Erzähler. Der Umbau wäre überschaubar, die Grenze liegt woanders: kein Sprachmodell im Gateway spricht Dialog mit Einwürfen, zwei Stimmen, die abwechselnd Sätze vorlesen, sind noch kein Gespräch.
- **Die Mindmap kann nichts einklappen.** Mermaid kann es nicht, also begrenzt der Code stattdessen die Anzahl der Knoten. Mit Einklappen wäre `markmap` die Bibliothek.
- **Kein Teilen.** Notizbücher gehören genau einem Konto. Freigaben hätten ein zweites Rechtemodell bedeutet und wären am Kern vorbeigegangen.
- **Kein Dark Mode.** Angelegt ist er in den Tailwind-Variablen, gesetzt wird die Klasse nirgends.
- **Kein Hintergrundjob.** Alles läuft in der Anfrage, die es ausgelöst hat. Eine Audio-Übersicht dauert damit knapp eine Minute, in der ein Ladezustand steht.
- **Der Leser wird doppelt montiert.** Das Layout rendert die rechte Spalte einmal für breite und einmal für schmale Fenster und versteckt eine davon per CSS. Doppelter Zustand, doppelte Anfragen. Auffällig wurde es erst, als dort Ton hing.
