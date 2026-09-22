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

  const actors = entry.seats.map((s) => game.seats.find((x) => x.id === s.seatId)).filter((s): s is Seat => Boolean(s && s.alive))
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
        body = (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[14px] text-(--text-dim)">{actor.name} pointed at {other.name}. Who is drunk until dusk?</p>
            <div className="flex gap-2">
              {[other, actor].filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i).map((s) => (
                <Button key={s.id} variant="primary" className="flex-1" onClick={() => { place(s, 'Drunk', 'sailor'); mark(`${key}: ${s.name} is drunk until dusk.`, [s.id]); setChosen([]); haptic('confirm') }}>
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
        body = (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[14px] text-(--text-dim)">{chosen[0]!.name} and {chosen[1]!.name} are safe tonight. Which one is drunk until dusk? Your choice.</p>
            <div className="flex gap-2">
              {chosen.map((s) => (
                <Button key={s.id} variant="primary" className="flex-1" onClick={() => { for (const c of chosen) place(c, 'Safe', 'innkeeper'); place(s, 'Drunk', 'innkeeper'); mark(`${key}: ${chosen[0]!.name} and ${chosen[1]!.name} are safe tonight, ${s.name} is drunk until dusk.`, chosen.map((c) => c.id)); setChosen([]); haptic('confirm') }}>
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
          <Button key="pick" className="mt-2 w-full" disabled={!first && victims.length > 0 && !done(deathKey)} onClick={() => setPick({ title: `Who did ${actor.name} poison?`, count: 1, allow: alive, onDone: ([s]) => { place(s!, 'Poisoned', 'pukka'); mark(`${pickKey}: ${s!.name} is poisoned until the Pukka’s next turn.`, [s!.id]); haptic('confirm') } })}>
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
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} point at?`, count: 1, allow: (s) => (!s.alive ? 'dead' : last?.id === s.id ? 'same as last night' : null), onDone: ([s]) => {
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
      const key = `Devil’s Advocate ${actor.name}`
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
        <Button variant="danger" className="mt-3 w-full" onClick={() => setPick({ title: `Who did ${actor.name} choose to kill?`, hint: 'Only if they gave a thumbs up. Nothing can stop this kill.', count: 1, allow: alive, onDone: ([s]) => { place(actor, 'No Ability', 'assassin'); kill(s!, 'assassin', 'The Assassin'); mark(`Assassin ${actor.name}: killed ${s!.name}.`, [s!.id]) } })}>
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
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: 'Choose the grandchild', hint: 'Any good player. Then point at them and show their character token.', count: 1, allow: (s) => (!s.alive ? 'dead' : !isGood(s) ? 'evil' : s.id === actor.id ? 'the Grandmother' : null), onDone: ([s]) => { place(s!, 'Grandchild', 'grandmother'); mark(`Grandmother ${actor.name}: shown ${s!.name}, the ${nameOf(real(s!))}.`, [s!.id]); haptic('confirm') } })}>
          Choose the grandchild
        </Button>
      )
      break
    }
    case 'chambermaid': {
      const key = `Chambermaid ${actor.name}`
      if (done(key)) { body = <Done text={game.log.find((l) => l.phase === `Night ${night}` && l.text.startsWith(key))!.text} />; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Which 2 players did ${actor.name} point at?`, count: 2, allow: (s) => (!s.alive ? 'dead' : s.id === actor.id ? 'themselves' : null), onDone: (ss) => {
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
    case 'tinker':
      body = <Button variant="danger" className="mt-3 w-full" onClick={() => kill(actor, 'other', 'The Storyteller')}>Kill {actor.name} the Tinker tonight</Button>
      break
    case 'courtier': {
      const used = actor.effects.some((e) => e.label === 'No Ability')
      if (used) { body = <p className="mt-3 text-[14px] text-(--text-dim)">{actor.name} has already used their ability. Tap Next.</p>; break }
      body = (
        <Button className="mt-3 w-full" onClick={() => setPick({ title: `Whose character did ${actor.name} name?`, hint: 'Pick the player who has that character. If nobody does, tap Nobody.', count: 1, allow: alive, onDone: ([s]) => { place(actor, 'No Ability', 'courtier'); place(s!, 'Drunk 3', 'courtier'); mark(`Courtier ${actor.name}: ${s!.name} is drunk for 3 nights and 3 days.`, [s!.id]) } })}>
          {actor.name} used it: whose character?
        </Button>
      )
      break
    }
    default:
      break
  }

  return (
    <>
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
