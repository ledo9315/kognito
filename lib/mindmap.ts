import { z } from 'zod'

/**
 * The shape of a mindmap, and nothing that talks to a model or a database.
 *
 * Same split as lib/briefing.ts, lib/faq.ts, lib/flashcards.ts and
 * lib/timeline.ts: the reader draws the map in the browser and must not drag
 * the AI SDK into the bundle. The generating lives in
 * lib/artifact-generation.ts.
 */

/**
 * Three levels, spelled out, instead of a node that contains itself.
 *
 * A tree wants recursion, and zod can express it. The cost is a `$ref` in the
 * json schema and a depth the model decides on, which is the one thing a
 * panel 384 pixels wide cannot absorb. Written out, the depth is a property
 * of the type: the prompt cannot talk the model into a fourth level and
 * `mergeMindmaps` stays two nested loops instead of a tree walk.
 */
export const Mindmap = z.object({
  title: z.string().describe('Kurzer Titel der Mindmap, höchstens acht Wörter'),
  branches: z
    .array(
      z.object({
        label: z.string().describe('Ein Hauptthema, zwei bis vier Wörter'),
        children: z
          .array(
            z.object({
              label: z
                .string()
                .describe('Ein Unterthema des Hauptthemas, zwei bis fünf Wörter'),
              children: z
                .array(z.string())
                .describe('Höchstens zwei Stichworte, je zwei bis vier Wörter'),
            }),
          )
          .describe('Zwei bis vier Unterthemen'),
      }),
    )
    .min(1)
    .describe('Vier bis sechs Hauptthemen, die die Quellen gliedern'),
})

export type Mindmap = z.infer<typeof Mindmap>
type Branch = Mindmap['branches'][number]

export const mindmapRules = `Du gliederst die nummerierten Abschnitte, die dir vorliegen, zu einer Mindmap.

Regeln:
- Eine Mindmap gliedert, sie fasst nicht zusammen. Jede Beschriftung ist ein Stichwort, kein Satz und kein Halbsatz.
- Nimm auf, was die Gliederung trägt, nicht alles, was im Text steht. Eine Karte mit achtzig Knoten liest niemand.
- Halte die Beschriftungen kurz genug, dass sie in einen Knoten passen: zwei bis fünf Wörter, ohne Punkt am Ende.
- Die Hauptthemen teilen den Stoff auf. Zwei Hauptthemen, die dasselbe meinen, sind ein Hauptthema.
- Ein Unterthema gehört unter das Hauptthema, zu dem es wirklich gehört, nicht unter das erstbeste.
- Verwende ausschließlich, was in den Abschnitten steht. Ergänze nichts aus allgemeinem Wissen.
- Schreibe auf Deutsch, sachlich und knapp.`

/** What the studio shows under the title, counted from the content. */
export function mindmapMeta(mindmap: Mindmap) {
  const topics = mindmap.branches.length
  const nodes = mindmap.branches.reduce(
    (total, branch) =>
      total +
      branch.children.reduce((count, child) => count + 1 + child.children.length, 0),
    0,
  )

  return `${topics} ${topics === 1 ? 'Thema' : 'Themen'} · ${nodes} Knoten`
}

/**
 * How much map fits on a screen, decided here instead of in the prompt.
 *
 * The schema asks for a handful of nodes under each topic, and a first real
 * run answered with 82 of them without breaking a single rule. Nothing about
 * that is wrong, it is simply more than a drawing can carry: measured against
 * mermaid, 79 nodes come out 1964 pixels wide, 61 come out 1798 and 31 come
 * out 1198. The panel is 384.
 *
 * Same division as the timeline in #57. The schema stays generous, because a
 * limit it cannot enforce only teaches the model to lie, and the counting
 * happens afterwards in code where it holds.
 */
const bounds = { branches: 6, children: 3, leaves: 2 }

export function withinBounds(mindmap: Mindmap): Mindmap {
  return {
    title: mindmap.title,
    branches: mindmap.branches.slice(0, bounds.branches).map((branch) => ({
      label: branch.label,
      children: branch.children.slice(0, bounds.children).map((child) => ({
        label: child.label,
        children: child.children.slice(0, bounds.leaves),
      })),
    })),
  }
}

function same(one: string, other: string) {
  return one.trim().toLowerCase() === other.trim().toLowerCase()
}

/**
 * The partial maps of a large selection into one, branch by branch.
 *
 * Same reasoning as `mergeFaqs`: joining in code cannot lose a node, a second
 * model pass could. Unlike a list, two windows rarely disagree about the
 * branch and often about what hangs under it, so a branch two windows both
 * saw keeps the children of both instead of the first one winning.
 *
 * Quadratic in the number of branches, which is a handful. A lookup by label
 * would be faster and less obvious to read.
 */
export function mergeMindmaps(parts: Mindmap[]): Mindmap {
  const branches: Branch[] = []

  for (const branch of parts.flatMap((part) => part.branches)) {
    const known = branches.find((candidate) => same(candidate.label, branch.label))

    // Copied, never referenced, so merging cannot reach back into its input.
    if (!known) {
      branches.push({
        label: branch.label,
        children: branch.children.map((child) => ({
          label: child.label,
          children: [...child.children],
        })),
      })
      continue
    }

    for (const child of branch.children) {
      const knownChild = known.children.find((candidate) =>
        same(candidate.label, child.label),
      )

      if (!knownChild) {
        known.children.push({ label: child.label, children: [...child.children] })
        continue
      }

      for (const leaf of child.children) {
        if (!knownChild.children.some((candidate) => same(candidate, leaf))) {
          knownChild.children.push(leaf)
        }
      }
    }
  }

  return { title: parts[0].title, branches }
}

/**
 * Characters that end a node early instead of appearing in it.
 *
 * Mermaid delimits a node with brackets and a markdown string with quotes or
 * backticks, and documents no way to escape either inside a label. The labels
 * here are written by a model that read documents nobody in this project
 * wrote, so a stray bracket is a matter of when. Removing beats escaping: a
 * label that loses a parenthesis still reads, a map that fails to parse does
 * not.
 */
const structural = /[[\](){}<>"'`|]/g

/** A label as mermaid may read it: one line, no delimiters, never empty. */
export function mermaidLabel(text: string) {
  return text.replace(structural, '').replace(/\s+/g, ' ').trim()
}

/**
 * The map in mermaid's mindmap syntax, which is indentation and nothing else.
 *
 * Every node is written as `id[label]` with an id of our own. Without one,
 * mermaid reads the label itself as the id, and then a label it dislikes is a
 * parse error rather than an odd looking node.
 *
 * Labels that are empty after cleaning are dropped, along with whatever hangs
 * under them. A node without a caption carries nothing.
 */
export function toMermaid(mindmap: Mindmap): string {
  const lines = ['mindmap', `  root((${mermaidLabel(mindmap.title) || 'Mindmap'}))`]
  let id = 0

  for (const branch of mindmap.branches) {
    const label = mermaidLabel(branch.label)
    if (!label) continue
    lines.push(`    n${(id += 1)}[${label}]`)

    for (const child of branch.children) {
      const childLabel = mermaidLabel(child.label)
      if (!childLabel) continue
      lines.push(`      n${(id += 1)}[${childLabel}]`)

      for (const leaf of child.children) {
        const leafLabel = mermaidLabel(leaf)
        if (!leafLabel) continue
        lines.push(`        n${(id += 1)}[${leafLabel}]`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readMindmap(content: unknown): Mindmap | null {
  const parsed = Mindmap.safeParse(content)
  return parsed.success ? parsed.data : null
}
