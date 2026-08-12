const relative = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const millisecondsPerDay = 24 * 60 * 60 * 1000

/** Calendar days apart, so 23:59 and 00:01 count as yesterday, not as today. */
function daysAgo(date: Date, now: Date) {
  const startOfDay = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())

  return Math.round((startOfDay(now) - startOfDay(date)) / millisecondsPerDay)
}

/**
 * "Heute", "gestern", "vor 4 Tagen", and a plain date once that stops being
 * useful. Intl handles the wording, including "vorgestern".
 */
export function updatedLabel(date: Date, now: Date = new Date()) {
  const days = daysAgo(date, now)

  if (days < 0 || days > 6) return absolute.format(date)

  const label = relative.format(-days, 'day')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
