import { parseReminderMarkup } from '@botc/rules'

/**
 * Renders official Storyteller reminder text.
 *
 * Two markers matter. `:reminder:` means "place or update a reminder token
 * here", and *TEXT IN ASTERISKS* names a physical info token to show the
 * player. Both are rendered visibly rather than hidden behind a hover: on a
 * touch device hover-revealed text is simply unreachable, and this is the
 * information the Storyteller needs while fifteen people watch them.
 */
export function ReminderText({ source }: { source: string }) {
  const nodes = parseReminderMarkup(source)
  return (
    <span className="serif text-[16px] leading-snug text-(--text)">
      {nodes.map((node, i) => {
        if (node.kind === 'text') return <span key={i}>{node.value}</span>
        if (node.kind === 'reminder') {
          return (
            <span
              key={i}
              className="caps mx-1 inline-flex translate-y-[-1px] items-center gap-1 align-middle text-[10px] text-(--text-dim)"
            >
              <span
                className="inline-block size-2 rounded-full border border-(--text-dim)"
                aria-hidden
              />
              reminder
            </span>
          )
        }
        return (
          <strong
            key={i}
            className="caps mx-[2px] rounded-[3px] bg-(--text) px-[5px] py-[1px] text-[11px] text-(--bg)"
          >
            {node.value}
          </strong>
        )
      })}
    </span>
  )
}
