import { CHARACTERS } from '@botc/rules'

/** Messages exchanged through the relay, all encrypted before they leave. */
export type RelayMessage =
  | { t: 'seats'; seats: { id: string; name: string; taken: boolean }[] }
  | { t: 'claim'; seatId: string; deviceId: string }
  | { t: 'role'; seatId: string; character: number; script: number[]; scriptName: string }
  | { t: 'phase'; phase: string; day: number }
  | { t: 'death'; seatId: string; alive: boolean }

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
