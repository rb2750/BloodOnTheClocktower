import { useEffect, useMemo, useState } from 'react'
import { checkSeating, getCharacter } from '@botc/rules'
import { Grimoire, Lock, Unlock, Eye, EyeOff, haptic } from '@botc/ui'
import { toast } from 'sonner'
import { useRoom } from '../room.js'
import { useStore, phaseLabel } from '../state/store.js'
import { Screen } from '../components/Screen.js'
import { SeatView } from '../components/SeatView.js'
import { SeatSheet } from '../components/SeatSheet.js'
import { NightPanel } from '../components/NightPanel.js'
import { DayPanel } from '../components/DayPanel.js'
import { PhaseCinematic } from '../components/PhaseCinematic.js'
import { LogSheet } from '../components/LogSheet.js'
import { Dial } from '../components/Dial.js'
import { DistributeSheet } from '../components/DistributeSheet.js'
import { EndGameSheet } from '../components/EndGameSheet.js'
import { useRingDrag } from '../hooks/useRingDrag.js'
import type { Screen as ScreenName } from '../App.js'

export function RunScreen({ go }: { go: (s: ScreenName) => void }) {
  const game = useStore((s) => s.game)
  const setLocked = useStore((s) => s.setLocked)
  const undo = useStore((s) => s.undo)
  const canUndo = useStore((s) => s.undoStack.length > 0)

  const toggleVote = useStore((s) => s.toggleVote)
  const nightOrder = useStore((s) => s.nightOrder)
  const moveSeat = useStore((s) => s.moveSeat)
  const concealed = useStore((s) => s.concealed)
  const setConcealed = useStore((s) => s.setConcealed)

  const [openSeat, setOpenSeat] = useState<string | null>(null)
  const { talking } = useRoom()
  const [logOpen, setLogOpen] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [ending, setEnding] = useState(false)

  // Whoever is acting right now: the seats woken at this night step, or the
  // hands raised in an open vote.
  const openNomination =
    game?.phase.k === 'day'
      ? game.nominations.find((n) => n.day === game.phase.n && !n.settled)
      : undefined
  const awake = useMemo(() => {
    if (!game || game.phase.k !== 'night') return new Set<string>()
    const order = nightOrder()
    const entry = order[Math.min(game.phase.step, Math.max(order.length - 1, 0))]
    return new Set(entry?.seats.map((s) => s.seatId) ?? [])
  }, [game, nightOrder])

  // Seating rules that the current arrangement breaks: the Marionette away
  // from the Demon, the evil line broken. Checked live, so a drag that fixes
  // or breaks one is answered at once.
  const seatingWarnings = useMemo(() => (game ? checkSeating(game.seats) : []), [game])

  const ring = useRingDrag({
    order: game?.seats.map((s) => s.id) ?? [],
    disabled: !game || game.locked,
    onMove: (seatId, toIndex) => {
      moveSeat(seatId, toIndex)
      const seat = game?.seats.find((s) => s.id === seatId)
      const after = checkSeating(
        (() => {
          const next = [...(game?.seats ?? [])]
          const from = next.findIndex((s) => s.id === seatId)
          const [moved] = next.splice(from, 1)
          if (moved) next.splice(toIndex, 0, moved)
          return next
        })(),
      )
      if (after.length > 0) toast.warning(after[0]!.message)
      else toast(`${seat?.name ?? 'Player'} moved.`, { action: { label: 'Undo', onClick: () => undo() } })
    },
  })

  if (!game) return null

  const locked = game.locked
  const aliveCount = game.seats.filter((s) => s.alive && !s.isTraveller).length
  const arcFrom = openNomination
    ? game.seats.findIndex((s) => s.id === openNomination.nominatorId)
    : -1
  const arcTo = openNomination
    ? game.seats.findIndex((s) => s.id === openNomination.nomineeId)
    : -1

  return (
    <>
      <Screen
        title={phaseLabel(game.phase)}
        subtitle={
          seatingWarnings.length > 0 ? (
            <span className="text-(--color-red-2)">{seatingWarnings[0]!.message}</span>
          ) : openNomination ? (
            'tap a seat to raise a hand'
          ) : game.phase.k === 'night' ? (
            `${aliveCount} alive · hold to undo`
          ) : (
            `${aliveCount} alive`
          )
        }
        onTitle={() => setLogOpen(true)}
        onTitleHold={() => {
          if (!canUndo) return
          haptic('warn')
          const label = undo()
          if (label) toast(`Undid: ${label.toLowerCase()}`)
        }}
        onBack={() => go('home')}
        fill
        trailing={
          <span className="flex items-center">
            {/* Hide every role at a tap, for when someone can see the phone. */}
            <button
              onClick={() => setConcealed(!concealed)}
              aria-label={concealed ? 'Show roles' : 'Hide roles'}
              aria-pressed={concealed}
              className={`grid size-11 place-items-center ${concealed ? 'text-(--now)' : 'text-(--text-faint)'}`}
            >
              {concealed ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button
              onClick={() => setLocked(!locked)}
              aria-label={locked ? 'Unlock grimoire' : 'Lock grimoire'}
              className={`grid size-11 place-items-center ${locked ? 'text-(--now)' : 'text-(--text-faint)'}`}
            >
              {locked ? <Lock size={20} /> : <Unlock size={20} />}
            </button>
          </span>
        }
        // The phase panel is the one thing always within thumb reach, and it is
        // part of the layout rather than floating over it, so the circle can
        // take exactly the space that is left.
        bottom={
          game.phase.k === 'night' ? (
            <NightPanel onHandOut={() => setDistributing(true)} onEnd={() => setEnding(true)} />
          ) : game.phase.k === 'day' ? (
            <DayPanel onOpenSeat={setOpenSeat} onEnd={() => setEnding(true)} />
          ) : null
        }
      >
        <Grimoire
          count={game.seats.length}
          keys={ring.order}
          dragging={ring.dragging}
          onSeatPointerDown={ring.onPointerDown}
          centre={<Dial concealed={concealed} />}
          overlay={
            arcFrom >= 0 && arcTo >= 0 ? <NominationArc from={arcFrom} to={arcTo} /> : undefined
          }
        >
          {(i) => {
            const seat = game.seats.find((s) => s.id === ring.order[i])
            if (!seat) return null
            return (
              <SeatView
                seat={seat}
                disabled={locked}
                concealed={concealed}
                now={awake.has(seat.id) || (openNomination?.voterIds.includes(seat.id) ?? false)}
                onOpen={() => {
                  // A drag that just ended is not a tap.
                  if (ring.consumeDrag()) return
                  // During a vote the ring is the ballot: tapping a seat raises
                  // or lowers that hand. The sheet waits until hands are down.
                  if (openNomination) {
                    const canVote = seat.alive || seat.deadVoteAvailable
                    const voting = openNomination.voterIds.includes(seat.id)
                    if (canVote || voting) {
                      haptic('tap')
                      toggleVote(openNomination.id, seat.id)
                    }
                    else toast(`${seat.name} has no vote left.`)
                    return
                  }
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

      {/* Who is talking to whom, never what. At a table you can see two people
          walk off together, and this is that, for the last couple of minutes. */}
      {talking.filter((t) => Date.now() - t.at < 120000).length > 0 && (
        <p className="pointer-events-none fixed inset-x-0 bottom-[46%] z-30 px-5 text-center text-[11px] text-(--text-faint)">
          {talking
            .filter((t) => Date.now() - t.at < 120000)
            .slice(-2)
            .map((t) => `${game.seats.find((s) => s.id === t.a)?.name} and ${game.seats.find((s) => s.id === t.b)?.name} are talking`)
            .join(' · ')}
        </p>
      )}

      {/* A believed role owed to the Drunk is the one thing that can ruin a
          game from this screen, so it is said here, in red, until it is done. */}
      {game.seats.some((s) => s.characterId === 'drunk') && (
        <div className="fixed inset-x-0 top-0 z-40 flex flex-wrap items-center gap-2 border-b border-(--color-red-2) bg-(--bg) px-4 py-2">
          <span className="caps text-(--color-red-2)">The Drunk needs a role to believe</span>
          {game.seats
            .filter((s) => s.characterId === 'drunk')
            .map((s) => (
              <button
                key={s.id}
                onClick={() => setOpenSeat(s.id)}
                className="min-h-9 rounded-full border border-(--color-red-2) px-3 text-[13px] text-(--text)"
              >
                choose for {s.name}
              </button>
            ))}
        </div>
      )}

      <SeatSheet seatId={openSeat} onClose={() => setOpenSeat(null)} />
      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onHandOut={() => {
          setLogOpen(false)
          setDistributing(true)
        }}
        onEnd={() => {
          setLogOpen(false)
          setEnding(true)
        }}
      />
      <DistributeSheet open={distributing} onClose={() => setDistributing(false)} />
      <EndGameSheet open={ending} onClose={() => setEnding(false)} />
      <PhaseCinematic />
    </>
  )
}

export function characterFor(id: string | undefined) {
  return id ? getCharacter(id) : undefined
}

/**
 * A hairline arc from nominator to nominee, bowed towards the centre of the
 * ring. Seat positions are measured from the DOM rather than recomputed,
 * so the arc follows the same trigonometry the seats use, whatever the count.
 */
function NominationArc({ from, to }: { from: number; to: number }) {
  const [d, setD] = useState<{ path: string; head: string } | null>(null)

  useEffect(() => {
    const measure = () => {
      const circle = document.querySelector<HTMLElement>('.circle')
      const seats = circle?.querySelectorAll<HTMLElement>(':scope > li')
      const a = seats?.[from]
      const b = seats?.[to]
      if (!circle || !a || !b) return
      const box = circle.getBoundingClientRect()
      const centre = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
      }
      const p = centre(a)
      const q = centre(b)
      const c = { x: box.width / 2, y: box.height / 2 }
      // Pull the control point towards the middle, and shorten both ends so
      // the line meets the ring of the token rather than its centre.
      const control = { x: (p.x + q.x) / 2 * 0.45 + c.x * 0.55, y: (p.y + q.y) / 2 * 0.45 + c.y * 0.55 }
      const trim = (s: { x: number; y: number }, t: { x: number; y: number }, by: number) => {
        const dx = t.x - s.x
        const dy = t.y - s.y
        const len = Math.hypot(dx, dy) || 1
        return { x: s.x + (dx / len) * by, y: s.y + (dy / len) * by }
      }
      const r = a.getBoundingClientRect().width / 2 + 4
      const start = trim(p, control, r)
      const end = trim(q, control, r)
      setD({
        path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        head: `${end.x},${end.y}`,
      })
    }
    measure()
    const t = window.setTimeout(measure, 450)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [from, to])

  if (!d) return null
  return (
    <>
      <path className="nomination-arc" d={d.path} />
      <circle className="nomination-arc-head" r="3" transform={`translate(${d.head})`} />
    </>
  )
}
