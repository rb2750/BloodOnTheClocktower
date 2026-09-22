import { describe, expect, it } from 'vitest'
import { dealCharacters, firstGameSetup, seededRng, pickBluffs, shuffle } from '../src/deal.js'
import { editionScript, parseScript, serialiseScript, scriptCharacter } from '../src/script.js'
import { baseComposition, compositionTotal } from '../src/composition.js'
import { getCharacter } from '../src/data.js'
import type { BagTeam } from '../src/types.js'

const TB = editionScript('tb', 'Trouble Brewing')
const SNV = editionScript('snv', 'Sects & Violets')

function countByTeam(ids: readonly string[]): Record<BagTeam, number> {
  const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 } as Record<BagTeam, number>
  for (const id of ids) {
    const team = getCharacter(id)?.team
    if (team === 'townsfolk' || team === 'outsider' || team === 'minion' || team === 'demon') {
      counts[team] += 1
    }
  }
  return counts
}

describe('dealing', () => {
  it('deals exactly one character per seat for every player count', () => {
    for (let n = 5; n <= 15; n++) {
      for (let seed = 1; seed <= 12; seed++) {
        const deal = dealCharacters(TB, { playerCount: n, rng: seededRng(seed) })
        expect(deal.shortfall, `n=${n} seed=${seed}`).toEqual([])
        expect(new Set(deal.characterIds).size, `n=${n} seed=${seed} had duplicates`).toBe(
          deal.characterIds.length,
        )
        expect(deal.characterIds, `n=${n} seed=${seed}`).toHaveLength(n)
      }
    }
  })

  it('matches the resolved composition exactly', () => {
    for (let n = 5; n <= 15; n++) {
      for (let seed = 1; seed <= 12; seed++) {
        const deal = dealCharacters(TB, { playerCount: n, rng: seededRng(seed) })
        expect(countByTeam(deal.characterIds), `n=${n} seed=${seed}`).toEqual(
          deal.resolution.composition,
        )
        expect(compositionTotal(deal.resolution.composition)).toBe(n)
      }
    }
  })

  it('adjusts the Outsider count when the Baron is dealt', () => {
    // Force the Baron in and confirm the deal grows to four Outsiders.
    const deal = dealCharacters(TB, {
      playerCount: 12,
      rng: seededRng(7),
      required: ['baron'],
    })
    expect(deal.characterIds).toContain('baron')
    expect(deal.resolution.composition.outsider).toBe(4)
    expect(countByTeam(deal.characterIds).outsider).toBe(4)
    expect(deal.characterIds).toHaveLength(12)
  })

  it('never deals an excluded character', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const deal = dealCharacters(TB, {
        playerCount: 10,
        rng: seededRng(seed),
        excluded: ['imp'],
      })
      expect(deal.characterIds).not.toContain('imp')
    }
  })

  it('always deals a required character', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const deal = dealCharacters(TB, {
        playerCount: 9,
        rng: seededRng(seed),
        required: ['virgin', 'saint'],
      })
      expect(deal.characterIds).toContain('virgin')
      expect(deal.characterIds).toContain('saint')
    }
  })

  it('is deterministic for a given seed', () => {
    const a = dealCharacters(SNV, { playerCount: 11, rng: seededRng(99) })
    const b = dealCharacters(SNV, { playerCount: 11, rng: seededRng(99) })
    expect(a.characterIds).toEqual(b.characterIds)
  })

  it('handles Sects & Violets, whose Demons modify setup', () => {
    for (let n = 7; n <= 15; n++) {
      for (let seed = 1; seed <= 10; seed++) {
        const deal = dealCharacters(SNV, { playerCount: n, rng: seededRng(seed) })
        expect(deal.characterIds, `n=${n} seed=${seed}`).toHaveLength(n)
        expect(countByTeam(deal.characterIds)).toEqual(deal.resolution.composition)
      }
    }
  })

  it('reports a shortfall rather than dealing a short game', () => {
    const tiny = parseScript(['imp', 'poisoner', 'chef', 'empath', 'butler'])
    const deal = dealCharacters(tiny, { playerCount: 15, rng: seededRng(1) })
    expect(deal.shortfall.length).toBeGreaterThan(0)
  })
})

describe('demon bluffs', () => {
  it('only offers good characters that are not in play', () => {
    const deal = dealCharacters(TB, { playerCount: 10, rng: seededRng(3) })
    const bluffs = pickBluffs(TB, deal.characterIds, seededRng(3))
    expect(bluffs).toHaveLength(3)
    for (const id of bluffs) {
      expect(deal.characterIds).not.toContain(id)
      const team = getCharacter(id)!.team
      expect(['townsfolk', 'outsider']).toContain(team)
    }
    expect(new Set(bluffs).size).toBe(3)
  })
})

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f']
    const out = shuffle(input, seededRng(5))
    expect(out.slice().sort()).toEqual(input.slice().sort())
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})

describe('script import and export', () => {
  it('reads bare character ids', () => {
    const script = parseScript(['chef', 'empath', 'imp', 'poisoner', 'butler'])
    expect(script.characterIds).toEqual(['chef', 'empath', 'imp', 'poisoner', 'butler'])
    expect(script.warnings).toEqual([])
  })

  it('reads the _meta block', () => {
    const script = parseScript([
      { id: '_meta', name: 'Night Shift', author: 'Someone', bootlegger: ['A house rule.'] },
      'chef',
      'imp',
      'poisoner',
      'butler',
      'empath',
    ])
    expect(script.meta.name).toBe('Night Shift')
    expect(script.meta.author).toBe('Someone')
    expect(script.meta.bootlegger).toEqual(['A house rule.'])
  })

  it('reads the deprecated { id } object form', () => {
    const script = parseScript([{ id: 'chef' }, { id: 'imp' }, 'poisoner', 'butler', 'empath'])
    expect(script.characterIds).toContain('chef')
    expect(script.characterIds).toContain('imp')
  })

  it('reads homebrew characters and keeps them addressable', () => {
    const script = parseScript([
      'imp',
      'poisoner',
      'chef',
      'butler',
      {
        id: 'lamplighter',
        name: 'Lamplighter',
        team: 'townsfolk',
        ability: 'Each night, you learn whether a lamp is lit.',
        reminders: ['Lit'],
        firstNight: 40,
        firstNightReminder: 'Nod if the lamp is lit.',
      },
    ])
    expect(script.homebrew.lamplighter?.name).toBe('Lamplighter')
    expect(scriptCharacter(script, 'lamplighter')?.team).toBe('townsfolk')
    expect(scriptCharacter(script, 'chef')?.name).toBe('Chef')
  })

  it('normalises the American spelling of traveller', () => {
    const script = parseScript([
      'imp',
      'poisoner',
      'chef',
      'butler',
      { id: 'wanderer', name: 'Wanderer', team: 'traveler', ability: 'Wanders.' },
    ])
    expect(script.homebrew.wanderer?.team).toBe('traveller')
  })

  it('warns about unknown ids instead of failing the whole import', () => {
    const script = parseScript(['chef', 'nosuchcharacter', 'imp', 'poisoner', 'butler'])
    expect(script.characterIds).not.toContain('nosuchcharacter')
    expect(script.warnings.join(' ')).toContain('nosuchcharacter')
  })

  it('rejects a script with nothing recognisable in it', () => {
    expect(() => parseScript(['nope', 'alsonope'])).toThrow()
    expect(() => parseScript({ not: 'an array' })).toThrow()
  })

  it('round-trips through serialise and parse', () => {
    const original = parseScript([
      { id: '_meta', name: 'Round Trip' },
      'imp',
      'poisoner',
      'chef',
      'butler',
      {
        id: 'lamplighter',
        name: 'Lamplighter',
        team: 'townsfolk',
        ability: 'Each night, you learn whether a lamp is lit.',
      },
    ])
    const again = parseScript(serialiseScript(original))
    expect(again.meta.name).toBe('Round Trip')
    expect(again.characterIds).toEqual(original.characterIds)
    expect(again.homebrew.lamplighter?.ability).toBe(original.homebrew.lamplighter?.ability)
  })

  it('builds an edition script without Fabled or Loric', () => {
    expect(TB.characterIds).toContain('imp')
    expect(TB.characterIds).toContain('thief')
    for (const id of TB.characterIds) {
      expect(['fabled', 'loric']).not.toContain(getCharacter(id)!.team)
    }
  })
})

describe('firstGameSetup', () => {
  const bmr = editionScript('bmr', 'Bad Moon Rising')

  it('fills every Bad Moon Rising table from five to fifteen with the right counts', () => {
    for (let n = 5; n <= 15; n++) {
      const ids = firstGameSetup(bmr, n)!
      const want = baseComposition(n)
      const teams = ids.map((id) => getCharacter(id)!.team)
      expect(new Set(ids).size).toBe(n)
      for (const team of ['townsfolk', 'outsider', 'minion', 'demon'] as const) {
        expect(teams.filter((t) => t === team).length).toBe(want[team])
      }
      expect(ids).toContain('pukka')
    }
  })

  it('has nothing to offer a script it was not written for', () => {
    expect(firstGameSetup(editionScript('tb', 'Trouble Brewing'), 7)).toBeNull()
  })
})
