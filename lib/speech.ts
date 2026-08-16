import { generateSpeech, type SpeechModel } from 'ai'
import { del, issueSignedToken, presignUrl, put } from '@vercel/blob'

/**
 * Turning a piece of script into an mp3 a browser can play.
 *
 * The model runs through the AI Gateway, same as everywhere else in this
 * project, so speaking needs no second provider and no second key. The file
 * goes into Vercel Blob because the database column next to it holds json
 * that every page load selects, and a megabyte of audio has no business
 * being read on the way to a notebook title.
 *
 * The store is private, so what is kept is the pathname and not a url. An
 * overview is read out of somebody's sources, and a public url would be the
 * one place in this project where holding a link counts as being allowed to
 * listen. The route handler checks the owner and signs a url that expires,
 * see app/api/audio.
 *
 * The pieces are joined by putting one byte range after the other. These are
 * mp3 frames without an id3 header and at a constant bitrate, so a decoder
 * reads the result as one file and reports the summed length exactly. No
 * ffmpeg in a serverless function, and no playlist in the browser.
 */

/**
 * Measured against the gateway on a German text of 1276 characters: `tts-1`
 * takes 4.5 seconds, `tts-1-hd` takes 8.2. A piece of 4000 characters is
 * therefore well under half a minute even on the slower one, and the pieces
 * run side by side, so the better voice costs nothing worth having.
 *
 * Both the model and the voice are read from the environment, because which
 * one sounds right in German is decided by listening, not by reading code.
 */
export function defaultSpeechModel(): SpeechModel {
  return process.env.AI_SPEECH_MODEL ?? 'openai/tts-1-hd'
}

function defaultVoice() {
  return process.env.AI_SPEECH_VOICE ?? 'nova'
}

/** The pathname of the one stored mp3, spoken from all the pieces. */
export async function speak(
  pieces: string[],
  model: SpeechModel = defaultSpeechModel(),
): Promise<string> {
  // Side by side: the pieces do not depend on each other, and in a row they
  // would add up to a minute of waiting.
  const spoken = await Promise.all(
    // No `language`: the OpenAI speech models ignore it and warn, they take
    // the language from the text.
    pieces.map((text) =>
      generateSpeech({ model, voice: defaultVoice(), text }).then(
        (result) => result.audio,
      ),
    ),
  )

  // The only caller refuses an empty script before it gets here, so this
  // says out loud what the next line already assumes.
  if (spoken.length === 0) {
    throw new Error('No speech pieces provided')
  }

  const mediaType = spoken[0].mediaType

  // Belt and braces: the Blob constructor already copies exactly the bytes a
  // typed array view spans, offset included. Spelling the copy out costs
  // nothing and does not depend on that reading.
  const blobParts: BlobPart[] = spoken.map((audio) => {
    const bytes = audio.uint8Array
    const start = bytes.byteOffset
    const end = start + bytes.byteLength

    if (bytes.buffer instanceof ArrayBuffer) {
      return bytes.buffer.slice(start, end)
    }

    return new Uint8Array(bytes).buffer
  })

  const { pathname } = await put(
    `audio/${crypto.randomUUID()}.mp3`,
    new Blob(blobParts, { type: mediaType }),
    { access: 'private', contentType: mediaType },
  )

  return pathname
}

/**
 * A url for this one file, good for an hour and for nothing else.
 *
 * The default expiry of the api. Long enough to listen to ten minutes and
 * short enough that a url out of a browser history is worth nothing.
 */
export async function presignAudio(pathname: string) {
  const signed = await issueSignedToken({ pathname, operations: ['get'] })

  const { presignedUrl } = await presignUrl(signed, {
    operation: 'get',
    pathname,
    access: 'private',
  })

  return presignedUrl
}

/**
 * Best effort. The artifact row is gone by the time this runs, and a file
 * nothing points at any more is not worth failing a deletion over.
 */
export async function forget(pathname: string) {
  try {
    await del(pathname)
  } catch (error) {
    console.error('speech: deleting the audio failed', error)
  }
}
