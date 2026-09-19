import { describe, expect, it } from 'vitest'
import {
  baseComposition,
  compositionTable,
  compositionTotal,
  isTeensyville,
  requiredTravellers,
} from '../src/composition.js'
import { resolveSetup, jinxesInPlay } from '../src/setup.js'
import { CHARACTERS } from '../src/data.js'

describe('composition table', () => {
  it('matches the official table for every published row', () => {
    expect(compositionTable()).toEqual([
      { players: 5, composition: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 } },
      { players: 6, composition: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 } },
      { players: 7, composition: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 } },
      { players: 8, composition: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 } },
      { players: 9, composition: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 } },
      { players: 10, composition: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 } },
      { players: 11, composition: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 } },
      { players: 12, composition: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 } },
      { players: 13, composition: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 } },
      { players: 14, composition: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 } },
      { players: 15, composition: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 } },
    ])
  })

  it('always totals the player count from 5 to 15', () => {
    for (let n = 5; n <= 15; n++) {
      expect(compositionTotal(baseComposition(n)), `${n} players`).toBe(n)
    }
  })

  it('always has exactly one Demon at setup', () => {
    for (let n = 5; n <= 15; n++) expect(baseComposition(n).demon).toBe(1)
  })

  it('treats 16 to 20 players as the 15 row plus Travellers', () => {
    for (let n = 16; n <= 20; n++) {
      expect(baseComposition(n)).toEqual(baseComposition(15))
      expect(requiredTravellers(n)).toBe(n - 15)
    }
    expect(requiredTravellers(12)).toBe(0)
  })

  it('rejects fewer than five players', () => {
    expect(() => baseComposition(4)).toThrow(RangeError)
  })

  it('identifies Teensyville', () => {
    expect(isTeensyville(5)).toBe(true)
    expect(isTeensyville(6)).toBe(true)
    expect(isTeensyville(7)).toBe(false)
  })
})

describe('setup solver', () => {
  it('leaves the composition alone when nothing modifies setup', () => {
    const r = resolveSetup(12, ['imp', 'poisoner', 'baron'].slice(0, 2).concat(['chef']))
    expect(r.composition).toEqual(r.base)
  })

  it('applies the Baron: two extra Outsiders replacing two Townsfolk', () => {
    const r = resolveSetup(12, ['imp', 'baron', 'poisoner', 'chef'])
    expect(r.composition).toEqual({ townsfolk: 5, outsider: 4, minion: 2, demon: 1 })
    expect(compositionTotal(r.composition)).toBe(12)
    expect(r.settled).toBe(true)
  })

  it('applies the Fang Gu and Vigormortis Outsider deltas', () => {
    expect(resolveSetup(12, ['fanggu']).composition).toEqual({
      townsfolk: 6,
      outsider: 3,
      minion: 2,
      demon: 1,
    })
    expect(resolveSetup(12, ['vigormortis']).composition).toEqual({
      townsfolk: 8,
      outsider: 1,
      minion: 2,
      demon: 1,
    })
  })

  it('asks the Storyteller to choose for the Godfather, and honours the answer', () => {
    const pending = resolveSetup(12, ['godfather'])
    expect(pending.settled).toBe(false)
    expect(pending.pendingChoices).toHaveLength(1)
    expect(pending.pendingChoices[0]!.characterId).toBe('godfather')

    const fewer = resolveSetup(12, ['godfather'], { godfather: 0 })
    expect(fewer.composition.outsider).toBe(1)
    expect(fewer.settled).toBe(true)

    const more = resolveSetup(12, ['godfather'], { godfather: 1 })
    expect(more.composition.outsider).toBe(3)
    expect(compositionTotal(more.composition)).toBe(12)
  })

  it('keeps the seat count level for Lil’ Monsta by trading the Demon for a Minion', () => {
    const r = resolveSetup(10, ['lilmonsta'], {})
    expect(r.composition).toEqual({ townsfolk: 7, outsider: 0, minion: 3, demon: 0 })
    expect(compositionTotal(r.composition)).toBe(10)
  })

  it('removes the whole evil team for the Atheist', () => {
    const r = resolveSetup(12, ['atheist'])
    expect(r.composition).toEqual({ townsfolk: 10, outsider: 2, minion: 0, demon: 0 })
    expect(compositionTotal(r.composition)).toBe(12)
  })

  it('starts the Summoner game with no Demon', () => {
    const r = resolveSetup(12, ['summoner'])
    expect(r.composition.demon).toBe(0)
    expect(r.composition.townsfolk).toBe(8)
    expect(compositionTotal(r.composition)).toBe(12)
  })

  it('pulls the Damsel in for the Huntsman and the King for the Choirboy', () => {
    const huntsman = resolveSetup(12, ['huntsman'])
    expect(huntsman.forced.map((f) => f.characterId)).toContain('damsel')

    const choirboy = resolveSetup(12, ['choirboy'])
    expect(choirboy.forced.map((f) => f.characterId)).toContain('king')
  })

  it('swaps the bag token but not the slot for the Drunk', () => {
    const r = resolveSetup(12, ['drunk'])
    // The Drunk still occupies an Outsider slot...
    expect(r.composition).toEqual(r.base)
    // ...but the player draws a Townsfolk token instead.
    expect(r.bag.outsider).toBe(r.composition.outsider - 1)
    expect(r.bag.townsfolk).toBe(r.composition.townsfolk + 1)
    expect(r.disguised.map((d) => d.characterId)).toContain('drunk')
  })

  it('does the same for the Marionette, and records the seating constraint', () => {
    const r = resolveSetup(12, ['marionette'])
    expect(r.bag.minion).toBe(r.composition.minion - 1)
    expect(r.bag.townsfolk).toBe(r.composition.townsfolk + 1)
    expect(r.seating.map((s) => s.constraint)).toContain('neighbours-demon')
  })

  it('refuses to guess the open-ended modifiers, and says so', () => {
    for (const id of ['kazali', 'xaan', 'lordoftyphon', 'legion']) {
      const r = resolveSetup(12, [id])
      expect(r.settled, `${id} should not settle silently`).toBe(false)
      expect(r.unresolved.map((u) => u.characterId)).toContain(id)
      expect(r.unresolved[0]!.note.length).toBeGreaterThan(20)
    }
  })

  it('records the Lord of Typhon evil-line seating constraint', () => {
    const r = resolveSetup(12, ['lordoftyphon'])
    expect(r.seating.map((s) => s.constraint)).toContain('evil-line')
  })

  it('flags the Bounty Hunter alignment twist without changing counts', () => {
    const r = resolveSetup(12, ['bountyhunter'])
    expect(r.composition).toEqual(r.base)
    expect(r.notes.some((n) => n.note.includes('evil'))).toBe(true)
  })

  it('reports a problem rather than producing a negative count', () => {
    // At five players there are only three Townsfolk to give away, and these
    // three modifiers between them want to take four.
    const r = resolveSetup(5, ['baron', 'fanggu', 'lordoftyphon'])
    expect(r.composition.townsfolk).toBeLessThan(0)
    expect(r.problems.length).toBeGreaterThan(0)
    expect(r.problems.join(' ')).toContain('negative')
    expect(r.settled).toBe(false)
  })

  it('keeps every setup-modifying character solvable or explicitly unresolved', () => {
    for (const c of CHARACTERS.filter((x) => x.setup)) {
      const r = resolveSetup(12, [c.id])
      const accountedFor =
        r.settled ||
        r.pendingChoices.length > 0 ||
        r.unresolved.length > 0 ||
        r.problems.length > 0
      expect(accountedFor, `${c.id} produced no guidance at all`).toBe(true)
    }
  })
})

describe('jinxes', () => {
  it('finds a jinx between two selected characters exactly once', () => {
    // The Spy and the Damsel are a real jinxed pair in the official data.
    // Note there are no jinxes internal to Trouble Brewing at all.
    const found = jinxesInPlay(['spy', 'damsel', 'chef'])
    expect(found).toHaveLength(1)
    expect([found[0]!.a, found[0]!.b].sort()).toEqual(['damsel', 'spy'])
    expect(found[0]!.reason.length).toBeGreaterThan(10)
  })

  it('ignores jinxes where only one side is in play', () => {
    expect(jinxesInPlay(['spy'])).toEqual([])
    expect(jinxesInPlay(['spy', 'chef', 'empath'])).toEqual([])
  })
})
