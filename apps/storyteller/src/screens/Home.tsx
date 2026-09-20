import { Book, Candle, Hourglass, Ring, Rows, Row, Button, Scroll, BuildStamp } from '@botc/ui'
import { BUILD } from '../config.js'
import { useState } from 'react'
import { useRoom } from '../room.js'
import { enablePush, pushState, type PushState } from '../push.js'
import { useStore, phaseLabel } from '../state/store.js'
import type { Screen as ScreenName } from '../App.js'

/**
 * The front door.
 *
 * A wordmark, the clock face, and a short list. Nothing here needs a box:
 * the one thing to press is the filled button at the bottom.
 */
export function HomeScreen({ go }: { go: (s: ScreenName) => void }) {
  const game = useStore((s) => s.game)
  const roster = useStore((s) => s.roster)
  const savedScripts = useStore((s) => s.savedScripts)
  const history = useStore((s) => s.history)
  const live = game && (game.phase.k === 'night' || game.phase.k === 'day')
  const ended = game?.phase.k === 'ended'

  return (
    <div className="flex h-full flex-col bg-(--bg)">
      <main
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="pt-10 text-center">
          <h1 className="display text-[44px] leading-none">Grimoire</h1>
          <div className="caps mt-2 text-(--text-faint)" style={{ letterSpacing: '0.26em' }}>
            Storyteller&rsquo;s companion
          </div>
        </div>

        <ClockFace />

        <Rows className="mt-4">
          {live && (
            <Row
              leading={<Book size={20} />}
              trailing={`${phaseLabel(game.phase)} · continue`}
              onClick={() => go('run')}
            >
              {game.scriptName}
            </Row>
          )}
          {ended && (
            <Row leading={<Scroll size={20} />} trailing="recap" onClick={() => go('recap')}>
              {game.scriptName}
            </Row>
          )}
          <Row
            leading={<Ring size={20} />}
            trailing={roster.length > 0 ? String(roster.length) : undefined}
            onClick={() => go('plan')}
          >
            Your regulars
          </Row>
          <Row
            leading={<Book size={20} />}
            trailing={savedScripts.length > 0 ? `${savedScripts.length} saved` : undefined}
            onClick={() => go('plan')}
          >
            Scripts
          </Row>
          <Row
            leading={<Hourglass size={20} />}
            trailing={history.length > 0 ? String(history.length) : undefined}
            onClick={() => go('history')}
          >
            Past games
          </Row>
          <Row leading={<Candle size={20} />} onClick={() => go('settings')}>
            Settings
          </Row>
        </Rows>
      </main>

      <div
        className="shrink-0 border-t border-(--hairline) bg-(--surface) px-5 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
      >
        <Button variant="primary" live className="w-full" onClick={() => go('plan')}>
          {live ? 'Start another game' : 'New game'}
        </Button>
        <Alerts />
        <BuildStamp build={BUILD} />
      </div>
    </div>
  )
}

/** The clock face, drawn as lines. The hand sits a little past eleven: the
 *  last wake of the night. This is also the app icon. */
function ClockFace() {
  const r = 70
  return (
    <svg
      viewBox="0 0 160 160"
      className="mx-auto mt-6 block size-[150px] text-(--text)"
      aria-hidden
    >
      <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <line
            key={i}
            x1={80 + Math.cos(a) * r}
            y1={80 + Math.sin(a) * r}
            x2={80 + Math.cos(a) * (r - 8)}
            y2={80 + Math.sin(a) * (r - 8)}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
      <line
        x1="80"
        y1="80"
        x2={80 + Math.cos(-1.92) * 46}
        y2={80 + Math.sin(-1.92) * 46}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="80" cy="80" r="3" fill="currentColor" />
    </svg>
  )
}


/** The Storyteller's own buzz: a hand, a seat, two players talking. */
function Alerts() {
  const { subscribe } = useRoom()
  const [state, setState] = useState<PushState>(() => pushState())
  const [busy, setBusy] = useState(false)
  if (state === 'unsupported' || state === 'on') return null
  const turnOn = async () => {
    setBusy(true)
    try {
      const sub = await enablePush()
      if (sub) subscribe(sub)
    } finally {
      setBusy(false)
      setState(pushState())
    }
  }
  return (
    <div className="mt-4 rounded-2xl border border-(--hairline-strong) px-4 py-3">
      {state === 'install-first' ? (
        <p className="serif text-[14px] leading-snug text-(--text-dim)">
          To get a buzz on this phone: Share, Add to Home Screen, open it from there, then turn alerts on here.
        </p>
      ) : state === 'denied' ? (
        <p className="serif text-[14px] leading-snug text-(--text-dim)">Alerts are blocked for this app in Settings.</p>
      ) : (
        <Button className="w-full" disabled={busy} onClick={() => void turnOn()}>
          {busy ? 'Turning on…' : 'Turn on alerts on this phone'}
        </Button>
      )}
    </div>
  )
}
