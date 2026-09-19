import type { Alignment, Script } from '@botc/rules'

/** When an effect stops applying. Most tools model poison as an untyped
 *  boolean and get this wrong: "tonight and tomorrow day" is not "permanent". */
export type Expiry =
  | { kind: 'dusk' }
  | { kind: 'permanent' }
  | { kind: 'night'; night: number }
  | { kind: 'day'; day: number }

export type EffectKind =
  | 'poisoned'
  | 'drunk'
  | 'protected'
  | 'mad'
  | 'red-herring'
  | 'registers-as'
  | 'custom'

export type Effect = {
  id: string
  kind: EffectKind
  /** The reminder-token label, taken from the character's own token list. */
  label: string
  sourceSeatId?: string
  sourceCharacterId?: string
  expiry: Expiry
  /** For madness: what they must claim. For registers-as: what they register as. */
  subject?: string
  note?: string
  createdAt: number
  createdOn: string
}

export type Seat = {
  id: string
  name: string
  /** The character this player believes they are. */
  characterId?: string
  /** Their real character, when it differs. The Drunk, Marionette, Lunatic. */
  trueCharacterId?: string
  /** Set only when it differs from the character's own team alignment. */
  alignmentOverride?: Alignment
  alive: boolean
  /** Dead players keep exactly one vote for the rest of the game. */
  deadVoteAvailable: boolean
  isTraveller: boolean
  effects: Effect[]
  /** Storyteller's private notes on this player. */
  notes: string
}

export type Phase =
  | { k: 'setup' }
  | { k: 'night'; n: number; step: number }
  | { k: 'day'; n: number }
  | { k: 'ended'; winner: 'good' | 'evil'; rationale: string }

export type LogKind =
  | 'phase'
  | 'deal'
  | 'info'
  | 'death'
  | 'effect'
  | 'nomination'
  | 'execution'
  | 'note'
  | 'change'

export type LogEntry = {
  id: string
  at: number
  /** "Night 1", "Day 2" — the phase this happened in. */
  phase: string
  kind: LogKind
  text: string
  seatIds: string[]
  /** Information handed to a player, and whether it was the truth. */
  info?: { toSeatId: string; given: string; truthful: boolean; id?: string }
}

export type Nomination = {
  id: string
  day: number
  nominatorId: string
  nomineeId: string
  voterIds: string[]
  tally: number
  majority: number
  /** Open while votes are being counted, then settled. */
  settled: boolean
  at: number
}

export type Game = {
  id: string
  createdAt: number
  scriptName: string
  script: Script
  seats: Seat[]
  phase: Phase
  /** Three good characters not in play, shown to the Demon on the first night. */
  bluffs: string[]
  nominations: Nomination[]
  log: LogEntry[]
  /** Locks the grimoire so the tablet can be set down or passed safely. */
  locked: boolean
  /** The shared room, once a code has been shown. Kept for the whole game so
   *  the same code works at any point and a re-scan finds the same room. */
  room?: { id: string; key: Uint8Array }
  /** Which device claimed each seat, so nobody can take a seat that is spoken
   *  for and the same phone is recognised on a later scan. */
  claims?: Record<string, string>
  finishedAt?: number
}
