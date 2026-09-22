import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { useStore } from './state/store.js'
import { startSync } from './state/sync.js'
import { RoomProvider } from './room.js'
import { HomeScreen } from './screens/Home.js'
import { PlanScreen } from './screens/Plan.js'
import { RunScreen } from './screens/Run.js'
import { HistoryScreen } from './screens/History.js'
import { SettingsScreen } from './screens/Settings.js'
import { RecapScreen } from './screens/Recap.js'
import { useWakeLock } from './hooks/useWakeLock.js'

export type Screen = 'home' | 'plan' | 'run' | 'history' | 'settings' | 'recap'

export function App() {
  const game = useStore((s) => s.game)
  const dim = useStore((s) => s.settings.dim)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  const [screen, setScreen] = useState<Screen>('home')
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), [])

  // The game is kept on the server; another device's changes arrive here.
  useEffect(
    () =>
      startSync(
        // Undo steps were recorded against the old copy and would corrupt the new one.
        () => Promise.resolve(useStore.persist.rehydrate()).then(() => {
          useStore.setState({ undoStack: [] })
        }),
        () => useStore.persist.hasHydrated(),
      ),
    [],
  )

  // A live game is holding the phone for ninety minutes; keep the screen on.
  useWakeLock(keepAwake && game !== null && game.phase.k !== 'setup')

  useEffect(() => {
    document.documentElement.dataset.dim = dim ? 'true' : 'false'
  }, [dim])

  // Opening the app mid-game lands on the grimoire without a tap. Only on
  // boot: the back button must be allowed to leave it afterwards.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    // The store hydrates from IndexedDB after first paint; wait for it, or
    // the decision would be made against an empty game.
    if (!useStore.persist.hasHydrated()) return
    booted.current = true
    if (game && (game.phase.k === 'night' || game.phase.k === 'day')) setScreen('run')
  }, [game, hydrated])

  // A game that has just ended goes straight to its recap, and a game that is
  // gone cannot be run.
  useEffect(() => {
    if (game?.phase.k === 'ended' && screen === 'run') setScreen('recap')
    if (!game && (screen === 'run' || screen === 'recap')) setScreen('home')
  }, [game, screen])

  return (
    <RoomProvider>
      {screen === 'home' && <HomeScreen go={setScreen} />}
      {screen === 'plan' && <PlanScreen go={setScreen} />}
      {screen === 'run' && <RunScreen go={setScreen} />}
      {screen === 'history' && <HistoryScreen go={setScreen} />}
      {screen === 'settings' && <SettingsScreen go={setScreen} />}
      {screen === 'recap' && game && <RecapScreen game={game} go={setScreen} />}
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
    </RoomProvider>
  )
}
