/** The seven character types in the official data. `loric` is a whole-game
 *  modifier type present in TPI's data but missing from most community sets. */
export type Team =
  | 'townsfolk'
  | 'outsider'
  | 'minion'
  | 'demon'
  | 'traveller'
  | 'fabled'
  | 'loric'

/** Teams that are dealt from the bag and counted by the composition table. */
export const BAG_TEAMS = ['townsfolk', 'outsider', 'minion', 'demon'] as const
export type BagTeam = (typeof BAG_TEAMS)[number]

export type Alignment = 'good' | 'evil'

/** Which alignment a team belongs to before any character changes it. */
export function teamAlignment(team: Team): Alignment {
  return team === 'minion' || team === 'demon' ? 'evil' : 'good'
}

export type Special = {
  type: 'selection' | 'ability' | 'signal' | 'vote' | 'reveal' | 'player' | 'reminder'
  name: string
  value?: unknown
  time?: string
  global?: string
}

export type Jinx = { with: string; reason: string }

export type Character = {
  id: string
  name: string
  edition: string
  team: Team
  ability: string
  flavor: string
  setup: boolean
  reminders: string[]
  /** Reminder tokens available even when this character is not in play. */
  remindersGlobal: string[]
  /** Position in the first-night order; 0 means this character does not wake. */
  firstNight: number
  firstNightReminder: string
  otherNight: number
  otherNightReminder: string
  special: Special[]
  jinxes: Jinx[]
  /** Base path for art; suffix with `_g.webp` or `_e.webp`. */
  image: string
}

/** A non-character step in the night order (dusk, minion info, demon info, dawn). */
export type NightStep = {
  id: string
  name: string
  firstNight: number
  firstNightReminder: string
  otherNight: number
  otherNightReminder: string
}

export type ScriptMeta = {
  id: string
  name: string
  author?: string
  logo?: string
  almanac?: string
  /** Homebrew rule lines the Storyteller has added to this script. */
  bootlegger?: string[]
  /** Explicit night-order overrides, as arrays of character ids. */
  firstNight?: string[]
  otherNight?: string[]
}

export type Script = {
  meta: ScriptMeta
  /** Character ids on this script, in the order the script lists them. */
  characterIds: string[]
  /** Homebrew characters defined inline by the script, keyed by id. */
  homebrew: Record<string, Character>
}

export type Composition = {
  townsfolk: number
  outsider: number
  minion: number
  demon: number
}
