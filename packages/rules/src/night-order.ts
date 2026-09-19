import { CHARACTERS, NIGHT_STEPS, getCharacter, getStep } from './data.js'

/**
 * Characters that stay in the ordered night queue even when the player holding
 * them is dead, because their ability is conditioned on that death.
 *
 * Derived by reading the ability text of every night-waking character rather
 * than pattern-matching it: phrases like "if you guess wrong, you die" describe
 * a consequence, not activity after death, and a regex cannot tell them apart.
 */
const ACTIVE_WHILE_DEAD = new Set([
  'ravenkeeper',
  'zombuul',
  'poppygrower',
  'farmer',
  'barber',
  'hatter',
  'moonchild',
  'sweetheart',
  'plaguedoctor',
])

/** Evil-team info is only given at seven or more players. */
export const EVIL_INFO_MIN_PLAYERS = 7

export type NightSeat = {
  seatId: string
  /** The character this player believes they are, and whose slot they wake in. */
  characterId: string
  /** Their real character, when it differs (the Drunk, the Marionette, the Lunatic). */
  trueCharacterId?: string
  alive: boolean
}

export type NightEntrySeat = {
  seatId: string
  alive: boolean
  isDisguised: boolean
  trueCharacterId?: string
}

export type NightEntry = {
  key: string
  kind: 'step' | 'character'
  id: string
  name: string
  /** Position in this night's queue, starting at 1. */
  order: number
  /** Official Storyteller reminder, carrying `:reminder:` and *TOKEN* markup. */
  reminder: string
  /** Seats woken here. Empty for pseudo-steps like dusk and dawn. */
  seats: NightEntrySeat[]
  /** Reminder tokens this character can place. */
  reminderTokens: string[]
  /** Every holder is dead, so the step is shown greyed rather than dropped. */
  allDead: boolean
}

export type BuildNightOrderOptions = {
  night: number
  seats: readonly NightSeat[]
  /** Non-Traveller player count, which gates the evil-info steps. */
  playerCount: number
  /** Keep steps whose holders are all dead instead of dropping them. */
  includeDead?: boolean
  /** Explicit order override from a script's `_meta.firstNight`/`otherNight`. */
  override?: readonly string[]
}

/** Ids in official night order, rebuilt from the vendored position integers. */
function officialSequence(isFirst: boolean): string[] {
  const positioned: { id: string; order: number }[] = []
  for (const s of NIGHT_STEPS) {
    const order = isFirst ? s.firstNight : s.otherNight
    if (order > 0) positioned.push({ id: s.id, order })
  }
  for (const c of CHARACTERS) {
    const order = isFirst ? c.firstNight : c.otherNight
    if (order > 0) positioned.push({ id: c.id, order })
  }
  positioned.sort((a, b) => a.order - b.order)
  return positioned.map((p) => p.id)
}

const SEQUENCE_CACHE = new Map<boolean, string[]>()

export function nightSequence(isFirst: boolean): string[] {
  let seq = SEQUENCE_CACHE.get(isFirst)
  if (!seq) {
    seq = officialSequence(isFirst)
    SEQUENCE_CACHE.set(isFirst, seq)
  }
  return seq
}

/**
 * Build the wake queue for a night.
 *
 * A player who believes they are someone else wakes in their cover character's
 * slot, flagged so the Storyteller does not forget. That is the case the
 * hand-rolled night lists in other tools most often get wrong.
 */
export function buildNightOrder(opts: BuildNightOrderOptions): NightEntry[] {
  const { night, seats, playerCount, includeDead = false, override } = opts
  const isFirst = night === 1
  const order = override ? [...override] : nightSequence(isFirst)

  // Group seats by the character whose slot they wake in.
  const bySlot = new Map<string, NightEntrySeat[]>()
  for (const seat of seats) {
    const list = bySlot.get(seat.characterId) ?? []
    list.push({
      seatId: seat.seatId,
      alive: seat.alive,
      isDisguised: Boolean(
        seat.trueCharacterId && seat.trueCharacterId !== seat.characterId,
      ),
      trueCharacterId: seat.trueCharacterId,
    })
    bySlot.set(seat.characterId, list)
  }

  const entries: NightEntry[] = []
  let position = 0

  for (const id of order) {
    const step = getStep(id)

    if (step) {
      if (id === 'minioninfo' || id === 'demoninfo') {
        if (!isFirst || playerCount < EVIL_INFO_MIN_PLAYERS) continue
      }
      const reminder = isFirst ? step.firstNightReminder : step.otherNightReminder
      if (!reminder) continue
      entries.push({
        key: `${id}@${++position}`,
        kind: 'step',
        id,
        name: step.name,
        order: position,
        reminder,
        seats: [],
        reminderTokens: [],
        allDead: false,
      })
      continue
    }

    const character = getCharacter(id)
    if (!character) continue

    const holders = bySlot.get(id)
    if (!holders?.length) continue

    const reminder = isFirst ? character.firstNightReminder : character.otherNightReminder
    if (!reminder) continue

    const anyAlive = holders.some((h) => h.alive)
    if (!anyAlive && !ACTIVE_WHILE_DEAD.has(id) && !includeDead) continue

    entries.push({
      key: `${id}@${++position}`,
      kind: 'character',
      id,
      name: character.name,
      order: position,
      reminder,
      seats: holders,
      reminderTokens: character.reminders,
      allDead: !anyAlive,
    })
  }

  return entries
}

/**
 * The interrupt stack. Some abilities resolve the moment they are triggered
 * rather than at their place in the order: the Scarlet Woman when the Demon
 * dies, the Ravenkeeper on death, the Imp passing the star. A queue alone
 * cannot express these, and it is where hand-rolled night lists break.
 */
export type Interrupt = {
  id: string
  characterId: string
  characterName: string
  seatId: string
  reason: string
  reminder: string
}

/** Triggers that should raise an interrupt, keyed by the event that causes them. */
export const INTERRUPT_TRIGGERS: Record<string, { characterId: string; reason: string }[]> = {
  'demon-died': [
    { characterId: 'scarletwoman', reason: 'The Demon died, so the Scarlet Woman becomes the Demon.' },
  ],
  'died-at-night': [
    { characterId: 'ravenkeeper', reason: 'The Ravenkeeper died at night and wakes to choose a player.' },
    { characterId: 'farmer', reason: 'The Farmer died at night, so a good player becomes a Farmer.' },
  ],
  died: [
    { characterId: 'sweetheart', reason: 'The Sweetheart died, so one player is drunk from now on.' },
    { characterId: 'moonchild', reason: 'The Moonchild learned they died and chooses a player.' },
    { characterId: 'plaguedoctor', reason: 'The Plague Doctor died, so you gain a Minion ability.' },
    { characterId: 'poppygrower', reason: 'The Poppy Grower died, so evil learn each other tonight.' },
  ],
}

export function interruptFor(
  characterId: string,
  seatId: string,
  reason: string,
  night: number,
): Interrupt | null {
  const c = getCharacter(characterId)
  if (!c) return null
  const reminder = night === 1 ? c.firstNightReminder : c.otherNightReminder
  return {
    id: `${characterId}:${seatId}:${reason}`,
    characterId,
    characterName: c.name,
    seatId,
    reason,
    reminder: reminder || c.ability,
  }
}
