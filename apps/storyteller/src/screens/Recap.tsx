import { useMemo } from 'react'
import { getCharacter, teamAlignment } from '@botc/rules'
import { Button, Grimoire, Label, Export } from '@botc/ui'
import { Screen } from '../components/Screen.js'
import { CharacterToken } from '../components/CharacterToken.js'
import type { Screen as ScreenName } from '../App.js'
import type { Game, LogKind, Seat } from '../state/types.js'

const TONE: Record<LogKind, string> = {
  phase: 'text-(--text)',
  deal: 'text-(--text-faint)',
  info: 'text-(--color-blue-2)',
  death: 'text-(--color-red-2)',
  effect: 'text-(--text-dim)',
  nomination: 'text-(--text-dim)',
  execution: 'text-(--color-red-2)',
  note: 'text-(--text-faint)',
  change: 'text-(--text-dim)',
}

const TEAM: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
  traveller: 'Traveller',
  fabled: 'Fabled',
  loric: 'Loric',
}

type Death = { phase: string; how: 'executed' | 'died' }

function realOf(seat: Seat) {
  return getCharacter(seat.trueCharacterId ?? seat.characterId ?? '')
}

function alignmentOf(seat: Seat): 'good' | 'evil' | undefined {
  if (seat.alignmentOverride) return seat.alignmentOverride
  const c = realOf(seat)
  return c ? teamAlignment(c.team) : undefined
}

/** Everything worth saying about a finished game, worked out once. */
function analyse(game: Game) {
  const seats = game.seats
  const byId = new Map(seats.map((s) => [s.id, s]))
  const name = (id: string) => byId.get(id)?.name ?? '?'

  const deaths = new Map<string, Death>()
  for (const entry of game.log) {
    if (entry.kind === 'execution' || entry.kind === 'death') {
      for (const id of entry.seatIds) {
        if (!deaths.has(id)) {
          deaths.set(id, { phase: entry.phase, how: entry.kind === 'execution' ? 'executed' : 'died' })
        }
      }
    }
  }
  // A player revived later is alive now; what the log says stands as history.
  const dead = seats.filter((s) => !s.alive)

  const nominations = game.nominations.filter((n) => n.settled)
  const nominatedCount = new Map<string, number>()
  const nominatorCount = new Map<string, number>()
  const handsCount = new Map<string, number>()
  let votesCast = 0
  for (const n of nominations) {
    nominatedCount.set(n.nomineeId, (nominatedCount.get(n.nomineeId) ?? 0) + 1)
    nominatorCount.set(n.nominatorId, (nominatorCount.get(n.nominatorId) ?? 0) + 1)
    for (const v of n.voterIds) handsCount.set(v, (handsCount.get(v) ?? 0) + 1)
    votesCast += n.voterIds.length
  }
  const top = (m: Map<string, number>) => {
    let best: [string, number] | null = null
    for (const [id, c] of m) if (!best || c > best[1]) best = [id, c]
    return best
  }
  const executions = game.log.filter((l) => l.kind === 'execution').length
  const nightDeaths = game.log.filter((l) => l.kind === 'death' && /^Night/.test(l.phase)).length
  const biggest = nominations.reduce<typeof nominations[number] | null>(
    (b, n) => (!b || n.tally > b.tally ? n : b),
    null,
  )
  const closest = nominations
    .filter((n) => n.tally < n.majority)
    .reduce<typeof nominations[number] | null>(
      (b, n) => (!b || n.majority - n.tally < b.majority - b.tally ? n : b),
      null,
    )
  const lies = new Map<string, number>()
  for (const l of game.log) {
    if (l.info && !l.info.truthful) lies.set(l.info.toSeatId, (lies.get(l.info.toSeatId) ?? 0) + 1)
  }
  const firstDeath = game.log.find((l) => l.kind === 'death' || l.kind === 'execution')
  const days = Math.max(0, ...game.log.map((l) => Number(/^Day (\d+)/.exec(l.phase)?.[1] ?? 0)))
  const nights = Math.max(0, ...game.log.map((l) => Number(/^Night (\d+)/.exec(l.phase)?.[1] ?? 0)))
  const minutes = game.finishedAt ? Math.round((game.finishedAt - game.createdAt) / 60000) : null

  const survivors = seats.filter((s) => s.alive && !s.isTraveller)
  const evilSurvivors = survivors.filter((s) => alignmentOf(s) === 'evil')

  return {
    name,
    deaths,
    dead,
    nominations,
    votesCast,
    executions,
    nightDeaths,
    biggest,
    closest,
    days,
    nights,
    minutes,
    mostNominated: top(nominatedCount),
    mostNominating: top(nominatorCount),
    mostHands: top(handsCount),
    mostLiedTo: top(lies),
    firstDeath,
    survivors,
    evilSurvivors,
  }
}

/**
 * The recap: the story of the game, laid out for reading aloud while the
 * table reveals, and for looking back on later.
 */
export function RecapScreen({
  game,
  go,
  onBack,
}: {
  game: Game
  go: (s: ScreenName) => void
  onBack?: () => void
}) {
  const a = useMemo(() => analyse(game), [game])
  const ended = game.phase.k === 'ended' ? game.phase : null
  const winner = ended?.winner
  const winnerColour = winner === 'good' ? 'text-(--color-blue-2)' : 'text-(--color-red-2)'

  const exportGame = () => {
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `grimoire-${game.scriptName.toLowerCase().replace(/\s+/g, '-')}-${new Date(game.createdAt).toISOString().slice(0, 10)}.json`
    el.click()
    URL.revokeObjectURL(url)
  }

  let lastPhase = ''

  return (
    <Screen
      title="The recap"
      subtitle={`${game.scriptName} · ${new Date(game.createdAt).toLocaleDateString()}`}
      onBack={onBack ?? (() => go('home'))}
      bottom={
        <div className="flex gap-2">
          <Button onClick={exportGame} aria-label="Export this game">
            <Export size={18} />
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => go('plan')}>
            New game
          </Button>
        </div>
      }
    >
      {/* --- The verdict ------------------------------------------------- */}
      <section className="pt-8 text-center">
        <div className="caps text-(--text-faint)">
          {ended ? 'The game is over' : 'Still in play'}
        </div>
        {ended && (
          <h2 className={`display mt-2 text-[64px] leading-[0.95] ${winnerColour}`}>
            {winner === 'good' ? 'Good' : 'Evil'}
            <br />
            wins
          </h2>
        )}
        {ended?.rationale && (
          <p className="serif mx-auto mt-4 max-w-[30ch] text-[18px] leading-snug text-(--text-dim)">
            {ended.rationale}
          </p>
        )}
      </section>

      <dl className="mt-8 grid grid-cols-3 gap-y-6 border-y border-(--hairline) py-5 text-center">
        <Stat n={game.seats.length} label="Players" />
        <Stat n={a.nights} label={a.nights === 1 ? 'Night' : 'Nights'} />
        <Stat n={a.days} label={a.days === 1 ? 'Day' : 'Days'} />
        <Stat n={a.nominations.length} label="Nominations" />
        <Stat n={a.executions} label={a.executions === 1 ? 'Execution' : 'Executions'} />
        <Stat n={a.nightDeaths} label="Night deaths" />
        {a.minutes !== null && (
          <Stat
            n={a.minutes >= 60 ? `${Math.floor(a.minutes / 60)}h ${a.minutes % 60}m` : `${a.minutes}m`}
            label="Played for"
          />
        )}
        <Stat n={a.votesCast} label="Hands raised" />
        <Stat n={a.survivors.length} label="Survived" />
      </dl>

      {/* --- The final grimoire ------------------------------------------ */}
      <section className="mt-10">
        <Label>The final grimoire</Label>
        <div className="relative flex h-[400px] flex-col">
          <Grimoire count={game.seats.length} keys={game.seats.map((s) => s.id)}>
            {(i) => {
              const seat = game.seats[i]
              if (!seat) return null
              const c = realOf(seat)
              return (
                <div className="relative flex flex-col items-center">
                  <CharacterToken
                    character={c}
                    dead={!seat.alive}
                    voteSpent={!seat.alive && !seat.deadVoteAvailable}
                    alignment={seat.alignmentOverride}
                  />
                  <span className="seat-name">{seat.name}</span>
                </div>
              )
            }}
          </Grimoire>
        </div>
      </section>

      {/* --- Who was who ------------------------------------------------- */}
      <section className="mt-8">
        <Label>Who was who</Label>
        <ul className="m-0 list-none border-t border-(--hairline) p-0">
          {game.seats.map((seat) => {
            const real = realOf(seat)
            const believed = getCharacter(seat.characterId ?? '')
            const align = alignmentOf(seat)
            const death = a.deaths.get(seat.id)
            return (
              <li key={seat.id} className="flex items-center gap-3 border-b border-(--hairline) py-2.5">
                <CharacterToken character={real} size="40px" dead={!seat.alive} alignment={seat.alignmentOverride} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[16px] ${seat.alive ? 'text-(--text)' : 'text-(--text-dim)'}`}>
                      {seat.name}
                    </span>
                    <span
                      className={`caps text-[10px] ${
                        align === 'evil' ? 'text-(--color-red-2)' : align === 'good' ? 'text-(--color-blue-2)' : 'text-(--text-faint)'
                      }`}
                    >
                      {real ? `${real.name} · ${TEAM[real.team] ?? real.team}` : 'no character'}
                    </span>
                  </div>
                  <div className="serif text-[13.5px] text-(--text-faint)">
                    {seat.trueCharacterId && believed ? `Believed they were the ${believed.name}. ` : ''}
                    {seat.isTraveller ? 'Travelled through. ' : ''}
                    {seat.alive
                      ? 'Alive at the end.'
                      : death
                        ? `${death.how === 'executed' ? 'Executed' : 'Died'}, ${death.phase.toLowerCase()}.`
                        : 'Dead.'}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* --- Honours ----------------------------------------------------- */}
      <section className="mt-10">
        <Label>Honours</Label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-(--hairline) pt-5">
          {a.mostNominated && (
            <Honour big={a.name(a.mostNominated[0])} label="Most accused" detail={`nominated ${a.mostNominated[1]} time${a.mostNominated[1] === 1 ? '' : 's'}`} />
          )}
          {a.mostNominating && (
            <Honour big={a.name(a.mostNominating[0])} label="Most accusing" detail={`made ${a.mostNominating[1]} nomination${a.mostNominating[1] === 1 ? '' : 's'}`} />
          )}
          {a.mostHands && (
            <Honour big={a.name(a.mostHands[0])} label="Itchy hand" detail={`voted ${a.mostHands[1]} time${a.mostHands[1] === 1 ? '' : 's'}`} />
          )}
          {a.firstDeath && a.firstDeath.seatIds[0] && (
            <Honour big={a.name(a.firstDeath.seatIds[0])} label="First to fall" detail={a.firstDeath.phase} />
          )}
          {a.biggest && (
            <Honour big={String(a.biggest.tally)} label="Biggest vote" detail={`against ${a.name(a.biggest.nomineeId)}`} />
          )}
          {a.closest && (
            <Honour big={`${a.closest.tally} of ${a.closest.majority}`} label="Closest escape" detail={`${a.name(a.closest.nomineeId)} lived`} />
          )}
          {a.mostLiedTo && (
            <Honour big={a.name(a.mostLiedTo[0])} label="Most deceived" detail={`given ${a.mostLiedTo[1]} false piece${a.mostLiedTo[1] === 1 ? '' : 's'} of information`} />
          )}
          {a.evilSurvivors.length > 0 && (
            <Honour big={a.evilSurvivors.map((s) => s.name).join(', ')} label="Evil, never caught" detail="alive at the end" />
          )}
          {game.bluffs.length > 0 && (
            <Honour
              big={game.bluffs.map((id) => getCharacter(id)?.name ?? id).join(', ')}
              label="The Demon's bluffs"
              detail="never in play"
              small
            />
          )}
        </div>
      </section>

      {/* --- Every vote -------------------------------------------------- */}
      {a.nominations.length > 0 && (
        <section className="mt-10">
          <Label>Every vote</Label>
          <ul className="m-0 list-none border-t border-(--hairline) p-0">
            {a.nominations.map((n) => {
              const passed = n.tally >= n.majority
              return (
                <li key={n.id} className="border-b border-(--hairline) py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px]">
                      <span className="text-(--text-dim)">Day {n.day} · </span>
                      {a.name(n.nominatorId)} <span className="text-(--text-faint)">nominated</span>{' '}
                      {a.name(n.nomineeId)}
                    </span>
                    <span className={`tabular display text-[22px] leading-none ${passed ? 'text-(--color-red-2)' : 'text-(--text-dim)'}`}>
                      {n.tally}
                      <span className="text-[13px] text-(--text-faint)"> / {n.majority}</span>
                    </span>
                  </div>
                  <div className="serif mt-1 text-[13.5px] text-(--text-faint)">
                    {n.voterIds.length === 0 ? 'No hands.' : n.voterIds.map(a.name).join(', ')}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* --- The story --------------------------------------------------- */}
      <section className="mt-10 pb-8">
        <Label>How it went</Label>
        <ol className="m-0 list-none p-0">
          {game.log.map((entry) => {
            const showPhase = entry.phase !== lastPhase
            lastPhase = entry.phase
            return (
              <li key={entry.id}>
                {showPhase && (
                  <div className="mt-6 mb-2 flex items-center gap-3 first:mt-0">
                    <span className="display text-[22px] leading-none text-(--text)">{entry.phase}</span>
                    <span className="h-px flex-1 bg-(--hairline)" />
                  </div>
                )}
                <div className={`serif py-0.5 text-[15px] leading-snug ${TONE[entry.kind]}`}>
                  {entry.text}
                  {entry.info && (
                    <span className={entry.info.truthful ? ' text-(--text-faint)' : ' text-(--now)'}>
                      {' '}
                      ({entry.info.truthful ? 'true' : 'a lie'})
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </Screen>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <dd className="tabular display m-0 text-[32px] leading-none text-(--text)">{n}</dd>
      <dt className="caps mt-1.5 text-[10px] text-(--text-faint)">{label}</dt>
    </div>
  )
}

function Honour({ big, label, detail, small = false }: { big: string; label: string; detail: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="caps text-[10px] text-(--text-faint)">{label}</div>
      <div className={`display mt-1 leading-none text-(--text) ${small ? 'text-[18px]' : 'text-[26px]'} break-words`}>
        {big}
      </div>
      <div className="serif mt-1 text-[13.5px] text-(--text-dim)">{detail}</div>
    </div>
  )
}
