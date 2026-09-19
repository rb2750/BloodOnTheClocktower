import type { Composition } from './types.js'

/**
 * The official player composition table.
 *
 * Only 5-15 players have a published row. Games of 16-20 players use the
 * 15-player row and every additional player must be a Traveller, since
 * Travellers are never counted by this table.
 */
const TABLE: Record<number, Composition> = {
  5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
}

export const MIN_PLAYERS = 5
export const MAX_PLAYERS = 20
/** Above this count, every extra player must be a Traveller. */
export const MAX_TABLE_PLAYERS = 15

/** 5-6 players is "Teensyville", which affects script size rather than the bag. */
export function isTeensyville(playerCount: number): boolean {
  return playerCount === 5 || playerCount === 6
}

/**
 * The base composition for a given number of non-Traveller players, before any
 * setup-modifying character is applied.
 */
export function baseComposition(nonTravellerCount: number): Composition {
  if (nonTravellerCount < MIN_PLAYERS) {
    throw new RangeError(
      `Blood on the Clocktower needs at least ${MIN_PLAYERS} players, got ${nonTravellerCount}.`,
    )
  }
  const row = TABLE[Math.min(nonTravellerCount, MAX_TABLE_PLAYERS)]
  if (!row) throw new RangeError(`No composition row for ${nonTravellerCount} players.`)
  return { ...row }
}

/** Total seats a composition accounts for. */
export function compositionTotal(c: Composition): number {
  return c.townsfolk + c.outsider + c.minion + c.demon
}

/** Every published row, for the setup screen's reference table. */
export function compositionTable(): { players: number; composition: Composition }[] {
  return Object.entries(TABLE).map(([players, composition]) => ({
    players: Number(players),
    composition: { ...composition },
  }))
}

/**
 * How many of the seated players must be Travellers. Travellers are additional
 * to the table, so any player beyond fifteen is necessarily one.
 */
export function requiredTravellers(seatedCount: number): number {
  return Math.max(0, seatedCount - MAX_TABLE_PLAYERS)
}
