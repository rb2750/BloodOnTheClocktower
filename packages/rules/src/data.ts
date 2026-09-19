import charactersJson from '../data/characters.json' with { type: 'json' }
import stepsJson from '../data/steps.json' with { type: 'json' }
import provenanceJson from '../data/provenance.json' with { type: 'json' }
import type { Character, NightStep, Team } from './types.js'

export const CHARACTERS = charactersJson as unknown as Character[]
export const NIGHT_STEPS = stepsJson as unknown as NightStep[]
export const PROVENANCE = provenanceJson as {
  fetchedAt: string
  source: string
  notice: string
  sha256: Record<string, string>
  counts: Record<string, number>
}

const BY_ID = new Map<string, Character>(CHARACTERS.map((c) => [c.id, c]))
const STEP_BY_ID = new Map<string, NightStep>(NIGHT_STEPS.map((s) => [s.id, s]))

export function getCharacter(id: string): Character | undefined {
  return BY_ID.get(id)
}

export function getStep(id: string): NightStep | undefined {
  return STEP_BY_ID.get(id)
}

/** True for `dusk`, `minioninfo`, `demoninfo` and `dawn`. */
export function isNightStep(id: string): boolean {
  return STEP_BY_ID.has(id)
}

export function charactersByTeam(team: Team): Character[] {
  return CHARACTERS.filter((c) => c.team === team)
}

/** The official editions, in the order they were published. */
export const EDITIONS = [
  { id: 'tb', name: 'Trouble Brewing', level: 'Beginner' },
  { id: 'bmr', name: 'Bad Moon Rising', level: 'Intermediate' },
  { id: 'snv', name: 'Sects & Violets', level: 'Advanced' },
  { id: 'carousel', name: 'Experimental', level: 'Experimental' },
  { id: 'fabled', name: 'Fabled', level: 'Storyteller' },
  { id: 'loric', name: 'Loric', level: 'Storyteller' },
] as const

export function charactersByEdition(edition: string): Character[] {
  return CHARACTERS.filter((c) => c.edition === edition)
}

/**
 * Filename for a character's art, relative to the art root.
 *
 * Probed against the official asset host: Fabled and Loric have a single plain
 * file, every other team has `_g` and `_e` variants, and Travellers additionally
 * have an unaligned plain file. The rule is exact across all 181 characters.
 */
export function artFile(c: Character, variant: 'g' | 'e' | 'neutral' = 'g'): string {
  const flat = c.team === 'fabled' || c.team === 'loric'
  if (flat || (variant === 'neutral' && c.team === 'traveller')) {
    return `${c.edition}/${c.id}.webp`
  }
  return `${c.edition}/${c.id}_${variant === 'neutral' ? 'g' : variant}.webp`
}

/**
 * Art is served from the app's own origin so it is precached and works offline.
 * `scripts/fetch-art.ts` downloads it at build time; the files are not committed.
 */
export const ART_ROOT = 'art'

export function characterArt(c: Character, variant: 'g' | 'e' | 'neutral' = 'g'): string {
  return `${ART_ROOT}/${artFile(c, variant)}`
}
