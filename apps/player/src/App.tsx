import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { PayloadError, payloadFromHash } from '@botc/protocol'
import { ScrollText, StickyNote, User } from 'lucide-react'
import { useStore } from './state.js'
import { MeScreen } from './screens/Me.js'
import { ScriptScreen } from './screens/Script.js'
import { NotesScreen } from './screens/Notes.js'

type Tab = 'me' | 'script' | 'notes'

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'me', label: 'Me', icon: User },
  { id: 'script', label: 'Script', icon: ScrollText },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

export function App() {
  const applyPayload = useStore((s) => s.applyPayload)
  const payload = useStore((s) => s.payload)
  const [tab, setTab] = useState<Tab>('me')

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
          setTab('me')
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

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'me' && <MeScreen />}
        {tab === 'script' && <ScriptScreen />}
        {tab === 'notes' && <NotesScreen />}
      </main>

      {/* Three destinations, always in the thumb zone, never a menu. */}
      <nav
        className="flex shrink-0 border-t border-(--hairline) bg-(--surface)"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        {TABS.map((t) => {
          const active = tab === t.id
          const disabled = t.id !== 'me' && !payload
          return (
            <button
              key={t.id}
              disabled={disabled}
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-(--tap-min) flex-1 flex-col items-center justify-center gap-1 pt-2 text-[11px] transition-colors disabled:opacity-30 ${
                active ? 'text-(--accent)' : 'text-(--text-faint)'
              }`}
            >
              <t.icon size={19} strokeWidth={active ? 2.25 : 1.9} />
              {t.label}
            </button>
          )
        })}
      </nav>

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
