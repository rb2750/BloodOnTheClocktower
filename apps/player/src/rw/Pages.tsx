import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { baseComposition, characterArt, getCharacter, teamAlignment, type Character, type Team } from '@botc/rules'
import { idsFor, type SealedGrimoire } from '@botc/protocol'
import { Grimoire, Token, haptic } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'
import { RELAY_URL } from '../config.js'
import { useKeyboardViewport } from '../useKeyboardViewport.js'
import { useHold } from './hold.js'
import { Icon, Lantern, Tok } from './Token.js'
import { RwSheet } from './Sheet.js'
import { word } from './words.js'

function Header({ title, sub, back, onBack }: { title: string; sub?: string; back?: string; onBack?: () => void }) {
  return (
    <div className="rw-hdr">
      <div style={{ minWidth: 0 }}>
        {back && (
          <button className="rw-back" onClick={onBack}>
            {Icon.back} {back}
          </button>
        )}
        <div className="rw-title">{title}</div>
        {sub && <div className="rw-sub">{sub}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ joining */

export function CodePage() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // The four letters under the Storyteller's QR. The relay hands back the same
  // text the QR carries, and it goes in through the address bar so a typed
  // code and a scanned one take exactly the same path.
  const join = async () => {
    const typed = code.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')
    if (typed.length !== 4) return
    setBusy(true)
    try {
      const res = await fetch(`${RELAY_URL}/code/${typed}`)
      if (!res.ok) {
        toast.error('No game is using that code right now.')
        return
      }
      haptic('confirm')
      window.location.hash = await res.text()
    } catch {
      toast.error('Could not reach the Storyteller. Check your signal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rw-page">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
        <Tok size={112}>
          <Lantern size={48} />
        </Tok>
        <div className="disp" style={{ fontSize: 52, lineHeight: 1, marginTop: 26 }}>Ravenswood</div>
        <div className="rw-sub" style={{ fontSize: 17 }}>Your seat at the table</div>
      </div>
      <form
        className="rw-dock"
        onSubmit={(e) => {
          e.preventDefault()
          void join()
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 500 }}>Scan the Storyteller’s code</div>
        <div className="rw-help" style={{ paddingTop: 2 }}>or type the four letters under it</div>
        <label style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: 10, margin: '14px 0 16px' }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`rw-codebox${i === Math.min(code.length, 3) ? ' cur' : ''}`}>
              {code[i]?.toUpperCase() ?? ''}
            </span>
          ))}
          <input
            ref={input}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9a-z]/gi, '').slice(0, 4))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Game code"
            style={{ position: 'absolute', inset: 0, opacity: 0, fontSize: 16 }}
          />
        </label>
        <button type="submit" className="rw-btn" disabled={code.length !== 4 || busy}>
          {busy ? 'Finding the game…' : 'Join the game'}
        </button>
      </form>
    </div>
  )
}

export function NamePage({ onClaimed }: { onClaimed: () => void }) {
  const { seats, claim, status } = useRelay()
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="rw-page">
      <Header title="Who are you?" sub={seats.length ? `Tap your name. ${word(seats.length)} at this table.` : 'Finding the table…'} />
      <div className="rw-list" style={{ marginTop: 10 }}>
        {/* No seat is ever closed. A player who cleared their browser, or came
            back on another phone, must always be able to sit down again. */}
        {seats.map((seat) => (
          <button
            key={seat.id}
            className={`rw-item${picked === seat.id ? ' on' : ''}`}
            onClick={() => {
              if (picked) return
              haptic('confirm')
              setPicked(seat.id)
              window.setTimeout(() => {
                claim(seat)
                onClaimed()
              }, 450)
            }}
          >
            <Tok name={seat.name} size={48} hot={picked === seat.id} />
            <span className="nm">{seat.name}</span>
            {picked === seat.id && <span style={{ marginLeft: 'auto', color: 'var(--lamp)', fontWeight: 500 }}>That’s me</span>}
          </button>
        ))}
        {seats.length === 0 && (
          <div className="rw-help" style={{ marginTop: 40 }}>
            {status === 'open' ? 'Waiting for the Storyteller to open the table.' : 'Connecting to the Storyteller…'}
          </div>
        )}
      </div>
      <div className="rw-help" style={{ padding: '0 30px 18px' }}>Nobody else ever sees your character.</div>
    </div>
  )
}

/* ------------------------------------------------------------------ messages */

export function MessagesPage({ onBack, onThread, onLetters }: { onBack: () => void; onThread: (id: string) => void; onLetters: () => void }) {
  const table = useStore((s) => s.table)
  const chats = useStore((s) => s.chats)
  const seatId = useStore((s) => s.seatId)
  const notes = useStore((s) => s.notes)
  const messages = useStore((s) => s.messages)
  const whispersSeen = useStore((s) => s.whispersSeen)
  const people = table.filter((t) => t.id && t.id !== seatId)
  const talking = people
    .filter((p) => chats[p.id!]?.lines.length)
    .sort((a, b) => (chats[b.id!]!.unread - chats[a.id!]!.unread))
  const rest = people.filter((p) => !chats[p.id!]?.lines.length && p.pub)
  const claim = (name: string) => getCharacter(notes[name]?.claims.at(-1)?.characterId ?? '')

  return (
    <div className="rw-page">
      <Header title="Messages" sub="Only the two of you can read each one" back="Table" onBack={onBack} />
      <div className="rw-list" style={{ marginTop: 8 }}>
        {messages.length > 0 && (
          <button className="rw-item" onClick={onLetters}>
            <Tok size={52}>
              <span style={{ color: 'var(--lamp)' }}>{Icon.book}</span>
            </Tok>
            <div style={{ flex: 1 }}>
              <div className="nm">The Storyteller</div>
              <div className="ab">{messages.length === 1 ? 'One note' : `${word(messages.length)} notes`}</div>
            </div>
            {messages.length > whispersSeen && <span className="rw-wax inline">{messages.length - whispersSeen}</span>}
          </button>
        )}
        {talking.map((p) => {
          const c = chats[p.id!]!
          const last = c.lines.at(-1)!
          return (
            <button key={p.id} className="rw-item" onClick={() => onThread(p.id!)}>
              <Tok name={p.name} character={claim(p.name)} size={52} dead={!p.alive} team={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="nm">{p.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--faint)' }}>{last.at}</span>
                </div>
                <div className="ab" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {last.from === 'me' ? 'You: ' : ''}
                  {last.text}
                </div>
              </div>
              {c.unread > 0 && <span className="rw-wax inline">{c.unread}</span>}
            </button>
          )
        })}
        {rest.length > 0 && (
          <>
            <div className="rw-sect" style={{ color: 'var(--dim)', marginTop: 26 }}>Start a conversation</div>
            <div className="rw-chips">
              {rest.map((p) => (
                <button key={p.id} className="rw-chip art" onClick={() => onThread(p.id!)}>
                  <Tok name={p.name} character={claim(p.name)} size={32} team={false} />
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
        {people.length === 0 && messages.length === 0 && (
          <div className="rw-help" style={{ marginTop: 40 }}>Nobody at the table has joined on their phone yet.</div>
        )}
      </div>
    </div>
  )
}

/**
 * A private conversation with one other player. At night the box goes:
 * everyone is asleep, and the rule at the table is the rule here.
 */
export function ThreadPage({ seatId, onBack }: { seatId: string; onBack: () => void }) {
  const chat = useStore((s) => s.chats[seatId])
  const person = useStore((s) => s.table.find((t) => t.id === seatId))
  const notes = useStore((s) => s.notes)
  const phase = useStore((s) => s.phase)
  const readChat = useStore((s) => s.readChat)
  const { chat: send, status } = useRelay()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const box = useKeyboardViewport()
  const name = person?.name ?? '…'
  const night = /^night/i.test(phase)
  const claim = getCharacter(notes[name]?.claims.at(-1)?.characterId ?? '')
  const lines = chat?.lines ?? []

  useEffect(() => {
    readChat(seatId)
    end.current?.scrollIntoView({ block: 'end' })
  }, [seatId, lines.length, readChat])
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [box.height])

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    haptic('tap')
    const ok = await send(seatId, text)
    setSending(false)
    if (ok) setDraft('')
    else toast.error(`${name}’s phone is not in the room right now.`)
  }

  let lastDay = ''
  return (
    <div className="rw-page" style={{ top: box.top, height: box.height, bottom: 'auto' }}>
      <div className="rw-hdr" style={{ alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
        <button className="rw-back" style={{ margin: 0 }} onClick={onBack} aria-label="Back">{Icon.back}</button>
        <Tok name={name} character={claim} size={44} dead={person ? !person.alive : false} team={false} />
        <div>
          <div className="disp" style={{ fontSize: 28, lineHeight: 1 }}>{name}</div>
          <div style={{ fontSize: 14, color: 'var(--dim)' }}>{claim ? `says ${claim.name}` : person && !person.alive ? 'dead' : 'private'}</div>
        </div>
      </div>
      <div className="rw-list" style={{ padding: '6px 18px 12px', display: 'flex', flexDirection: 'column' }}>
        <div className="rw-daymark">Only you and {name} can read this</div>
        {lines.map((l) => {
          const mark = l.at !== lastDay ? l.at : null
          lastDay = l.at
          return (
            <div key={l.id} style={{ display: 'contents' }}>
              {mark && <div className="rw-daymark">{mark}</div>}
              <div className={`rw-bub ${l.from === 'me' ? 'me' : 'them'}`}>{l.text}</div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <div className="rw-dock" style={{ animation: 'none' }}>
        {night ? (
          <div className="rw-help">Everyone is asleep. Messages open again at dawn.</div>
        ) : (
          <form
            style={{ display: 'flex', gap: 10, alignItems: 'center' }}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <input className="rw-field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${name}`} enterKeyHint="send" />
            <button type="submit" className="rw-btn" style={{ width: 50, minHeight: 50, padding: 0, flex: 'none' }} disabled={!draft.trim() || sending || status !== 'open'} aria-label="Send">
              {Icon.send}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ the Storyteller's letters */

/** One letter, sealed until held. */
export function Letter({ text, at, seal = true, onRead }: { text: string; at: string; seal?: boolean; onRead?: () => void }) {
  const [open, setOpen] = useState(false)
  const h = useHold({
    ms: 420,
    onDone: () => {
      haptic('pick')
      setOpen(true)
      onRead?.()
    },
    onEnd: () => setOpen(false),
  })
  return (
    <div className={`rw-letter${open ? ' open' : ''}`} {...h.bind} style={{ paddingBottom: open ? 34 : 24 }}>
      {seal && (
        <>
          <span className="rw-seal l" />
          <span className="rw-seal r" />
        </>
      )}
      <div className="shut" style={open ? { position: 'absolute', inset: '34px 26px 24px' } : undefined}>
        <div style={{ font: "italic 600 22px 'Cormorant Garamond'", color: '#6A5A3E' }}>{seal ? 'Sealed' : at}</div>
        <div style={{ fontSize: 15, color: '#6A5A3E', marginTop: 4 }}>{seal ? `${at}. Hold to break the seal.` : 'Hold to read it again'}</div>
      </div>
      <div className="said" style={open ? undefined : { position: 'absolute', inset: '34px 26px 24px' }}>
        <div style={{ fontSize: 15, color: '#6A5A3E' }}>From the Storyteller, {at.toLowerCase()}</div>
        <p style={{ font: "italic 600 28px/1.25 'Cormorant Garamond'", margin: '14px 0 0' }}>{text}</p>
      </div>
    </div>
  )
}

export function LettersPage({ onBack }: { onBack: () => void }) {
  const messages = useStore((s) => s.messages)
  const whispersSeen = useStore((s) => s.whispersSeen)
  const seeWhispers = useStore((s) => s.seeWhispers)
  return (
    <div className="rw-page">
      <Header title="From the Storyteller" sub="Hold a note to read it. It seals itself again when you let go." back="Messages" onBack={onBack} />
      <div className="rw-list" style={{ paddingTop: 36, display: 'flex', flexDirection: 'column', gap: 40 }}>
        {[...messages].reverse().map((m, i) => (
          <Letter key={m.id} text={m.text} at={m.at} seal={messages.length - 1 - i >= whispersSeen} onRead={seeWhispers} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ the script */

const ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled']
const HEADING: Record<string, string> = { townsfolk: 'Townsfolk', outsider: 'Outsiders', minion: 'Minions', demon: 'Demons', traveller: 'Travellers', fabled: 'Fabled', loric: 'Loric' }

export function ScriptPage({ onBack }: { onBack: () => void }) {
  const scriptIds = useStore((s) => s.scriptIds)
  const scriptName = useStore((s) => s.scriptName)
  const table = useStore((s) => s.table)
  const [open, setOpen] = useState<Character | null>(null)
  const grouped = useMemo(() => {
    const cs = scriptIds.map((id) => getCharacter(id)).filter((c): c is Character => Boolean(c))
    return ORDER.map((team) => ({ team, cs: cs.filter((c) => c.team === team) })).filter((g) => g.cs.length)
  }, [scriptIds])
  const seated = table.filter((t) => !t.traveller).length
  const c = seated >= 5 ? baseComposition(seated) : null
  const sub = c
    ? `A ${seated} player game starts with ${word(c.townsfolk).toLowerCase()} Townsfolk, ${word(c.outsider).toLowerCase()} ${c.outsider === 1 ? 'Outsider' : 'Outsiders'}, ${word(c.minion).toLowerCase()} ${c.minion === 1 ? 'Minion' : 'Minions'} and one Demon.`
    : `${word(scriptIds.length)} characters could be in this game.`
  return (
    <div className="rw-page">
      <Header title={scriptName || 'The script'} sub={sub} back="Table" onBack={onBack} />
      <div className="rw-list">
        {grouped.map((g) => (
          <div key={g.team}>
            <div className="rw-sect" style={{ color: teamAlignment(g.team) === 'evil' ? 'var(--evil)' : 'var(--good)' }}>{HEADING[g.team]}</div>
            {g.cs.map((ch) => (
              <button key={ch.id} className="rw-item" style={{ alignItems: 'flex-start' }} onClick={() => setOpen(ch)}>
                <Tok character={ch} size={50} />
                <div style={{ flex: 1 }}>
                  <div className="nm">{ch.name}</div>
                  <div className="ab">{ch.ability}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
        {scriptIds.length === 0 && <div className="rw-help" style={{ marginTop: 40 }}>The script appears once the Storyteller has handed out characters.</div>}
      </div>
      <RwSheet open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Tok character={open} size={64} />
              <div>
                <div className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{open.name}</div>
                <div className="rw-sub" style={{ color: teamAlignment(open.team) === 'evil' ? 'var(--evil)' : 'var(--good)' }}>
                  {HEADING[open.team]?.replace(/s$/, '')}, on the {teamAlignment(open.team) === 'evil' ? 'evil' : 'good'} team
                </div>
              </div>
            </div>
            <p style={{ fontSize: 18, lineHeight: 1.4, marginTop: 18 }}>{open.ability}</p>
            {open.flavor && <p style={{ font: "italic 500 19px/1.35 'Cormorant Garamond'", color: 'var(--dim)' }}>{open.flavor}</p>}
            {open.jinxes.filter((j) => scriptIds.includes(j.with)).map((j) => (
              <div key={j.with} style={{ marginTop: 14 }}>
                <div className="rw-lbl" style={{ margin: '0 0 4px' }}>With the {getCharacter(j.with)?.name}</div>
                <div style={{ fontSize: 16, color: 'var(--dim)' }}>{j.reason}</div>
              </div>
            ))}
          </>
        )}
      </RwSheet>
    </div>
  )
}

/* ------------------------------------------------------------------ the grimoire */

export function GrimoirePage({ onBack }: { onBack: () => void }) {
  const grimoire = useStore((s) => s.grimoire)
  const [shown, setShown] = useState(false)
  const h = useHold({ ms: 380, onDone: () => { haptic('pick'); setShown(true) }, onEnd: () => setShown(false) })
  return (
    <div className="rw-page">
      <Header title="The grimoire" sub={grimoire ? `As it stood on ${grimoire.at.toLowerCase()}` : undefined} back="Table" onBack={onBack} />
      {grimoire ? (
        <div className="rw-ring" {...h.bind} style={{ margin: '0 8px 24px', touchAction: 'none' }}>
          {shown ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }} className="rw-rise">
              <Grimoire count={grimoire.seats.length} keys={grimoire.seats.map((s) => s.name)} showClock={false} centre={<p className="rw-eyebrow">Only you can see this</p>}>
                {(i) => <GrimSeat seat={grimoire.seats[i]!} />}
              </Grimoire>
            </div>
          ) : (
            <div className="rw-centre" style={{ width: '70%' }}>
              {h.p > 0 && <div className="rw-eyebrow live">Keep holding</div>}
              <div className="rw-say">Hold to see the grimoire</div>
              <div className="rw-note">It covers itself the moment you let go</div>
            </div>
          )}
        </div>
      ) : (
        <div className="rw-help" style={{ marginTop: 40 }}>The Storyteller has not shown you the grimoire.</div>
      )}
    </div>
  )
}

function GrimSeat({ seat }: { seat: SealedGrimoire['seats'][number] }) {
  const character = getCharacter(idsFor([seat.character])[0] ?? '')
  const alignment = character ? teamAlignment(character.team) : undefined
  return (
    <span className="relative flex flex-col items-center">
      <Token
        src={character ? characterArt(character, alignment === 'evil' ? 'e' : 'g') : undefined}
        name={seat.name}
        alignment={alignment ?? 'unknown'}
        dead={seat.dead}
      />
      <span className="seat-name">{seat.name}</span>
      {(seat.drunk || seat.tokens.length > 0) && (
        <span className="chips">
          {seat.drunk && <span className="chip" data-kind="drunk">Drunk</span>}
          {seat.tokens.slice(0, 2).map((t) => (
            <span key={t.label} className="chip" data-kind={t.kind}>{t.label}</span>
          ))}
        </span>
      )}
    </span>
  )
}
