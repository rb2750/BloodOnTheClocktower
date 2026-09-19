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
  | { t: 'seats'; seats: { id: string; name: string; taken: boolean; alive?: boolean; ghostVote?: boolean; traveller?: boolean }[] }
  | { t: 'claim'; seatId: string; deviceId: string; pub: string }
  /** A player raising or lowering their hand on the open nomination. */
  | { t: 'hand'; seatId: string; up: boolean }
  | { t: 'role'; seatId: string; sealed: string }
  /** A private line from the Storyteller, sealed to one player's own key. */
  | { t: 'whisper'; seatId: string; id: string; sealed: string }
  | { t: 'phase'; phase: string; day: number }
  /** Today's nomination, as the Storyteller is counting it, or none. Hands are
   *  raised in the open, so who voted is public and travels as names. */
  | { t: 'vote'; nomination: VoteSnapshot | null }
  | { t: 'death'; seatId: string; alive: boolean }

export type VoteSnapshot = {
  id: string
  nominator: string
  nominee: string
  voters: string[]
  tally: number
  majority: number
  settled: boolean
}

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
