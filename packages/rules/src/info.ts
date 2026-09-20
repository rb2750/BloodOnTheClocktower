import type { Character, Team } from './types.js'

/**
 * What a character learns, read out of the official night reminder.
 *
 * The Pandemonium Institute's reminders already say the shape in plain words:
 * "Give a finger signal" is a number, "Nod or shake your head" is yes or no,
 * "Show the Townsfolk character token. Point to both…" is a character and two
 * players. Reading it from the data rather than writing it out per character
 * means a refresh cannot leave this quietly disagreeing with the night sheet,
 * and the test suite re-checks the whole roster.
 *
 * Anything that does not match is not forced into a shape. The Storyteller
 * writes those in their own words, which is what they do today.
 */
export type InfoShape =
  | { kind: 'none' }
  | { kind: 'number' }
  | { kind: 'yesNo' }
  /** One character token, eg the Undertaker's execution or the Ravenkeeper's. */
  | { kind: 'character' }
  /** Two players and a character of one team: Washerwoman, Librarian, Investigator. */
  | { kind: 'pair'; team: Team }

const PAIR = /Show the (Townsfolk|Outsider|Minion) character token\.\s*Point to both/i
const ONE_CHARACTER = /show (?:their|that player's) character token/i
const NUMBER = /give a finger signal/i
const YES_NO = /\bnod\b|shake your head/i

function reminders(character: Character): string {
  return [character.firstNightReminder, character.otherNightReminder].filter(Boolean).join(' ')
}

/**
 * Characters shown the Grimoire itself rather than told something: the Spy and
 * the Widow. Read from the same reminders as everything else, so a script that
 * adds another is covered without a list here.
 */
export function seesGrimoire(character: Character): boolean {
  return /show the grimoire/i.test(reminders(character))
}

export function infoShape(character: Character): InfoShape {
  const text = reminders(character)
  const pair = PAIR.exec(text)
  if (pair) return { kind: 'pair', team: pair[1]!.toLowerCase() as Team }
  if (ONE_CHARACTER.test(text)) return { kind: 'character' }
  if (NUMBER.test(text)) return { kind: 'number' }
  if (YES_NO.test(text)) return { kind: 'yesNo' }
  return { kind: 'none' }
}

/**
 * The sentence the player reads.
 *
 * The shape says what to ask for; the wording is per character, because "1"
 * on its own tells a player nothing and every one of these has a phrase the
 * game already uses at the table. A character with a shape but no phrase still
 * works: it falls back to the plain parts, and the Storyteller can edit it.
 */
export type InfoParts = {
  players?: string[]
  character?: string
  number?: number
  yes?: boolean
}

type Phrase = (p: InfoParts) => string

const one = (p: InfoParts, i: number) => p.players?.[i] ?? '…'
const some = (n: number | undefined) => (n === undefined ? '…' : String(n))
const pairPhrase: Phrase = (p) =>
  `One of ${one(p, 0)} and ${one(p, 1)} is the ${p.character ?? '…'}.`

const PHRASES: Record<string, Phrase> = {
  washerwoman: pairPhrase,
  librarian: (p) =>
    p.character === 'none'
      ? 'There are no Outsiders in play.'
      : pairPhrase(p),
  investigator: pairPhrase,
  chef: (p) =>
    `${some(p.number)} pair${p.number === 1 ? '' : 's'} of evil players are sitting next to each other.`,
  empath: (p) =>
    `${some(p.number)} of your living neighbours ${p.number === 1 ? 'is' : 'are'} evil.`,
  fortuneteller: (p) => (p.yes ? 'Yes, one of them is the Demon.' : 'No.'),
  undertaker: (p) => `The ${p.character ?? '…'} was executed today.`,
  ravenkeeper: (p) => `${one(p, 0)} is the ${p.character ?? '…'}.`,
  clockmaker: (p) => `The Demon is ${some(p.number)} steps from the nearest Minion.`,
  oracle: (p) => `${some(p.number)} of the dead players are evil.`,
  juggler: (p) => `${some(p.number)} of your guesses were correct.`,
  chambermaid: (p) =>
    `${some(p.number)} of the players you chose woke tonight to use their ability.`,
  mathematician: (p) => `${some(p.number)} abilities did not work as they should have.`,
  flowergirl: (p) => (p.yes ? 'Yes, the Demon voted today.' : 'No, the Demon did not vote today.'),
  towncrier: (p) => (p.yes ? 'Yes, a Minion nominated today.' : 'No Minion nominated today.'),
  seamstress: (p) => (p.yes ? 'Yes, they are the same alignment.' : 'No, they are not the same alignment.'),
  grandmother: (p) => `${one(p, 0)} is the ${p.character ?? '…'}.`,
  barista: (p) => `${some(p.number)}.`,
}

export function infoPhrase(characterId: string, parts: InfoParts): string {
  const phrase = PHRASES[characterId]
  if (phrase) return phrase(parts)
  // No wording written for this one, so say the parts plainly rather than
  // inventing a sentence the game does not use.
  const bits = [
    parts.players?.join(' and '),
    parts.character,
    parts.number === undefined ? undefined : String(parts.number),
    parts.yes === undefined ? undefined : parts.yes ? 'Yes' : 'No',
  ].filter(Boolean)
  return bits.join(' · ')
}

/** Characters this can compose a sentence for, for tests and for the UI. */
export function hasPhrase(characterId: string): boolean {
  return characterId in PHRASES
}
