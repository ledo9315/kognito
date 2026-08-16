/** Hostname of a source URL for display, without a leading `www.`. */
export function sourceHostLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    // No valid URL: the beginning of the input is labeled (more useful than an empty title).
    return value.slice(0, 40)
  }
}

/** Recognizes YouTube links so that the source is categorized as a video. */
export function isYoutubeUrl(value: string) {
  return /youtu\.?be/.test(value)
}
