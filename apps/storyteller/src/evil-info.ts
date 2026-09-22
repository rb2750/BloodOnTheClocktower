import { getCharacter } from '@botc/rules'
import type { Game, Seat } from './state/types.js'

const names = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? 'nobody') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/**
 * What evil is told on the first night, as notes for their phones: each
 * Minion learns the Demon and the other Minions; the Demon learns its Minions
 * and the three bluffs. Built from the game as it stands, so a bluff swapped
 * later is reflected.
 */
export function evilNotes(game: Game): { seat: Seat; text: string; demon: boolean }[] {
  const teamOf = (s: Seat) => getCharacter(s.trueCharacterId ?? s.characterId ?? '')?.team
  const demon = game.seats.find((s) => teamOf(s) === 'demon')
  const minions = game.seats.filter((s) => teamOf(s) === 'minion')
  const bluffs = game.bluffs.map((id) => getCharacter(id)?.name ?? id)
  const out: { seat: Seat; text: string; demon: boolean }[] = minions.map((m) => ({
    seat: m,
    demon: false,
    text: `Your Demon is ${demon?.name ?? 'unknown'}.${minions.length > 1 ? ` Your fellow ${minions.length === 2 ? 'Minion is' : 'Minions are'} ${names(minions.filter((x) => x.id !== m.id).map((x) => x.name))}.` : ''}`,
  }))
  if (demon)
    out.push({
      seat: demon,
      demon: true,
      text: `You are the Demon. Your ${minions.length === 1 ? 'Minion is' : 'Minions are'} ${names(minions.map((m) => m.name))}. These characters are not in play: ${names(bluffs)}. They are safe for you to claim.`,
    })
  return out
}
