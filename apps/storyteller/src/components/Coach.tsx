import type { Tip } from '../coach.js'

const MARK: Record<Tip['k'], { label: string; colour: string }> = {
  do: { label: 'Do', colour: 'var(--text)' },
  say: { label: 'Say', colour: 'var(--now)' },
  note: { label: 'Record', colour: 'var(--text-dim)' },
  hint: { label: 'Hint', colour: 'var(--color-blue-2)' },
  warn: { label: 'Check', colour: 'var(--color-red-2)' },
}

/** The coach's list for this moment, in order. */
export function Coach({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) return null
  return (
    <ol className="mt-3 flex list-none flex-col gap-2 border-t border-(--hairline) p-0 pt-3">
      {tips.map((tip, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="caps mt-[3px] w-[46px] shrink-0 text-[9.5px]" style={{ color: MARK[tip.k].colour }}>
            {MARK[tip.k].label}
          </span>
          <span className="text-[15px] leading-snug" style={{ color: tip.k === 'say' ? 'var(--now)' : 'var(--text)' }}>
            {tip.t}
          </span>
        </li>
      ))}
    </ol>
  )
}
