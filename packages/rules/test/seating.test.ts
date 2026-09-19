import { describe, expect, it } from 'vitest'
import { checkSeating } from '../src/seating.js'

const seat = (id: string, characterId: string, extra: Partial<Parameters<typeof checkSeating>[0][number]> = {}) => ({
  id,
  name: id,
  characterId,
  ...extra,
})

describe('seating rules', () => {
  it('is satisfied when the Marionette neighbours the Demon', () => {
    const seats = [
      seat('a', 'imp'),
      seat('b', 'washerwoman', { trueCharacterId: 'marionette' }),
      seat('c', 'chef'),
      seat('d', 'empath'),
      seat('e', 'poisoner'),
    ]
    expect(checkSeating(seats)).toEqual([])
  })

  it('warns when the Marionette is moved away from the Demon', () => {
    const seats = [
      seat('a', 'imp'),
      seat('c', 'chef'),
      seat('b', 'washerwoman', { trueCharacterId: 'marionette' }),
      seat('d', 'empath'),
      seat('e', 'poisoner'),
    ]
    const warnings = checkSeating(seats)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.seatId).toBe('b')
    expect(warnings[0]?.message).toMatch(/next to the Demon/)
  })

  it('wraps around the end of the circle', () => {
    const seats = [
      seat('b', 'washerwoman', { trueCharacterId: 'marionette' }),
      seat('c', 'chef'),
      seat('d', 'empath'),
      seat('e', 'poisoner'),
      seat('a', 'imp'),
    ]
    expect(checkSeating(seats)).toEqual([])
  })

  it('ignores Travellers when counting neighbours', () => {
    const seats = [
      seat('a', 'imp'),
      seat('t', 'thief', { isTraveller: true }),
      seat('b', 'washerwoman', { trueCharacterId: 'marionette' }),
      seat('c', 'chef'),
      seat('d', 'empath'),
      seat('e', 'poisoner'),
    ]
    expect(checkSeating(seats)).toEqual([])
  })

  it('needs the evil line centred on the Lord of Typhon', () => {
    const good = ['chef', 'empath', 'librarian', 'monk', 'slayer']
    const ok = [
      seat('m1', 'poisoner'),
      seat('lot', 'lordoftyphon'),
      seat('m2', 'spy'),
      ...good.map((c, i) => seat(`g${i}`, c)),
    ]
    expect(checkSeating(ok)).toEqual([])

    const broken = [
      seat('lot', 'lordoftyphon'),
      seat('m1', 'poisoner'),
      seat('m2', 'spy'),
      ...good.map((c, i) => seat(`g${i}`, c)),
    ]
    expect(checkSeating(broken)).toHaveLength(1)
    expect(checkSeating(broken)[0]?.message).toMatch(/middle/)

    const split = [
      seat('m1', 'poisoner'),
      seat('lot', 'lordoftyphon'),
      seat('g0', 'chef'),
      seat('m2', 'spy'),
      ...good.slice(1).map((c, i) => seat(`g${i + 1}`, c)),
    ]
    expect(checkSeating(split)).toHaveLength(1)
    expect(checkSeating(split)[0]?.message).toMatch(/unbroken line/)
  })

  it('says nothing about characters with no seating rule', () => {
    expect(checkSeating([seat('a', 'imp'), seat('b', 'chef'), seat('c', 'poisoner')])).toEqual([])
  })
})
