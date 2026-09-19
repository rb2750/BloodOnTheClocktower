import { describe, expect, it } from 'vitest'
import {
  parseReminderMarkup,
  placesReminder,
  reminderToPlainText,
  tokensShownIn,
} from '../src/markup.js'
import {
  canNominate,
  exileThreshold,
  majorityThreshold,
  resolveBlock,
  tallyVotes,
  voteWeight,
  votesNeeded,
  votesNeededPhrase,
  type NominationRecord,
} from '../src/voting.js'
import { getCharacter } from '../src/data.js'

describe('reminder markup', () => {
  it('splits out token names and reminder markers', () => {
    expect(
      parseReminderMarkup('Point to both the *TOWNSFOLK* and *WRONG* players.'),
    ).toEqual([
      { kind: 'text', value: 'Point to both the ' },
      { kind: 'token', value: 'TOWNSFOLK' },
      { kind: 'text', value: ' and ' },
      { kind: 'token', value: 'WRONG' },
      { kind: 'text', value: ' players.' },
    ])
  })

  it('recognises the reminder-token marker', () => {
    const nodes = parseReminderMarkup('The Poisoner chooses a player. :reminder:')
    expect(nodes.at(-1)).toEqual({ kind: 'reminder' })
    expect(placesReminder('The Poisoner chooses a player. :reminder:')).toBe(true)
    expect(placesReminder('Give a finger signal.')).toBe(false)
  })

  it('lists the physical tokens a step says to show', () => {
    const imp = getCharacter('imp')!
    expect(tokensShownIn(imp.otherNightReminder)).toContain('YOU ARE')
  })

  it('renders readable plain text for logs and screen readers', () => {
    expect(reminderToPlainText('The Poisoner chooses a player. :reminder:')).toBe(
      'The Poisoner chooses a player. place a reminder token',
    )
  })

  it('handles text with no markup at all', () => {
    expect(parseReminderMarkup('Give a finger signal.')).toEqual([
      { kind: 'text', value: 'Give a finger signal.' },
    ])
  })

  it('parses every official reminder without throwing', () => {
    for (const c of [getCharacter('washerwoman')!, getCharacter('fortuneteller')!]) {
      expect(() => parseReminderMarkup(c.firstNightReminder)).not.toThrow()
      expect(() => parseReminderMarkup(c.otherNightReminder)).not.toThrow()
    }
  })
})

describe('voting thresholds', () => {
  it('needs at least half the living players, rounded up', () => {
    expect(majorityThreshold(10)).toBe(5)
    expect(majorityThreshold(9)).toBe(5)
    expect(majorityThreshold(5)).toBe(3)
    expect(majorityThreshold(2)).toBe(1)
  })

  it('recomputes as players die', () => {
    expect(majorityThreshold(15)).toBe(8)
    expect(majorityThreshold(14)).toBe(7)
    expect(majorityThreshold(13)).toBe(7)
  })

  it('uses all players, not just the living, for a Traveller exile', () => {
    expect(exileThreshold(12)).toBe(6)
  })
})

const nom = (
  nominator: string,
  nominee: string,
  tally: number,
  majority: number,
): NominationRecord => ({
  day: 1,
  nominator,
  nominee,
  voters: [],
  tally,
  majority,
  succeeded: tally >= majority,
  at: 0,
})

describe('who is about to die', () => {
  it('is nobody when no nomination reaches the majority', () => {
    expect(resolveBlock([nom('a', 'b', 2, 5)], 10)).toEqual({
      seatId: null,
      votes: 0,
      tied: false,
    })
  })

  it('is the single nominee who reaches it', () => {
    expect(resolveBlock([nom('a', 'b', 6, 5)], 10)).toEqual({
      seatId: 'b',
      votes: 6,
      tied: false,
    })
  })

  it('requires beating the current leader, not just matching the majority', () => {
    const block = resolveBlock([nom('a', 'b', 7, 5), nom('c', 'd', 6, 5)], 10)
    expect(block.seatId).toBe('b')
    expect(block.votes).toBe(7)
  })

  it('executes nobody on a tie, and takes the tied players off the block', () => {
    const block = resolveBlock([nom('a', 'b', 6, 5), nom('c', 'd', 6, 5)], 10)
    expect(block.seatId).toBeNull()
    expect(block.tied).toBe(true)
  })

  it('handles a later nomination overtaking an earlier one', () => {
    const block = resolveBlock([nom('a', 'b', 5, 5), nom('c', 'd', 8, 5)], 10)
    expect(block.seatId).toBe('d')
  })
})

describe('nomination rules', () => {
  const alive = (id: string) => id !== 'dead'

  it('allows a clean nomination', () => {
    expect(canNominate('a', 'b', [], alive).allowed).toBe(true)
  })

  it('stops the dead from nominating', () => {
    const check = canNominate('dead', 'b', [], alive)
    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('Dead')
  })

  it('allows only one nomination per player per day', () => {
    const today = [nom('a', 'b', 3, 5)]
    expect(canNominate('a', 'c', today, alive).allowed).toBe(false)
  })

  it('allows each player to be nominated only once per day', () => {
    const today = [nom('a', 'b', 3, 5)]
    expect(canNominate('c', 'b', today, alive).allowed).toBe(false)
  })

  it('permits self-nomination', () => {
    expect(canNominate('a', 'a', [], alive).allowed).toBe(true)
  })
})

describe('the votes-needed line', () => {
  it('states the bar when nobody is on the block', () => {
    expect(votesNeeded(9, 0)).toEqual({ toTie: 5, toTakeBlock: 5 })
    expect(votesNeededPhrase('Alice', 9, 0)).toBe('Alice needs 5 to be executed.')
  })

  it('states both numbers when someone already holds the block', () => {
    expect(votesNeeded(9, 4)).toEqual({ toTie: 5, toTakeBlock: 5 })
    expect(votesNeeded(9, 6)).toEqual({ toTie: 6, toTakeBlock: 7 })
    expect(votesNeededPhrase('Alice', 9, 6)).toBe('Alice needs 6 to tie, 7 to take the block.')
  })
})

describe('vote weights', () => {
  it('gives the Bureaucrat three votes and the Thief minus one', () => {
    expect(voteWeight('bureaucrat')).toBe(3)
    expect(voteWeight('thief')).toBe(-1)
    expect(voteWeight('chef')).toBe(1)
    expect(voteWeight(undefined)).toBe(1)
  })

  it('tallies a mixed set of voters', () => {
    expect(
      tallyVotes([
        { seatId: 'a' },
        { seatId: 'b', characterId: 'bureaucrat' },
        { seatId: 'c', characterId: 'thief' },
      ]),
    ).toBe(3)
  })
})
