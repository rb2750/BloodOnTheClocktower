import { useState } from 'react'
import { getCharacter } from '@botc/rules'
import { Button, Label, Rows, Row, Export } from '@botc/ui'
import { useStore } from '../state/store.js'
import { Screen } from '../components/Screen.js'
import type { Screen as ScreenName } from '../App.js'
import type { Game } from '../state/types.js'

export function HistoryScreen({ go }: { go: (s: ScreenName) => void }) {
  const history = useStore((s) => s.history)
  const [openId, setOpenId] = useState<string | null>(null)
  const game = history.find((g) => g.id === openId)

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ history }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grimoire-games-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (game) return <Recap game={game} onBack={() => setOpenId(null)} />

  return (
    <Screen
      title="Past games"
      onBack={() => go('home')}
      bottom={
        history.length > 0 ? (
          <Button className="w-full" onClick={exportAll}>
            <Export size={17} />
            Export everything as JSON
          </Button>
        ) : undefined
      }
    >
      {history.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-(--text-faint)">
          Finished games are kept here, with a walk through what happened.
        </p>
      ) : (
        <Rows className="pb-6">
          {history.map((g) => (
            <Row
              key={g.id}
              onClick={() => setOpenId(g.id)}
              trailing={
                <span
                  className={
                    g.phase.k === 'ended' && g.phase.winner === 'good'
                      ? 'text-(--color-blue-2)'
                      : g.phase.k === 'ended'
                        ? 'text-(--color-red-2)'
                        : undefined
                  }
                >
                  {g.phase.k === 'ended'
                    ? g.phase.winner === 'good'
                      ? 'Good won'
                      : 'Evil won'
                    : 'Unfinished'}
                </span>
              }
            >
              <span className="block">{g.scriptName}</span>
              <span className="caps block text-(--text-faint)">
                {new Date(g.createdAt).toLocaleDateString()} · {g.seats.length} players
              </span>
            </Row>
          ))}
        </Rows>
      )}
    </Screen>
  )
}

/**
 * The end-of-game walkthrough, in the order things actually happened. This is
 * the part the Storyteller reads out while everyone reveals.
 */
function Recap({ game, onBack }: { game: Game; onBack: () => void }) {
  let lastPhase = ''
  return (
    <Screen title={game.scriptName} onBack={onBack}>
      <section className="pb-8">
        <Label>Who was who</Label>
        <ul className="mb-6 space-y-1">
          {game.seats.map((seat) => {
            const real = getCharacter(seat.trueCharacterId ?? seat.characterId ?? '')
            const believed = getCharacter(seat.characterId ?? '')
            return (
              <li
                key={seat.id}
                className="flex items-baseline justify-between border-b border-(--hairline) py-2 first:border-t"
              >
                <span className="text-[14px]">{seat.name}</span>
                <span className="text-[13px] text-(--text-dim)">
                  {real?.name ?? '—'}
                  {seat.trueCharacterId && believed && (
                    <span className="text-(--text-faint)"> (thought: {believed.name})</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        <Label>How it went</Label>
        <ol className="space-y-1">
          {game.log.map((entry) => {
            const showPhase = entry.phase !== lastPhase
            lastPhase = entry.phase
            return (
              <li key={entry.id}>
                {showPhase && (
                  <div className="mb-1 mt-4 flex items-center gap-2 first:mt-0">
                    <span className="caps text-(--text-faint)">{entry.phase}</span>
                    <span className="h-px flex-1 bg-(--hairline)" />
                  </div>
                )}
                <div className="text-[14px] leading-snug text-(--text-dim)">{entry.text}</div>
              </li>
            )
          })}
        </ol>
      </section>
    </Screen>
  )
}
