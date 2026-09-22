import { CHARACTERS } from '@botc/rules'

/**
 * Messages exchanged through the relay. Every one is encrypted with the room
 * key before it leaves, so the relay sees only bytes.
 *
 * The `role` message goes one step further. The relay broadcasts to the whole
 * room and every player holds the room key, so a role protected by that alone
 * would be readable by the other players. Its contents are therefore sealed a
 * second time, to the claiming player's own ephemeral public key.
 */
export type RelayMessage =
  | { t: 'hello'; pub: string }
  | { t: 'seats'; seats: { id: string; name: string; taken: boolean; alive?: boolean; ghostVote?: boolean; traveller?: boolean; pub?: string }[] }
  | { t: 'claim'; seatId: string; deviceId: string; pub: string }
  /** A player raising or lowering their hand on the open nomination. */
  | { t: 'hand'; seatId: string; up: boolean }
  /** A private line from one player to another, sealed between their two keys.
   *  The envelope says who is talking; the two of them can read what, and so
   *  can the Storyteller, from `copy`, which is sealed to their key for the recap. */
  | { t: 'chat'; id: string; from: string; to: string; sealed: string; copy?: string }
  | { t: 'role'; seatId: string; sealed: string }
  /** A private line from the Storyteller, sealed to one player's own key. */
  | { t: 'whisper'; seatId: string; id: string; sealed: string }
  /** The Grimoire itself, sealed to the one player entitled to see it. */
  | { t: 'grimoire'; seatId: string; id: string; sealed: string }
  /** `at` is when the phase changed, so a phone joining an hour into the
   *  night can tell an old night from one that has just fallen. */
  | { t: 'phase'; phase: string; day: number; at?: number; winner?: 'good' | 'evil'; reason?: string }
  /** A countdown the whole table can see. `endsAt` null clears it. Stamped so
   *  the replayed backlog cannot bring back a timer that was stopped. */
  | { t: 'timer'; endsAt: number | null; seconds: number; label: string; at: number }
  /** Today's nomination, as the Storyteller is counting it, or none. Hands are
   *  raised in the open, so who voted is public and travels as names. */
  | { t: 'vote'; nomination: VoteSnapshot | null }
  | { t: 'death'; seatId: string; alive: boolean }
  /** A tap on the shoulder, to one seat or to '*' for the whole table. Nothing
   *  to read, so it is not sealed; stamped so a replay never buzzes anyone. */
  | { t: 'nudge'; seatId: string; at: number }
  /** Who may speak. In `queue` the hands form a line the Storyteller calls
   *  from; `silent` is the count, when nobody talks. */
  | { t: 'floor'; mode: FloorMode; queue: string[]; speaking: string | null }
  /** A player asking for the floor, or giving it up. */
  | { t: 'speak'; seatId: string; want: boolean }
  /** Whether nominations are open, and who is waiting to make one. */
  | {
      t: 'nominations'
      open: boolean
      queue: NominationRequest[]
      /** Today's nominations so far. Public at the table, so public here, and
       *  it is what tells a phone who has a nomination left. */
      today: { nominatorId: string; nomineeId: string; exile?: boolean }[]
    }
  /** A player's nomination, which the Storyteller takes when they are ready.
   *  Carries its own id so a replayed backlog never queues it twice. */
  | { t: 'nominate'; id: string; seatId: string; nomineeId: string }
  | { t: 'withdraw'; id: string; seatId: string }

export type FloorMode = 'open' | 'queue' | 'silent'

export type NominationRequest = {
  id: string
  nominatorId: string
  nomineeId: string
}

export type VoteSnapshot = {
  id: string
  /** An exile: the whole table may vote, and the dead vote for free. */
  exile?: boolean
  nominator: string
  nominee: string
  voters: string[]
  tally: number
  majority: number
  settled: boolean
}

/** What a sealed `grimoire` contains once opened: the table as it stands. */
export type SealedGrimoire = {
  at: string
  seats: {
    name: string
    /** The character token in their slot, which is the one they believe. */
    character: number
    /** A Drunk token sits alongside it. */
    drunk: boolean
    dead: boolean
    /** Reminder tokens on that seat, drawn the way the Storyteller sees them. */
    tokens: { kind: string; label: string }[]
  }[]
}

/** What a sealed `chat` contains once opened. */
export type SealedChat = { text: string; at: string }

/** What a sealed `whisper` contains once opened. */
export type SealedWhisper = { text: string; at: string }

/** What a sealed `role` message contains once opened. */
export type SealedRole = {
  character: number
  script: number[]
  scriptName: string
}

/**
 * Character ids are sent as indexes into the bundled roster rather than as
 * strings, which is what keeps the QR payload small enough to stay a chunky,
 * easily-scanned code.
 */
const INDEX_BY_ID = new Map(CHARACTERS.map((c, i) => [c.id, i]))

export function characterIndex(id: string): number {
  const index = INDEX_BY_ID.get(id)
  if (index === undefined) throw new Error(`Unknown character "${id}".`)
  return index
}

export function characterAt(index: number): string | undefined {
  return CHARACTERS[index]?.id
}

export function indexesFor(ids: readonly string[]): number[] {
  return ids.map(characterIndex)
}

export function idsFor(indexes: readonly number[]): string[] {
  return indexes.map(characterAt).filter((id): id is string => Boolean(id))
}
