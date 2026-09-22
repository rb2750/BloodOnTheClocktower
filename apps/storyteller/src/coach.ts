import { getCharacter, teamAlignment, type NightEntry } from '@botc/rules'
import type { Game, Seat } from './state/types.js'
import { BASICS, EXPLAIN } from './rules-explained.js'

const basic = (title: string): Tip => ({ k: 'rule', t: `${title}: ${BASICS.find((b) => b.title === title)!.text}` })

/*
 * The coach: exactly what to do, in order, for a first-time Storyteller.
 *
 * Every line is one of four kinds. "do" is an action, in the order to do it.
 * "say" is a line to speak aloud, word for word. "note" is what to record in
 * the app. "hint" is advice drawn from the state of this game, like the right
 * moment to kill the Tinker. Nothing here decides for the Storyteller; it
 * makes sure nothing is forgotten.
 */

export type Tip = { k: 'rule' | 'do' | 'say' | 'note' | 'hint' | 'warn'; t: string }

const real = (s: Seat) => s.trueCharacterId ?? s.characterId
const team = (s: Seat) => getCharacter(real(s) ?? '')?.team
const isEvil = (s: Seat) =>
  s.alignmentOverride ? s.alignmentOverride === 'evil' : teamAlignment(team(s) ?? 'townsfolk') === 'evil'
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? 'nobody') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const nameOf = (id?: string) => getCharacter(id ?? '')?.name ?? id ?? ''

function facts(game: Game) {
  const seats = game.seats
  const who = (id: string) => seats.filter((s) => real(s) === id || s.characterId === id)
  const one = (id: string) => who(id)[0]
  const demon = seats.find((s) => team(s) === 'demon')
  const minions = seats.filter((s) => team(s) === 'minion')
  const alive = seats.filter((s) => s.alive && !s.isTraveller)
  const effect = (label: string, source?: string) =>
    seats.filter((s) => s.effects.some((e) => e.label === label && (!source || e.sourceCharacterId === source)))
  const n = game.phase.k === 'night' || game.phase.k === 'day' ? game.phase.n : 0
  const diedIn = (phase: string) =>
    game.log.filter((l) => (l.kind === 'death' || l.kind === 'execution') && l.phase === phase).flatMap((l) => l.seatIds)
  const deadNow = (ids: string[]) => [...new Set(ids)].map((id) => seats.find((s) => s.id === id)).filter((s): s is Seat => Boolean(s && !s.alive))
  const impaired = (s: Seat) => s.effects.find((e) => e.label === 'Poisoned' || e.label.startsWith('Drunk'))
  const goodAlive = alive.filter((s) => !isEvil(s)).length
  const evilAlive = alive.filter((s) => isEvil(s)).length
  return { seats, who, one, demon, minions, alive, effect, n, diedIn, deadNow, goodAlive, evilAlive, impaired }
}

/** How the game stands, in one line, and whether evil or good is ahead. */
export function balance(game: Game): Tip[] {
  const f = facts(game)
  if (f.alive.length === 0) return []
  const tips: Tip[] = [
    { k: 'hint', t: `${f.alive.length} alive: ${f.goodAlive} good, ${f.evilAlive} evil. Evil wins if only 2 players are left alive with the Demon among them.` },
  ]
  if (f.alive.length <= 4 && f.demon?.alive)
    tips.push({ k: 'warn', t: 'Evil is close to winning. Go easy on extra deaths (keep the Tinker alive, no bonus kills).' })
  return tips
}

function tinkerHint(game: Game, when: 'night' | 'day'): Tip[] {
  const f = facts(game)
  const tinker = f.one('tinker')
  if (!tinker || !tinker.alive) return []
  const lastNight = f.deadNow(f.diedIn(`Night ${game.phase.k === 'day' ? f.n : f.n - 1}`))
  const exorcised = f.effect('Chosen', 'exorcist').some((s) => s.id === f.demon?.id)
  // The first night and day are quiet by design, so there is nothing to fix yet.
  if (f.n <= 1) return []
  const reasons: string[] = []
  if (when === 'night' && exorcised) reasons.push('the Exorcist stopped the Demon tonight, so without it nobody would die')
  if (when === 'day' && lastNight.length === 0) reasons.push('nobody died last night')
  if (f.alive.length <= 4) return [{ k: 'hint', t: `Keep ${tinker.name} the Tinker alive for now: evil is already close to winning.` }]
  return [
    reasons.length
      ? { k: 'hint', t: `A good moment to kill ${tinker.name} the Tinker: ${list(reasons)}. Mark them dead from their seat and say nothing about how.` }
      : { k: 'hint', t: `${tinker.name} is the Tinker and can die whenever you like. Save it for a night nobody else dies, or when good is pulling ahead.` },
  ]
}

/** Everything to do on the current night step. */
export function nightCoach(game: Game, entry: NightEntry | undefined, wokeTonight: Seat[]): Tip[] {
  if (!entry || game.phase.k !== 'night') return []
  const f = facts(game)
  const first = f.n === 1
  const names = entry.seats.map((s) => game.seats.find((x) => x.id === s.seatId)?.name).filter(Boolean) as string[]
  const nm = list(names)
  const t: Tip[] = []
  const add = (k: Tip['k'], text: string) => t.push({ k, t: text })

  // What this character does, in plain words, before what to do about it.
  if (entry.kind === 'character' && EXPLAIN[entry.id]) add('rule', EXPLAIN[entry.id]!)

  // A drunk or poisoned player's ability does nothing. Say so before the
  // steps, because every step below assumes it works.
  const actors = entry.seats.map((s) => game.seats.find((x) => x.id === s.seatId)).filter((s): s is Seat => Boolean(s))
  for (const s of actors) {
    const why = f.impaired(s)
    if (!why) continue
    const because = why.label === 'Poisoned' ? 'poisoned' : `drunk (${nameOf(why.sourceCharacterId)})`
    add('warn', `${s.name} is ${because}, so their ability does nothing tonight. Wake them and go through the motions, but place no tokens for them${['grandmother', 'chambermaid', 'gambler', 'exorcist'].includes(entry.id) ? ', and you may give them wrong information' : ''}.`)
  }

  switch (entry.id) {
    case 'dusk':
      if (first) {
        t.push(basic('Night and day'), basic('Drunk and poisoned'), basic('Telling the truth'))
        add('do', 'Check every player has looked at their character on their phone. If anyone hasn’t, use Hand out characters.')
        add('say', '“Everyone, close your eyes.”')
        add('do', 'Wait until every eye is closed. Then work down the steps, tapping Next after each one. Steps for characters not in play are already left out.')
        add('hint', 'Wake a player by tapping their shoulder. Use gestures only: nod, shake your head, point. Never speak at night.')
      } else {
        add('say', '“Night falls. Everyone, close your eyes.”')
        add('do', 'Wait until every eye is closed, then work down the steps.')
        t.push(...tinkerHint(game, 'night'))
      }
      break
    case 'minioninfo': {
      add('rule', 'With 7 or more players, evil learn who each other are on the first night, so they can work together.')
      const m = f.minions.map((s) => s.name)
      add('do', `Wake the Minion${m.length > 1 ? 's' : ''}: ${list(m)}.`)
      add('do', `Show the “This is the Demon” card and point at ${f.demon?.name ?? 'the Demon'}.`)
      if (m.length > 1) add('do', 'Point at each Minion so they see each other.')
      add('do', 'Put them back to sleep.')
      add('do', 'Tap the Send button below too, so each Minion has it on their phone.')
      break
    }
    case 'demoninfo':
      add('rule', 'The Demon learns their Minions and three good characters that are not in play. Those are safe for evil to pretend to be, because no real player has them.')
      add('do', `Wake the Demon: ${f.demon?.name ?? '?'}.`)
      add('do', `Show “These are your Minions” and point at ${list(f.minions.map((s) => s.name))}.`)
      add('do', `Show “These characters are not in play”, then the three bluffs below: ${list(game.bluffs.map(nameOf))}.`)
      add('do', `Tap “Send to ${f.demon?.name ?? 'the Demon'}’s phone” below so they can re-read their Minions and bluffs later.`)
      add('do', 'Put them back to sleep.')
      break
    case 'dawn': {
      t.push(basic('Announcing deaths'))
      const dead = f.deadNow(f.diedIn(`Night ${f.n}`))
      add('do', 'Wait about ten seconds so nobody can tell who woke last.')
      add('say', dead.length ? `“Good morning. ${list(dead.map((s) => s.name))} died last night.” Don’t say how.` : '“Good morning. Nobody died last night.”')
      if (dead.length === 0) add('hint', 'If someone should have died, check you marked them dead from their seat before calling eyes open.')
      const moon = dead.find((s) => real(s) === 'moonchild')
      if (moon) add('warn', `${moon.name} was the Moonchild. Tell them to publicly choose an alive player today. If that player is good, they die tonight.`)
      const gm = f.one('grandmother')
      const grandchild = f.effect('Grandchild')[0]
      if (gm?.alive && grandchild && dead.includes(grandchild)) add('warn', `${grandchild.name} was the Grandmother’s grandchild. If the Demon killed them, ${gm.name} the Grandmother dies too: mark them dead now.`)
      break
    }
    case 'grandmother':
      if (!first) {
        const gc = f.effect('Grandchild')[0]
        add('do', `Don’t wake anyone. Check: did the Demon kill ${gc ? gc.name + ' (the grandchild)' : 'the grandchild'} tonight? If so, ${nm} the Grandmother dies too: mark them dead.`)
        break
      }
      add('do', `Wake ${nm}. Point at a good player and show that player’s character token.`)
      add('note', 'Place “Grandchild” on the player you showed.')
      add('hint', 'Any good player works. A Townsfolk who talks a lot makes a juicy target for the Demon, which makes the Grandmother matter.')
      break
    case 'sailor':
      add('do', `Wake ${nm}. They point at an alive player.`)
      add('do', `Decide who is drunk until dusk: ${nm}, or the player they pointed at. Usually the player they pointed at.`)
      add('note', `Place “Drunk” on that one player: tap “place Drunk”, then their seat. Not both.`)
      add('hint', 'While sober the Sailor cannot die, even to the Demon or execution. Making the Sailor drunk is how you let them die.')
      break
    case 'courtier':
      add('do', `Wake ${nm}. Ask with a gesture if they use their once-per-game ability. If yes, they point at a character on the sheet. That character is drunk for 3 nights and 3 days.`)
      add('note', 'Place “Drunk 3” on whoever has that character, and “No Ability” on the Courtier.')
      break
    case 'innkeeper':
      add('do', `Wake ${nm}. They point at 2 players, which may include themselves. Neither of those two can die tonight.`)
      add('note', 'Place “Safe” on each of the two players they pointed at (tap “place Safe”, then the seat, twice).')
      add('do', 'Then choose one of those same two players to be drunk until dusk. Your choice.')
      add('note', `Place “Drunk” on the one you chose. Nothing goes on ${nm} unless they pointed at themselves.`)
      add('hint', 'If the Pukka’s victim is Safe tonight, they survive. The Assassin still kills through it.')
      break
    case 'gambler':
      add('do', `Wake ${nm}. They point at a player and at a character on their sheet.`)
      add('do', 'If the guess is wrong, the Gambler dies: mark them dead from their seat.')
      break
    case 'exorcist': {
      const d = f.demon
      add('do', `Wake ${nm}. They point at a player. It can’t be the same player as last night.`)
      add('note', 'Place “Chosen” on that player.')
      if (d) add('warn', `If they chose ${d.name} (the Demon): after the Exorcist sleeps, wake ${d.name}, point at the Exorcist, put them to sleep, and skip the Demon’s step tonight.`)
      break
    }
    case 'devilsadvocate':
      add('do', `Wake ${nm}. They point at a living player, not the same one as last night.`)
      add('note', 'Place “Survives Execution” on that player. If they are executed tomorrow, they don’t die.')
      break
    case 'pukka': {
      const blocked = f.effect('Chosen', 'exorcist').some((s) => s.id === f.demon?.id)
      const prev = f.effect('Poisoned', 'pukka').filter((s) => s.alive)
      if (blocked && !first) {
        add('warn', `The Exorcist chose ${f.demon?.name} tonight: skip this step. The Pukka doesn’t wake, nobody new is poisoned, and nobody dies to the Pukka tonight.`)
        break
      }
      // The token can go missing; the log of who was poisoned last night cannot.
      const lastNight = `Night ${f.n - 1}`
      const logged = game.log.filter((l) => l.phase === lastNight && l.kind === 'effect' && / is poisoned\.$/.test(l.text)).flatMap((l) => l.seatIds)
      const victims = prev.length ? prev : f.seats.filter((s) => s.alive && logged.includes(s.id))
      if (!first && victims.length === 0) add('hint', 'Nobody is marked as poisoned from last night, so nobody dies to the Pukka now. If someone was poisoned and the token is missing, mark them dead from their seat.')
      if (!first && victims.length) {
        const p = victims[0]!
        const safe = p.effects.some((e) => e.label === 'Safe') || real(p) === 'sailor'
        add('do', safe
          ? `${p.name} was poisoned last night but is protected tonight, so they don’t die. Take their “Poisoned” token off.`
          : `${p.name} was poisoned last night and dies now. Tap ${p.name}’s seat and tap Kill, then take their “Poisoned” token off.`)
        if (real(p) === 'fool') add('warn', `${p.name} is the Fool: the first time they would die, they don’t. Leave them alive and place “No Ability” on them.`)
        const gm = f.one('grandmother')
        if (f.effect('Grandchild').some((s) => s.id === p.id) && gm?.alive && !safe) add('warn', `${p.name} is the Grandmother’s grandchild, so ${gm.name} the Grandmother dies too.`)
      }
      add('do', `Wake ${nm}. They point at a player: that player is poisoned.`)
      add('note', 'Place “Poisoned” on them. The poison lasts until the Pukka’s next turn, and their ability doesn’t work meanwhile: give them wrong information if you like.')
      if (first) add('hint', 'Nobody dies tonight. The Pukka’s victim dies next night.')
      break
    }
    case 'assassin': {
      const used = f.effect('No Ability', 'assassin').length > 0
      if (used) {
        add('do', `${nm} has already used their kill. You can skip this step.`)
        break
      }
      add('do', `Wake ${nm}. Ask with a gesture (thumbs up or down) whether they use their once-per-game kill tonight.`)
      add('do', 'If yes, they point at a player: that player dies, even if protected. Mark them dead.')
      add('note', 'If they used it, place “No Ability” on the Assassin.')
      break
    }
    case 'professor':
      add('do', `Wake ${nm}. Ask with a gesture if they use their once-per-game ability. If yes, they point at a dead player.`)
      add('do', 'If that player is a Townsfolk, they come back to life: open their seat and tap Revive. Otherwise nothing happens.')
      add('note', 'Place “No Ability” on the Professor either way once used.')
      break
    case 'chambermaid': {
      add('do', `Wake ${nm}. They point at 2 alive players (not themselves).`)
      add('do', 'Show with fingers how many of those two woke tonight because of their own ability.')
      const w = wokeTonight.map((s) => s.name)
      add('hint', w.length ? `Woke tonight for their own ability: ${list(w)}. Minion and Demon info on night 1 does not count.` : 'Nobody else woke tonight for their own ability.')
      break
    }
    case 'tinker':
      t.push(...tinkerHint(game, 'night'))
      add('do', 'If you decide the Tinker dies tonight, mark them dead from their seat now.')
      break
    case 'moonchild':
      add('do', 'If the Moonchild died today and publicly chose someone: if that player is good, they die now. Mark them dead. If evil, nothing happens.')
      break
    default:
      break
  }
  return t
}

/** What to do during the day, from dawn to the execution. */
export function dayCoach(game: Game, block: { seatId: string | null; tied: boolean }, nominationsToday: number): Tip[] {
  if (game.phase.k !== 'day') return []
  const f = facts(game)
  const t: Tip[] = []
  const add = (k: Tip['k'], text: string) => t.push({ k, t: text })
  const lastNight = f.deadNow(f.diedIn(`Night ${f.n}`))

  if (f.n === 1 && nominationsToday === 0)
    t.push(basic('How each side wins'), basic('Nominations'), basic('Executions'), basic('The dead'))
  if (nominationsToday === 0) {
    add('say', lastNight.length ? `If you haven’t yet: “${list(lastNight.map((s) => s.name))} died last night.”` : 'If you haven’t yet: “Nobody died last night.”')
    add('do', 'Let the town talk freely for a few minutes. Give private chats time if people want them.')
    add('do', 'When you’re ready, open nominations below and say the line.')
  }
  const moon = f.seats.find((s) => real(s) === 'moonchild' && !s.alive)
  if (moon && (lastNight.includes(moon) || f.deadNow(f.diedIn(`Day ${f.n}`)).includes(moon)))
    add('warn', `${moon.name} (Moonchild) must publicly choose an alive player. If that player is good, they die tonight: remember it for the Moonchild step.`)

  const target = f.seats.find((s) => s.id === block.seatId)
  if (target) {
    if (target.effects.some((e) => e.label === 'Survives Execution'))
      add('warn', `${target.name} is protected by the Devil’s Advocate: if executed, they don’t die. Say “${target.name} is executed” and leave them alive.`)
    if (real(target) === 'fool' && !target.effects.some((e) => e.label === 'No Ability'))
      add('warn', `${target.name} is the Fool: the first time they would die, they don’t.`)
    if (real(target) === 'sailor' && !target.effects.some((e) => e.label === 'Drunk'))
      add('warn', `${target.name} is the sober Sailor and can’t die.`)
    if (real(target) === 'moonchild') add('warn', `${target.name} is the Moonchild: if they die, they publicly choose a player straight away.`)
    if (target.id === f.demon?.id) add('hint', `${target.name} is the Demon. If they die by execution, good wins (unless a Mastermind is in play).`)
  }
  if (block.tied) add('hint', 'A tie means nobody is executed today, unless someone beats the tie.')
  t.push(...tinkerHint(game, 'day'))
  add('do', 'When nominations are done, tap Execute (or No execution). Night falls straight after.')
  return t
}
