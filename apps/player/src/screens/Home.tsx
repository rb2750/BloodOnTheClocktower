import { useEffect, useState } from 'react'
import { baseComposition, characterArt, getCharacter } from '@botc/rules'
import { ChevronRight, Plus, Token, Button, BuildStamp, haptic, inputClass } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'
import { BUILD } from '../config.js'
import { enablePush, pushState, type PushState } from '../push.js'
import { MeScreen } from './Me.js'
import { HoldToReveal } from '../components/HoldToReveal.js'
import { NoteSheet } from './Notes.js'
import { SheetOne, SheetShort, SheetTeams, SheetCombined } from './NoteSheets.js'

// Preview only: ?sheet=1|2|3 to compare the three note sheets.
const SHEET = new URLSearchParams(window.location.search).get('sheet') ?? ''
const Note =
  SHEET === '1'
    ? SheetOne
    : SHEET === '2'
      ? SheetShort
      : SHEET === '3'
        ? SheetTeams
        : SHEET === '4'
          ? SheetCombined
          : NoteSheet

/**
 * Everyone at the table, in seat order, as the Storyteller last described it.
 * A game played with one code per player never sends a table, so the names
 * the player typed in stand in, all of them alive as far as this phone knows.
 */
function useTable(): { name: string; alive: boolean }[] {
  const table = useStore((s) => s.table)
  const notes = useStore((s) => s.notes)
  const seatName = useStore((s) => s.seatName)
  if (table.length > 0) return table.filter((t) => t.name !== seatName)
  return Object.keys(notes).map((name) => ({ name, alive: true }))
}

function claimOf(name: string, notes: ReturnType<typeof useStore.getState>['notes']) {
  const claim = notes[name]?.claims.at(-1)
  return claim ? getCharacter(claim.characterId) : undefined
}

/** The table as it actually sits: a ring, in seat order, like the grimoire. */
export function HomeScreen({ openRoles, openThread }: { openRoles: () => void; openThread: (seatId: string) => void }) {
  const payload = useStore((s) => s.payload)
  const characterId = useStore((s) => s.characterId)
  const seatName = useStore((s) => s.seatName)
  const scriptIds = useStore((s) => s.scriptIds)
  const notes = useStore((s) => s.notes)
  const chats = useStore((s) => s.chats)
  const fullTable = useStore((s) => s.table)
  const table = useTable()
  const [open, setOpen] = useState<string | null>(null)
  const unreadFor = (name: string) => chats[fullTable.find((t) => t.name === name)?.id ?? '']?.unread ?? 0
  const unreadAll = Object.values(chats).reduce((n, c) => n + c.unread, 0)

  return (
    <>
      <Clock />
      <Seat name={seatName} />
      <Vote />
      <Changed />
      <Alerts />
      <MeScreen />
      <Whispers />

      {payload && (characterId || seatName) && (
        <div className="mt-6 mb-10">
          <Composition />
          <div className="relative mx-auto aspect-square w-[min(86vw,340px)]">
            {table.map(({ name, alive }, i) => {
              // Seat one sits at the bottom, where the player is, so the ring
              // matches the room rather than a clock face.
              const angle = (i / table.length) * 2 * Math.PI + Math.PI / 2
              const note = notes[name]
              const noted = Boolean(
                note && (note.claims.length || note.stamps.length || note.lines.length),
              )
              return (
                <button
                  key={name}
                  onClick={() => setOpen(name)}
                  className="absolute flex w-[68px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{
                    left: `${50 + 40 * Math.cos(angle)}%`,
                    top: `${50 + 40 * Math.sin(angle)}%`,
                  }}
                >
                  <Person
                    name={name}
                    claim={claimOf(name, notes)}
                    dead={!alive}
                    noted={noted}
                    unread={unreadFor(name)}
                    size="52px"
                  />
                </button>
              )
            })}
            <div className="absolute inset-[26%] flex flex-col items-center justify-center gap-1 text-center">
              <p className="caps text-(--text-faint)">The table</p>
              <p className="serif text-[13px] leading-snug text-(--text-faint)">
                {unreadAll > 0
                  ? `${unreadAll} new message${unreadAll === 1 ? '' : 's'}`
                  : 'Tap anyone to note what they claim'}
              </p>
            </div>
          </div>

          <AddSomeone empty={table.length === 0} />

          <button
            onClick={openRoles}
            className="mt-6 flex w-full items-center gap-4 border-y border-(--hairline) px-5 py-5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="display block text-[20px] leading-tight text-(--text)">
                What every role does
              </span>
              <span className="serif block text-[13px] text-(--text-faint)">
                All {scriptIds.length} characters that could be in this game
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--text-faint)" />
          </button>
        </div>
      )}

      <BuildStamp build={BUILD} />

      <Note
        name={open}
        onClose={() => setOpen(null)}
        onMessage={
          open && fullTable.find((t) => t.name === open)?.pub
            ? () => {
                const id = fullTable.find((t) => t.name === open)!.id!
                setOpen(null)
                openThread(id)
              }
            : undefined
        }
        unread={open ? unreadFor(open) : 0}
        last={open ? chats[fullTable.find((t) => t.name === open)?.id ?? '']?.lines.at(-1)?.text : undefined}
      />
    </>
  )
}

/**
 * What the Storyteller told you, under the same cover as your character.
 *
 * The fact that you were told something is not a secret: they wake people and
 * the table watches it happen. What was said is, so it never sits in the open,
 * and the newest one is on top because that is the one being asked about.
 */
function Whispers() {
  const messages = useStore((s) => s.messages)
  if (messages.length === 0) return null
  const newest = messages.at(-1)!

  return (
    <section className="mt-6 px-5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="caps text-(--text-faint)">The Storyteller told you</p>
        <span className="caps text-(--text-faint)">
          {messages.length === 1 ? newest.at : `${messages.length} things`}
        </span>
      </div>
      <HoldToReveal label="Press and hold" hint="Only you should read this.">
        <div className="flex flex-col gap-3 px-2 text-center">
          {[...messages].reverse().map((m) => (
            <p key={m.id} className="serif text-[16px] leading-snug text-(--text)">
              {m.text}
              <span className="caps ml-2 text-[10px] text-(--text-faint)">{m.at}</span>
            </p>
          ))}
        </div>
      </HoldToReveal>
    </section>
  )
}

/**
 * The Storyteller's seat list fills the ring in, so this is for the game played
 * with one code per player, where nobody sent a list at all.
 */
function AddSomeone({ empty }: { empty: boolean }) {
  const ensureNote = useStore((s) => s.ensureNote)
  const [open, setOpen] = useState(empty)
  const [draft, setDraft] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-auto mt-2 flex min-h-(--tap-min) items-center gap-2 px-5 text-[14px] text-(--text-faint)"
      >
        <Plus size={16} />
        Someone missing?
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const name = draft.trim()
        if (!name) return
        ensureNote(name)
        setDraft('')
      }}
      className="mt-2 flex gap-2 px-5"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a name"
        autoComplete="off"
        className={`${inputClass} flex-1`}
      />
      <Button type="submit" aria-label="Add" disabled={!draft.trim()}>
        <Plus size={20} />
      </Button>
    </form>
  )
}

/**
 * What this many players means, the line printed on the setup sheet: public,
 * and the first thing a new player asks. Travellers do not count, and a
 * Baron or the like changes the true numbers, which is not this line's job.
 */
function Composition() {
  const table = useStore((s) => s.table)
  const seated = table.filter((t) => !t.traveller).length
  if (seated < 5) return null
  const c = baseComposition(seated)
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return (
    <div className="mb-3 px-5 text-center">
      <p className="caps text-[10px] text-(--text-faint)">How a {seated}-player game starts</p>
      <p className="caps mt-1 text-(--text-dim)">
        {[
          part(c.townsfolk, 'Townsfolk', 'Townsfolk'),
          part(c.outsider, 'Outsider', 'Outsiders'),
          part(c.minion, 'Minion', 'Minions'),
          part(c.demon, 'Demon', 'Demons'),
        ].join(' · ')}
      </p>
    </div>
  )
}

/**
 * The buzz. The web cannot vibrate an iPhone, so the buzz is a real
 * notification, which iOS grants only to an app on the home screen and only
 * after a tap that asks. This row is that tap, and says what to do first.
 */
function Alerts() {
  const seatId = useStore((s) => s.seatId)
  const { subscribe, status } = useRelay()
  const [state, setState] = useState<PushState>(() => pushState())
  const [busy, setBusy] = useState(false)
  if (!seatId || state === 'unsupported' || state === 'on') return null

  const turnOn = async () => {
    setBusy(true)
    try {
      const sub = await enablePush()
      if (sub) subscribe(sub)
    } finally {
      setBusy(false)
      setState(pushState())
    }
  }

  return (
    <section className="mx-5 mt-4 rounded-2xl border border-(--hairline-strong) px-4 py-3">
      {state === 'install-first' ? (
        <>
          <p className="caps text-(--text-faint)">To get a buzz</p>
          <p className="serif mt-1 text-[15px] leading-snug text-(--text-dim)">
            Tap Share, then Add to Home Screen, and open it from there. Then come back here and
            turn alerts on.
          </p>
        </>
      ) : state === 'denied' ? (
        <>
          <p className="caps text-(--text-faint)">Alerts are blocked</p>
          <p className="serif mt-1 text-[15px] leading-snug text-(--text-dim)">
            Allow notifications for this app in Settings to get a buzz.
          </p>
        </>
      ) : (
        <Button className="w-full" variant="primary" disabled={busy || status !== 'open'} onClick={() => void turnOn()}>
          {busy ? 'Turning on…' : 'Turn on alerts'}
        </Button>
      )}
    </section>
  )
}

/** The Storyteller changed your character. Says so until you have looked. */
function Changed() {
  const changed = useStore((s) => s.roleChanged)
  if (!changed) return null
  return (
    <section className="mx-5 mt-4 rounded-2xl border border-(--accent) px-4 py-3">
      <p className="caps text-(--accent)">Your character has changed</p>
      <p className="serif mt-1 text-[15px] leading-snug text-(--text-dim)">
        The Storyteller has given you a different one. Hold your card to see it.
      </p>
    </section>
  )
}

/**
 * The vote as the Storyteller is counting it, at the top because a nomination
 * is the loudest thing that happens in a day. It says how many hands are up,
 * how many are needed, and who has voted, which is all public at the table.
 */
function Vote() {
  const vote = useStore((s) => s.vote)
  const seatName = useStore((s) => s.seatName)
  const table = useStore((s) => s.table)
  const { hand, status } = useRelay()
  const counted = Boolean(vote && seatName !== null && vote.voters.includes(seatName))
  // The hand goes up on screen the instant it is tapped, and the Storyteller's
  // count settles it. If the count never comes, the hand comes down again and
  // says so, rather than lying on the screen.
  const [wanted, setWanted] = useState<boolean | null>(null)
  const [lost, setLost] = useState(false)
  useEffect(() => {
    if (wanted === null) return
    if (wanted === counted) {
      setWanted(null)
      return
    }
    const t = window.setTimeout(() => {
      setWanted(null)
      setLost(true)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [wanted, counted])
  useEffect(() => setLost(false), [vote?.id])
  if (!vote) return null

  const you = vote.nominee === seatName
  const enough = vote.tally >= vote.majority
  const me = table.find((t) => t.name === seatName)
  const raised = wanted ?? counted
  // Alive, or dead with the one vote still in hand. A hand already up can
  // always come down, which is how a spent ghost vote is taken back.
  const may = Boolean(me && (me.alive || me.ghostVote || raised))

  return (
    <section className="mx-5 mt-4 rounded-2xl border border-(--hairline-strong) bg-(--surface) px-4 py-3">
      <p className="caps text-(--text-faint)">{vote.settled ? 'Vote closed' : 'On the block'}</p>
      <p className="display mt-1 text-[22px] leading-tight text-(--text)">
        {you ? `${vote.nominator} nominates you` : `${vote.nominator} nominates ${vote.nominee}`}
      </p>
      <p className="serif mt-1 text-[15px] leading-snug text-(--text-dim)">
        {vote.settled
          ? `${vote.tally} ${vote.tally === 1 ? 'vote' : 'votes'}, ${enough ? 'enough to execute' : 'not enough'}.`
          : `${vote.tally} of ${vote.majority} needed to execute.`}
      </p>
      {vote.voters.length > 0 && (
        <p className="mt-1 text-[12px] text-(--text-faint)">Voting: {vote.voters.join(', ')}</p>
      )}

      {!vote.settled && me && (
        <div className="mt-3">
          {may ? (
            <button
              onClick={() => {
                haptic('tap')
                setLost(false)
                setWanted(!raised)
                hand(!raised)
              }}
              disabled={status !== 'open'}
              aria-pressed={raised}
              className={`min-h-(--tap-min) w-full rounded-full border px-4 text-[16px] font-medium disabled:opacity-40 ${
                raised
                  ? 'border-(--accent) bg-(--accent) text-(--bg)'
                  : 'border-(--hairline-strong) text-(--text)'
              }`}
            >
              {raised ? 'Lower my hand' : 'Raise my hand'}
            </button>
          ) : (
            <p className="caps text-(--text-faint)">Your ghost vote is spent</p>
          )}
          {lost && (
            <p className="mt-2 text-center text-[12px] text-(--color-red-2)">
              The Storyteller did not get that. Try again.
            </p>
          )}
          {!me.alive && may && !raised && (
            <p className="mt-2 text-center text-[12px] text-(--text-faint)">
              You are dead. This is your one vote for the rest of the game.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** The time of day, as the Storyteller's phone has it. Big, because it is the
 *  one thing a player glances at most and the one thing this app was not
 *  showing at all. */
function Clock() {
  const phase = useStore((s) => s.phase)
  const known = useStore((s) => s.phaseKnown)
  if (!known) return null
  return <h1 className="display px-5 pt-6 text-center text-[30px] leading-none text-(--text)">{phase}</h1>
}

function Seat({ name }: { name: string | null }) {
  if (!name) return null
  return <p className="caps px-5 pt-2 text-center text-(--text-faint)">You are {name}</p>
}

/**
 * A person wears what you think they are, and nothing the app knows.
 *
 * The app is only ever told one role, your own. The picture on somebody else is
 * the claim *you* wrote down, drawn without an alignment ring because hearsay
 * has no colour, and named underneath so it never reads as fact.
 */
function Person({
  name,
  claim,
  dead = false,
  noted = false,
  unread = 0,
  size,
}: {
  name: string
  claim?: ReturnType<typeof getCharacter>
  dead?: boolean
  noted?: boolean
  unread?: number
  size: string
}) {
  return (
    <>
      <span className="relative">
        <Token
          src={claim ? characterArt(claim, 'g') : undefined}
          name={name}
          alignment="unknown"
          size={size}
          dead={dead}
        />
        {/* A mark for "you have written something here": brass, because red
            and blue mean alignment and nothing else. */}
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-(--accent) px-1 text-[11px] font-semibold leading-5 text-(--bg)">
            {unread}
          </span>
        ) : (
          noted && (
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-(--bg) bg-(--accent)" />
          )
        )}
      </span>
      <span
        className={`max-w-[10ch] truncate text-[12px] ${
          dead ? 'text-(--text-faint) line-through' : 'text-(--text-dim)'
        }`}
      >
        {name}
      </span>
      {claim && (
        <span className="max-w-[12ch] text-center text-[11px] leading-tight text-(--text-faint)">
          says {claim.name}
        </span>
      )}
    </>
  )
}
