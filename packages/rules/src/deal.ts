import { baseComposition } from './composition.js'
import { scriptCharacter, scriptCharacters } from './script.js'
import { resolveSetup, type SetupChoices, type SetupResolution } from './setup.js'
import { SETUP_MODIFIERS } from './setup-modifiers.js'
import { BAG_TEAMS, type BagTeam, type Character, type Composition, type Script } from './types.js'

export type Rng = () => number

/** Deterministic generator, so a deal can be replayed in tests and bug reports. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0x100000000
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i]!
    const b = out[j]!
    out[i] = b
    out[j] = a
  }
  return out
}

export type DealResult = {
  /** Character ids to deal, one per non-Traveller seat, in no particular order. */
  characterIds: string[]
  resolution: SetupResolution
  /** Slots the dealer could not fill because the script lacks enough characters. */
  shortfall: { team: BagTeam; missing: number }[]
}

export type DealOptions = {
  playerCount: number
  choices?: SetupChoices
  rng?: Rng
  /** Characters the Storyteller has pinned into the deal. */
  required?: readonly string[]
  /** Characters the Storyteller has excluded. */
  excluded?: readonly string[]
}

function poolsFor(script: Script): Record<BagTeam, Character[]> {
  const pools: Record<BagTeam, Character[]> = {
    townsfolk: [],
    outsider: [],
    minion: [],
    demon: [],
  }
  for (const c of scriptCharacters(script)) {
    if (c.team === 'townsfolk' || c.team === 'outsider' || c.team === 'minion' || c.team === 'demon') {
      pools[c.team].push(c)
    }
  }
  return pools
}

/**
 * Deal a set of characters for a game.
 *
 * Setup-modifying characters change the counts, and the counts decide which
 * characters get picked, so this settles by picking evil first, re-resolving,
 * then filling the good teams against the updated target. Characters the
 * Storyteller pinned are kept across every pass.
 */
export function dealCharacters(script: Script, options: DealOptions): DealResult {
  const { playerCount, choices = {}, rng = Math.random } = options
  const required = new Set(options.required ?? [])
  const excluded = new Set(options.excluded ?? [])

  const pools = poolsFor(script)
  const available = (team: BagTeam) =>
    shuffle(
      pools[team].filter((c) => !excluded.has(c.id)),
      rng,
    )

  const pickedByTeam: Record<BagTeam, string[]> = {
    townsfolk: [],
    outsider: [],
    minion: [],
    demon: [],
  }

  const teamOf = (id: string): BagTeam | undefined => {
    const t = scriptCharacter(script, id)?.team
    return t && (BAG_TEAMS as readonly string[]).includes(t) ? (t as BagTeam) : undefined
  }

  // Pinned characters go in first and are never displaced.
  for (const id of required) {
    const team = teamOf(id)
    if (team) pickedByTeam[team].push(id)
  }

  /**
   * Grow or trim a team to `target`, keeping what is already chosen.
   *
   * Stability matters more than it looks: if a pass re-rolled its picks, a
   * setup-modifying character chosen on one pass could vanish on the next, the
   * target would swing back, and the loop would oscillate instead of settling.
   * Pinned characters are kept first, then existing picks, then new ones.
   */
  const fill = (team: BagTeam, target: number) => {
    const current = pickedByTeam[team]
    const ordered = [
      ...current.filter((id) => required.has(id)),
      ...current.filter((id) => !required.has(id)),
    ]
    const next = ordered.slice(0, Math.max(0, target))
    if (next.length < target) {
      for (const c of available(team)) {
        if (next.length >= target) break
        if (!next.includes(c.id)) next.push(c.id)
      }
    }
    // Never silently drop a pinned character, even if the target shrank.
    for (const id of current) {
      if (required.has(id) && !next.includes(id)) next.push(id)
    }
    pickedByTeam[team] = next
  }

  const all = () => Object.values(pickedByTeam).flat()
  const same = (a: Composition, b: Composition) =>
    a.townsfolk === b.townsfolk &&
    a.outsider === b.outsider &&
    a.minion === b.minion &&
    a.demon === b.demon

  // Evil is picked first, because the Baron, the Godfather, Lil' Monsta and
  // friends set the shape of everything else. Then iterate to a fixed point:
  // the picks decide the composition, and the composition decides the picks.
  let target: Composition = baseComposition(playerCount)
  fill('demon', target.demon)
  fill('minion', target.minion)

  let resolution = resolveSetup(playerCount, all(), choices)
  target = resolution.composition

  for (let pass = 0; pass < 8; pass++) {
    // Forced inclusions consume a slot, so seat them before filling.
    for (const f of resolution.forced) {
      const team = teamOf(f.characterId)
      if (team && !pickedByTeam[team].includes(f.characterId)) {
        pickedByTeam[team] = [f.characterId, ...pickedByTeam[team]]
      }
    }
    for (const team of BAG_TEAMS) fill(team, target[team])

    resolution = resolveSetup(playerCount, all(), choices)
    if (same(resolution.composition, target)) break
    target = resolution.composition
  }

  const shortfall: DealResult['shortfall'] = []
  for (const team of BAG_TEAMS) {
    const missing = resolution.composition[team] - pickedByTeam[team].length
    if (missing > 0) shortfall.push({ team, missing })
  }

  return { characterIds: all(), resolution, shortfall }
}

/**
 * The three good characters not in play that the Demon is shown as bluffs.
 *
 * Returned in a sensible order rather than at random: characters that wake on
 * the first night make the safest bluffs, because the player can claim to have
 * received information. Characters whose presence is obvious to the town, like
 * the Saint, make poor ones.
 */
export function bluffCandidates(script: Script, inPlayIds: readonly string[]): Character[] {
  const inPlay = new Set(inPlayIds)
  return scriptCharacters(script)
    .filter(
      (c) =>
        !inPlay.has(c.id) &&
        (c.team === 'townsfolk' || c.team === 'outsider') &&
        !SETUP_MODIFIERS[c.id]?.wipe,
    )
    .sort((a, b) => {
      const score = (c: Character) =>
        (c.firstNight > 0 ? -2 : 0) + (c.team === 'outsider' ? 1 : 0)
      return score(a) - score(b) || a.name.localeCompare(b.name)
    })
}

export function pickBluffs(
  script: Script,
  inPlayIds: readonly string[],
  rng: Rng = Math.random,
): string[] {
  const candidates = bluffCandidates(script, inPlayIds)
  // Prefer the stronger half, then choose within it, so bluffs are varied but
  // rarely actively bad.
  const strong = candidates.slice(0, Math.max(3, Math.ceil(candidates.length / 2)))
  return shuffle(strong, rng).slice(0, 3).map((c) => c.id)
}

/**
 * A setup chosen for a Storyteller's first time on a script, in the order to
 * add characters as the table grows.
 *
 * Every pick here asks nothing of the Storyteller mid-game: no drunkenness to
 * track, no characters that make them improvise a death or an alignment. Good
 * gets steady information and enough protection to survive the script's
 * death rate; evil gets a kill that ignores protection and a way to save a
 * Minion. Each list is long enough for fifteen players.
 */
const FIRST_GAME: Record<string, Record<BagTeam, string[]>> = {
  bmr: {
    townsfolk: ['grandmother', 'sailor', 'chambermaid', 'exorcist', 'innkeeper', 'professor', 'fool', 'gambler', 'tealady'],
    outsider: ['tinker', 'moonchild'],
    minion: ['assassin', 'devilsadvocate', 'mastermind'],
    demon: ['pukka'],
  },
}

/** The first-game setup for this script and table size, or null if the script has none. */
export function firstGameSetup(script: Script, playerCount: number): string[] | null {
  const onScript = new Set(scriptCharacters(script).map((c) => c.id))
  const target = baseComposition(playerCount)
  for (const lists of Object.values(FIRST_GAME)) {
    const picked: string[] = []
    for (const team of BAG_TEAMS) {
      const ids = lists[team].slice(0, target[team])
      if (ids.length < target[team] || ids.some((id) => !onScript.has(id))) {
        picked.length = 0
        break
      }
      picked.push(...ids)
    }
    if (picked.length === playerCount) return picked
  }
  return null
}
