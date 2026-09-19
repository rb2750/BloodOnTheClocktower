import { CHARACTERS, getCharacter } from './data.js'
import type { Character, Script, ScriptMeta, Team } from './types.js'

/**
 * A script file is a mixed array. Each entry is one of:
 *  - a bare string, which is an official character id
 *  - a `_meta` object carrying the script's name, author and order overrides
 *  - a full character object, which is homebrew (or an override of an official one)
 *  - a deprecated `{ id }` object referring to an official character
 *
 * This is the format the official Script Tool emits and every tool in the
 * ecosystem consumes, so it is the import and export format here too.
 */
export type ScriptEntry = string | Record<string, unknown>

const TEAMS: Team[] = [
  'townsfolk',
  'outsider',
  'minion',
  'demon',
  'traveller',
  'fabled',
  'loric',
]

export class ScriptParseError extends Error {}

function normaliseTeam(value: unknown): Team {
  const raw = String(value ?? '').toLowerCase()
  // Data descended from community tools spells this the American way.
  const fixed = raw === 'traveler' ? 'traveller' : raw
  if (!TEAMS.includes(fixed as Team)) {
    throw new ScriptParseError(`Unknown team "${raw}".`)
  }
  return fixed as Team
}

function homebrewFrom(entry: Record<string, unknown>): Character {
  const id = String(entry.id ?? '').trim()
  if (!id) throw new ScriptParseError('A character entry is missing its id.')
  const name = String(entry.name ?? id)
  const team = normaliseTeam(entry.team)
  const images = entry.image
  const image = Array.isArray(images) ? String(images[0] ?? '') : String(images ?? '')

  return {
    id,
    name,
    edition: String(entry.edition ?? 'homebrew'),
    team,
    ability: String(entry.ability ?? ''),
    flavor: String(entry.flavor ?? ''),
    setup: Boolean(entry.setup),
    reminders: Array.isArray(entry.reminders) ? entry.reminders.map(String) : [],
    remindersGlobal: Array.isArray(entry.remindersGlobal)
      ? entry.remindersGlobal.map(String)
      : [],
    firstNight: Number(entry.firstNight ?? 0),
    firstNightReminder: String(entry.firstNightReminder ?? ''),
    otherNight: Number(entry.otherNight ?? 0),
    otherNightReminder: String(entry.otherNightReminder ?? ''),
    special: Array.isArray(entry.special) ? (entry.special as Character['special']) : [],
    jinxes: Array.isArray(entry.jinxes)
      ? (entry.jinxes as { id: string; reason: string }[]).map((j) => ({
          with: j.id,
          reason: j.reason,
        }))
      : [],
    image,
  }
}

export type ParsedScript = Script & { warnings: string[] }

export function parseScript(input: unknown, fallbackName = 'Custom script'): ParsedScript {
  const entries: ScriptEntry[] = Array.isArray(input)
    ? (input as ScriptEntry[])
    : (() => {
        throw new ScriptParseError('A script must be a JSON array.')
      })()

  const warnings: string[] = []
  let meta: ScriptMeta = { id: '_meta', name: fallbackName }
  const characterIds: string[] = []
  const homebrew: Record<string, Character> = {}

  for (const entry of entries) {
    if (typeof entry === 'string') {
      const id = entry.trim()
      if (!getCharacter(id)) {
        warnings.push(`Unknown character id "${id}" was skipped.`)
        continue
      }
      if (!characterIds.includes(id)) characterIds.push(id)
      continue
    }

    if (!entry || typeof entry !== 'object') {
      warnings.push('A script entry was neither a string nor an object and was skipped.')
      continue
    }

    const id = String((entry as Record<string, unknown>).id ?? '')

    if (id === '_meta') {
      const m = entry as Record<string, unknown>
      meta = {
        id: '_meta',
        name: String(m.name ?? fallbackName),
        author: m.author ? String(m.author) : undefined,
        logo: m.logo ? String(m.logo) : undefined,
        almanac: m.almanac ? String(m.almanac) : undefined,
        bootlegger: Array.isArray(m.bootlegger) ? m.bootlegger.map(String) : undefined,
        firstNight: Array.isArray(m.firstNight) ? m.firstNight.map(String) : undefined,
        otherNight: Array.isArray(m.otherNight) ? m.otherNight.map(String) : undefined,
      }
      continue
    }

    // The deprecated `{ id }` form refers to an official character.
    const keys = Object.keys(entry as object)
    if (keys.length === 1 && keys[0] === 'id') {
      if (!getCharacter(id)) {
        warnings.push(`Unknown character id "${id}" was skipped.`)
        continue
      }
      if (!characterIds.includes(id)) characterIds.push(id)
      continue
    }

    try {
      const character = homebrewFrom(entry as Record<string, unknown>)
      homebrew[character.id] = character
      if (!characterIds.includes(character.id)) characterIds.push(character.id)
    } catch (err) {
      warnings.push(err instanceof ScriptParseError ? err.message : String(err))
    }
  }

  if (characterIds.length === 0) {
    throw new ScriptParseError('That script contains no recognisable characters.')
  }

  return { meta, characterIds, homebrew, warnings }
}

/** Serialise back to the interchange format, so scripts round-trip. */
export function serialiseScript(script: Script): ScriptEntry[] {
  const out: ScriptEntry[] = [
    {
      id: '_meta',
      name: script.meta.name,
      ...(script.meta.author ? { author: script.meta.author } : {}),
      ...(script.meta.logo ? { logo: script.meta.logo } : {}),
      ...(script.meta.almanac ? { almanac: script.meta.almanac } : {}),
      ...(script.meta.bootlegger ? { bootlegger: script.meta.bootlegger } : {}),
      ...(script.meta.firstNight ? { firstNight: script.meta.firstNight } : {}),
      ...(script.meta.otherNight ? { otherNight: script.meta.otherNight } : {}),
    },
  ]
  for (const id of script.characterIds) {
    const hb = script.homebrew[id]
    out.push(hb ? serialiseHomebrew(hb) : id)
  }
  return out
}

function serialiseHomebrew(c: Character): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    team: c.team,
    ability: c.ability,
    ...(c.image ? { image: c.image } : {}),
    ...(c.flavor ? { flavor: c.flavor } : {}),
    ...(c.setup ? { setup: true } : {}),
    ...(c.reminders.length ? { reminders: c.reminders } : {}),
    ...(c.firstNight ? { firstNight: c.firstNight, firstNightReminder: c.firstNightReminder } : {}),
    ...(c.otherNight ? { otherNight: c.otherNight, otherNightReminder: c.otherNightReminder } : {}),
  }
}

/** Look a character up in a script, falling back to the official roster. */
export function scriptCharacter(script: Script, id: string): Character | undefined {
  return script.homebrew[id] ?? getCharacter(id)
}

export function scriptCharacters(script: Script): Character[] {
  return script.characterIds
    .map((id) => scriptCharacter(script, id))
    .filter((c): c is Character => Boolean(c))
}

/** Build a script from an official edition. */
export function editionScript(edition: string, name: string): Script {
  return {
    meta: { id: '_meta', name },
    characterIds: CHARACTERS.filter(
      (c) => c.edition === edition && c.team !== 'fabled' && c.team !== 'loric',
    ).map((c) => c.id),
    homebrew: {},
  }
}
