import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useStore } from './state/store.js'
import { HomeScreen } from './screens/Home.js'
import { PlanScreen } from './screens/Plan.js'
import { RunScreen } from './screens/Run.js'
import { HistoryScreen } from './screens/History.js'
import { SettingsScreen } from './screens/Settings.js'
import { useWakeLock } from './hooks/useWakeLock.js'

export type Screen = 'home' | 'plan' | 'run' | 'history' | 'settings'

export function App() {
  const game = useStore((s) => s.game)
  const dim = useStore((s) => s.settings.dim)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  const [screen, setScreen] = useState<Screen>('home')

  // A live game is holding the phone for ninety minutes; keep the screen on.
  useWakeLock(keepAwake && game !== null && game.phase.k !== 'setup')

  useEffect(() => {
    document.documentElement.dataset.dim = dim ? 'true' : 'false'
  }, [dim])

  // Landing in a live game should not need a tap, and a game that has ended
  // should not strand the Storyteller on the empty ring.
  useEffect(() => {
    if (game && game.phase.k !== 'setup' && screen === 'home') setScreen('run')
    if (!game && screen === 'run') setScreen('home')
  }, [game, screen])

  return (
    <>
      {screen === 'home' && <HomeScreen go={setScreen} />}
      {screen === 'plan' && <PlanScreen go={setScreen} />}
      {screen === 'run' && <RunScreen go={setScreen} />}
      {screen === 'history' && <HistoryScreen go={setScreen} />}
      {screen === 'settings' && <SettingsScreen go={setScreen} />}
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--surface-raised)',
            border: '1px solid var(--hairline)',
            color: 'var(--text)',
          },
        }}
      />
    </>
  )
}
