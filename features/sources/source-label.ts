/**
 * How a number of sources is written out, in one place.
 *
 * The overview, the workspace header and the chat all count the same thing,
 * and a plural rule copied four times is a plural rule that drifts. No
 * imports on purpose: every caller is a client component.
 */
export function sourceLabel(count: number) {
  return `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`
}
