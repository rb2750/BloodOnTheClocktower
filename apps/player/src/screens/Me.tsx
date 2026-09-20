import { useState } from 'react'
import { toast } from 'sonner'
import { characterArt, getCharacter, teamAlignment } from '@botc/rules'
import { AbilityText, Button, Label, Rows, Row, Token, Qr, haptic, inputClass } from '@botc/ui'
import { useStore } from '../state.js'
import { HoldToReveal } from '../components/HoldToReveal.js'
import { useRelay } from '../room.js'
import { RELAY_URL } from '../config.js'

const TEAM_LABEL: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
  traveller: 'Traveller',
  fabled: 'Fabled',
  loric: 'Loric',
}

export function MeScreen() {
  const payload = useStore((s) => s.payload)
  const characterId = useStore((s) => s.characterId)
  const markRevealed = useStore((s) => s.markRevealed)
  const character = getCharacter(characterId ?? '')

  if (!payload) return <Empty />
  // A phone told it is the Drunk has been told nothing: the Storyteller has
  // not yet chosen what it should believe. Show the waiting screen, never the
  // token, however the word arrived and even if it was stored last night.
  if (!character || character.id === 'drunk') return <Waiting />

  const alignment = teamAlignment(character.team)

  return (
    <section className="px-5 pt-4">
      <HoldToReveal grand onFirstReveal={markRevealed}>
        {/* Everything secret is in here: the picture, the name, the team and
            the ability, which is the line a player actually needs to read. */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Token
            src={characterArt(character, alignment === 'evil' ? 'e' : 'g')}
            name={character.name}
            alignment={alignment}
            size="min(30vw, 116px)"
          />
          <div>
            <h1 className="display text-[30px] leading-none text-(--text)">{character.name}</h1>
            <p
              className={`caps m-0 mt-2 ${
                alignment === 'evil' ? 'text-(--color-red-2)' : 'text-(--color-blue-2)'
              }`}
              style={{ letterSpacing: '0.22em' }}
            >
              {/* The word as well as the colour and the ring shape: three
                  redundant channels, so colour vision is never the only cue. */}
              {TEAM_LABEL[character.team] ?? character.team} · {alignment}
            </p>
          </div>
          <div className="max-w-[32ch]">
            <AbilityText>{character.ability}</AbilityText>
          </div>
        </div>
      </HoldToReveal>

      <p className="mx-auto mt-4 max-w-[32ch] text-center text-[13px] leading-snug text-(--text-faint)">
        It covers itself the moment you let go. Hold it again whenever you need reminding.
      </p>
    </section>
  )
}

function Empty() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

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
      window.location.hash = await res.text()
    } catch {
      toast.error('Could not reach the Storyteller. Check your signal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-8 text-center">
      <Qr size={44} className="text-(--text-dim)" strokeWidth={1.25} />
      <h1 className="display text-[26px] leading-tight text-(--text)">Scan the Storyteller&rsquo;s code</h1>
      <p className="serif max-w-[28ch] text-[15px] leading-snug text-(--text-faint)">
        Point your camera at the code they are holding. Your character, the script and your
        notes all live here afterwards, and it works with no signal.
      </p>
      <form
        className="mt-2 flex w-full max-w-[22ch] flex-col items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void join()
        }}
      >
        <Label>Or type the four letters under it</Label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9a-z]/gi, '').slice(0, 4))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD"
          aria-label="Game code"
          className={`${inputClass} display text-center text-[26px] uppercase tracking-[0.3em]`}
        />
        <Button type="submit" className="w-full" disabled={code.length !== 4 || busy}>
          Join
        </Button>
      </form>
    </section>
  )
}

/**
 * Either "who are you?" or "hold tight".
 *
 * Nobody is asked to type a name. The Storyteller already entered everyone, and
 * they are holding the code out to a specific person, so the whole join is:
 * scan, tap your name, hold the card. Two taps and no keyboard.
 */
function Waiting() {
  const seatName = useStore((s) => s.seatName)
  const { seats, status, claim, claimed } = useRelay()

  if (!claimed && seats.length > 0) {
    return (
      <section className="px-5 py-8">
        <h1 className="display mb-1 text-center text-[26px] text-(--text)">Who are you?</h1>
        <p className="serif mx-auto mb-6 max-w-[30ch] text-center text-[14px] leading-snug text-(--text-faint)">
          Tap your own name. You will only ever be shown your own character.
        </p>
        {/* No seat is ever closed. A player who cleared their browser data, or
            came back on a different phone, must be able to sit down again, and
            a locked-out player mid-game is worse than the theft it prevents. */}
        <Rows>
          {seats.map((seat) => (
            <Row
              key={seat.id}
              onClick={() => {
                haptic('confirm')
                claim(seat)
              }}
            >
              {seat.name}
            </Row>
          ))}
        </Rows>
      </section>
    )
  }

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="size-3 animate-pulse rounded-full bg-(--now)" />
      <h1 className="display text-[26px] leading-tight text-(--text)">
        {seatName ? `You are ${seatName}` : 'Waiting for the Storyteller'}
      </h1>
      <p className="serif max-w-[28ch] text-[15px] leading-snug text-(--text-faint)">
        {status === 'offline'
          ? 'Not connected. If they are handing out codes one at a time, scan the one meant for you.'
          : 'The Storyteller is choosing your character. Keep this open.'}
      </p>
      <div className="mt-2">
        <Label>Meanwhile</Label>
        <p className="max-w-[28ch] text-[13px] text-(--text-faint)">
          You can read the script and start taking notes below.
        </p>
      </div>
    </section>
  )
}
