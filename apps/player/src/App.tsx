import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Quill, Scroll } from '@botc/ui'
import { Toaster, toast } from 'sonner'
import { PayloadError, payloadFromHash } from '@botc/protocol'
import { useStore } from './state.js'
import { MeScreen } from './screens/Me.js'
import { ScriptScreen } from './screens/Script.js'
import { NotesScreen } from './screens/Notes.js'

type View = 'home' | 'script' | 'notes'

/**
 * Two places to go, both named in words on the home screen.
 *
 * There is no tab bar. A player picks this up once, in a dim room, having never
 * seen it before, so the app opens on the only thing they came for and says
 * what the other two things are in full sentences rather than in icons.
 */
export function App() {
  const applyPayload = useStore((s) => s.applyPayload)
  const payload = useStore((s) => s.payload)
  const seatName = useStore((s) => s.seatName)
  const characterId = useStore((s) => s.characterId)
  const scriptName = useStore((s) => s.scriptName)
  const notes = useStore((s) => s.notes)
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

  // Only notes actually written count: a table full of names nobody has said
  // anything about is not "what you think of six people".
  const noted = Object.values(notes).filter(
    (n) => n.claims.length > 0 || n.stamps.length > 0 || n.lines.length > 0,
  ).length

  return (
    <div className="flex h-full flex-col">
      {view !== 'home' && <BackBar onBack={() => history.back()} />}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {view === 'home' && (
          <>
            {seatName && (
              <p className="caps px-5 pt-5 text-center text-(--text-faint)">You are {seatName}</p>
            )}

            <MeScreen />

            {/* While the question on screen is "who are you?", it is the only
                question on screen. */}
            {payload && (characterId || seatName) && (
              <nav className="mt-8 mb-10">
                <Destination
                  icon={Scroll}
                  title="The script"
                  hint={
                    scriptName
                      ? `What every character in ${scriptName} does`
                      : 'What every character in this game does'
                  }
                  onClick={() => open('script')}
                />
                <Destination
                  icon={Quill}
                  title="Your notes"
                  hint={
                    noted > 0
                      ? `What you make of ${noted} ${noted === 1 ? 'person' : 'people'} so far`
                      : 'Who claimed what, and who you believe'
                  }
                  onClick={() => open('notes')}
                />
              </nav>
            )}
          </>
        )}

        {view === 'script' && <ScriptScreen />}
        {view === 'notes' && <NotesScreen />}
      </main>

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

/** A whole row of the screen, named in words, at the size of a thumb. */
function Destination({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: typeof Scroll
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 border-t border-(--hairline) px-5 py-5 text-left last:border-b"
    >
      <Icon size={24} strokeWidth={1.5} className="shrink-0 text-(--text-dim)" />
      <span className="min-w-0 flex-1">
        <span className="display block text-[21px] leading-tight text-(--text)">{title}</span>
        <span className="serif mt-0.5 block text-[14px] leading-snug text-(--text-faint)">
          {hint}
        </span>
      </span>
      <ChevronRight size={20} strokeWidth={1.5} className="shrink-0 text-(--text-faint)" />
    </button>
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
