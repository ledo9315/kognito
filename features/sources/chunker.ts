import { chunkLimits } from '@/lib/config'

export type TextChunk = {
  text: string
  charStart: number
  charEnd: number
}

type ChunkLimits = {
  min: number
  max: number
  overlap: number
}

export function chunkText(
  text: string,
  limits: ChunkLimits = chunkLimits,
): TextChunk[] {

  if (text.trim() === '') return []

  const chunks: TextChunk[] = []
  let start = 0

  while (start < text.length) {

    const limit = Math.min(start + limits.max, text.length)
    const end = limit === text.length ? limit : cutPoint(text, start + limits.min, limit)
    chunks.push({ text: text.slice(start, end), charStart: start, charEnd: end })

    if (end >= text.length) break
    start = nextStart(text, end, limits.overlap)
  }

  return chunks
}

function cutPoint(text: string, earliest: number, latest: number) {
  const window = text.slice(earliest, latest)

  const paragraph = window.lastIndexOf('\n\n')
  if (paragraph !== -1) return earliest + paragraph + 2

  const sentence = lastMatch(window, /[.!?]["'”’)\]]?(?=\s)/g)
  if (sentence !== -1) return earliest + sentence + 1

  const space = lastMatch(window, /\s/g)
  if (space !== -1) return earliest + space + 1

  return latest
}

function lastMatch(value: string, pattern: RegExp) {
  let index = -1
  for (const match of value.matchAll(pattern)) index = match.index
  return index
}

function nextStart(text: string, end: number, overlap: number) {
  const candidate = Math.max(end - overlap, 0)
  const space = text.slice(candidate, end - 1).search(/\s/)

  return space === -1 ? candidate : candidate + space + 1
}
