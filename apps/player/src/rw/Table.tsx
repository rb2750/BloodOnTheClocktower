import { useEffect, useRef, useState } from 'react'
import { canNominate, getCharacter, type Character } from '@botc/rules'
import { alert, haptic } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'
import { enablePush, pushState, type PushState } from '../push.js'
import { useHold } from './hold.js'
import { Icon, Lantern, Tok } from './Token.js'
import { aliveLine, list, word } from './words.js'

export type Seat = { id?: string; name: string; alive: boolean; ghostVote?: boolean; traveller?: boolean; pub?: string }

/**
 * Everyone else at the table, clockwise from the player's own left. The seat
 * order is the room's, so walking it from the player's own chair is what they
 * see when they look round. A game played with one code per player never
 * sends a table, so the names they wrote down stand in.
 */
export function useSeats(): { others: Seat[]; me?: Seat; all: Seat[] } {
  const table = useStore((s) => s.table)
  const notes = useStore((s) => s.notes)
  const seatName = useStore((s) => s.seatName)
  if (table.length > 0) {
    const i = table.findIndex((t) => t.name === seatName)
    const others = i < 0 ? table : [...table.slice(i + 1), ...table.slice(0, i)]
    return { others, me: i < 0 ? undefined : table[i], all: table }
  }
  const others = Object.values(notes).map((n) => ({ name: n.name, alive: n.diedOnDay === undefined }))
  return { others, all: others }
}

const claimOf = (notes: ReturnType<typeof useStore.getState>['notes'], name: string): Character | undefined => {
  const c = notes[name]?.claims.at(-1)
  return c ? getCharacter(c.characterId) : undefined
}

/** Anyone who died since this phone last looked, so the shroud can fall on them once. */
function useJustDied(seats: Seat[]) {
  const last = useRef<Map<string, boolean> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const now = new Map(seats.map((s) => [s.name, s.alive]))
    if (last.current) {
      const died = seats.filter((s) => !s.alive && last.current!.get(s.name) === true).map((s) => s.name)
      if (died.length) setFresh((f) => new Set([...f, ...died]))
    }
    last.current = now
  }, [seats])
  return fresh
}

export function TableScreen({
  light,
  deaths,
  enter,
  onPerson,
  onMenu,
  onMessages,
  onReveal,
}: {
  light: 'day' | 'dusk' | 'night' | 'dawn'
  deaths: string[]
  enter: boolean
  onPerson: (name: string) => void
  onMenu: () => void
  onMessages: () => void
  onReveal: (open: boolean) => void
}) {
  const phase = useStore((s) => s.phase)
  const phaseKnown = useStore((s) => s.phaseKnown)
  const characterId = useStore((s) => s.characterId)
  const notes = useStore((s) => s.notes)
  const chats = useStore((s) => s.chats)
  const messages = useStore((s) => s.messages)
  const whispersSeen = useStore((s) => s.whispersSeen)
  const seatId = useStore((s) => s.seatId)
  const seatName = useStore((s) => s.seatName)
  const vote = useStore((s) => s.vote)
  const floor = useStore((s) => s.floor)
  const nominations = useStore((s) => s.nominations)
  const myRequest = useStore((s) => s.myRequest)
  const { others, me, all } = useSeats()
  const { hand, speak, askNominate, withdrawNomination, status } = useRelay()
  const fresh = useJustDied(all)

  const character = getCharacter(characterId ?? '')
  const hasCharacter = Boolean(character && character.id !== 'drunk')
  const night = light === 'night'
  const unread = Object.values(chats).reduce((n, c) => n + c.unread, 0) + Math.max(0, messages.length - whispersSeen)
  const alive = all.filter((s) => s.alive).length

  // ---- the vote, with the hand going up the moment it is tapped
  const counted = Boolean(vote && seatName && vote.voters.includes(seatName))
  const [wanted, setWanted] = useState<boolean | null>(null)
  const [lost, setLost] = useState(false)
  useEffect(() => {
    if (wanted === null) return
    if (wanted === counted) return setWanted(null)
    const t = window.setTimeout(() => {
      setWanted(null)
      setLost(true)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [wanted, counted])
  useEffect(() => setLost(false), [vote?.id])
  const raised = wanted ?? counted
  const liveVote = vote && !vote.settled ? vote : null
  const mayVote = Boolean(me && (me.alive || me.ghostVote || raised || vote?.exile))

  // ---- nominations
  const records = nominations.today.map((n) => ({
    day: 0, nominator: n.nominatorId, nominee: n.nomineeId, voters: [], tally: 0, majority: 0, succeeded: false, exile: n.exile, at: 0,
  }))
  const aliveOf = (id: string) => all.find((t) => t.id === id)?.alive ?? false
  const travellerOf = (id: string) => all.find((t) => t.id === id)?.traveller ?? false
  const canPick = (id?: string) =>
    Boolean(
      id && seatId && nominations.open && !myRequest && !liveVote && !night && status === 'open' &&
        canNominate(seatId, id, records, aliveOf, travellerOf).allowed,
    )
  const mine = seatId ? canNominate(seatId, null, records, aliveOf, travellerOf) : { allowed: false }
  const [holding, setHolding] = useState<string | null>(null)
  const nameOf = (id: string) => all.find((t) => t.id === id)?.name ?? 'someone'

  // ---- the floor
  const speaking = floor.mode === 'queue' ? floor.speaking : null
  const myTurn = Boolean(seatId && speaking === seatId)
  const myPlace = seatId ? floor.queue.indexOf(seatId) : -1

  // ---- hands and glows on the ring
  const hands = new Set<string>()
  if (liveVote) for (const v of liveVote.voters) hands.add(v)
  if (liveVote && seatName && raised) hands.add(seatName)
  if (liveVote && seatName && !raised) hands.delete(seatName)
  if (!liveVote && floor.mode === 'queue') for (const id of floor.queue) hands.add(nameOf(id))

  // ---- buzzing
  const [push, setPush] = useState<PushState>(() => pushState())
  const { subscribe } = useRelay()
  const turnOnPush = async () => {
    const sub = await enablePush()
    if (sub) subscribe(sub)
    setPush(pushState())
  }

  // ---- the middle of the square says only what is true right now
  const over = useStore((s) => s.over)
  const finished = phaseKnown && /^finished/i.test(phase)
  let centre: React.ReactNode
  let key = ''
  if (finished) {
    key = 'over'
    centre = (
      <>
        <div className="rw-eyebrow">The game is over</div>
        <div className="rw-say" style={{ color: over?.winner === 'evil' ? 'var(--evil)' : over ? 'var(--good)' : undefined }}>
          {over ? `${over.winner === 'evil' ? 'Evil' : 'Good'} wins` : 'Thanks for playing'}
        </div>
        <div className="rw-note">Hold your lantern to show the table who you were</div>
      </>
    )
  } else if (light === 'night') {
    key = 'night'
    centre = (
      <>
        <div className="rw-eyebrow">{phase}</div>
        <div className="rw-say">Close your eyes</div>
      </>
    )
  } else if (light === 'dawn') {
    key = 'dawn'
    centre = (
      <>
        <div className="rw-eyebrow live">Dawn</div>
        <div className="rw-say">Open your eyes</div>
      </>
    )
  } else if (holding) {
    key = 'hold'
    centre = (
      <>
        <div className="rw-eyebrow live">{travellerOf(holding) ? `Call for ${nameOf(holding)}’s exile?` : `Nominate ${nameOf(holding)}?`}</div>
        <div className="rw-say">Keep holding</div>
        <div className="rw-note">Let go to cancel</div>
      </>
    )
  } else if (liveVote) {
    key = `vote-${liveVote.id}`
    const you = liveVote.nominee === seatName
    centre = (
      <>
        <div className="rw-eyebrow live">
          {liveVote.exile
            ? `${liveVote.nominator} calls to exile ${you ? 'you' : liveVote.nominee}`
            : `${liveVote.nominator} nominates ${you ? 'you' : liveVote.nominee}`}
        </div>
        <div className="rw-tally" key={liveVote.tally}>
          <span className="rw-swap" style={{ display: 'inline-block' }}>{liveVote.tally}</span>
          <small> of {liveVote.majority}</small>
        </div>
        <div className="rw-note">
          {liveVote.voters.length === 0 ? 'No hands up yet' : list(liveVote.voters.map((v) => (v === seatName ? 'you' : v)))}
        </div>
      </>
    )
  } else if (myRequest) {
    const ahead = nominations.queue.findIndex((r) => r.id === myRequest.id)
    key = 'asked'
    centre = (
      <>
        <div className="rw-eyebrow">You nominated {nameOf(myRequest.nomineeId)}</div>
        <div className="rw-say">Waiting for the Storyteller</div>
        {ahead > 0 && <div className="rw-note">{ahead === 1 ? 'One nomination ahead of yours' : `${word(ahead)} nominations ahead of yours`}</div>}
      </>
    )
  } else if (floor.mode === 'queue') {
    const next = floor.queue.slice(0, 2).map((id) => (id === seatId ? 'you' : nameOf(id)))
    key = `floor-${speaking}`
    centre = myTurn ? (
      <>
        <div className="rw-eyebrow live">Your turn</div>
        <div className="rw-say">The table is listening</div>
      </>
    ) : (
      <>
        <div className="rw-eyebrow">Hands up to speak</div>
        <div className="rw-say">{speaking ? `${nameOf(speaking)} has the floor` : 'Waiting for a hand'}</div>
        {next.length > 0 && <div className="rw-note">{myPlace === 0 ? 'You are next' : `Next: ${list(next)}`}</div>}
      </>
    )
  } else if (floor.mode === 'silent') {
    key = 'quiet'
    centre = (
      <>
        <div className="rw-eyebrow">The Storyteller is speaking</div>
        <div className="rw-say">Quiet, please</div>
      </>
    )
  } else if (vote?.settled) {
    key = `result-${vote.id}`
    const enough = vote.tally >= vote.majority
    centre = (
      <>
        <div className="rw-eyebrow">{vote.nominee} received {vote.tally === 1 ? 'one vote' : `${word(vote.tally).toLowerCase()} votes`}</div>
        <div className="rw-say">{enough ? (vote.exile ? `Enough to exile ${vote.nominee}` : 'Enough to execute') : 'Not enough'}</div>
        {nominations.open && <div className="rw-note">Nominations are still open</div>}
      </>
    )
  } else if (nominations.open) {
    key = 'noms'
    centre = (
      <>
        <div className="rw-eyebrow live">Nominations are open</div>
        <div className="rw-say">{mine.allowed || all.some((t) => t.traveller) ? 'Hold a player to nominate them' : 'Watch the nominations'}</div>
      </>
    )
  } else if (!hasCharacter) {
    key = 'waiting'
    centre = (
      <>
        <div className="rw-eyebrow">Everyone is taking their seats</div>
        <div className="rw-say">Your character is on its way</div>
      </>
    )
  } else {
    key = 'talk'
    centre = (
      <>
        <div className="rw-eyebrow">The town talks</div>
        <div className="rw-say">Who do you believe?</div>
      </>
    )
  }

  // ---- the one place actions live
  let dock: React.ReactNode = null
  if (night) dock = null
  else if (deaths.length > 0 && light === 'dawn') {
    dock = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Tok name={deaths[0]} size={46} dead />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700 }}>{list(deaths)} died in the night</div>
          <div className="rw-help" style={{ textAlign: 'left', padding: 0 }}>
            {deaths.length === 1 ? 'They keep one ghost vote.' : 'Each keeps one ghost vote.'}
          </div>
        </div>
      </div>
    )
  } else if (liveVote && me) {
    dock = mayVote ? (
      <>
        <button
          className="rw-btn"
          disabled={status !== 'open'}
          aria-pressed={raised}
          onClick={() => {
            haptic('tap')
            setLost(false)
            setWanted(!raised)
            hand(!raised)
          }}
        >
          {raised ? 'Lower my hand' : (<>{Icon.hand()} Raise hand</>)}
        </button>
        <div className="rw-help" style={{ paddingTop: 10 }}>
          {raised
            ? 'Your hand is up. Lower it before the count ends to take it back.'
            : !me.alive && !liveVote.exile
              ? 'You are dead. This is your one vote for the rest of the game.'
              : liveVote.exile
                ? 'Everyone votes on an exile, and it costs the dead nothing.'
                : 'Your vote counts once.'}
        </div>
        {lost && <div className="rw-err">The Storyteller did not get that. Try again.</div>}
      </>
    ) : (
      <div className="rw-help">Your ghost vote is spent.</div>
    )
  } else if (myRequest) {
    dock = (
      <button className="rw-btn line" onClick={() => { haptic('tap'); withdrawNomination() }}>
        Take it back
      </button>
    )
  } else if (floor.mode === 'queue' && seatId) {
    dock = myTurn ? (
      <button className="rw-btn" onClick={() => { haptic('tap'); speak(false) }}>I’m done speaking</button>
    ) : (
      <button className={`rw-btn${myPlace >= 0 ? '' : ' line'}`} disabled={status !== 'open'} onClick={() => { haptic('tap'); speak(myPlace < 0) }}>
        {Icon.hand()} {myPlace >= 0 ? 'Lower hand' : 'Raise hand to speak'}
      </button>
    )
  } else if (nominations.open && seatId) {
    dock = (
      <div className="rw-help">
        {mine.allowed
          ? 'You have one nomination today.'
          : all.some((t) => t.traveller)
            ? 'You can still call for a Traveller’s exile.'
            : mine.reason === 'Dead players may not nominate.'
              ? 'The dead may not nominate.'
              : 'You have used your nomination today.'}
      </div>
    )
  } else if (!hasCharacter) {
    dock = <div className="rw-help">The Storyteller hands out characters in a moment. Keep this open.</div>
  } else {
    dock = (
      <>
        <div className="rw-help">
          Tap a player to note what they claim.
          <br />
          Hold your lantern to see your character.
        </div>
        {push === 'off' && (
          <button className="rw-btn ghost" style={{ marginTop: 6 }} onClick={() => void turnOnPush()}>
            {Icon.bell} Buzz me when something happens
          </button>
        )}
      </>
    )
  }

  // ---- seat sizes shrink as the table grows
  const n = others.length + 1
  const size = n <= 8 ? 64 : n <= 11 ? 54 : n <= 14 ? 46 : 40

  const you = useHold({
    ms: 380,
    enabled: hasCharacter,
    onDone: () => {
      haptic('pick')
      onReveal(true)
    },
    onEnd: () => onReveal(false),
    onTap: () => {
      haptic('tap')
      if (!hasCharacter) return
      window.dispatchEvent(new CustomEvent('rw:hint', { detail: 'Hold your lantern to see your character.' }))
    },
  })

  return (
    <div className="rw-page">
      <div className="rw-hdr">
        <div>
          <div className="rw-title">{finished ? 'Game over' : phaseKnown ? phase : 'Ravenswood'}</div>
          <div className="rw-sub">{night ? 'Eyes closed' : aliveLine(alive, all.length - alive) || (seatName ?? '')}</div>
        </div>
        <div className="rw-icons">
          <button className="rw-icon" aria-label="This phone" onClick={onMenu}>
            {Icon.menu}
          </button>
          {!night && (
            <button className="rw-icon" aria-label={unread ? `${unread} unread` : 'Messages'} onClick={onMessages}>
              {Icon.env}
              {unread > 0 && <span className="rw-wax" key={unread}>{unread}</span>}
            </button>
          )}
        </div>
      </div>

      <div className="rw-ring">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="51" rx="37" ry="39" fill="rgba(18,24,38,.35)" stroke="#2C3446" strokeWidth=".35" vectorEffect="non-scaling-stroke" />
          <ellipse cx="50" cy="51" rx="35.6" ry="37.5" fill="none" stroke="#1D2433" strokeWidth=".25" vectorEffect="non-scaling-stroke" />
          <ellipse cx="50" cy="51" rx="37" ry="39" fill="none" stroke="#3B4458" strokeWidth="5" strokeDasharray="1.2 30" vectorEffect="non-scaling-stroke" />
        </svg>

        {others.map((s, k) => (
          <SeatView
            key={s.name}
            seat={s}
            k={k}
            n={n}
            size={size}
            enter={enter}
            claim={claimOf(notes, s.name)}
            unread={s.id ? (chats[s.id]?.unread ?? 0) : 0}
            hand={hands.has(s.name)}
            hot={Boolean(speaking && s.id === speaking) || (canPick(s.id) && !holding) || holding === s.id}
            fresh={fresh.has(s.name)}
            nominable={canPick(s.id)}
            onTap={() => onPerson(s.name)}
            onHolding={(on) => setHolding(on ? (s.id ?? null) : null)}
            onNominate={() => {
              if (!s.id) return
              haptic('confirm')
              alert('seat')
              setHolding(null)
              askNominate(s.id)
            }}
          />
        ))}

        <div className={`rw-seat${enter ? ' enter' : ''}`} style={{ left: '50%', top: '90%', ['--k' as string]: others.length }}>
          <div className="tokwrap" {...you.bind}>
            {you.p > 0 && <span className="rw-prog" style={{ ['--p' as string]: you.p }} />}
            <Tok size={size} hot={myTurn || (Boolean(liveVote) && raised)}>
              <Lantern lit={hasCharacter && !night} size={Math.round(size * 0.53)} />
            </Tok>
            {seatName && hands.has(seatName) && <span className="rw-hand">{Icon.hand(14)}</span>}
          </div>
          <div className="rw-plate">{seatName ?? 'You'}</div>
          <div className="rw-says">you</div>
        </div>

        <div className="rw-centre">
          <div className="rw-swap" key={key}>{centre}</div>
        </div>
      </div>

      {dock && (
        <div className="rw-dock" key={night ? 'n' : 'd'}>
          {dock}
        </div>
      )}
      {!dock && <div style={{ height: 12 }} />}
    </div>
  )
}

function SeatView({
  seat, k, n, size, enter, claim, unread, hand, hot, fresh, nominable, onTap, onHolding, onNominate,
}: {
  seat: Seat; k: number; n: number; size: number; enter: boolean; claim?: Character; unread: number; hand: boolean; hot: boolean
  fresh: boolean; nominable: boolean; onTap: () => void; onHolding: (on: boolean) => void; onNominate: () => void
}) {
  const a = (2 * Math.PI * (k + 1)) / n + Math.PI / 2
  const x = 50 + 37 * Math.cos(a)
  const y = 51 + 39 * Math.sin(a)
  const h = useHold({
    ms: 1000,
    enabled: nominable,
    onDone: onNominate,
    onTap: () => {
      haptic('tap')
      onTap()
    },
  })
  useEffect(() => onHolding(h.p > 0), [h.p > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`rw-seat${enter ? ' enter' : ''}`}
      style={{ left: `${x}%`, top: `${y}%`, ['--k' as string]: k }}
      role="button"
      tabIndex={0}
      aria-label={`${seat.name}${seat.alive ? '' : ', dead'}${claim ? `, says ${claim.name}` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
    >
      <div className="tokwrap" {...h.bind}>
        {h.p > 0 && <span className="rw-prog" style={{ ['--p' as string]: h.p }} />}
        <Tok name={seat.name} character={claim} size={size} dead={!seat.alive} fresh={fresh} hot={hot} team={false} />
        {unread > 0 && <span className="rw-wax" key={unread}>{unread}</span>}
        {hand && <span className="rw-hand">{Icon.hand(14)}</span>}
      </div>
      <div className={`rw-plate${seat.alive ? '' : ' dead'}`}>{seat.name}</div>
      {claim && <div className="rw-says">{seat.alive ? 'says' : 'said'} {claim.name}</div>}
    </div>
  )
}
