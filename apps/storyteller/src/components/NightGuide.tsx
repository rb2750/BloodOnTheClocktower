import { useState } from 'react'
import { getCharacter, type NightEntry } from '@botc/rules'
import { Button, Sheet, haptic } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import type { Seat } from '../state/types.js'
import { impaired, isGood, real, tryKill } from '../deaths.js'
import { effectFor } from '../reminders.js'
import { CharacterToken } from './CharacterToken.js'

/*
 * The step, done for you.
 *
 * Each character's night action is a couple of taps: who they pointed at,
 * then what follows is applied by the app, with every rule that could block
 * it checked first. Tokens are placed, deaths are marked, the log says what
 * happened and why. A player who is drunk or poisoned gets no tokens at all,
 * and the step says so instead of offering the taps.
 */

type Pick = { title: string; hint?: string; count: number; allow: (s: Seat) => string | null; onDone: (seats: Seat[]) => void }

export function NightGuide({ entry }: { entry: NightEntry }) {
  const game = useStore((s) => s.game)
  const addEffect = useStore((s) => s.addEffect)
  const removeEffect = useStore((s) => s.removeEffect)
  const toggleAlive = useStore((s) => s.toggleAlive)
  const log = useStore((s) => s.log)
  const [pick, setPick] = useState<Pick | null>(null)
  const [chosen, setChosen] = useState<Seat[]>([])
  if (!game || entry.kind !== 'character') return null

  const actors = entry.seats.map((s) => game.seats.find((x) => x.id === s.seatId)).filter((s): s is Seat => Boolean(s && (s.alive || entry.id === 'moonchild')))
  const actor = actors[0]
  if (!actor) return null
  const night = game.phase.k === 'night' ? game.phase.n : 0
  const nameOf = (id?: string) => getCharacter(id ?? '')?.name ?? id ?? ''
  const demon = game.seats.find((s) => getCharacter(real(s) ?? '')?.team === 'demon')
  const alive = (s: Seat) => (s.alive ? null : 'dead')
  const place = (seat: Seat, label: string, source: string) => addEffect(seat.id, { label, sourceCharacterId: source, ...effectFor(label, source) })
  const clear = (seat: Seat, label: string, source: string) =>
    seat.effects.filter((e) => e.label === label && e.sourceCharacterId === source).forEach((e) => removeEffect(seat.id, e.id))
  const kill = (seat: Seat, cause: 'demon' | 'assassin' | 'other', by: string) => {
    const v = tryKill(game, seat, cause)
    if (!v.dies) {
      if (v.foolSpent) place(seat, 'No Ability', 'fool')
      log('note', `${by} tried to kill ${seat.name}, but ${v.why}.`, [seat.id])
      toast(`${seat.name} survives: ${v.why}.`)
      return
    }
    toggleAlive(seat.id)
    log('note', `${by} killed ${seat.name}.`, [seat.id])
    for (const a of v.also) {
      toggleAlive(a.seat.id)
      log('note', `${a.seat.name} died too: ${a.why}.`, [a.seat.id])
      toast(`${a.seat.name} dies too: ${a.why}.`)
    }
    haptic('warn')
    toast(`${seat.name} is dead.`)
  }
  const done = (label: string) => game.log.some((l) => l.phase === `Night ${night}` && l.text.startsWith(label))
  const mark = (text: string, ids: string[] = []) => log('note', text, ids)

  const why = impaired(actor)
  if (why) {
    return (
      <p className="mt-3 rounded-(--radius-surface) border border-(--color-red) px-3 py-2 text-[14px] text-(--color-red-2)">
        {actor.name} is {why.label === 'Poisoned' ? 'poisoned' : `drunk (${nameOf(why.sourceCharacterId)})`}: their ability does nothing tonight. Wake them and let them point, but nothing happens. Nothing to tap here.
      </p>
    )
  }

  let body: React.ReactNode = null
  const first = night === 1

  /**
   * Which of some players to make drunk, with the reason. Drunk means their
   * ability does nothing, so it goes on whoever has the most to lose tonight:
   * the Demon (no kill), then someone with a night ability, then someone
   * whose passive protection matters. Never the Sailor themselves unless
   * evil needs the help, because a drunk Sailor can die.
   */
  const suggestDrunk = (options: Seat[], sailor?: Seat): { seat: Seat; why: string } => {
    const goodAlive = game.seats.filter((s) => s.alive && isGood(s)).length
    const evilAlive = game.seats.filter((s) => s.alive && !isGood(s)).length
    const c = (s: Seat) => getCharacter(real(s) ?? '')
    const score = (s: Seat): [number, string] => {
      const ch = c(s)
      if (!ch) return [0, '']
      if (ch.team === 'demon') return [5, `${s.name} is the Demon: drunk, they kill nobody tonight`]
      if (ch.id === 'sailor') return [evilAlive >= goodAlive - 1 ? 4 : 1, evilAlive >= goodAlive - 1 ? 'evil needs help and a drunk Sailor can die' : 'a drunk Sailor can be killed, so only pick them to help evil']
      if (ch.otherNight > 0 || ch.firstNight > 0) return [3, `${s.name} (${ch.name}) acts at night, so this costs them tonight’s ability`]
      if (['tealady', 'fool', 'innkeeper'].includes(ch.id)) return [2, `${s.name} (${ch.name}) protects, and drunk they don’t`]
      return [1, `${s.name} (${ch.name}) loses little`]
    }
    const ranked = options.map((s) => ({ seat: s, r: score(s) })).sort((a, b) => b.r[0] - a.r[0])
    const best = ranked[0]!
    if (sailor && best.seat.id !== sailor.id && best.r[0] <= 1 && ranked.length > 1) return { seat: best.seat, why: 'nobody here has much to lose, so the usual choice: the player they pointed at' }
    return { seat: best.seat, why: best.r[1] }
  }
  const Suggest = ({ s }: { s: { seat: Seat; why: string } }) => (
    <p className="text-[13.5px] leading-snug text-(--color-blue-2)">Suggested: {s.seat.name}, because {s.why}.</p>
  )
  // The whole step in plain words, in order, before the buttons.
  const you = actor.name
  const steps: Record<string, string[]> = {
    sailor: [`Wake ${you}.`, `${you} points at any alive player.`, 'Tap below and tell the app who they pointed at, then choose who is drunk. Usually the player they pointed at.', `${you} goes back to sleep.`],
    innkeeper: [`Wake ${you}.`, `${you} points at 2 players, and may include themselves. Both are safe tonight.`, 'Tap below and pick those 2, then choose which ONE of them is drunk. Your choice.', `${you} goes back to sleep.`],
    pukka: first
      ? [`Wake ${you}.`, `${you} points at one player. That player is poisoned.`, 'Tap below and pick them.', `Nobody dies tonight. ${you} goes back to sleep.`]
      : ['First: the player poisoned last night dies now. Tap the red button.', `Then wake ${you}. They point at a new player, who is now poisoned.`, 'Tap below and pick them.', `${you} goes back to sleep.`],
    exorcist: [`Wake ${you}.`, `${you} points at a player, not the same one as last night.`, 'Tap below and pick them. If it is the Demon, the app tells you what to do next.', `${you} goes back to sleep.`],
    devilsadvocate: [`Wake ${you}.`, `${you} points at a living player, not the same one as last night. If that player is executed tomorrow, they survive.`, 'Tap below and pick them.', `${you} goes back to sleep.`],
    assassin: [`Wake ${you}.`, 'Ask with a thumbs up: use your kill tonight?', 'If NO: tap Next, nothing happens.', 'If YES: they point at a player. Tap below and pick them. That player dies no matter what protects them. The app remembers the kill is used.'],
    grandmother: first
      ? [`Wake ${you}.`, 'Tap below and pick one good player: the grandchild.', 'Point at that player, and show their character token to the Grandmother. The app names the token.', `${you} goes back to sleep.`]
      : ['Nobody wakes. Nothing to do here.'],
    chambermaid: [`Wake ${you}.`, `${you} points at 2 other alive players.`, 'Tap below and pick them. The app tells you how many fingers to hold up.', `Hold up that many fingers. ${you} goes back to sleep.`],
    gambler: [`Wake ${you}.`, `${you} points at a player and at a character on their sheet: a guess.`, 'Tap Guessed right or Guessed wrong. Wrong means they die.', `${you} goes back to sleep.`],
    professor: [`Wake ${you}.`, 'Ask with a thumbs up: use your ability tonight?', 'If NO: tap Next.', 'If YES: they point at a dead player. Tap below and pick them. The app brings them back if they are a Townsfolk.'],
    tinker: ['Nobody wakes. You may kill the Tinker now if you want to. Otherwise tap Next.'],
    courtier: [`Wake ${you}.`, 'Ask with a thumbs up: use your ability tonight?', 'If NO: tap Next.', 'If YES: they name a character. Tap below and pick the player who has it.'],
    moonchild: actor.alive ? ['Nobody wakes. Nothing to do here.'] : ['The Moonchild died today and chose a player. Tap below and pick who. If that player is good, they die now.'],
  }
  const intro = steps[entry.id] ? (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-[15px] leading-snug text-(--text)">
      {steps[entry.id]!.map((line, i) => <li key={i}>{line}</li>)}
    </ol>
  ) : null
  const Done = ({ text }: { text: string }) => <p className="mt-3 text-[14px] text-(--color-ok)">✓ {text}</p>

  switch (entry.id) {
    case 'sailor': {
      const key = `Sailor ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} point at?`, count: 1, allow: alive, onDone: ([s]) => setChosen([s!]) })}>
          Who did {actor.name} point at?
        </Button>
      )
      if (chosen.length === 1 && chosen[0]!.id !== actor.id || chosen.length === 1) {
        const other = chosen[0]!
        const opts = [other, actor].filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
        const sug = suggestDrunk(opts, actor)
        body = (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[14px] text-(--text-dim)">{actor.name} pointed at {other.name}. Who is drunk until dusk?</p>
            <Suggest s={sug} />
            <div className="flex gap-2">
              {opts.map((s) => (
                <Button key={s.id} variant={s.id === sug.seat.id ? 'primary' : 'quiet'} className="flex-1" onClick={() => { place(s, 'Drunk', 'sailor'); mark(`${key}: ${s.name} is drunk until dusk.`, [s.id]); setChosen([]); haptic('confirm') }}>
                  {s.name} is drunk
                </Button>
              ))}
            </div>
          </div>
        )
      }
      break
    }
    case 'innkeeper': {
      const key = `Innkeeper ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      if (chosen.length === 2) {
        const sug = suggestDrunk(chosen)
        body = (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[14px] text-(--text-dim)">{chosen[0]!.name} and {chosen[1]!.name} are safe tonight. Which one is drunk until dusk? Your choice.</p>
            <Suggest s={sug} />
            <div className="flex gap-2">
              {chosen.map((s) => (
                <Button key={s.id} variant={s.id === sug.seat.id ? 'primary' : 'quiet'} className="flex-1" onClick={() => { for (const c of chosen) place(c, 'Safe', 'innkeeper'); place(s, 'Drunk', 'innkeeper'); mark(`${key}: ${chosen[0]!.name} and ${chosen[1]!.name} are safe tonight, ${s.name} is drunk until dusk.`, chosen.map((c) => c.id)); setChosen([]); haptic('confirm') }}>
                  {s.name} is drunk
                </Button>
              ))}
            </div>
          </div>
        )
      } else {
        body = (
          <Button className="mt-3 w-full" onClick={() => setPick({ title: `Which 2 players did ${actor.name} point at?`, hint: 'They may point at themselves.', count: 2, allow: alive, onDone: (ss) => setChosen(ss) })}>
            Which 2 players did {actor.name} point at?
          </Button>
        )
      }
      break
    }
    case 'pukka': {
      const blocked = demon?.effects.some((e) => e.label === 'Exorcised')
      if (blocked) { body = <p className="mt-3 text-[14px] text-(--color-red-2)">The Exorcist chose {demon?.name} tonight: the Pukka does not wake and nothing happens. Tap Next.</p>; break }
      const victims = game.seats.filter((s) => s.alive && s.effects.some((e) => e.label === 'Poisoned' && e.sourceCharacterId === 'pukka'))
      const deathKey = `Pukka death`
      const pickKey = `Pukka ${actor.name}`
      const parts: React.ReactNode[] = []
      if (!first && victims.length > 0 && !done(deathKey)) {
        const v = victims[0]!
        parts.push(
          <Button key="die" variant="danger" className="mt-3 w-full" onClick={() => { clear(v, 'Poisoned', 'pukka'); kill(v, 'demon', 'The Pukka'); mark(`${deathKey}: ${v.name}, poisoned last night.`, [v.id]) }}>
            {v.name} was poisoned last night: they die now
          </Button>,
        )
      } else if (!first && victims.length === 0 && !done(deathKey)) {
        parts.push(<p key="none" className="mt-3 text-[14px] text-(--text-dim)">Nobody is poisoned from last night, so nobody dies to the Pukka now.</p>)
      } else if (done(deathKey)) parts.push(<Done key="d" text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(deathKey))!.text} />)
      if (done(pickKey)) parts.push(<Done key="p" text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(pickKey))!.text} />)
      else
        parts.push(
          <Button key="pick" className="mt-2 w-full" disabled={!first && victims.length > 0 && !done(deathKey)} onClick={() => setPick({ title: `Who did ${actor.name} poison?`, hint: 'They may point at a dead player. Nothing happens then, but the choice stands.', count: 1, allow: () => null, onDone: ([s]) => { if (s!.alive) place(s!, 'Poisoned', 'pukka'); mark(s!.alive ? `${pickKey}: ${s!.name} is poisoned until the Pukka’s next turn.` : `${pickKey}: chose ${s!.name}, who is dead. Nothing happens.`, [s!.id]); haptic('confirm') } })}>
            Who did {actor.name} point at? (poisoned)
          </Button>,
        )
      body = <>{parts}</>
      break
    }
    case 'exorcist': {
      const key = `Exorcist ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      const last = game.seats.find((s) => s.effects.some((e) => e.label === 'Chosen' && e.sourceCharacterId === 'exorcist'))
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} point at?`, count: 1, allow: (s) => (last?.id === s.id ? 'same as last night' : null), onDone: ([s]) => {
          for (const x of game.seats) clear(x, 'Chosen', 'exorcist')
          place(s!, 'Chosen', 'exorcist')
          if (demon && s!.id === demon.id) {
            place(demon, 'Exorcised', 'exorcist')
            mark(`${key}: chose ${s!.name}, the Demon. The Demon does not act tonight.`, [s!.id])
            toast(`${s!.name} is the Demon: wake ${s!.name}, point at ${actor.name}, then the Demon’s step is skipped.`, { duration: 9000 })
          } else mark(`${key}: chose ${s!.name}.`, [s!.id])
          haptic('confirm')
        } })}>
          Who did {actor.name} point at?
        </Button>
      )
      break
    }
    case 'devilsadvocate': {
      const key = `${entry.name} ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      const last = game.seats.find((s) => s.effects.some((e) => e.label === 'Survives Execution'))
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} point at?`, count: 1, allow: (s) => (!s.alive ? 'dead' : last?.id === s.id ? 'same as last night' : null), onDone: ([s]) => { for (const x of game.seats) clear(x, 'Survives Execution', 'devilsadvocate'); place(s!, 'Survives Execution', 'devilsadvocate'); mark(`${key}: ${s!.name} survives execution tomorrow.`, [s!.id]); haptic('confirm') } })}>
          Who did {actor.name} point at?
        </Button>
      )
      break
    }
    case 'assassin': {
      const used = actor.effects.some((e) => e.label === 'No Ability')
      if (used) { body = <p className="mt-3 text-[14px] text-(--text-dim)">{actor.name} has already used their kill. Tap Next.</p>; break }
      body = (
        <Button variant="danger" className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} choose to kill?`, hint: 'Only if they gave a thumbs up. Nothing can stop this kill. They may choose a dead player: nothing happens, but the kill is used up.', count: 1, allow: () => null, onDone: ([s]) => { place(actor, 'No Ability', 'assassin'); if (s!.alive) { kill(s!, 'assassin', 'The Assassin'); mark(`Assassin ${actor.name}: killed ${s!.name}.`, [s!.id]) } else { mark(`Assassin ${actor.name}: chose ${s!.name}, who is already dead. The kill is used up.`, [s!.id]); toast(`${s!.name} is already dead. The Assassin’s kill is used up.`) } } })}>
          {actor.name} used their kill: who?
        </Button>
      )
      break
    }
    case 'grandmother': {
      if (!first) {
        body = <p className="mt-3 text-[14px] text-(--text-dim)">Nobody wakes. If the Demon killed the grandchild tonight, the Grandmother died with them: that happens by itself when you record the Pukka’s kill.</p>
        break
      }
      const gc = game.seats.find((s) => s.effects.some((e) => e.label === 'Grandchild'))
      if (gc) { body = <Done text={`${gc.name} is the grandchild. Show ${actor.name} ${gc.name} and the ${nameOf(real(gc))} token.`} />; break }
      const cands = game.seats.filter((s) => s.alive && isGood(s) && s.id !== actor.id)
      const gsug = cands.find((s) => getCharacter(real(s) ?? '')?.team === 'townsfolk' && (getCharacter(real(s) ?? '')?.otherNight ?? 0) > 0) ?? cands[0]
      body = (
        <>
        {gsug && <Suggest s={{ seat: gsug, why: 'a Townsfolk who acts at night is a likely Demon target, which makes the Grandmother matter' }} />}
        <Button className="mt-3 w-full" onClick={() => setPick({ title: 'Choose the grandchild', hint: 'Any good player. Then point at them and show their character token.', count: 1, allow: (s) => (!s.alive ? 'dead' : !isGood(s) ? 'evil' : s.id === actor.id ? 'the Grandmother' : null), onDone: ([s]) => { place(s!, 'Grandchild', 'grandmother'); mark(`Grandmother ${actor.name}: shown ${s!.name}, the ${nameOf(real(s!))}.`, [s!.id]); haptic('confirm') } })}>
          Choose the grandchild
        </Button>
        </>
      )
      break
    }
    case 'chambermaid': {
      const key = `Chambermaid ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Which 2 players did ${actor.name} point at?`, hint: 'Dead players may be chosen.', count: 2, allow: (s) => (s.id === actor.id ? 'themselves' : null), onDone: (ss) => {
          const woke = ss.filter((s) => WAKES(game, s, night)).length
          mark(`${key}: chose ${ss[0]!.name} and ${ss[1]!.name}. Show ${woke} finger${woke === 1 ? '' : 's'}.`, ss.map((s) => s.id))
          toast(`Show ${actor.name} ${woke} finger${woke === 1 ? '' : 's'}.`, { duration: 8000 })
          haptic('confirm')
        } })}>
          Which 2 players did {actor.name} point at?
        </Button>
      )
      break
    }
    case 'gambler': {
      const key = `Gambler ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      body = (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={() => { mark(`${key}: guessed right, nothing happens.`) }}>Guessed right</Button>
          <Button variant="danger" className="flex-1" onClick={() => { mark(`${key}: guessed wrong.`); kill(actor, 'other', 'A wrong guess') }}>Guessed wrong: dies</Button>
        </div>
      )
      break
    }
    case 'professor': {
      const used = actor.effects.some((e) => e.label === 'No Ability')
      if (used) { body = <p className="mt-3 text-[14px] text-(--text-dim)">{actor.name} has already used their ability. Tap Next.</p>; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Which dead player did ${actor.name} choose?`, hint: 'Only if they used it. A Townsfolk comes back to life; anyone else stays dead.', count: 1, allow: (s) => (s.alive ? 'alive' : null), onDone: ([s]) => {
          place(actor, 'No Ability', 'professor')
          if (getCharacter(real(s!) ?? '')?.team === 'townsfolk') { toggleAlive(s!.id); mark(`Professor ${actor.name}: ${s!.name} is alive again.`, [s!.id]); toast(`${s!.name} is alive again.`) }
          else { mark(`Professor ${actor.name}: chose ${s!.name}, not a Townsfolk, nothing happens.`, [s!.id]); toast(`${s!.name} is not a Townsfolk: nothing happens.`) }
        } })}>
          {actor.name} used it: who?
        </Button>
      )
      break
    }
    case 'moonchild': {
      const key = `Moonchild ${actor.name}`
      if (actor.alive) { body = <p className="mt-3 text-[14px] text-(--text-dim)">{actor.name} is alive, so nothing happens. Tap Next.</p>; break }
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      body = (
        <Button variant="danger" className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} choose when they died?`, hint: 'If that player is good, they die now. If evil or already dead, nothing happens.', count: 1, allow: () => null, onDone: ([s]) => { if (isGood(s!) && s!.alive) { kill(s!, 'other', 'The Moonchild'); mark(`${key}: chose ${s!.name}, who is good.`, [s!.id]) } else { mark(`${key}: chose ${s!.name}, who is evil. Nothing happens.`, [s!.id]); toast(`${s!.name} is evil: nothing happens.`) } } })}>
          Who did {actor.name} choose?
        </Button>
      )
      break
    }
    case 'tinker':
      body = <Button variant="danger" className="mt-3 w-full" onClick={() => kill(actor, 'other', 'The Storyteller')}>Kill {actor.name} the Tinker tonight</Button>
      break
    case 'courtier': {
      const used = actor.effects.some((e) => e.label === 'No Ability')
      if (used) { body = <p className="mt-3 text-[14px] text-(--text-dim)">{actor.name} has already used their ability. Tap Next.</p>; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Whose character did ${actor.name} name?`, hint: 'Pick the player who has that character, alive or dead. If nobody does, tap Nobody.', count: 1, allow: () => null, onDone: ([s]) => { place(actor, 'No Ability', 'courtier'); place(s!, 'Drunk 3', 'courtier'); mark(`Courtier ${actor.name}: ${s!.name} is drunk for 3 nights and 3 days.`, [s!.id]) } })}>
          {actor.name} used it: whose character?
        </Button>
      )
      break
    }
    default:
      break
  }

  const pending = Boolean(body) && !done(`${entry.name} `) && !['tinker'].includes(entry.id) && !(entry.id === 'grandmother' && (!first || game.seats.some((s) => s.effects.some((e) => e.label === 'Grandchild')))) && !(entry.id === 'pukka' && done(`Pukka ${actor.name}`)) && !(['assassin', 'professor', 'courtier'].includes(entry.id) && actor.effects.some((e) => e.label === 'No Ability'))
  return (
    <>
      {pending && <span data-guide-pending={entry.name} hidden />}
      {intro}
      {body}
      <Sheet open={pick !== null} onOpenChange={(o) => !o && setPick(null)} title={pick?.title ?? ''} subtitle={pick?.hint}>
        <PickSeats pick={pick} seats={game.seats} onClose={() => setPick(null)} />
      </Sheet>
    </>
  )
}

/** Who woke tonight for their own ability: for the Chambermaid's count. */
function WAKES(game: NonNullable<ReturnType<typeof useStore.getState>['game']>, s: Seat, night: number) {
  const c = getCharacter(real(s) ?? '')
  if (!c || !s.alive) return false
  const order = night === 1 ? c.firstNight : c.otherNight
  if (!order) return false
  if (['tinker', 'moonchild'].includes(c.id)) return false
  if (c.id === 'grandmother' && night > 1) return false
  if (c.team === 'demon' && s.effects.some((e) => e.label === 'Exorcised')) return false
  return true
}

function PickSeats({ pick, seats, onClose }: { pick: Pick | null; seats: Seat[]; onClose: () => void }) {
  const [sel, setSel] = useState<Seat[]>([])
  if (!pick) return null
  const choose = (s: Seat) => {
    const next = sel.some((x) => x.id === s.id) ? sel.filter((x) => x.id !== s.id) : [...sel, s]
    if (next.length === pick.count) {
      pick.onDone(next)
      setSel([])
      onClose()
    } else setSel(next)
  }
  return (
    <div className="grid grid-cols-3 gap-2 pb-2">
      {seats.map((s) => {
        const no = pick.allow(s)
        const on = sel.some((x) => x.id === s.id)
        return (
          <button
            key={s.id}
            disabled={Boolean(no)}
            onClick={() => choose(s)}
            className={`flex min-h-(--tap-min) flex-col items-center gap-1 rounded-(--radius-surface) border p-2 disabled:opacity-30 ${on ? 'border-(--accent)' : 'border-(--hairline-strong)'}`}
          >
            <CharacterToken character={getCharacter(s.characterId ?? '')} size="40px" dead={!s.alive} />
            <span className="truncate text-[13px]">{s.name}</span>
            <span className="caps text-[9px] text-(--text-faint)">{no ?? getCharacter(s.characterId ?? '')?.name ?? ''}</span>
          </button>
        )
      })}
    </div>
  )
}
