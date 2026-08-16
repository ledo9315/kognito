# Kognito

Ein Notizbuch für eigene Quellen. PDFs, Texte und Webseiten hochladen, Fragen dazu stellen, und jede Aussage der Antwort trägt eine Belegstelle, die zurück in den Quelltext springt. Dazu ein Studio, das aus derselben Auswahl ein Briefing, ein FAQ, eine Zeitleiste, eine Mindmap, Lernkarten oder eine gesprochene Übersicht erzeugt.

[![CI](https://github.com/ledo9315/kognito/actions/workflows/ci.yml/badge.svg)](https://github.com/ledo9315/kognito/actions/workflows/ci.yml)

<img width="5088" height="3384" alt="dashboard" src="https://github.com/user-attachments/assets/2faf8a95-93c5-4e3c-975b-17700fada738" />

## Funktionen

- **Quellen** als PDF, TXT und Markdown, über eine Webadresse, als eingefügter Text oder als Notiz, die in der App selbst entsteht.
- **Chat mit Belegen.** Jede Antwort verweist auf nummerierte Passagen, ein Klick öffnet die Quelle an genau der Stelle.
- **Auswahl.** Beantwortet wird nur aus den Quellen, die angehakt sind. Dieselbe Auswahl gilt für das Studio.
- **Studio** mit sechs Formaten aus derselben Auswahl: Audio-Übersicht, Briefing, FAQ, Zeitleiste, Mindmap und Lernkarten, gespeichert und jederzeit wieder aufrufbar.
- **Notizen**, die wie jede andere Quelle zitiert und durchsucht werden können.
- **Konten** mit E-Mail und Passwort oder über Google.

## Schnellstart

Vorausgesetzt sind Node 24 (steht in `.nvmrc`) und pnpm 11. Dazu eine Postgres-Datenbank mit der Erweiterung `pgvector`, ein Schlüssel für das Vercel AI Gateway und ein Vercel-Blob-Store für die Audiodateien.

```bash
git clone https://github.com/ledo9315/kognito.git
cd kognito
pnpm install

cp .env.example .env.local   # Werte eintragen, siehe Konfiguration
pnpm db:migrate
pnpm dev
```

Die App läuft dann auf http://localhost:3000.

## Konfiguration

| Variable | Pflicht | Wofür |
| --- | --- | --- |
| `DATABASE_URL` | ja | Postgres mit pgvector, gepoolte Verbindung |
| `BETTER_AUTH_SECRET` | ja | Signatur der Sitzungen |
| `AI_GATEWAY_API_KEY` | ja | Chat, Artefakte, Einbettungen und Sprachausgabe |
| `BLOB_READ_WRITE_TOKEN` | für Audio | Ablage der erzeugten mp3-Dateien |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | nein | ohne sie fehlt nur die Anmeldung über Google |
| `BETTER_AUTH_URL` | nein | wird sonst aus der Umgebung abgeleitet |
| `AI_GATEWAY_MODEL` | nein | Voreinstellung `openai/gpt-5-mini` |
| `AI_EMBEDDING_MODEL` | nein | Voreinstellung `openai/text-embedding-3-small` |
| `AI_SPEECH_MODEL` | nein | Voreinstellung `openai/tts-1-hd` |
| `AI_SPEECH_VOICE` | nein | Voreinstellung `nova` |

Wer auf Vercel und Neon arbeitet, holt sich alle Werte mit `vercel env pull .env.local` in einem Zug.

## Wie es funktioniert

### Quellen und Passagen

Eine hochgeladene Datei wird ausgelesen, in Passagen von 500 bis 1000 Zeichen mit 100 Zeichen Überlappung geschnitten und mit ihren Zeichenpositionen gespeichert. Diese Positionen sind es, die eine Belegstelle später an die richtige Stelle im Quelltext springen lassen. Eine Notiz ist keine eigene Tabelle, sondern eine Quelle der Art `note`, weshalb Auswahl, Zerlegung, Suche und Belege für sie unverändert gelten.

### Antworten

Solange die gewählten Quellen zusammen unter 120.000 Zeichen bleiben, geht ihr gesamter Text in den Prompt. Kein Suchen, kein Sortieren nach Ähnlichkeit, keine Passage, die verloren geht, weil ein Suchverfahren sie für nebensächlich hielt.

Darüber schaltet `getContextChunks` in `features/chat/context.ts` auf Suche um: Passagen werden eingebettet, nach Kosinusabstand zur Frage geholt und in Lesereihenfolge an das Modell übergeben. Beides liegt hinter derselben Funktion, aufrufender Code merkt vom Wechsel nichts.

Das Modell zitiert mit Nummern, die auf die übergebenen Passagen zeigen. Beim Auflösen werden Nummern verworfen, die es sich ausgedacht hat.

### Artefakte

Ein Artefakt hat keine Frage, mit der man suchen könnte, und was eine Suche als themenfremd verwirft, ist genau das, was eine Zusammenfassung dem Leser noch schuldet. Artefakte lesen deshalb immer jede Passage der Auswahl. Passt sie nicht in einen Prompt, wird sie in Fenster geteilt, die nebeneinander laufen, und die Teilergebnisse werden im Code zusammengeführt statt von einem weiteren Modellaufruf.

### Audio-Übersicht

Zuerst entsteht ein Skript von rund zehn Minuten, dann wird es gesprochen. Da ein Syntheseaufruf gut 4000 Zeichen annimmt, wird das Skript an Satzgrenzen geteilt, die Stücke laufen nebeneinander und werden anschließend zu einer Datei zusammengefügt. Das braucht kein ffmpeg: Die Modelle liefern mp3 ohne ID3-Kopf und mit konstanter Bitrate, also folgen die Frames des zweiten Stücks unmittelbar auf die des ersten, und die Gesamtlänge stimmt auf die Millisekunde.

### Zugriff

Autorisierung passiert serverseitig. `proxy.ts` prüft nur optimistisch das Sitzungscookie und trifft keine Entscheidung, die eigentliche Prüfung steht in `lib/session.ts` und wird von jeder Seite und jeder Action aufgerufen, die Nutzerdaten anfasst. Jede Abfrage filtert zusätzlich nach der Besitzer-Id des Notizbuchs.

Die Audiodateien liegen in einem privaten Blob-Store. Gespeichert wird nur ihr Pfad, und `/api/audio/[artifactId]` prüft Sitzung und Besitzer, bevor es auf eine signierte Adresse weiterleitet, die nach einer Stunde verfällt.

## Technik

| Bereich | Wahl |
| --- | --- |
| Framework | Next.js 16, App Router, React 19 |
| Oberfläche | Tailwind 4, shadcn/ui auf Base UI |
| Datenbank | Postgres mit pgvector, Drizzle ORM |
| Konten | Better Auth |
| Modelle | AI SDK über das Vercel AI Gateway |
| Dateien | Vercel Blob |
| Tests | Vitest mit pglite, Playwright |

Geschrieben wird über Server Actions. Eigene Routen gibt es nur zwei: `/api/chat` streamt die Antwort, `/api/audio/[artifactId]` liefert eine Datei aus.

Die Ordner trennen danach, was die Anwendung kann, und was sie dafür benutzt. `features/` beantwortet die erste Frage, `lib/` die zweite.

```
app/            Seiten, Layouts und die beiden Routen
features/       Fachbereiche, je mit Logik, Actions, Tests und components/
  sources/      Hochladen, Extrahieren, Zerlegen, Notizen
  chat/         Kontext, Antwort, Zitate, Folgefragen
  artifacts/    Briefing, FAQ, Karteikarten, Zeitstrahl, Mindmap, Audio
  notebooks/    Notizbücher, Arbeitsfläche, gemeinsamer Zustand
components/     Oberfläche ohne Fachbereich, ui/ enthält die shadcn-Bausteine
lib/            Technische Grundlage: Datenbank, Auth, Sitzung, Embeddings,
                Konfiguration, Sprachsynthese
lib/db/         Schema, Migrationen, Testdatenbank
e2e/            Playwright-Specs
```

## Entwicklung

```bash
pnpm dev          # Entwicklungsserver
pnpm build        # Produktionsbuild
pnpm lint
pnpm typecheck
pnpm test         # Vitest, ein Durchlauf
pnpm test:watch
pnpm test:e2e     # Playwright, Chromium
pnpm db:generate  # Migration aus Änderungen an schema.ts
pnpm db:migrate
pnpm db:studio
```

Einzelne Tests laufen mit `pnpm test lib/session.test.ts` oder `pnpm test -t 'owner scoping'`.

### Tests

224 Unit-Tests, ohne jsdom und ohne Testing Library: geprüft wird, was rechnet und was speichert. Datenbanktests laufen gegen ein Postgres, das im selben Prozess startet, und wenden dabei die echten Migrationsdateien an, eine kaputte Migration fällt also schon in den Unit-Tests auf. Modellaufrufe treffen die Mock-Modelle des AI SDK, sodass der ganze Lauf ohne Netz und ohne Zugangsdaten auskommt.

Playwright fährt drei Projekte: `setup` meldet ein frisches Konto an und legt die Sitzung ab, `chromium` fährt die angemeldeten Specs dagegen, `anonymous` die abgemeldeten ohne sie. Lokal gegen `pnpm dev`, auf CI gegen `pnpm build && pnpm start`.

CI läuft in zwei parallelen Jobs. `checks` bekommt bewusst keine Zugangsdaten: dass Lint, Typen, Unit-Tests und Build ohne `DATABASE_URL` durchlaufen, belegt, dass Datenbank und Auth erst beim ersten Aufruf gebaut werden und nicht beim Import. `e2e` läuft gegen eine eigene Datenbank und wendet vorher die Migrationen an.

Bekannter Haken: Startet Vitest alle Dateien gleichzeitig, kippen die pglite-Tests auf schwächeren Maschinen in Hook-Timeouts. `pnpm exec vitest run --fileParallelism=false` läuft durch.

## Grenzen

- Die Audio-Übersicht hat einen Erzähler und keinen Dialog. Kein Sprachmodell im Gateway spricht Gespräche mit Einwürfen, zwei Stimmen, die abwechselnd Sätze vorlesen, sind noch keins.
- Die Mindmap kann keine Äste einklappen, weil Mermaid es nicht kann. Stattdessen begrenzt der Code die Anzahl der Knoten.
- Notizbücher gehören genau einem Konto, es gibt keine Freigabe und keine Zusammenarbeit.
- Kein Dark Mode. Die Variablen dafür stehen bereit, die Klasse wird nirgends gesetzt.
- Kein Hintergrundjob. Alles läuft in der Anfrage, die es ausgelöst hat, eine Audio-Übersicht dauert damit knapp eine Minute.
- Die rechte Spalte wird zweimal gerendert, einmal für breite und einmal für schmale Fenster, versteckt wird eine davon per CSS. Das kostet doppelten Zustand und doppelte Anfragen.

## Mitmachen

Erst ein Issue, dann ein Branch, dann ein Pull Request. Direkt auf `main` geht nichts, und beide CI-Jobs müssen grün sein. Gemergt wird mit Merge-Commits, Squash und Rebase sind abgeschaltet.

Sprache: die Oberfläche und alles, was in Issues und Pull Requests steht, auf Deutsch. Code, Bezeichner, Kommentare und Commit-Nachrichten auf Englisch. Bezeichner werden ausgeschrieben, also `notebook` statt `nb`.
