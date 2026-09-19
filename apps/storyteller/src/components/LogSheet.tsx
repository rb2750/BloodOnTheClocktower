import { Sheet } from '@botc/ui'
import { useStore } from '../state/store.js'
import type { LogKind } from '../state/types.js'

/** Colour by event type, so scanning back for "who died on night two" is fast. */
const TONE: Record<LogKind, string> = {
  phase: 'text-(--accent)',
  deal: 'text-(--text-faint)',
  info: 'text-(--color-blue-2)',
  death: 'text-(--color-red-2)',
  effect: 'text-(--text-dim)',
  nomination: 'text-(--text)',
  execution: 'text-(--color-red-2)',
  note: 'text-(--text-faint)',
  change: 'text-(--text-dim)',
}

/**
 * The game log.
 *
 * This is the gap in every existing tool: they run a game beautifully and
 * remember nothing about it. At eleven at night, "who died on night two, and
 * why" has to be answerable.
 */
export function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useStore((s) => s.game)
  if (!game) return null

  const entries = [...game.log].reverse()
  let lastPhase = ''

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="What has happened"
      subtitle={`${game.scriptName} · ${game.seats.length} players`}
    >
      {entries.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-(--text-faint)">Nothing yet.</p>
      ) : (
        <ol className="space-y-1 pb-2">
          {entries.map((entry) => {
            const showPhase = entry.phase !== lastPhase
            lastPhase = entry.phase
            return (
              <li key={entry.id}>
                {showPhase && (
                  <div className="mb-1 mt-4 flex items-center gap-2 first:mt-0">
                    <span className="display text-[11px] text-(--text-faint)">
                      {entry.phase}
                    </span>
                    <span className="h-px flex-1 bg-(--hairline)" />
                  </div>
                )}
                <div className={`text-[14px] leading-snug ${TONE[entry.kind]}`}>
                  {entry.text}
                  {entry.info && (
                    <span
                      className={
                        entry.info.truthful
                          ? ' text-(--text-faint)'
                          : ' text-(--accent)'
                      }
                    >
                      {' '}
                      ({entry.info.truthful ? 'true' : 'a lie'})
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Sheet>
  )
}
