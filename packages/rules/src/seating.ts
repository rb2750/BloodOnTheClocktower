import { getCharacter } from './data.js'
import { teamAlignment } from './types.js'
import { SETUP_MODIFIERS } from './setup-modifiers.js'

export type SeatingSeat = {
  id: string
  name: string
  /** The character this player believes they are. */
  characterId?: string
  /** Their real character, when it differs. */
  trueCharacterId?: string
  alignmentOverride?: 'good' | 'evil'
  /** Travellers sit at the table but are outside every seating rule. */
  isTraveller?: boolean
}

export type SeatingWarning = {
  seatId: string
  characterId: string
  message: string
}

function realCharacterId(seat: SeatingSeat): string | undefined {
  return seat.trueCharacterId ?? seat.characterId
}

function isEvil(seat: SeatingSeat): boolean {
  if (seat.alignmentOverride) return seat.alignmentOverride === 'evil'
  const c = getCharacter(realCharacterId(seat) ?? '')
  return c ? teamAlignment(c.team) === 'evil' : false
}

function isDemon(seat: SeatingSeat): boolean {
  return getCharacter(realCharacterId(seat) ?? '')?.team === 'demon'
}

/**
 * Which seating rules the current arrangement breaks.
 *
 * Some characters only work in a particular seat: the Marionette must
 * neighbour the Demon, and the Lord of Typhon needs the evil team in one
 * unbroken line with the Demon in the middle. Seats are checked in circle
 * order, wrapping at the ends, and Travellers are skipped, because the rules
 * talk about the players at the table rather than the chairs.
 */
export function checkSeating(seats: readonly SeatingSeat[]): SeatingWarning[] {
  const ring = seats.filter((s) => !s.isTraveller)
  const n = ring.length
  if (n < 3) return []
  const warnings: SeatingWarning[] = []
  const at = (i: number) => ring[((i % n) + n) % n]!

  ring.forEach((seat, i) => {
    const id = realCharacterId(seat)
    if (!id) return
    const rule = SETUP_MODIFIERS[id]?.seating
    if (!rule) return
    const name = getCharacter(id)?.name ?? id

    if (rule === 'neighbours-demon') {
      if (!isDemon(at(i - 1)) && !isDemon(at(i + 1))) {
        warnings.push({
          seatId: seat.id,
          characterId: id,
          message: `${seat.name} is the ${name} and must sit next to the Demon.`,
        })
      }
    }

    if (rule === 'evil-line') {
      // Walk out from this seat in both directions while the seats are evil;
      // the two arms must be equal and must cover every evil player.
      let left = 0
      while (left < n - 1 && isEvil(at(i - left - 1))) left++
      let right = 0
      while (right < n - 1 && isEvil(at(i + right + 1))) right++
      const evilCount = ring.filter(isEvil).length
      const inLine = 1 + left + right
      if (inLine < evilCount || left !== right) {
        warnings.push({
          seatId: seat.id,
          characterId: id,
          message:
            inLine < evilCount
              ? `The evil players must sit in one unbroken line around ${seat.name}, the ${name}.`
              : `${seat.name}, the ${name}, must sit in the middle of the evil line.`,
        })
      }
    }
  })

  return warnings
}
