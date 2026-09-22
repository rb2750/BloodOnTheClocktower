import { getCharacter, teamAlignment } from '@botc/rules'
import type { Game, Seat } from './state/types.js'

/*
 * Whether an attempt to kill a player goes through, and who else dies with
 * them. The rules that save a player are all checked here, in one place, so
 * no step can forget one. The Assassin is the one thing nothing stops.
 */
export type Verdict = { dies: boolean; why?: string; also: { seat: Seat; why: string }[]; foolSpent?: boolean }

export const real = (s: Seat) => s.trueCharacterId ?? s.characterId
export const impaired = (s: Seat) => s.effects.find((e) => e.label === 'Poisoned' || e.label.startsWith('Drunk'))
export const isGood = (s: Seat) =>
  s.alignmentOverride ? s.alignmentOverride === 'good' : teamAlignment(getCharacter(real(s) ?? '')?.team ?? 'townsfolk') === 'good'

export function tryKill(game: Game, seat: Seat, cause: 'demon' | 'assassin' | 'other'): Verdict {
  const has = (label: string) => seat.effects.some((e) => e.label === label)
  if (!seat.alive) return { dies: false, why: `${seat.name} is already dead`, also: [] }
  if (cause !== 'assassin') {
    if (has('Safe')) return { dies: false, why: `the Innkeeper protected ${seat.name} tonight`, also: [] }
    if (has('Cannot Die')) return { dies: false, why: `the Tea Lady protects ${seat.name}`, also: [] }
    if (real(seat) === 'sailor' && !impaired(seat)) return { dies: false, why: `${seat.name} is the Sailor and is sober, so cannot die`, also: [] }
    if (real(seat) === 'fool' && !has('No Ability')) return { dies: false, why: `${seat.name} is the Fool: the first time they would die, they don’t`, also: [], foolSpent: true }
  }
  const also: Verdict['also'] = []
  if (cause === 'demon' && has('Grandchild')) {
    const gm = game.seats.find((s) => real(s) === 'grandmother' && s.alive)
    if (gm && !impaired(gm)) also.push({ seat: gm, why: `${seat.name} was the Grandmother’s grandchild and the Demon killed them` })
  }
  return { dies: true, also }
}
