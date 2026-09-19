import { describe, expect, it } from 'vitest'
import { CHARACTERS, getCharacter, hasPhrase, infoPhrase, infoShape } from '../src/index.js'

const shapeOf = (id: string) => infoShape(getCharacter(id)!)

describe('what a character learns', () => {
  it('reads two players and a character from the pair reminders', () => {
    expect(shapeOf('washerwoman')).toEqual({ kind: 'pair', team: 'townsfolk' })
    expect(shapeOf('librarian')).toEqual({ kind: 'pair', team: 'outsider' })
    expect(shapeOf('investigator')).toEqual({ kind: 'pair', team: 'minion' })
  })

  it('reads a finger signal as a number', () => {
    for (const id of ['chef', 'empath', 'clockmaker', 'oracle', 'juggler', 'chambermaid']) {
      expect(shapeOf(id), id).toEqual({ kind: 'number' })
    }
  })

  it('reads a nod as yes or no', () => {
    for (const id of ['fortuneteller', 'flowergirl', 'towncrier', 'seamstress']) {
      expect(shapeOf(id), id).toEqual({ kind: 'yesNo' })
    }
  })

  it('reads a shown token as one character', () => {
    expect(shapeOf('undertaker')).toEqual({ kind: 'character' })
    expect(shapeOf('ravenkeeper')).toEqual({ kind: 'character' })
  })

  it('leaves everything else to the Storyteller', () => {
    // These wake someone, but what they are told is a judgement or an exchange,
    // and forcing them into a shape would put words in the Storyteller's mouth.
    for (const id of ['spy', 'imp', 'poisoner', 'butler', 'eviltwin', 'pithag']) {
      expect(shapeOf(id), id).toEqual({ kind: 'none' })
    }
  })

  it('never claims a shape for a character with no night reminder at all', () => {
    for (const c of CHARACTERS) {
      if (c.firstNightReminder || c.otherNightReminder) continue
      expect(infoShape(c), c.id).toEqual({ kind: 'none' })
    }
  })
})

describe('the sentence a player reads', () => {
  it('names both players and the character', () => {
    expect(infoPhrase('washerwoman', { players: ['Finn', 'Cara'], character: 'Monk' })).toBe(
      'One of Finn and Cara is the Monk.',
    )
  })

  it('agrees with itself about number', () => {
    expect(infoPhrase('empath', { number: 1 })).toBe('1 of your living neighbours is evil.')
    expect(infoPhrase('empath', { number: 2 })).toBe('2 of your living neighbours are evil.')
    expect(infoPhrase('chef', { number: 1 })).toContain('1 pair of evil players')
    expect(infoPhrase('chef', { number: 0 })).toContain('0 pairs of evil players')
  })

  it('says yes or no in the character’s own terms', () => {
    expect(infoPhrase('fortuneteller', { yes: true })).toBe('Yes, one of them is the Demon.')
    expect(infoPhrase('towncrier', { yes: false })).toBe('No Minion nominated today.')
  })

  it('falls back to the parts rather than inventing a sentence', () => {
    expect(infoPhrase('some_unknown_character', { players: ['Finn'], number: 2 })).toBe('Finn · 2')
  })

  it('has wording for every base-script character it claims a shape for', () => {
    const missing = CHARACTERS.filter(
      (c) =>
        ['tb', 'bmr', 'snv'].includes(c.edition) &&
        infoShape(c).kind !== 'none' &&
        !hasPhrase(c.id),
    ).map((c) => c.id)
    expect(missing).toEqual([])
  })
})
