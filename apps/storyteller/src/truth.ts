import { getCharacter, infoShape, teamAlignment, type Character } from '@botc/rules'
import type { Game, Seat } from './state/types.js'

/**
 * What the grimoire says the answer is.
 *
 * Offered, never sent. A Storyteller hands out false information on purpose
 * all the time, and the point of showing the truth next to the field is that
 * both the deliberate lie and the accidental one become obvious: the number
 * you are about to send is there beside the number that is actually true.
 *
 * Only the answers that follow from the grimoire alone are worked out here.
 * Anything that depends on what a player chose in the moment, or on a judgement
 * call, is left blank rather than guessed at.
 */

/** What a seat really is, allowing for the Drunk, the Lunatic and overrides. */
function realCharacter(seat: Seat): Character | undefined {
  return getCharacter(seat.trueCharacterId ?? seat.characterId ?? '')
}

function isEvil(seat: Seat): boolean {
  if (seat.alignmentOverride) return seat.alignmentOverride === 'evil'
  const character = realCharacter(seat)
  return character ? teamAlignment(character.team) === 'evil' : false
}

/** Seats in seating order, Travellers included: they sit at the table too. */
function ring(game: Game): Seat[] {
  return game.seats
}

function holderOf(game: Game, test: (c: Character) => boolean): Seat | undefined {
  return ring(game).find((s) => {
    const c = realCharacter(s)
    return c ? test(c) : false
  })
}

/** Living neighbours either side, which is what the Empath sees. */
function livingNeighbours(game: Game, seat: Seat): Seat[] {
  const seats = ring(game).filter((s) => !s.isTraveller)
  const index = seats.findIndex((s) => s.id === seat.id)
  if (index === -1) return []
  const step = (direction: 1 | -1) => {
    for (let i = 1; i < seats.length; i++) {
      const next = seats[(index + direction * i + seats.length * i) % seats.length]!
      if (next.id === seat.id) break
      if (next.alive) return next
    }
    return undefined
  }
  return [step(1), step(-1)].filter((s): s is Seat => Boolean(s))
}

function evilPairs(game: Game): number {
  const seats = ring(game).filter((s) => !s.isTraveller)
  if (seats.length < 2) return 0
  let pairs = 0
  for (let i = 0; i < seats.length; i++) {
    const a = seats[i]!
    const b = seats[(i + 1) % seats.length]!
    if (isEvil(a) && isEvil(b)) pairs += 1
  }
  return pairs
}

function stepsBetween(game: Game, from: Seat, to: Seat): number {
  const seats = ring(game).filter((s) => !s.isTraveller)
  const a = seats.findIndex((s) => s.id === from.id)
  const b = seats.findIndex((s) => s.id === to.id)
  if (a === -1 || b === -1) return 0
  const forward = (b - a + seats.length) % seats.length
  return Math.min(forward, seats.length - forward)
}

/**
 * Drunk, poisoned, or not the character they believe they are.
 *
 * This matters more than it looks. The grimoire can work out what a sober
 * Empath would learn, and for a drunk one that answer is exactly the thing not
 * to send. So the suggestion still says what the truth is, and says plainly
 * that this player should probably not be told it.
 */
function impaired(seat: Seat): string | null {
  const effect = seat.effects.find((e) => e.kind === 'drunk' || e.kind === 'poisoned')
  if (effect) return effect.kind === 'drunk' ? 'drunk' : 'poisoned'
  const believed = seat.characterId
  const real = seat.trueCharacterId
  if (real && real !== believed) {
    return real === 'drunk' ? 'the Drunk' : `really the ${getCharacter(real)?.name ?? real}`
  }
  return null
}

export type Suggestion = {
  /** Filled into the template's own slots. */
  number?: number
  players?: string[]
  character?: string
  /** Said in the Storyteller's own words, above the field. */
  because: string
}

export function suggestion(game: Game, characterId: string, seatId: string): Suggestion | null {
  const seat = game.seats.find((s) => s.id === seatId)
  if (!seat) return null
  const shape = infoShape(getCharacter(characterId) ?? ({} as Character))
  const warning = impaired(seat)
  const said = (because: string) =>
    warning
      ? `${seat.name} is ${warning}, so this is what a sober one would learn. ${because}`
      : because

  if (characterId === 'empath') {
    const neighbours = livingNeighbours(game, seat)
    const evil = neighbours.filter(isEvil).length
    return {
      number: evil,
      because: said(
        `${neighbours.map((n) => n.name).join(' and ') || 'Nobody'} sit${
          neighbours.length === 1 ? 's' : ''
        } beside them alive.`,
      ),
    }
  }

  if (characterId === 'chef') {
    return { number: evilPairs(game), because: said('Counted around the table from the grimoire.') }
  }

  if (characterId === 'oracle') {
    const dead = ring(game).filter((s) => !s.alive && !s.isTraveller)
    return {
      number: dead.filter(isEvil).length,
      because: said(`${dead.length} dead at the table.`),
    }
  }

  if (characterId === 'clockmaker') {
    const demon = holderOf(game, (c) => c.team === 'demon')
    const minions = ring(game).filter((s) => {
      const c = realCharacter(s)
      return c?.team === 'minion'
    })
    if (!demon || minions.length === 0) return null
    const steps = Math.min(...minions.map((m) => stepsBetween(game, demon, m)))
    return { number: steps, because: said(`${demon.name} to the nearest Minion.`) }
  }

  if (shape.kind === 'pair') {
    // A truthful pairing: somebody who really is that team, and anybody else.
    const real = ring(game).find((s) => {
      const c = realCharacter(s)
      return c?.team === shape.team && s.id !== seat.id
    })
    if (!real) {
      return shape.team === 'outsider'
        ? { character: 'none', because: said('No Outsiders are in play.') }
        : null
    }
    const other = ring(game).find((s) => s.id !== real.id && s.id !== seat.id)
    const character = realCharacter(real)
    return {
      players: [real.name, other?.name ?? ''].filter(Boolean),
      character: character?.name,
      because: said(`${real.name} really is the ${character?.name}.`),
    }
  }

  return null
}
