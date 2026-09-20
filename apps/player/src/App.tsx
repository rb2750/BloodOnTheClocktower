import { useEffect, useState } from 'react'
import { ChevronLeft } from '@botc/ui'
import { Toaster, toast } from 'sonner'
import { PayloadError, payloadFromHash } from '@botc/protocol'
import { useStore } from './state.js'
import { ScriptScreen } from './screens/Script.js'
import { HomeScreen } from './screens/Home.js'
import { PlayerCinematic } from './components/PlayerCinematic.js'
import { ThreadScreen } from './screens/Thread.js'

type View = 'home' | 'script'

/**
 * One screen, and one place to go from it.
 *
 * There is no tab bar. A player picks this up once, in a dim room, having never
 * seen it before, so the app opens on the only thing they came for: their own
 * card, and the table around it.
 */
export function App() {
  const applyPayload = useStore((s) => s.applyPayload)
  const [view, setView] = useState<View>('home')

  // Read the scanned code, then strip it from the address bar immediately: it
  // is the one place a role could leak into browser history or a shared link.
  //
  // Listening for `hashchange` as well as reading it on mount matters: a
  // Storyteller who changes someone's character mid-game shows that player a
  // fresh code, and if the app is already open the browser treats that as a
  // same-document navigation and never remounts.
  useEffect(() => {
    const read = () => {
      if (!window.location.hash) return
      try {
        const parsed = payloadFromHash(window.location.hash)
        if (parsed) {
          applyPayload(parsed)
          setView('home')
        }
      } catch (err) {
        toast.error(err instanceof PayloadError ? err.message : 'That code could not be read.')
      } finally {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [applyPayload])

  // The phone's own back gesture is the one navigation every player already
  // knows, so leaving a section is wired to it as well as to the bar.
  useEffect(() => {
    const onPop = () => setView('home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = (next: View) => {
    history.pushState({ view: next }, '')
    setView(next)
  }

  const [thread, setThread] = useState<string | null>(null)
  const openThread = (seatId: string) => {
    history.pushState({ view: 'thread' }, '')
    setThread(seatId)
  }
  useEffect(() => {
    const onPop = () => setThread(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (thread) return <ThreadScreen seatId={thread} onBack={() => history.back()} />

  return (
    <div className="flex h-full flex-col">
      {view !== 'home' && <BackBar onBack={() => history.back()} />}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {view === 'home' && <HomeScreen openRoles={() => open('script')} openThread={openThread} />}
        {view === 'script' && <ScriptScreen />}
      </main>

      <PlayerCinematic />

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
    </div>
  )
}

/** Says where back goes, because "back" alone is a guess in an unfamiliar app. */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex shrink-0 border-b border-(--hairline) bg-(--surface) px-2">
      <button
        onClick={onBack}
        className="flex min-h-(--tap-min) flex-1 items-center gap-1 px-3 text-left text-[16px] text-(--text)"
      >
        <ChevronLeft size={20} strokeWidth={1.75} />
        Your character
      </button>
    </div>
  )
}
