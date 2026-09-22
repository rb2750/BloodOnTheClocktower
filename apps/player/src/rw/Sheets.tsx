import { useEffect, useMemo, useState } from 'react'
import { getCharacter, teamAlignment, type Character, type Team } from '@botc/rules'
import { BuildStamp, haptic } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'
import { BUILD } from '../config.js'
import { enablePush, pushState, type PushState } from '../push.js'
import { Icon, Lantern, Tok } from './Token.js'
import { RwSheet } from './Sheet.js'
import { useSeats } from './Table.js'
import { word } from './words.js'

/** Marks worth one tap. Older notes may carry others; those still show. */
const READS = ['Trust', 'Suspect', 'Lying', 'Confirmed']
const ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller']
const HEADING: Record<string, string> = { townsfolk: 'Townsfolk', outsider: 'Outsiders', minion: 'Minions', demon: 'Demons', traveller: 'Travellers' }

/**
 * Everything this phone knows about one other player: what they claim, what
 * you make of them, what they said. The picture on their token is only ever
 * the claim you chose, never anything the app was told.
 */
export function PersonSheet({ name, onClose, onMessage }: { name: string | null; onClose: () => void; onMessage: (id: string) => void }) {
  const notes = useStore((s) => s.notes)
  const table = useStore((s) => s.table)
  const chats = useStore((s) => s.chats)
  const day = useStore((s) => s.day)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const addLine = useStore((s) => s.addLine)
  const removeLine = useStore((s) => s.removeLine)
  const setDied = useStore((s) => s.setDied)
  const ensureNote = useStore((s) => s.ensureNote)
  const { others } = useSeats()
  const [picking, setPicking] = useState(false)
  const [line, setLine] = useState('')

  useEffect(() => {
    if (name) ensureNote(name)
    setPicking(false)
  }, [name, ensureNote])

  const note = name ? notes[name] : undefined
  const seat = table.find((t) => t.name === name)
  const i = others.findIndex((o) => o.name === name)
  const where =
    i < 0 ? '' : i === 0 ? 'sits on your left' : i === others.length - 1 ? 'sits on your right' : i < others.length / 2 ? `${word(i + 1).toLowerCase()} seats to your left` : `${word(others.length - i).toLowerCase()} seats to your right`
  const claims = note?.claims ?? []
  const current = claims.at(-1)?.characterId
  const earlier = [...new Set(claims.slice(0, -1).map((c) => c.characterId))].filter((c) => c !== current)
  const reads = [...READS, ...(note?.stamps ?? []).filter((s) => !READS.includes(s))]
  const unread = seat?.id ? (chats[seat.id]?.unread ?? 0) : 0
  const alive = seat ? seat.alive : note?.diedOnDay === undefined

  return (
    <>
      <RwSheet open={Boolean(name && note)} onClose={onClose}>
        {name && note && picking && (
          <Picker
            title={`What does ${name} say?`}
            current={current}
            onBack={() => setPicking(false)}
            onPick={(id) => {
              haptic('confirm')
              if (id !== current) addClaim(name, id)
              setPicking(false)
            }}
          />
        )}
        {name && note && !picking && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Tok name={name} character={getCharacter(current ?? '')} size={64} dead={!alive} team={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{name}</div>
                <div className="rw-sub" style={{ marginTop: 4 }}>
                  {alive ? 'Alive' : 'Dead'}
                  {where ? `, ${where}` : ''}
                </div>
              </div>
            </div>

            <div className="rw-lbl">Says they are</div>
            <div className="rw-chips">
              {[current, ...earlier].filter(Boolean).map((id) => {
                const c = getCharacter(id!)
                if (!c) return null
                return (
                  <button key={id} className={`rw-chip art${id === current ? ' on' : ''}`} onClick={() => { haptic('tap'); addClaim(name, id!) }}>
                    <Tok character={c} size={32} team={false} />
                    {c.name}
                  </button>
                )
              })}
              <button className="rw-chip" onClick={() => setPicking(true)}>
                {current ? 'Something else' : 'Choose a character'}
              </button>
            </div>
            {earlier.length > 0 && <div className="rw-help" style={{ textAlign: 'left', padding: '8px 0 0' }}>They have claimed more than one character.</div>}

            <div className="rw-lbl">Your read</div>
            <div className="rw-chips">
              {reads.map((r) => (
                <button key={r} className={`rw-chip${note.stamps.includes(r) ? ' on' : ''}`} onClick={() => { haptic('tap'); toggleStamp(name, r) }}>
                  {r}
                </button>
              ))}
            </div>

            <div className="rw-lbl">Notes</div>
            {note.lines.map((l) => (
              <div key={l.id} className="rw-line">
                <small>{l.at}</small>
                <span style={{ flex: 1 }}>{l.text}</span>
                <button aria-label="Delete note" onClick={() => removeLine(name, l.id)} style={{ color: 'var(--faint)', padding: 6 }}>
                  {Icon.x}
                </button>
              </div>
            ))}
            <form
              style={{ display: 'flex', gap: 10, marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault()
                addLine(name, line)
                setLine('')
              }}
            >
              <input className="rw-field" value={line} onChange={(e) => setLine(e.target.value)} placeholder={`What did ${name} say?`} enterKeyHint="done" />
              <button type="submit" className="rw-btn line" style={{ width: 50, minHeight: 50, padding: 0, flex: 'none' }} disabled={!line.trim()} aria-label="Add note">
                {Icon.plus}
              </button>
            </form>

            {!seat && (
              <button className="rw-btn ghost" style={{ marginTop: 14 }} onClick={() => setDied(name, alive ? day : undefined)}>
                {alive ? `Mark ${name} as dead` : `${name} is alive after all`}
              </button>
            )}

            {seat?.pub && seat.id && (
              <button className="rw-btn line" style={{ marginTop: 20 }} onClick={() => onMessage(seat.id!)}>
                {Icon.env} Message {name}
                {unread > 0 && <span className="rw-wax inline" style={{ marginLeft: 4 }}>{unread}</span>}
              </button>
            )}
          </>
        )}
      </RwSheet>

    </>
  )
}

function Picker({ title, current, onBack, onPick }: { title: string; current?: string; onBack: () => void; onPick: (id: string) => void }) {
  const scriptIds = useStore((s) => s.scriptIds)
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const cs = scriptIds.map((id) => getCharacter(id)).filter((c): c is Character => Boolean(c))
    const f = q.trim().toLowerCase()
    return ORDER.map((t) => ({ t, cs: cs.filter((c) => c.team === t && (!f || c.name.toLowerCase().includes(f))) })).filter((g) => g.cs.length)
  }, [scriptIds, q])
  return (
    <>
      <button className="rw-back" onClick={onBack}>{Icon.back} Back</button>
      <div className="disp" style={{ fontSize: 30, lineHeight: 1.05 }}>{title}</div>
      <input className="rw-field" style={{ marginTop: 14 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters" />
      {groups.map((g) => (
        <div key={g.t}>
          <div className="rw-sect" style={{ color: teamAlignment(g.t) === 'evil' ? 'var(--evil)' : 'var(--good)' }}>{HEADING[g.t]}</div>
          {g.cs.map((c) => (
            <button key={c.id} className={`rw-item${c.id === current ? ' on' : ''}`} style={{ minHeight: 60 }} onClick={() => onPick(c.id)}>
              <Tok character={c} size={42} team={false} />
              <span className="nm" style={{ fontSize: 20 }}>{c.name}</span>
              {c.id === current && <span style={{ marginLeft: 'auto', color: 'var(--lamp)' }}>✓</span>}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

/** This phone: who you are, the buzz, the reference pages, and the way out. */
export function MenuSheet({ open, onClose, onScript, onGrimoire }: { open: boolean; onClose: () => void; onScript: () => void; onGrimoire: () => void }) {
  const seatName = useStore((s) => s.seatName)
  const scriptName = useStore((s) => s.scriptName)
  const grimoire = useStore((s) => s.grimoire)
  const reset = useStore((s) => s.reset)
  const { subscribe, status } = useRelay()
  const [push, setPush] = useState<PushState>(() => pushState())
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  useEffect(() => {
    if (open) setPush(pushState())
  }, [open])

  const turnOn = async () => {
    setBusy(true)
    try {
      const sub = await enablePush()
      if (sub) subscribe(sub)
    } finally {
      setBusy(false)
      setPush(pushState())
    }
  }

  return (
    <RwSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Tok size={64}>
          <Lantern size={30} />
        </Tok>
        <div>
          <div className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{seatName ?? 'You'}</div>
          <div className="rw-sub" style={{ marginTop: 4 }}>{scriptName ? `Playing ${scriptName}` : 'Not seated yet'}</div>
        </div>
      </div>

      <div className="rw-lbl" style={{ marginTop: 26 }}>This phone</div>
      <button
        className="rw-item"
        style={{ minHeight: 64 }}
        disabled={push === 'on' || push === 'unsupported' || busy || status !== 'open'}
        onClick={() => void turnOn()}
      >
        <span style={{ color: 'var(--lamp)' }}>{Icon.bell}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>Buzz me when something happens</div>
          <div className="ab">
            {push === 'install-first'
              ? 'Tap Share, then Add to Home Screen, and open it from there first.'
              : push === 'denied'
                ? 'Allow notifications for this app in Settings.'
                : push === 'unsupported'
                  ? 'This browser cannot buzz. Keep the app open instead.'
                  : 'Votes, notes, messages and nightfall. Never a sound.'}
          </div>
        </div>
        <span className={`rw-toggle${push === 'on' ? ' on' : ''}`} />
      </button>
      <button className="rw-item" style={{ minHeight: 60 }} onClick={onScript}>
        <span style={{ color: 'var(--lamp)' }}>{Icon.book}</span>
        <div style={{ flex: 1, fontWeight: 500 }}>What every character does</div>
        <span style={{ color: 'var(--faint)' }}>{Icon.chev}</span>
      </button>
      {grimoire && (
        <button className="rw-item" style={{ minHeight: 60 }} onClick={onGrimoire}>
          <span style={{ color: 'var(--lamp)' }}>{Icon.eye}</span>
          <div style={{ flex: 1, fontWeight: 500 }}>The grimoire, as you saw it</div>
          <span style={{ color: 'var(--faint)' }}>{Icon.chev}</span>
        </button>
      )}

      <button
        className="rw-btn ghost danger"
        style={{ marginTop: 18 }}
        onClick={() => {
          haptic(armed ? 'warn' : 'tap')
          if (armed) {
            reset()
            onClose()
          } else setArmed(true)
        }}
      >
        {armed ? 'Tap again to leave and forget your notes' : 'Leave this game'}
      </button>
      <div style={{ opacity: 0.6 }}>
        <BuildStamp build={BUILD} />
      </div>
    </RwSheet>
  )
}
