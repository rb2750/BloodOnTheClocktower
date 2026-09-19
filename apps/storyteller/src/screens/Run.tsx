import { useState } from 'react'
import { getCharacter } from '@botc/rules'
import { Grimoire, Lock, Unlock, Book, Undo, Ring } from '@botc/ui'
import { toast } from 'sonner'
import { useStore, phaseLabel } from '../state/store.js'
import { Screen } from '../components/Screen.js'
import { SeatView } from '../components/SeatView.js'
import { SeatSheet } from '../components/SeatSheet.js'
import { NightPanel } from '../components/NightPanel.js'
import { DayPanel } from '../components/DayPanel.js'
import { PhaseCinematic } from '../components/PhaseCinematic.js'
import { LogSheet } from '../components/LogSheet.js'
import type { Screen as ScreenName } from '../App.js'

export function RunScreen({ go }: { go: (s: ScreenName) => void }) {
  const game = useStore((s) => s.game)
  const setLocked = useStore((s) => s.setLocked)
  const undo = useStore((s) => s.undo)
  const canUndo = useStore((s) => s.undoStack.length > 0)

  const [openSeat, setOpenSeat] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const addSeat = useStore((s) => s.addSeat)

  if (!game) return null

  const locked = game.locked
  const aliveCount = game.seats.filter((s) => s.alive && !s.isTraveller).length

  return (
    <>
      <Screen
        title={phaseLabel(game.phase)}
        subtitle={`${aliveCount} alive`}
        onTitle={() => setLogOpen(true)}
        onBack={() => go('home')}
        fill
        trailing={
          <button
            onClick={() => setLocked(!locked)}
            aria-label={locked ? 'Unlock grimoire' : 'Lock grimoire'}
            className={locked ? 'text-(--now)' : 'text-(--text-faint)'}
          >
            {locked ? <Lock size={20} /> : <Unlock size={20} />}
          </button>
        }
        // The phase panel is the one thing always within thumb reach, and it is
        // part of the layout rather than floating over it, so the circle can
        // take exactly the space that is left.
        bottom={
          game.phase.k === 'night' ? (
            <NightPanel />
          ) : game.phase.k === 'day' ? (
            <DayPanel onOpenSeat={setOpenSeat} />
          ) : null
        }
      >
        <Grimoire
          count={game.seats.length}
          centre={
            /* The middle of the ring is otherwise wasted space, and it is the
               one place a control can sit without crowding a seat. */
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setLogOpen(true)}
                className="caps inline-flex min-h-9 items-center gap-1.5 px-3 text-(--text-faint)"
              >
                <Book size={14} />
                Log
              </button>
              {canUndo && (
                <button
                  onClick={() => {
                    const label = undo()
                    if (label) toast(`Undid: ${label.toLowerCase()}`)
                  }}
                  className="caps inline-flex min-h-9 items-center gap-1.5 px-3 text-(--text-faint)"
                >
                  <Undo size={14} />
                  Undo
                </button>
              )}
              {/* Travellers join mid-game, so a seat can be added at any point.
                  Rare enough to live quietly in the middle of the ring. */}
              <button
                onClick={() => {
                  const name = window.prompt('Who is joining?')?.trim()
                  if (!name) return
                  addSeat(name, true)
                  toast(`${name} joined as a Traveller.`, {
                    action: { label: 'Undo', onClick: () => undo() },
                  })
                }}
                className="caps inline-flex min-h-9 items-center gap-1.5 px-3 text-(--text-faint)"
              >
                <Ring size={14} />
                Add
              </button>
            </div>
          }
        >
          {(i) => {
            const seat = game.seats[i]
            if (!seat) return null
            return (
              <SeatView
                seat={seat}
                disabled={locked}
                onOpen={() => {
                  if (locked) {
                    toast('The grimoire is locked.', {
                      action: { label: 'Unlock', onClick: () => setLocked(false) },
                    })
                    return
                  }
                  setOpenSeat(seat.id)
                }}
              />
            )
          }}
        </Grimoire>
      </Screen>

      <SeatSheet seatId={openSeat} onClose={() => setOpenSeat(null)} />
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <PhaseCinematic />
    </>
  )
}

export function characterFor(id: string | undefined) {
  return id ? getCharacter(id) : undefined
}
