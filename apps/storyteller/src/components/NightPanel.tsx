import { useMemo, useState } from 'react'
import { bluffCandidates, getCharacter, seesGrimoire } from '@botc/rules'
import { Button, ReminderText, Sheet, Label, ChevronLeft, ChevronRight, Qr, Dawn, Signpost, Eye, haptic } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { useRoom } from '../room.js'
import { WhisperSheet } from './WhisperSheet.js'
import { CharacterToken } from './CharacterToken.js'
import { Coach, RulesButton } from './Coach.js'
import { NightGuide } from './NightGuide.js'
import { effectFor } from '../reminders.js'
import { evilNotes } from '../evil-info.js'
import { EXPLAIN } from '../rules-explained.js'
import { balance, nightCoach } from '../coach.js'
import { GameOverHint } from './GameOverHint.js'

/**
 * The guided night walk.
 *
 * Note the register: at night the Storyteller is silent. They tap a shoulder
 * twice and show tokens. So this panel says what to *do* and what to *show* —
 * never a sentence to read aloud. Speech belongs to the day.
 */
/**
 * The Demon's bluffs, on the step that shows them.
 *
 * Chosen at the deal and kept for the recap, which is fine for the record and
 * useless at the table on the night they are shown. A tap swaps one for the
 * next character not in play, in the same order the dealer ranked them.
 */
function Bluffs() {
  const game = useStore((s) => s.game)
  const setBluffs = useStore((s) => s.setBluffs)
  const concealed = useStore((s) => s.concealed)
  if (!game) return null

  const inPlay = game.seats.flatMap((s) => [s.characterId, s.trueCharacterId]).filter((id): id is string => Boolean(id))
  const candidates = bluffCandidates(game.script, inPlay).map((c) => c.id)
  const bluffs = game.bluffs.length > 0 ? game.bluffs : candidates.slice(0, 3)

  const swap = (index: number) => {
    const free = candidates.filter((id) => !bluffs.includes(id))
    if (free.length === 0) return
    const at = candidates.indexOf(bluffs[index]!)
    const next = free.find((id) => candidates.indexOf(id) > at) ?? free[0]!
    haptic('tick')
    setBluffs(bluffs.map((id, i) => (i === index ? next : id)))
  }

  return (
    <div className="mt-3">
      <Label>Show the Demon these</Label>
      <div className="grid grid-cols-3 gap-2">
        {bluffs.map((id, i) => {
          const character = getCharacter(id)
          return (
            <button
              key={id}
              onClick={() => swap(i)}
              aria-label={`Swap ${character?.name ?? id}`}
              className="flex min-h-(--tap-min) flex-col items-center gap-1.5 rounded-(--radius-surface) border border-(--hairline-strong) px-2 py-2 active:bg-(--surface-raised)"
            >
              <CharacterToken character={concealed ? undefined : character} size="52px" />
              <span className="text-center text-[12px] leading-tight text-(--text)">
                {concealed ? 'Hidden' : (character?.name ?? id)}
              </span>
            </button>
          )
        })}
      </div>
      <p className="caps mt-1.5 text-(--text-faint)">Tap one to swap it</p>
    </div>
  )
}

/**
 * Evil's first-night information, sent to their phones as well as shown.
 *
 * The Minions learn their Demon; the Demon learns its Minions and the three
 * bluffs. It travels as a sealed note like any other, so it is resent if a
 * phone comes back, and the note is logged. Swapping a bluff after sending
 * offers the send again, since what the Demon holds is then out of date.
 */
function SendEvilInfo({ step }: { step: 'demoninfo' | 'minioninfo' }) {
  const game = useStore((s) => s.game)
  const log = useStore((s) => s.log)
  const { whisper, reachable } = useRoom()
  const [busy, setBusy] = useState(false)
  if (!game) return null
  const notes = evilNotes(game).filter((n) => (step === 'demoninfo') === n.demon)
  const sent = (seatId: string, text: string) => game.log.some((l) => l.kind === 'info' && l.info?.toSeatId === seatId && l.info.given === text)

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {notes.map(({ seat, text }) => {
        const done = sent(seat.id, text)
        const online = reachable.includes(seat.id)
        return (
          <button
            key={seat.id}
            disabled={busy || done}
            onClick={async () => {
              setBusy(true)
              haptic('confirm')
              const id = Math.random().toString(36).slice(2, 10)
              const ok = await whisper(seat.id, text, id)
              setBusy(false)
              if (!ok) {
                toast.error(`${seat.name}’s phone is not connected. Show them on your screen instead.`)
                return
              }
              log('info', `Told ${seat.name}: ${text}`, [seat.id], { toSeatId: seat.id, given: text, truthful: true, id })
              toast(`Sent to ${seat.name}’s phone.`)
            }}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
              done ? 'border-(--hairline) text-(--text-faint)' : 'border-(--accent) text-(--text)'
            }`}
          >
            <Signpost size={14} />
            {done ? `Sent to ${seat.name}` : `Send to ${seat.name}’s phone${online ? '' : ' (not connected)'}`}
          </button>
        )
      })}
    </div>
  )
}

/** Steps the guide handles end to end; their tokens are placed by the guide alone. */
const GUIDED = new Set(['sailor', 'innkeeper', 'pukka', 'exorcist', 'devilsadvocate', 'assassin', 'grandmother', 'chambermaid', 'gambler', 'professor', 'tinker', 'courtier', 'moonchild'])

export function NightPanel({ onHandOut, onEnd }: { onHandOut: () => void; onEnd: () => void }) {
  const game = useStore((s) => s.game)
  const nightOrder = useStore((s) => s.nightOrder)
  const setNightStep = useStore((s) => s.setNightStep)
  const toDay = useStore((s) => s.toDay)
  const addEffect = useStore((s) => s.addEffect)
  const toggleAlive = useStore((s) => s.toggleAlive)
  const [placing, setPlacing] = useState<{ label: string; characterId: string } | null>(null)
  const [telling, setTelling] = useState<{ seatId: string; characterId: string } | null>(null)
  const { reachable, showGrimoire } = useRoom()
  const [showed, setShowed] = useState<string | null>(null)
  const [skipArmed, setSkipArmed] = useState(false)
  const concealed = useStore((s) => s.concealed)

  const order = useMemo(() => nightOrder(), [nightOrder, game])
  if (!game || game.phase.k !== 'night') return null

  const step = Math.min(game.phase.step, Math.max(order.length - 1, 0))
  const entry = order[step]
  const isLast = step >= order.length - 1
  // Who woke tonight for their own ability, for the Chambermaid.
  const woke = order
    // Some steps are the Storyteller's to resolve and nobody opens their eyes.
    .filter((o) => o.kind !== 'step' && !['chambermaid', 'tinker', 'moonchild'].includes(o.id) && !(o.id === 'grandmother' && game.phase.k === 'night' && game.phase.n > 1) && !o.allDead)
    .flatMap((o) => o.seats.map((s) => game.seats.find((x) => x.id === s.seatId)))
    .filter((s): s is NonNullable<typeof s> => Boolean(s && s.alive))

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>
            {entry ? `Step ${entry.order} of ${order.length}` : 'Night complete'}
          </Label>
          {entry?.allDead && (
            <span className="caps text-(--text-faint)">everyone here is dead</span>
          )}
        </div>

        {entry ? (
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <div className="display text-[22px] leading-none text-(--text)">{entry.name}</div>
              {entry.seats.length > 0 && !concealed && (
                <div className="mb-1.5 mt-1 text-[13px] text-(--text-faint)">
                  {entry.seats
                    .map((s) => {
                      const seat = game.seats.find((x) => x.id === s.seatId)
                      return s.isDisguised ? `${seat?.name} (drunk)` : seat?.name
                    })
                    .join(', ')}
                </div>
              )}
              {/* A guided step is its own instructions: the rulebook text and
                  the coach would say the same thing twice, in harder words. */}
              {!GUIDED.has(entry.id) && <ReminderText source={entry.reminder} />}
              {GUIDED.has(entry.id) && !concealed && EXPLAIN[entry.id] && (
                <p className="serif mt-1 text-[13.5px] leading-snug text-(--text-dim)">{EXPLAIN[entry.id]}</p>
              )}
              {!concealed && <NightGuide key={entry.key} entry={entry} />}
              {!concealed && !GUIDED.has(entry.id) && (
                <Coach
                  tips={[
                    ...nightCoach(game, entry, woke).filter((t) => t.k !== 'note'),
                    ...(entry.id === 'dawn' || entry.id === 'dusk' ? balance(game) : []),
                  ]}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="serif m-0 text-[16px] text-(--text-dim)">
            Everyone is asleep and every step is done. Wait about ten seconds before you call
            for eyes open, so the last wake cannot be timed.
          </p>
        )}

        {/* The three bluffs are the point of the Demon's step, so they sit on
            it as tokens to be shown, not as a sentence about showing them. */}
        {entry?.id === 'demoninfo' && <Bluffs />}
        {(entry?.id === 'demoninfo' || entry?.id === 'minioninfo') && !concealed && <SendEvilInfo step={entry.id} />}

        {/* Handing out characters belongs at dusk on the first night, which is
            exactly when it happens at a table. Offered here rather than buried
            in a menu, and only when it is the thing you are about to do. */}
        {game.phase.n === 1 && step === 0 && (
          <Button className="mt-3 w-full" onClick={onHandOut}>
            <Qr size={17} />
            Hand out characters
          </Button>
        )}

        {/* The Spy and the Widow are owed the Grimoire itself, not a sentence
            about it. Their phone gets a sealed copy of the table as it stands,
            which beats handing over yours with your notes on it. */}
        {entry && seesGrimoire(getCharacter(entry.id) ?? ({} as never)) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.seats
              .filter((s) => reachable.includes(s.seatId))
              .map((s) => {
                const seat = game.seats.find((x) => x.id === s.seatId)
                if (!seat) return null
                return (
                  <button
                    key={s.seatId}
                    onClick={() => {
                      haptic('confirm')
                      void showGrimoire(seat.id).then((sent) => setShowed(sent ? seat.id : null))
                    }}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-(--accent) px-3 text-[13px] font-medium text-(--text)"
                  >
                    <Eye size={14} />
                    {showed === seat.id ? `${seat.name} is looking` : `show ${seat.name} the grimoire`}
                  </button>
                )
              })}
          </div>
        )}

        {/* Most steps exist to tell somebody something, and this is that step's
            own list of who is awake, so the word goes where it belongs without
            hunting for the seat. */}
        {entry && entry.seats.length > 0 && reachable.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.seats
              .filter((s) => reachable.includes(s.seatId))
              .map((s) => {
                const seat = game.seats.find((x) => x.id === s.seatId)
                if (!seat) return null
                return (
                  <button
                    key={s.seatId}
                    onClick={() => setTelling({ seatId: s.seatId, characterId: entry.id })}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-(--hairline-strong) px-3 text-[13px] font-medium text-(--text)"
                  >
                    <Signpost size={14} />
                    tell {seat.name}
                  </button>
                )
              })}
          </div>
        )}

        {/* Reminder tokens the current step wants placed, one tap each. */}
        {/* Every token the character has, not only when the official text
            says to place one: the Grandmother's grandchild is placed on
            night 1 but her night 1 text never mentions it. */}
        {entry && entry.reminderTokens.length > 0 && !GUIDED.has(entry.id) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* A character can carry two tokens of the same name (the Pukka's
                two "Poisoned"): one button each is enough, and the key must
                change with the step or a stale button survives into the next. */}
            {[...new Set(entry.reminderTokens)].map((label) => (
              <button
                key={`${entry.key}-${label}`}
                onClick={() => {
                  haptic('tap')
                  setPlacing({ label, characterId: entry.id })
                }}
                className="min-h-9 rounded-full border border-(--hairline-strong) px-3 text-[13px] font-medium text-(--text)"
              >
                {label === 'Dead' ? 'mark someone dead' : `place “${label}”`}
              </button>
            ))}
          </div>
        )}

        <GameOverHint onEnd={onEnd} />
        {!concealed && <RulesButton />}

        {/* How far through the night, one tick per step. */}
        <div className="mt-3 flex gap-[3px]" aria-hidden>
          {order.map((o, i) => (
            <span
              key={o.key}
              className={`h-[2px] flex-1 ${
                i < step ? 'bg-(--text-dim)' : i === step ? 'bg-(--now)' : 'bg-(--hairline)'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            live
            aria-label="Previous step"
            disabled={step === 0}
            onClick={() => { haptic('tap'); setNightStep(step - 1) }}
            className="px-4"
          >
            <ChevronLeft size={22} />
          </Button>
          {isLast ? (
            <Button
                live
                variant="primary"
                className="flex-1"
                onClick={() => {
                  haptic('confirm')
                  toDay()
                }}
              >
              <Dawn size={20} />
              Call for eyes open
            </Button>
          ) : (
            <Button
              live
              variant="primary"
              className="flex-1"
              onClick={() => {
                // A step with its action still unrecorded needs a second tap,
                // and says what was skipped, so nothing is forgotten by accident.
                const pending = document.querySelector('[data-guide-pending]')?.getAttribute('data-guide-pending')
                if (pending && !skipArmed) {
                  haptic('warn')
                  toast(`You haven’t recorded the ${pending}’s action. Tap Next again to skip it.`, { duration: 4000 })
                  setSkipArmed(true)
                  window.setTimeout(() => setSkipArmed(false), 4000)
                  return
                }
                setSkipArmed(false)
                haptic('tap')
                setNightStep(step + 1)
              }}
            >
              Next
              <ChevronRight size={20} />
            </Button>
          )}
        </div>
      </div>

      <GameOverHint onEnd={onEnd} />

      {/* Placing a token is a two-tap flow: pick the token, pick the seat. */}
      <Sheet
        open={placing !== null}
        onOpenChange={(open) => !open && setPlacing(null)}
        title={placing ? `Who is “${placing.label}”?` : ''}
      >
        <div className="grid grid-cols-3 gap-2 pb-2">
          {game.seats.map((seat) => (
            <button
              key={seat.id}
              onClick={() => {
                if (!placing) return
                if (placing.label === 'Dead') {
                  // The token means the player is dead, so mark them dead.
                  if (seat.alive) toggleAlive(seat.id)
                } else {
                  addEffect(seat.id, {
                    label: placing.label,
                    sourceCharacterId: placing.characterId,
                    ...effectFor(placing.label, placing.characterId),
                  })
                }
                setPlacing(null)
              }}
              className="flex min-h-(--tap-min) flex-col items-center gap-1 rounded-(--radius-surface) border border-(--hairline-strong) p-2"
            >
              <span className="truncate text-[13px]">{seat.name}</span>
              <span className="caps text-[9px] text-(--text-faint)">
                {getCharacter(seat.characterId ?? '')?.name ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <WhisperSheet
        seatId={telling?.seatId ?? null}
        characterId={telling?.characterId}
        onClose={() => setTelling(null)}
      />
    </>
  )
}

