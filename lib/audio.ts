import { z } from 'zod'
import {
  charactersPerSpokenMinute,
  maxScriptCharacters,
  maxSpeechCharacters,
} from '@/lib/config'

/**
 * The shape of an audio overview, and nothing that talks to a model, to a
 * storage or to a database.
 *
 * Same split as lib/briefing.ts and lib/flashcards.ts: the player runs in the
 * browser and must not drag the AI SDK into the bundle. The writing and the
 * speaking live in lib/artifact-generation.ts and lib/speech.ts.
 */

/** What the model writes. The sound is made from it afterwards. */
export const AudioScript = z.object({
  title: z.string().describe('Kurzer Titel der Folge, höchstens acht Wörter'),
  script: z
    .string()
    .describe(
      'Der gesprochene Text am Stück, ohne Überschriften und ohne Aufzählungen',
    ),
})

export type AudioScript = z.infer<typeof AudioScript>

/**
 * What is stored: the whole script, and the one file spoken from it.
 *
 * The synthesis still happens in pieces, because one request takes 4000
 * characters and ten minutes of speech are more than that. The pieces are
 * joined before they are stored, which needs no ffmpeg: the models return
 * mp3 without an id3 header and at a constant bitrate, so the frames of the
 * second file simply follow the frames of the first. Measured on two takes
 * of 29.016 and 29.160 seconds, the joined file reports 58.176.
 *
 * That is worth the two lines it costs. A playlist meant a pause at every
 * seam, a slider that started over, and a second element loading ahead to
 * hide both.
 *
 * A pathname and not a url: the file is private, and the url a browser may
 * fetch is signed per request, see lib/speech.ts.
 */
export const AudioOverview = z.object({
  title: z.string(),
  script: z.string().min(1),
  pathname: z.string(),
})

export type AudioOverview = z.infer<typeof AudioOverview>

/**
 * Most of what makes a voice sound alive is written before it speaks.
 *
 * The speech models of the gateway take no direction, so the only levers on
 * the delivery are the voice and the text itself. Sentence length sets the
 * rhythm, a full stop sets a pause, a question mark lifts the end of a
 * line. A script full of even, comma-strung clauses is read out evenly, and
 * that is what a summary written for the eye sounds like when it is heard.
 */
export const audioScriptRules = `Du schreibst das Skript einer Audio-Übersicht über die nummerierten Abschnitte, die dir vorliegen. Es spricht eine einzelne Person, frei und zusammenhängend, so wie in einer Podcast-Folge, der man gern zuhört.

So klingt es:
- Der erste Satz ist der Haken: die überraschendste Zahl, der schärfste Widerspruch, die Frage, die der Stoff offenlässt. Niemals "In diesem Dokument geht es um".
- Erzähle in einem Bogen. Erst die Spannung aufmachen, dann auflösen, am Ende der Gedanke, der hängen bleibt.
- Wechsle die Satzlänge. Ein langer Satz, der einen Gedanken entfaltet. Dann ein kurzer. Das ist der halbe Rhythmus.
- Stelle zwischendurch die Frage, die der Zuhörer gerade hat, und beantworte sie.
- Mach das Abstrakte konkret: eine Zahl, ein Beispiel, ein Vergleich, aber nur aus dem Stoff selbst.
- Sprich den Zuhörer an, sparsam, zwei- oder dreimal in der ganzen Folge.
- Keine Aufzählung. Was in der Quelle eine Liste ist, wird hier ein Satz mit "und" und "aber".

Und das gilt weiter:
- Rede über die Quellen, lies sie nicht vor. Kein Zitat, das länger als ein Satz ist.
- Gesprochene Sprache: keine Überschriften, keine Klammern, keine Abkürzungen. Zahlen so, wie man sie ausspricht.
- Keine Begrüßung, kein Abschied, kein Name und kein Sender. Fang beim Thema an und hör beim letzten Gedanken auf.
- Verwende ausschließlich, was in den Abschnitten steht. Erfinde nichts dazu, auch keine Spannung, die der Stoff nicht hergibt.
- Ungefähr achttausend Zeichen, also rund acht Minuten gesprochen. Lieber kürzer und dicht als länger und dünn.
- Schreibe auf Deutsch.`

/** What the studio shows under the title, estimated from the script. */
export function audioOverviewMeta(overview: AudioOverview) {
  const minutes = Math.max(
    1,
    Math.round(overview.script.length / charactersPerSpokenMinute),
  )
  return `Rund ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`
}

/**
 * The partial scripts of a large selection into one.
 *
 * Every window gets the same share of the running time. Joining them whole
 * and cutting the tail off afterwards would be shorter to write and would
 * drop the last sources of the selection entirely.
 */
export function mergeAudioScripts(parts: AudioScript[]): AudioScript {
  const share = Math.floor(maxScriptCharacters / parts.length)

  return {
    title: parts[0].title,
    script: parts
      .map((part) => trimToSentence(part.script, share))
      .join('\n\n'),
  }
}

/** Whole sentences up to the limit, because half a sentence is heard. */
export function trimToSentence(text: string, limit: number) {
  const trimmed = text.trim()
  if (trimmed.length <= limit) return trimmed

  const cut = trimmed.slice(0, limit)
  const end = Math.max(
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    cut.lastIndexOf('?'),
  )

  return (end === -1 ? cut : cut.slice(0, end + 1)).trim()
}

/**
 * The script in pieces one synthesis request each takes, cut between
 * sentences so no piece begins in the middle of a word.
 */
export function splitScript(script: string, limit = maxSpeechCharacters) {
  const pieces: string[] = []
  let piece = ''

  for (const sentence of script.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? []) {
    // A single sentence over the limit would never fit and is cut hard.
    if (sentence.length > limit) {
      if (piece.trim()) pieces.push(piece.trim())
      piece = ''
      for (let at = 0; at < sentence.length; at += limit) {
        pieces.push(sentence.slice(at, at + limit).trim())
      }
      continue
    }

    if (piece.length + sentence.length > limit) {
      pieces.push(piece.trim())
      piece = ''
    }

    piece += sentence
  }

  if (piece.trim()) pieces.push(piece.trim())
  return pieces.filter((one) => one.length > 0)
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readAudioOverview(content: unknown): AudioOverview | null {
  const parsed = AudioOverview.safeParse(content)
  return parsed.success ? parsed.data : null
}
