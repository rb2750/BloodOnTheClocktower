import { useMemo, useState } from 'react'
import { canNominate, getCharacter, votesNeededPhrase } from '@botc/rules'
import { Button, Sheet, Label, Point, Moon, Quote } from '@botc/ui'
import { toast } from 'sonner'
import { useStore, currentBlock } from '../state/store.js'
import type { Seat } from '../state/types.js'

/**
 * The day.
 *
 * Here the register flips: the Storyteller speaks, so this panel suggests
 * actual sentences. The most useful of them is generated rather than
 * templated — the app knows the living count and the current tally, so it can
 * say exactly how many votes are needed to tie and to take the block. Official
 * Storyteller advice asks for that line and no other tool produces it.
 */
export function DayPanel({ onOpenSeat }: { onOpenSeat: (id: string) => void }) {
  const game = useStore((s) => s.game)
  const toNight = useStore((s) => s.toNight)
  const nominate = useStore((s) => s.nominate)
  const settleNomination = useStore((s) => s.settleNomination)
  const execute = useStore((s) => s.execute)
  const expireEffects = useStore((s) => s.expireEffects)

  const [nominating, setNominating] = useState<{ nominatorId?: string } | null>(null)

  const block = useMemo(() => currentBlock(game), [game])
  if (!game || game.phase.k !== 'day') return null

  const day = game.phase.n
  const alive = game.seats.filter((s) => s.alive && !s.isTraveller)
  const today = game.nominations.filter((n) => n.day === day)
  const open = today.find((n) => !n.settled)
  const blockSeat = game.seats.find((s) => s.id === block.seatId)
  const seatName = (id: string) => game.seats.find((s) => s.id === id)?.name ?? '?'

  return (
    <>
      <div>
        {open ? (
          <VoteInProgress
            nominee={seatName(open.nomineeId)}
            nominator={seatName(open.nominatorId)}
            tally={open.tally}
            aliveCount={alive.length}
            blockVotes={block.votes}
            voters={open.voterIds}
            seats={game.seats}
            onClose={() => settleNomination(open.id)}
          />
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Day {day}</Label>
              <span className="caps text-(--text-faint)">
                {today.length} nomination{today.length === 1 ? '' : 's'}
              </span>
            </div>

            <SayThis>
              {blockSeat
                ? `${blockSeat.name} is about to die, with ${block.votes} vote${
                    block.votes === 1 ? '' : 's'
                  }.`
                : block.tied
                  ? 'Those players are tied, so nobody is about to die.'
                  : 'I am about to call for nominations.'}
            </SayThis>

            <div className="mt-4 flex gap-2">
              <Button live className="flex-1" onClick={() => setNominating({})}>
                <Point size={18} />
                Nominate
              </Button>
              <Button
                live
                variant="primary"
                className="flex-1"
                onClick={() => {
                  execute(block.seatId)
                  expireEffects('dusk')
                  toNight()
                }}
              >
                <Moon size={18} />
                {blockSeat ? `Execute ${blockSeat.name}` : 'No execution'}
              </Button>
            </div>
          </>
        )}
      </div>

      <Sheet
        open={nominating !== null}
        onOpenChange={(o) => !o && setNominating(null)}
        title={nominating?.nominatorId ? 'Who do they nominate?' : 'Who is nominating?'}
        subtitle={
          nominating?.nominatorId
            ? `${seatName(nominating.nominatorId)} nominates…`
            : 'Only living players may nominate, and only once each per day.'
        }
      >
        <div className="grid grid-cols-2 gap-2 pb-2">
          {game.seats.map((seat) => {
            const asNominator = !nominating?.nominatorId
            const check = asNominator
              ? canNominate(
                  seat.id,
                  '',
                  today.map((n) => ({
                    day: n.day,
                    nominator: n.nominatorId,
                    nominee: n.nomineeId,
                    voters: n.voterIds,
                    tally: n.tally,
                    majority: n.majority,
                    succeeded: false,
                    at: n.at,
                  })),
                  (id) => game.seats.find((s) => s.id === id)?.alive ?? false,
                )
              : canNominate(
                  nominating!.nominatorId!,
                  seat.id,
                  today.map((n) => ({
                    day: n.day,
                    nominator: n.nominatorId,
                    nominee: n.nomineeId,
                    voters: n.voterIds,
                    tally: n.tally,
                    majority: n.majority,
                    succeeded: false,
                    at: n.at,
                  })),
                  (id) => game.seats.find((s) => s.id === id)?.alive ?? false,
                )

            return (
              <button
                key={seat.id}
                disabled={!check.allowed}
                title={check.reason}
                onClick={() => {
                  if (asNominator) setNominating({ nominatorId: seat.id })
                  else {
                    nominate(nominating!.nominatorId!, seat.id)
                    setNominating(null)
                    toast(`${seatName(nominating!.nominatorId!)} nominates ${seat.name}.`)
                  }
                }}
                className="flex min-h-(--tap-min) flex-col items-start justify-center rounded-(--radius-surface) border border-(--hairline-strong) px-4 py-2 text-left disabled:opacity-30"
              >
                <span className="text-[14px]">{seat.name}</span>
                <span className="caps text-[9.5px] text-(--text-faint)">
                  {check.allowed
                    ? (getCharacter(seat.characterId ?? '')?.name ?? '—')
                    : check.reason}
                </span>
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}

function VoteInProgress({
  nominee,
  nominator,
  tally,
  aliveCount,
  blockVotes,
  voters,
  seats,
  onClose,
}: {
  nominee: string
  nominator: string
  tally: number
  aliveCount: number
  blockVotes: number
  voters: string[]
  seats: Seat[]
  onClose: () => void
}) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>
          {nominator} nominated {nominee}
        </Label>
        <span className="tabular display text-[28px] leading-none text-(--now)">{tally}</span>
      </div>

      <SayThis>{votesNeededPhrase(nominee, aliveCount, blockVotes)}</SayThis>

      <p className="caps mt-3 text-(--text-faint)">
        {voters.length === 0
          ? 'Tap a seat on the ring to raise a hand.'
          : voters
              .map((id) => seats.find((s) => s.id === id)?.name ?? '?')
              .join(', ')}
      </p>

      <Button live variant="primary" className="mt-4 w-full" onClick={onClose}>
        Hands down
      </Button>
    </>
  )
}

/** A line to read aloud. Marked as speech so it is never confused with the
 *  silent, gestural instructions the night panel gives. */
function SayThis({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-(--text) py-0.5 pl-3">
      <Quote size={14} className="mt-[3px] shrink-0 text-(--text-faint)" />
      <p className="serif m-0 text-[17px] leading-snug text-(--text)">{children}</p>
    </div>
  )
}
