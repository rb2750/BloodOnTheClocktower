import { characterArt, getCharacter, teamAlignment } from '@botc/rules'
import { AbilityText, Label, Rows, Row, Token, Qr } from '@botc/ui'
import { useStore } from '../state.js'
import { HoldToReveal } from '../components/HoldToReveal.js'
import { useRelay } from '../useRelay.js'

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
  if (!character) return <Waiting />

  const alignment = teamAlignment(character.team)

  return (
    <section className="px-5 pt-4">
      <HoldToReveal onFirstReveal={markRevealed}>
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
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-8 text-center">
      <Qr size={44} className="text-(--text-dim)" strokeWidth={1.25} />
      <h1 className="display text-[26px] leading-tight text-(--text)">Scan the Storyteller&rsquo;s code</h1>
      <p className="serif max-w-[28ch] text-[15px] leading-snug text-(--text-faint)">
        Point your camera at the code they are holding. Your character, the script and your
        notes all live here afterwards, and it works with no signal.
      </p>
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
        <Rows>
          {seats.map((seat) => (
            <Row
              key={seat.id}
              disabled={seat.taken}
              onClick={() => claim(seat)}
              trailing={seat.taken ? 'taken' : undefined}
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
          : 'They will send your character over in a moment. Keep this open.'}
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
