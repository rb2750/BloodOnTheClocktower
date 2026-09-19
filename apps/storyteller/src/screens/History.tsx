import { useState } from 'react'
import { Button, Label, Rows, Row, Export } from '@botc/ui'
import { useStore } from '../state/store.js'
import { Screen } from '../components/Screen.js'
import type { Screen as ScreenName } from '../App.js'
import { RecapScreen } from './Recap.js'

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

  if (game) return <RecapScreen game={game} go={go} onBack={() => setOpenId(null)} />

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

