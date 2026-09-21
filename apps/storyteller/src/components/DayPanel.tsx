import { useMemo, useState } from 'react'
import { canNominate, getCharacter, votesNeededPhrase } from '@botc/rules'
import { Button, Sheet, Label, Point, Moon, Quote, Hand, haptic } from '@botc/ui'
import type { FloorMode } from '@botc/protocol'
import { toast } from 'sonner'
import { useStore, currentBlock } from '../state/store.js'
import type { Seat } from '../state/types.js'
import { GameOverHint } from './GameOverHint.js'

/**
 * The day.
 *
 * Here the register flips: the Storyteller speaks, so this panel suggests
 * actual sentences. The most useful of them is generated rather than
 * templated — the app knows the living count and the current tally, so it can
 * say exactly how many votes are needed to tie and to take the block. Official
 * Storyteller advice asks for that line and no other tool produces it.
 */
export function DayPanel({ onOpenSeat, onEnd }: { onOpenSeat: (id: string) => void; onEnd: () => void }) {
  const game = useStore((s) => s.game)
  const toNight = useStore((s) => s.toNight)
  const nominate = useStore((s) => s.nominate)
  const settleNomination = useStore((s) => s.settleNomination)
  const execute = useStore((s) => s.execute)
  const expireEffects = useStore((s) => s.expireEffects)

  const setFloorMode = useStore((s) => s.setFloorMode)
  const giveFloor = useStore((s) => s.giveFloor)
  const setNominationsOpen = useStore((s) => s.setNominationsOpen)
  const dropNominationRequest = useStore((s) => s.dropNominationRequest)

  const [nominating, setNominating] = useState<{ nominatorId?: string } | null>(null)

  const block = useMemo(() => currentBlock(game), [game])
  if (!game || game.phase.k !== 'day') return null

  const day = game.phase.n
  const alive = game.seats.filter((s) => s.alive && !s.isTraveller)
  const today = game.nominations.filter((n) => n.day === day)
  const open = today.find((n) => !n.settled)
  const blockSeat = game.seats.find((s) => s.id === block.seatId)
  const seatName = (id: string) => game.seats.find((s) => s.id === id)?.name ?? '?'
  const aliveOf = (id: string) => game.seats.find((s) => s.id === id)?.alive ?? false
  const travellerOf = (id: string) => game.seats.find((s) => s.id === id)?.isTraveller ?? false

  return (
    <>
      <div>
        {open ? (
          <VoteInProgress
            nominee={seatName(open.nomineeId)}
            nominator={seatName(open.nominatorId)}
            exile={Boolean(open.exile)}
            majority={open.majority}
            tally={open.tally}
            aliveCount={alive.length}
            blockVotes={block.votes}
            voters={open.voterIds}
            seats={game.seats}
            onClose={() => {
              haptic('confirm')
              settleNomination(open.id)
            }}
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

            <GameOverHint onEnd={onEnd} />

            <Floor
              mode={game.floor?.mode ?? 'open'}
              queue={game.floor?.queue ?? []}
              speaking={game.floor?.speaking ?? null}
              seatName={seatName}
              onMode={(mode) => {
                haptic('tap')
                setFloorMode(mode)
              }}
              onCall={(id) => {
                haptic('confirm')
                giveFloor(id)
              }}
            />

            <Nominations
              open={Boolean(game.nominationsOpen)}
              queue={game.nominationQueue ?? []}
              seatName={seatName}
              check={(nominatorId, nomineeId) =>
                canNominate(nominatorId, nomineeId, records(today), aliveOf, travellerOf)
              }
              onToggle={() => {
                haptic('confirm')
                setNominationsOpen(!game.nominationsOpen)
              }}
              onTake={(request) => {
                haptic('confirm')
                nominate(request.nominatorId, request.nomineeId)
                toast(`${seatName(request.nominatorId)} nominates ${seatName(request.nomineeId)}.`)
              }}
              onDrop={dropNominationRequest}
            />

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
            // A dead player has no nomination, but may still call for the
            // exile of a Traveller, so the list keeps them when one is in play.
            const check = asNominator
              ? canNominate(seat.id, null, records(today), aliveOf, travellerOf)
              : canNominate(
                  nominating!.nominatorId!,
                  seat.id,
                  records(today),
                  aliveOf,
                  travellerOf,
                )
            const allowed =
              check.allowed || (asNominator && game.seats.some((s) => s.isTraveller))

            return (
              <button
                key={seat.id}
                disabled={!allowed}
                title={check.reason}
                onClick={() => {
                  if (asNominator) setNominating({ nominatorId: seat.id })
                  else {
                    haptic('confirm')
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
                    : allowed
                      ? 'Exile only'
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

/** Today's nominations in the shape the rules module reads. */
function records(today: { day: number; nominatorId: string; nomineeId: string; voterIds: string[]; tally: number; majority: number; exile?: boolean; at: number }[]) {
  return today.map((n) => ({
    day: n.day,
    nominator: n.nominatorId,
    nominee: n.nomineeId,
    voters: n.voterIds,
    tally: n.tally,
    majority: n.majority,
    succeeded: false,
    exile: n.exile,
    at: n.at,
  }))
}

const MODES: { mode: FloorMode; label: string }[] = [
  { mode: 'open', label: 'Open' },
  { mode: 'queue', label: 'Hands' },
  { mode: 'silent', label: 'Quiet' },
]

/**
 * Who may talk.
 *
 * Not a rule of the game: a table convention the Storyteller switches on when
 * everyone talking at once stops working, most often for a round of public
 * statements. In Hands the phones form a line in the order the hands went up,
 * which is the part a room cannot do for itself.
 */
function Floor({
  mode,
  queue,
  speaking,
  seatName,
  onMode,
  onCall,
}: {
  mode: FloorMode
  queue: string[]
  speaking: string | null
  seatName: (id: string) => string
  onMode: (mode: FloorMode) => void
  onCall: (id: string | null) => void
}) {
  return (
    <div className="mt-4 border-t border-(--hairline) pt-3">
      <div className="mb-2 flex items-center justify-between">
        <Label>The floor</Label>
        <span className="flex overflow-hidden rounded-full border border-(--hairline-strong)">
          {MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => onMode(m.mode)}
              aria-pressed={mode === m.mode}
              className={`caps min-h-8 px-3 text-[10px] ${
                mode === m.mode ? 'bg-(--accent) text-(--bg)' : 'text-(--text-dim)'
              }`}
            >
              {m.label}
            </button>
          ))}
        </span>
      </div>

      {mode === 'queue' && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {speaking && (
              <span className="caps min-h-8 rounded-full border border-(--accent) bg-(--accent) px-3 leading-8 text-[11px] text-(--bg)">
                {seatName(speaking)} has the floor
              </span>
            )}
            {queue.map((id, i) => (
              <span
                key={id}
                className="caps min-h-8 rounded-full border border-(--hairline-strong) px-3 text-[11px] leading-8 text-(--text-dim)"
              >
                {i + 1}. {seatName(id)}
              </span>
            ))}
            {queue.length === 0 && !speaking && (
              <span className="serif text-[14px] text-(--text-faint)">No hands up.</span>
            )}
          </div>
          {(queue.length > 0 || speaking) && (
            <div className="mt-2 flex gap-2">
              <Button
                className="flex-1"
                disabled={queue.length === 0}
                onClick={() => onCall(queue[0] ?? null)}
              >
                <Hand size={17} />
                {queue.length > 0 ? `Call ${seatName(queue[0]!)}` : 'Nobody waiting'}
              </Button>
              {speaking && (
                <Button variant="text" onClick={() => onCall(null)}>
                  Done
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Nominations, one at a time.
 *
 * A phone may ask at any point once nominations are open, and the asking is
 * what queues: the nomination itself does not exist until the Storyteller
 * takes it, because only one may be on the floor at a time and the rules are
 * checked again at that moment.
 */
function Nominations({
  open,
  queue,
  seatName,
  check,
  onToggle,
  onTake,
  onDrop,
}: {
  open: boolean
  queue: { id: string; nominatorId: string; nomineeId: string }[]
  seatName: (id: string) => string
  check: (nominatorId: string, nomineeId: string) => { allowed: boolean; reason?: string }
  onToggle: () => void
  onTake: (request: { nominatorId: string; nomineeId: string }) => void
  onDrop: (id: string) => void
}) {
  return (
    <div className="mt-4 border-t border-(--hairline) pt-3">
      <div className="mb-2 flex items-center justify-between">
        <Label>Nominations</Label>
        <button
          onClick={onToggle}
          aria-pressed={open}
          className={`caps min-h-8 rounded-full border px-3 text-[10px] ${
            open
              ? 'border-(--accent) bg-(--accent) text-(--bg)'
              : 'border-(--hairline-strong) text-(--text-dim)'
          }`}
        >
          {open ? 'Open' : 'Closed'}
        </button>
      </div>

      {open && queue.length === 0 && (
        <p className="serif text-[14px] text-(--text-faint)">
          The table can nominate from their phones. Nobody has yet.
        </p>
      )}

      <div className="grid gap-1.5">
        {queue.map((request) => {
          const verdict = check(request.nominatorId, request.nomineeId)
          return (
            <div key={request.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] text-(--text)">
                {seatName(request.nominatorId)} → {seatName(request.nomineeId)}
                {!verdict.allowed && (
                  <span className="caps ml-2 text-[9.5px] text-(--color-red-2)">
                    {verdict.reason}
                  </span>
                )}
              </span>
              {verdict.allowed ? (
                <Button
                  onClick={() =>
                    onTake({ nominatorId: request.nominatorId, nomineeId: request.nomineeId })
                  }
                >
                  <Point size={16} />
                  Take
                </Button>
              ) : (
                <Button variant="text" onClick={() => onDrop(request.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VoteInProgress({
  nominee,
  nominator,
  exile,
  majority,
  tally,
  aliveCount,
  blockVotes,
  voters,
  seats,
  onClose,
}: {
  nominee: string
  nominator: string
  exile: boolean
  majority: number
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
          {exile ? `${nominator} calls to exile ${nominee}` : `${nominator} nominated ${nominee}`}
        </Label>
        <span className="tabular display text-[28px] leading-none text-(--now)">{tally}</span>
      </div>

      <SayThis>
        {exile
          ? `${nominee} needs ${majority} to be exiled, and the dead vote too.`
          : votesNeededPhrase(nominee, aliveCount, blockVotes)}
      </SayThis>

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
