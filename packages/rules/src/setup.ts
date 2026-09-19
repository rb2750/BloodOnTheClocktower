import { baseComposition, compositionTotal } from './composition.js'
import { getCharacter } from './data.js'
import {
  SETUP_MODIFIERS,
  applyDelta,
  type CompositionDelta,
  type SetupChoiceOption,
} from './setup-modifiers.js'
import type { BagTeam, Composition } from './types.js'

export type PendingChoice = {
  characterId: string
  characterName: string
  prompt: string
  options: SetupChoiceOption[]
}

export type SetupNote = { characterId: string; characterName: string; note: string }

export type SetupResolution = {
  /** The published table row for this player count. */
  base: Composition
  /** Seats to deal after every modifier the solver could apply. */
  composition: Composition
  /** Which team's token each seat actually receives. */
  bag: Composition
  /** Choices the Storyteller must make before the count is definite. */
  pendingChoices: PendingChoice[]
  /** Cases the solver deliberately refuses to guess. */
  unresolved: SetupNote[]
  /** Characters dragged into play by another character. */
  forced: { by: string; characterId: string; characterName: string }[]
  /** Seating requirements the deal must honour. */
  seating: (SetupNote & { constraint: 'neighbours-demon' | 'evil-line' })[]
  /** Players who will hold a token that is not their real character. */
  disguised: (SetupNote & { coverTeam: BagTeam })[]
  /** Characters that may appear more than once. */
  duplicates: SetupNote[]
  /** Everything the Storyteller should read before starting. */
  notes: SetupNote[]
  /** True when the counts add up and nothing is left open. */
  settled: boolean
  problems: string[]
}

export type SetupChoices = Record<string, number>

/**
 * Work out what a game of `playerCount` players actually needs, given the
 * characters currently selected.
 *
 * The solver applies everything it can determine and is explicit about
 * everything it cannot. It never guesses at an open-ended modifier: a
 * confidently wrong setup is worse for a Storyteller than an honest gap.
 */
export function resolveSetup(
  playerCount: number,
  inPlayIds: readonly string[],
  choices: SetupChoices = {},
): SetupResolution {
  const base = baseComposition(playerCount)
  let composition = { ...base }

  const pendingChoices: PendingChoice[] = []
  const unresolved: SetupNote[] = []
  const forced: SetupResolution['forced'] = []
  const seating: SetupResolution['seating'] = []
  const disguised: SetupResolution['disguised'] = []
  const duplicates: SetupNote[] = []
  const notes: SetupNote[] = []
  const problems: string[] = []

  // Forced inclusions can themselves be setup-modifying, so resolve the closure
  // before applying anything.
  const active = new Set(inPlayIds)
  for (let pass = 0; pass < 4; pass++) {
    let added = false
    for (const id of [...active]) {
      for (const forcedId of SETUP_MODIFIERS[id]?.forces ?? []) {
        if (!active.has(forcedId)) {
          active.add(forcedId)
          added = true
        }
        if (!forced.some((f) => f.characterId === forcedId)) {
          forced.push({
            by: id,
            characterId: forcedId,
            characterName: getCharacter(forcedId)?.name ?? forcedId,
          })
        }
      }
    }
    if (!added) break
  }

  const named = (id: string) => ({
    characterId: id,
    characterName: getCharacter(id)?.name ?? id,
  })

  // Fixed deltas and Storyteller choices.
  const wipes: ('evil' | 'demon')[] = []
  for (const id of active) {
    const mod = SETUP_MODIFIERS[id]
    if (!mod) continue

    notes.push({ ...named(id), note: mod.note })

    if (mod.delta) composition = applyDelta(composition, mod.delta)

    if (mod.choice) {
      const picked = choices[id]
      const option = picked === undefined ? undefined : mod.choice.options[picked]
      if (option) {
        composition = applyDelta(composition, option.delta)
      } else {
        pendingChoices.push({
          ...named(id),
          prompt: mod.choice.prompt,
          options: mod.choice.options,
        })
      }
    }

    if (mod.open) unresolved.push({ ...named(id), note: mod.open.note })
    if (mod.bagDuplicate) duplicates.push({ ...named(id), note: mod.bagDuplicate.note })
    if (mod.seating) seating.push({ ...named(id), note: mod.note, constraint: mod.seating })
    if (mod.alignmentTwist) notes.push({ ...named(id), note: mod.alignmentTwist.note })
    if (mod.wipe) wipes.push(mod.wipe)
  }

  // Wipes run last: they absorb whatever the deltas produced.
  if (wipes.includes('evil')) {
    composition = {
      townsfolk: composition.townsfolk + composition.minion + composition.demon,
      outsider: composition.outsider,
      minion: 0,
      demon: 0,
    }
  } else if (wipes.includes('demon')) {
    composition = {
      ...composition,
      townsfolk: composition.townsfolk + composition.demon,
      demon: 0,
    }
  }

  // The bag differs from the composition wherever a token is withheld.
  const bag = { ...composition }
  for (const id of active) {
    const mod = SETUP_MODIFIERS[id]
    const cover = mod?.bagDisabled?.coverTeam
    if (!cover) continue
    const own = getCharacter(id)?.team
    if (own !== 'townsfolk' && own !== 'outsider' && own !== 'minion' && own !== 'demon') {
      continue
    }
    // A 'good' cover means either good team; Townsfolk is the usual choice and
    // the Storyteller can move it afterwards.
    const coverTeam: BagTeam = cover === 'good' ? 'townsfolk' : cover
    bag[own] -= 1
    bag[coverTeam] += 1
    disguised.push({ ...named(id), note: mod!.note, coverTeam })
  }

  // A modifier cannot take a team below zero. The Vigormortis removes an
  // Outsider, but at seven, ten or thirteen players there are none to remove,
  // so its effect is simply not applied rather than producing a negative count.
  // Townsfolk are the pool everything else is traded against, so a negative
  // Townsfolk count is a genuinely impossible selection and is reported.
  for (const team of ['outsider', 'minion', 'demon'] as const) {
    if (composition[team] < 0) {
      const excess = -composition[team]
      composition[team] = 0
      composition.townsfolk -= excess
      notes.push({
        characterId: '',
        characterName: 'Setup',
        note: `There were not enough ${team === 'outsider' ? 'Outsiders' : team + 's'} to remove, so that part of the setup change does not apply.`,
      })
    }
  }

  for (const [team, n] of Object.entries(composition)) {
    if (n < 0) problems.push(`${team} count went negative (${n}); the selection is impossible.`)
  }
  const total = compositionTotal(composition)
  if (total !== playerCount) {
    problems.push(
      `The counts add up to ${total} but there are ${playerCount} players. Adjust the open values by hand.`,
    )
  }

  return {
    base,
    composition,
    bag,
    pendingChoices,
    unresolved,
    forced,
    seating,
    disguised,
    duplicates,
    notes,
    settled: pendingChoices.length === 0 && unresolved.length === 0 && problems.length === 0,
    problems,
  }
}

/** Every setup-modifying character currently selected, for the warning badges. */
export function setupModifiersInPlay(inPlayIds: readonly string[]): string[] {
  return inPlayIds.filter((id) => getCharacter(id)?.setup)
}

/** Jinxed pairs among the selected characters, surfaced at selection time. */
export function jinxesInPlay(
  inPlayIds: readonly string[],
): { a: string; b: string; reason: string }[] {
  const set = new Set(inPlayIds)
  const out: { a: string; b: string; reason: string }[] = []
  const seen = new Set<string>()
  for (const id of inPlayIds) {
    for (const j of getCharacter(id)?.jinxes ?? []) {
      if (!set.has(j.with)) continue
      const key = [id, j.with].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ a: id, b: j.with, reason: j.reason })
    }
  }
  return out
}

export type { CompositionDelta }
