/**
 * Nomination and voting rules.
 *
 * Two things worth stating, because they are commonly got wrong by people
 * arriving from other social-deduction games: there is no seconding in Blood on
 * the Clocktower, a nomination goes straight to a vote; and the official term
 * for the player with enough votes is "about to die", not "on the block".
 */

export type NominationRecord = {
  day: number
  nominator: string
  nominee: string
  voters: string[]
  /** Total including vote multipliers and ghost votes. */
  tally: number
  majority: number
  /** Whether this nomination put the nominee about to die. */
  succeeded: boolean
  at: number
}

/** Votes needed to execute: at least half of the living players, rounded up. */
export function majorityThreshold(aliveCount: number): number {
  return Math.ceil(aliveCount / 2)
}

/** Travellers are exiled by a vote of half of *all* players, not just the living. */
export function exileThreshold(totalPlayers: number): number {
  return Math.ceil(totalPlayers / 2)
}

export type NominationCheck = { allowed: boolean; reason?: string }

export function canNominate(
  nominator: string,
  nominee: string,
  today: readonly NominationRecord[],
  alive: (seatId: string) => boolean,
): NominationCheck {
  if (!alive(nominator)) {
    return { allowed: false, reason: 'Dead players may not nominate.' }
  }
  if (today.some((n) => n.nominator === nominator)) {
    return { allowed: false, reason: 'They have already nominated today.' }
  }
  if (today.some((n) => n.nominee === nominee)) {
    return { allowed: false, reason: 'They have already been nominated today.' }
  }
  return { allowed: true }
}

export type BlockState = {
  /** Who is currently about to die, if anyone. */
  seatId: string | null
  votes: number
  /** True when two or more nominees are tied on the highest tally. */
  tied: boolean
}

/**
 * Work out who is about to die after a day's nominations.
 *
 * A nominee must reach the majority *and* stand alone above every other
 * nominee. A tie means nobody is executed, and the tied players come off the
 * block entirely.
 */
export function resolveBlock(
  nominations: readonly NominationRecord[],
  aliveCount: number,
): BlockState {
  const majority = majorityThreshold(aliveCount)
  let best = 0
  let leaders: string[] = []

  for (const n of nominations) {
    if (n.tally < majority) continue
    if (n.tally > best) {
      best = n.tally
      leaders = [n.nominee]
    } else if (n.tally === best) {
      leaders.push(n.nominee)
    }
  }

  if (leaders.length === 0) return { seatId: null, votes: 0, tied: false }
  if (leaders.length > 1) return { seatId: null, votes: best, tied: true }
  return { seatId: leaders[0]!, votes: best, tied: false }
}

/**
 * The line official Storyteller advice asks for and no other tool generates:
 * how many votes are needed to tie the current leader, and how many to take the
 * block outright.
 */
export function votesNeeded(
  aliveCount: number,
  currentBlockVotes: number,
): { toTie: number; toTakeBlock: number } {
  const majority = majorityThreshold(aliveCount)
  const toTie = Math.max(majority, currentBlockVotes)
  const toTakeBlock = Math.max(majority, currentBlockVotes + 1)
  return { toTie, toTakeBlock }
}

/** Phrase the Storyteller can read aloud during a vote. */
export function votesNeededPhrase(
  nomineeName: string,
  aliveCount: number,
  currentBlockVotes: number,
): string {
  const { toTie, toTakeBlock } = votesNeeded(aliveCount, currentBlockVotes)
  if (currentBlockVotes === 0) {
    return `${nomineeName} needs ${toTakeBlock} to be executed.`
  }
  return `${nomineeName} needs ${toTie} to tie, ${toTakeBlock} to take the block.`
}

/** Vote weight for a seat, covering the multiplier Travellers. */
export function voteWeight(characterId: string | undefined): number {
  switch (characterId) {
    case 'bureaucrat':
      return 3
    case 'thief':
      return -1
    case 'godofug':
      return 2
    default:
      return 1
  }
}

export function tallyVotes(
  voters: readonly { seatId: string; characterId?: string }[],
): number {
  return voters.reduce((total, v) => total + voteWeight(v.characterId), 0)
}
