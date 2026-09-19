import { describe, expect, it } from 'vitest'
import { buildNightOrder, nightSequence, type NightSeat } from '../src/night-order.js'

const seat = (seatId: string, characterId: string, extra: Partial<NightSeat> = {}): NightSeat => ({
  seatId,
  characterId,
  alive: true,
  ...extra,
})

/** A standard seven-player Trouble Brewing game. */
const TB7: NightSeat[] = [
  seat('s1', 'washerwoman'),
  seat('s2', 'librarian'),
  seat('s3', 'chef'),
  seat('s4', 'empath'),
  seat('s5', 'fortuneteller'),
  seat('s6', 'poisoner'),
  seat('s7', 'imp'),
]

describe('night order', () => {
  it('opens on dusk and closes on dawn', () => {
    const order = buildNightOrder({ night: 1, seats: TB7, playerCount: 7 })
    expect(order[0]!.id).toBe('dusk')
    expect(order.at(-1)!.id).toBe('dawn')
  })

  it('produces the official first night for Trouble Brewing', () => {
    const order = buildNightOrder({ night: 1, seats: TB7, playerCount: 7 })
    expect(order.map((e) => e.id)).toEqual([
      'dusk',
      'minioninfo',
      'demoninfo',
      'poisoner',
      'washerwoman',
      'librarian',
      'chef',
      'empath',
      'fortuneteller',
      'dawn',
    ])
  })

  it('does not wake the Imp on the first night', () => {
    const order = buildNightOrder({ night: 1, seats: TB7, playerCount: 7 })
    expect(order.map((e) => e.id)).not.toContain('imp')
  })

  it('wakes the Imp on later nights, and stops waking the first-night info roles', () => {
    const order = buildNightOrder({ night: 2, seats: TB7, playerCount: 7 })
    const ids = order.map((e) => e.id)
    expect(ids).toEqual(['dusk', 'poisoner', 'imp', 'empath', 'fortuneteller', 'dawn'])
    expect(ids).not.toContain('washerwoman')
    expect(ids).not.toContain('minioninfo')
  })

  it('omits the evil info steps below seven players', () => {
    const six = TB7.slice(0, 6)
    const ids = buildNightOrder({ night: 1, seats: six, playerCount: 6 }).map((e) => e.id)
    expect(ids).not.toContain('minioninfo')
    expect(ids).not.toContain('demoninfo')
    expect(ids).toContain('dusk')
  })

  it('drops a step once every holder is dead', () => {
    const seats = TB7.map((s) => (s.characterId === 'empath' ? { ...s, alive: false } : s))
    const ids = buildNightOrder({ night: 2, seats, playerCount: 7 }).map((e) => e.id)
    expect(ids).not.toContain('empath')
    expect(ids).toContain('fortuneteller')
  })

  it('keeps a dead holder visible when asked, marked as such', () => {
    const seats = TB7.map((s) => (s.characterId === 'empath' ? { ...s, alive: false } : s))
    const order = buildNightOrder({ night: 2, seats, playerCount: 7, includeDead: true })
    const empath = order.find((e) => e.id === 'empath')
    expect(empath).toBeDefined()
    expect(empath!.allDead).toBe(true)
  })

  it('keeps the Ravenkeeper in the queue when dead, because its ability needs that', () => {
    const seats = [...TB7, seat('s8', 'ravenkeeper', { alive: false })]
    const ids = buildNightOrder({ night: 2, seats, playerCount: 8 }).map((e) => e.id)
    expect(ids).toContain('ravenkeeper')
  })

  it('wakes the Drunk at their cover role’s position, flagged as disguised', () => {
    // This player believes they are the Chef. They are really the Drunk.
    const seats = TB7.map((s) =>
      s.characterId === 'chef' ? { ...s, trueCharacterId: 'drunk' } : s,
    )
    const order = buildNightOrder({ night: 1, seats, playerCount: 7 })
    const chef = order.find((e) => e.id === 'chef')
    expect(chef, 'the Drunk must still wake in the Chef slot').toBeDefined()
    expect(chef!.seats[0]!.isDisguised).toBe(true)
    expect(chef!.seats[0]!.trueCharacterId).toBe('drunk')
    // And the Drunk never appears as a step of its own; it has no night action.
    expect(order.map((e) => e.id)).not.toContain('drunk')
  })

  it('groups several holders of the same character into one step', () => {
    const seats = [...TB7, seat('s8', 'empath')]
    const order = buildNightOrder({ night: 2, seats, playerCount: 8 })
    const empath = order.find((e) => e.id === 'empath')!
    expect(empath.seats.map((s) => s.seatId)).toEqual(['s4', 's8'])
  })

  it('carries the official reminder text and its markup', () => {
    const order = buildNightOrder({ night: 1, seats: TB7, playerCount: 7 })
    const washerwoman = order.find((e) => e.id === 'washerwoman')!
    expect(washerwoman.reminder).toContain('*TOWNSFOLK*')
    expect(washerwoman.reminderTokens).toEqual(['Townsfolk', 'Wrong'])

    const poisoner = order.find((e) => e.id === 'poisoner')!
    expect(poisoner.reminder).toContain(':reminder:')
  })

  it('numbers steps consecutively from one', () => {
    const order = buildNightOrder({ night: 1, seats: TB7, playerCount: 7 })
    expect(order.map((e) => e.order)).toEqual(order.map((_, i) => i + 1))
  })

  it('honours an explicit order override from a script', () => {
    const order = buildNightOrder({
      night: 1,
      seats: TB7,
      playerCount: 7,
      override: ['dusk', 'chef', 'poisoner', 'dawn'],
    })
    expect(order.map((e) => e.id)).toEqual(['dusk', 'chef', 'poisoner', 'dawn'])
  })

  it('builds sequences containing every pseudo-step that applies', () => {
    expect(nightSequence(true)).toContain('minioninfo')
    expect(nightSequence(true)).toContain('demoninfo')
    expect(nightSequence(false)).not.toContain('minioninfo')
  })
})
