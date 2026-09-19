import { Button, Sheet, Ring, Undo } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import type { LogKind } from '../state/types.js'

/** Colour by event type, so scanning back for "who died on night two" is fast. */
const TONE: Record<LogKind, string> = {
  phase: 'text-(--text)',
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
  const addSeat = useStore((s) => s.addSeat)
  const undo = useStore((s) => s.undo)
  const canUndo = useStore((s) => s.undoStack.length > 0)
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
      <div className="mb-4 flex gap-2">
        <Button
          className="flex-1"
          disabled={!canUndo}
          onClick={() => {
            const label = undo()
            if (label) toast(`Undid: ${label.toLowerCase()}`)
          }}
        >
          <Undo size={18} />
          Undo
        </Button>
        {/* Travellers join mid-game, so a seat can be added at any point. */}
        <Button
          className="flex-1"
          onClick={() => {
            const name = window.prompt('Who is joining?')?.trim()
            if (!name) return
            addSeat(name, true)
            onClose()
            toast(`${name} joined as a Traveller.`, {
              action: { label: 'Undo', onClick: () => undo() },
            })
          }}
        >
          <Ring size={18} />
          Add a Traveller
        </Button>
      </div>
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
                    <span className="caps text-(--text-faint)">{entry.phase}</span>
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
                          : ' text-(--now)'
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
