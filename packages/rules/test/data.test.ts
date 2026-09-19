import { describe, expect, it } from 'vitest'
import { CHARACTERS, NIGHT_STEPS, PROVENANCE, getCharacter, artFile } from '../src/data.js'
import { SETUP_MODIFIERS } from '../src/setup-modifiers.js'
import { nightSequence } from '../src/night-order.js'

/**
 * These guard the assumptions the whole engine rests on. If a future data
 * refresh from The Pandemonium Institute changes shape, these fail loudly
 * rather than the night order silently losing a character.
 */
describe('vendored official data', () => {
  it('has the expected roster size and team split', () => {
    expect(CHARACTERS).toHaveLength(181)
    const byTeam = CHARACTERS.reduce<Record<string, number>>((acc, c) => {
      acc[c.team] = (acc[c.team] ?? 0) + 1
      return acc
    }, {})
    expect(byTeam).toEqual({
      townsfolk: 69,
      outsider: 23,
      minion: 27,
      demon: 19,
      traveller: 18,
      fabled: 14,
      loric: 11,
    })
  })

  it('carries the four Storyteller pseudo-steps, which are absent from the roster', () => {
    expect(NIGHT_STEPS.map((s) => s.id).sort()).toEqual([
      'dawn',
      'demoninfo',
      'dusk',
      'minioninfo',
    ])
    for (const step of NIGHT_STEPS) {
      expect(getCharacter(step.id)).toBeUndefined()
    }
  })

  it('has a night position for every night reminder, and vice versa', () => {
    for (const c of CHARACTERS) {
      expect(Boolean(c.firstNightReminder)).toBe(c.firstNight > 0)
      expect(Boolean(c.otherNightReminder)).toBe(c.otherNight > 0)
    }
  })

  it('resolves every jinx to a real character, in both directions', () => {
    for (const c of CHARACTERS) {
      for (const j of c.jinxes) {
        const other = getCharacter(j.with)
        expect(other, `${c.id} jinxed with unknown ${j.with}`).toBeDefined()
        expect(
          other!.jinxes.some((back) => back.with === c.id),
          `${j.with} is missing the reverse jinx with ${c.id}`,
        ).toBe(true)
      }
    }
  })

  it('records 131 jinx pairs', () => {
    const pairs = new Set<string>()
    for (const c of CHARACTERS) {
      for (const j of c.jinxes) pairs.add([c.id, j.with].sort().join('|'))
    }
    expect(pairs.size).toBe(131)
  })

  it('has a setup modifier entry for all 25 setup-modifying characters', () => {
    const flagged = CHARACTERS.filter((c) => c.setup).map((c) => c.id).sort()
    expect(flagged).toHaveLength(25)
    for (const id of flagged) {
      expect(SETUP_MODIFIERS[id], `no setup modifier defined for "${id}"`).toBeDefined()
    }
  })

  it('does not define setup modifiers for characters that do not modify setup', () => {
    for (const id of Object.keys(SETUP_MODIFIERS)) {
      expect(getCharacter(id)?.setup, `"${id}" is not flagged setup in the data`).toBe(true)
    }
  })

  it('produces night sequences that contain dusk first and dawn near the end', () => {
    for (const isFirst of [true, false]) {
      const seq = nightSequence(isFirst)
      expect(seq[0]).toBe('dusk')
      expect(seq).toContain('dawn')
      expect(seq.indexOf('dawn')).toBeGreaterThan(seq.length - 4)
    }
  })

  it('uses the flat art filename only for Fabled and Loric', () => {
    for (const c of CHARACTERS) {
      const flat = c.team === 'fabled' || c.team === 'loric'
      expect(artFile(c).endsWith(`${c.id}.webp`)).toBe(flat)
    }
  })

  it('records provenance so the data source is auditable', () => {
    expect(PROVENANCE.source).toContain('ThePandemoniumInstitute/botc-release')
    expect(PROVENANCE.notice).toContain('Pandemonium Institute')
    expect(Object.keys(PROVENANCE.sha256)).toContain('roles')
  })
})
