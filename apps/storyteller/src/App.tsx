import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useStore } from './state/store.js'
import { PlanScreen } from './screens/Plan.js'
import { RunScreen } from './screens/Run.js'
import { HistoryScreen } from './screens/History.js'
import { SettingsScreen } from './screens/Settings.js'
import { useWakeLock } from './hooks/useWakeLock.js'

export type Screen = 'plan' | 'run' | 'history' | 'settings'

export function App() {
  const game = useStore((s) => s.game)
  const dim = useStore((s) => s.settings.dim)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  const [screen, setScreen] = useState<Screen>('plan')

  // A live game is holding the phone for ninety minutes; keep the screen on.
  useWakeLock(keepAwake && game !== null && game.phase.k !== 'setup')

  useEffect(() => {
    document.documentElement.dataset.dim = dim ? 'true' : 'false'
  }, [dim])

  // Landing in Setup with no game, or in a live game, should not need a tap.
  useEffect(() => {
    if (game && game.phase.k !== 'setup' && screen === 'plan') setScreen('run')
    if (!game && screen === 'run') setScreen('plan')
  }, [game, screen])

  return (
    <>
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
