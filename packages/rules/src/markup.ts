/**
 * Storyteller reminder text uses two markers, documented in the official script
 * schema: `:reminder:` renders as a small reminder-token icon, and text wrapped
 * *in asterisks* names a physical token to show the player, such as
 * *TOWNSFOLK*, *WRONG*, *RED HERRING* or *YOU ARE*.
 */
export type MarkupNode =
  | { kind: 'text'; value: string }
  | { kind: 'reminder' }
  | { kind: 'token'; value: string }

const PATTERN = /(:reminder:)|\*([^*]+)\*/g

export function parseReminderMarkup(source: string): MarkupNode[] {
  const nodes: MarkupNode[] = []
  let last = 0

  for (const match of source.matchAll(PATTERN)) {
    const index = match.index ?? 0
    if (index > last) {
      nodes.push({ kind: 'text', value: source.slice(last, index) })
    }
    if (match[1]) {
      nodes.push({ kind: 'reminder' })
    } else if (match[2]) {
      nodes.push({ kind: 'token', value: match[2] })
    }
    last = index + match[0].length
  }

  if (last < source.length) {
    nodes.push({ kind: 'text', value: source.slice(last) })
  }
  return nodes
}

/** Plain-text rendering, for search, logs and accessible labels. */
export function reminderToPlainText(source: string): string {
  return parseReminderMarkup(source)
    .map((n) =>
      n.kind === 'text' ? n.value : n.kind === 'token' ? n.value : 'place a reminder token',
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The physical info tokens a step tells the Storyteller to show. */
export function tokensShownIn(source: string): string[] {
  return parseReminderMarkup(source)
    .filter((n): n is { kind: 'token'; value: string } => n.kind === 'token')
    .map((n) => n.value)
}

/** Whether this step asks the Storyteller to place or update a reminder token. */
export function placesReminder(source: string): boolean {
  return source.includes(':reminder:')
}
