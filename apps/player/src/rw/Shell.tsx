import { useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { PayloadError, payloadFromHash } from '@botc/protocol'
import { getCharacter, teamAlignment } from '@botc/rules'
import { alert } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'
import { Scene, type Light } from './Scene.js'
import { TableScreen, useSeats } from './Table.js'
import { CodePage, GrimoirePage, Letter, LettersPage, MessagesPage, NamePage, ScriptPage, ThreadPage } from './Pages.js'
import { MenuSheet, PersonSheet } from './Sheets.js'
import { Lantern, Tok } from './Token.js'
import { afterBack } from './words.js'
import './rw.css'

type Page = { k: 'table' } | { k: 'messages' } | { k: 'thread'; id: string } | { k: 'letters' } | { k: 'script' } | { k: 'grimoire' }

const TEAM: Record<string, string> = { townsfolk: 'Townsfolk', outsider: 'Outsider', minion: 'Minion', demon: 'Demon', traveller: 'Traveller' }

/**
 * Ravenswood, the player's app.
 *
 * One screen, the table, with everything else a step away and the phone's
 * own back gesture always the way home. The scene behind it is the time of
 * day, and a change of phase is the scene changing, which is why nothing
 * replays on a reload: a fresh page simply draws the time it already is.
 */
function clock(ms: number) {
  const s = Math.max(0, Math.ceil((ms - 200) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Shell() {
  const applyPayload = useStore((s) => s.applyPayload)
  const payload = useStore((s) => s.payload)
  const phase = useStore((s) => s.phase)
  const phaseKnown = useStore((s) => s.phaseKnown)
  const characterId = useStore((s) => s.characterId)
  const roleChanged = useStore((s) => s.roleChanged)
  const markRevealed = useStore((s) => s.markRevealed)
  const messages = useStore((s) => s.messages)
  const whispersSeen = useStore((s) => s.whispersSeen)
  const seeWhispers = useStore((s) => s.seeWhispers)
  const grimoire = useStore((s) => s.grimoire)
  const timer = useStore((s) => s.timer)
  const timerRang = useStore((s) => s.timerRang)
  const setTimerRang = useStore((s) => s.setTimerRang)
  const over = useStore((s) => s.over)
  const overSeenAt = useStore((s) => s.overSeenAt)
  const phaseAt = useStore((s) => s.phaseAt)
  const seeOver = useStore((s) => s.seeOver)
  const { claimed, status } = useRelay()
  const { all } = useSeats()

  const [page, setPage] = useState<Page>({ k: 'table' })
  const [person, setPerson] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [enter, setEnter] = useState(false)
  const [later, setLater] = useState(false)

  // The grimoire arriving is the Storyteller waking the Spy: say so, and go
  // straight to it. A reload finds it already here and says nothing.
  const [grimNew, setGrimNew] = useState(false)
  const lastGrim = useRef(grimoire)
  useEffect(() => {
    if (grimoire && grimoire !== lastGrim.current && lastGrim.current !== undefined) setGrimNew(true)
    lastGrim.current = grimoire
  }, [grimoire])

  // ---- the scanned code, read and then wiped from the address bar
  useEffect(() => {
    const read = () => {
      if (!window.location.hash) return
      try {
        const parsed = payloadFromHash(window.location.hash)
        if (parsed) {
          applyPayload(parsed)
          setPage({ k: 'table' })
        }
      } catch (err) {
        toast.error(err instanceof PayloadError ? err.message : 'That code could not be read.')
      } finally {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    let unsub: (() => void) | undefined
    if (useStore.persist.hasHydrated()) read()
    else unsub = useStore.persist.onFinishHydration(() => read())
    window.addEventListener('hashchange', read)
    return () => {
      unsub?.()
      window.removeEventListener('hashchange', read)
    }
  }, [applyPayload])

  // ---- pages sit on the history stack, so back always comes home
  // Each page's history entry carries the page, so back lands exactly where it
  // was, and a sheet closing never moves the page underneath it.
  const go = (next: Page) => {
    history.pushState({ page: next }, '')
    setPage(next)
  }
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (e.state?.sheet) return
      setPage((e.state?.page as Page | undefined) ?? { k: 'table' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ---- light: the phase, with dawn held for a few seconds after a night
  const night = phaseKnown && /^night/i.test(phase)
  const [dawn, setDawn] = useState(false)
  const [deaths, setDeaths] = useState<string[]>([])
  const aliveAtDusk = useRef<Set<string> | null>(null)
  const wasNight = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasNight.current === true && !night) {
      const before = aliveAtDusk.current
      setDeaths(before ? all.filter((s) => !s.alive && before.has(s.name)).map((s) => s.name) : [])
      setDawn(true)
      const t = window.setTimeout(() => setDawn(false), 9000)
      wasNight.current = night
      return () => window.clearTimeout(t)
    }
    if (night && wasNight.current !== true) aliveAtDusk.current = new Set(all.filter((s) => s.alive).map((s) => s.name))
    wasNight.current = night
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night])
  // Deaths the Storyteller records a moment after dawn still belong to the night.
  useEffect(() => {
    if (!dawn || !aliveAtDusk.current) return
    setDeaths(all.filter((s) => !s.alive && aliveAtDusk.current!.has(s.name)).map((s) => s.name))
  }, [all, dawn])
  const light: Light = !phaseKnown || /^setup/i.test(phase) ? 'dusk' : night ? 'night' : dawn ? 'dawn' : 'day'

  // ---- quiet signals from the room
  useEffect(() => {
    const onChat = (e: Event) => {
      const { seatId, name } = (e as CustomEvent<{ seatId: string; name: string }>).detail
      if (page.k === 'thread' && page.id === seatId) return
      toast(`${name} sent you a message`, { duration: 6000, action: { label: 'Read', onClick: () => go({ k: 'thread', id: seatId }) } })
    }
    const onNudge = () => toast('The Storyteller needs you. Look up.', { duration: 6000 })
    const onHint = (e: Event) => toast((e as CustomEvent<string>).detail, { duration: 2500 })
    window.addEventListener('botc:chat', onChat)
    window.addEventListener('botc:nudge', onNudge)
    window.addEventListener('rw:hint', onHint)
    return () => {
      window.removeEventListener('botc:chat', onChat)
      window.removeEventListener('botc:nudge', onNudge)
      window.removeEventListener('rw:hint', onHint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // ---- the timer, counted on this phone's own clock
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [timer])
  const left = timer ? timer.endsAt - now : 0
  const [timesUp, setTimesUp] = useState(false)
  useEffect(() => {
    if (!timer || left > 0 || timer.endsAt === timerRang) return
    // A timer that ended while the phone was away is not an alarm now.
    if (now - timer.endsAt > 15_000) return setTimerRang(timer.endsAt)
    setTimerRang(timer.endsAt)
    alert('timesup')
    setTimesUp(true)
    const t = window.setTimeout(() => setTimesUp(false), 5000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, left <= 0])

  // ---- the end of the game, said once
  const finished = phaseKnown && /^finished/i.test(phase) && over !== null
  const showOver = finished && overSeenAt !== (phaseAt ?? null) && !reveal && page.k === 'table'
  useEffect(() => {
    if (showOver) alert('over')
  }, [showOver])

  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if (payload?.kind !== 'room' || status === 'open') return setOffline(false)
    const t = window.setTimeout(() => setOffline(true), 3000)
    return () => window.clearTimeout(t)
  }, [status, payload])

  const character = getCharacter(characterId ?? '')
  const hasCharacter = Boolean(character && character.id !== 'drunk')
  const unseen = messages.length > whispersSeen
  const readingPage = page.k !== 'table'

  let body: React.ReactNode
  if (!payload) body = <CodePage />
  else if (payload.kind === 'room' && !claimed) body = <NamePage onClaimed={() => setEnter(true)} />
  else if (page.k === 'messages') body = <MessagesPage onBack={() => history.back()} onThread={(id) => go({ k: 'thread', id })} onLetters={() => go({ k: 'letters' })} />
  else if (page.k === 'thread') body = <ThreadPage seatId={page.id} onBack={() => history.back()} />
  else if (page.k === 'letters') body = <LettersPage onBack={() => history.back()} />
  else if (page.k === 'script') body = <ScriptPage onBack={() => history.back()} />
  else if (page.k === 'grimoire') body = <GrimoirePage onBack={() => { setGrimNew(false); history.back() }} />
  else
    body = (
      <TableScreen
        light={light}
        deaths={deaths}
        enter={enter}
        onPerson={setPerson}
        onMenu={() => setMenu(true)}
        onMessages={() => go({ k: 'messages' })}
        onReveal={(open) => {
          setReveal(open)
          if (open) markRevealed()
        }}
      />
    )

  const naming = payload?.kind === 'room' && !claimed
  const veil = !payload ? 0 : naming || readingPage ? 0.62 : 0

  return (
    <div className={`rw${night ? ' is-night' : ''}`}>
      <Scene light={light} veil={veil} props={!naming && !readingPage} />
      {body}

      <PersonSheet
        name={person}
        onClose={() => setPerson(null)}
        onMessage={(id) => afterBack(() => { setPerson(null); go({ k: 'thread', id }) })}
      />
      <MenuSheet
        open={menu}
        onClose={() => setMenu(false)}
        onScript={() => afterBack(() => { setMenu(false); go({ k: 'script' }) })}
        onGrimoire={() => afterBack(() => { setMenu(false); go({ k: 'grimoire' }) })}
      />

      {/* your character, while the lantern is held */}
      {reveal && character && hasCharacter && (
        <div className="rw-over" aria-live="polite">
          <div className="veil" style={{ background: 'rgba(2,3,8,.94)' }} />
          <div className="rw-grow" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -80, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(233,192,122,.32), rgba(233,192,122,0))', animation: 'rw-fade 1.2s var(--out) .2s both' }} />
            <Tok character={character} size={Math.min(232, Math.round(window.innerWidth * 0.58))} />
          </div>
          {[
            <div key="n" className="disp" style={{ fontSize: 56, lineHeight: 1, marginTop: 30 }}>{character.name}</div>,
            <div key="t" style={{ color: teamAlignment(character.team) === 'evil' ? 'var(--evil)' : 'var(--good)', marginTop: 8, fontWeight: 500 }}>
              {TEAM[character.team] ?? character.team}, on the {teamAlignment(character.team) === 'evil' ? 'evil' : 'good'} team
            </div>,
            <p key="a" style={{ font: "italic 500 23px/1.35 'Cormorant Garamond'", margin: '18px 0 0', maxWidth: '30ch' }}>{character.ability}</p>,
          ].map((el, i) => (
            <div key={i} className="rw-rise" style={{ position: 'relative', animationDelay: `${0.35 + i * 0.12}s` }}>{el}</div>
          ))}
          <div className="rw-help" style={{ position: 'absolute', bottom: 'calc(40px + var(--safe-bottom, env(safe-area-inset-bottom)))', left: 0, right: 0 }}>Let go to hide</div>
        </div>
      )}

      {/* a note from the Storyteller, the moment it arrives */}
      {payload && !naming && !reveal && unseen && !later && page.k === 'table' && (
        <div className="rw-over">
          <div className="veil" style={{ background: 'rgba(2,3,8,.7)' }} />
          <div className="disp rw-rise" style={{ position: 'relative', fontSize: 34, lineHeight: 1.15, marginBottom: 50 }}>The Storyteller has a note for you</div>
          <div className="rw-rise" style={{ position: 'relative', width: '100%', animationDelay: '.15s' }}>
            <Letter text={messages[whispersSeen]!.text} at={messages[whispersSeen]!.at} onRead={() => undefined} />
          </div>
          <div style={{ position: 'relative', marginTop: 26, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <button className="rw-btn line" onClick={seeWhispers}>I’ve read it</button>
            <button className="rw-btn ghost" onClick={() => setLater(true)}>Later</button>
          </div>
        </div>
      )}

      {payload && hasCharacter && roleChanged && !reveal && !grimNew && page.k === 'table' && (
        <div className="rw-banner">
          <Tok size={40} hot>
            <Lantern size={20} />
          </Tok>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Your character has changed</div>
            <div style={{ fontSize: 14, color: 'var(--dim)' }}>Hold your lantern to see it.</div>
          </div>
        </div>
      )}

      {grimNew && page.k !== 'grimoire' && !reveal && (
        <button className="rw-banner" onClick={() => { setGrimNew(false); go({ k: 'grimoire' }) }}>
          <Tok size={40} hot>
            <Lantern size={20} />
          </Tok>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>The Storyteller is showing you the grimoire</div>
            <div style={{ fontSize: 14, color: 'var(--dim)' }}>Tap to open it. Only you can see it.</div>
          </div>
        </button>
      )}

      {/* the Storyteller's countdown, small, on every page */}
      {timer && !timesUp && (
        <div className={`rw-timer${left <= 10_000 ? ' ending' : ''}${left <= 0 ? ' done' : ''}`} role="timer" aria-live="off">
          <span className="t">{clock(left)}</span>
          {timer.label && <span className="l">{left <= 0 ? 'Time is up' : timer.label}</span>}
        </div>
      )}

      {timesUp && (
        <div className="rw-over" onClick={() => setTimesUp(false)}>
          <div className="veil" style={{ background: 'rgba(2,3,8,.82)' }} />
          <div className="disp rw-rise" style={{ position: 'relative', fontSize: 64, lineHeight: 1 }}>Time is up</div>
          {timer?.label && <div className="rw-rise" style={{ position: 'relative', marginTop: 12, color: 'var(--dim)', fontSize: 18, animationDelay: '.1s' }}>{timer.label} is over</div>}
        </div>
      )}

      {showOver && over && (
        <div className="rw-over">
          <div className="veil" style={{ background: 'rgba(2,3,8,.9)' }} />
          <div className="rw-rise" style={{ position: 'relative', color: 'var(--dim)', fontSize: 16 }}>The game is over</div>
          <div className="disp rw-rise" style={{ position: 'relative', fontSize: 72, lineHeight: 1, marginTop: 10, color: over.winner === 'evil' ? 'var(--evil)' : 'var(--good)', animationDelay: '.1s' }}>
            {over.winner === 'evil' ? 'Evil' : 'Good'} wins
          </div>
          {over.reason && <p className="rw-rise" style={{ position: 'relative', font: "italic 500 22px/1.35 'Cormorant Garamond'", margin: '18px 0 0', maxWidth: '30ch', animationDelay: '.2s' }}>{over.reason}</p>}
          <p className="rw-rise" style={{ position: 'relative', color: 'var(--dim)', fontSize: 15, margin: '22px 0 0', maxWidth: '32ch', animationDelay: '.3s' }}>
            Wait for the Storyteller. When they ask, hold your lantern and show the table who you were.
          </p>
          <button className="rw-btn line rw-rise" style={{ position: 'relative', marginTop: 26, animationDelay: '.4s' }} onClick={seeOver}>Back to the table</button>
        </div>
      )}

      {offline && !roleChanged && !grimNew && (
        <div className="rw-banner">
          <Tok size={40}>
            <Lantern size={20} lit={false} />
          </Tok>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Reconnecting</div>
            <div style={{ fontSize: 14, color: 'var(--dim)' }}>Your notes and character are safe on this phone.</div>
          </div>
        </div>
      )}

      <Toaster
        position="top-center"
        offset={{ top: 'calc(12px + var(--safe-top, env(safe-area-inset-top)))' }}
        toastOptions={{
          style: {
            background: 'rgba(18,22,34,.96)',
            border: '1px solid rgba(182,154,94,.32)',
            color: '#EFE7D6',
            borderRadius: 22,
            fontFamily: "'Alegreya Sans', sans-serif",
            fontSize: 16,
          },
        }}
      />
    </div>
  )
}
