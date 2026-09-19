import { characterArt, getCharacter, teamAlignment } from '@botc/rules'
import { AbilityText, Label, Token } from '@botc/ui'
import { QrCode } from 'lucide-react'
import { useStore } from '../state.js'
import { HoldToReveal } from '../components/HoldToReveal.js'

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
  const hasRevealed = useStore((s) => s.hasRevealed)
  const character = getCharacter(characterId ?? '')

  if (!payload) return <Empty />
  if (!character) return <Waiting />

  const alignment = teamAlignment(character.team)

  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-7 px-6 py-10">
      <HoldToReveal onFirstReveal={markRevealed}>
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <Token
            src={characterArt(character, alignment === 'evil' ? 'e' : 'g')}
            name={character.name}
            alignment={alignment}
            size="min(38vw, 150px)"
          />
          <div>
            <h1 className="display text-[20px] text-(--text)">{character.name}</h1>
            <p
              className={`m-0 text-[12px] uppercase tracking-[0.16em] ${
                alignment === 'evil' ? 'text-(--color-evil-300)' : 'text-(--color-good-300)'
              }`}
            >
              {/* The word as well as the colour and the ring shape: three
                  redundant channels, so colour vision is never the only cue. */}
              {TEAM_LABEL[character.team] ?? character.team} · {alignment}
            </p>
          </div>
        </div>
      </HoldToReveal>

      {hasRevealed && (
        <div className="max-w-[34ch] text-center">
          <AbilityText>{character.ability}</AbilityText>
        </div>
      )}

      <p className="max-w-[30ch] text-center text-[13px] leading-snug text-(--text-faint)">
        {hasRevealed
          ? 'Hold again whenever you need reminding. It covers itself the moment you let go.'
          : 'Nobody else can see this unless they are looking over your shoulder right now.'}
      </p>
    </section>
  )
}

function Empty() {
  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <QrCode size={40} className="text-(--color-brass-600)" strokeWidth={1.4} />
      <h1 className="display text-[18px] text-(--text)">Scan the Storyteller&rsquo;s code</h1>
      <p className="max-w-[28ch] text-[14px] leading-snug text-(--text-faint)">
        Point your camera at the code they are holding. Your character, the script and your
        notes all live here afterwards, and it works with no signal.
      </p>
    </section>
  )
}

function Waiting() {
  const seatName = useStore((s) => s.seatName)
  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="size-3 animate-pulse rounded-full bg-(--color-brass-400)" />
      <h1 className="display text-[18px] text-(--text)">
        {seatName ? `You are ${seatName}` : 'Waiting for the Storyteller'}
      </h1>
      <p className="max-w-[28ch] text-[14px] leading-snug text-(--text-faint)">
        They will send your character over in a moment. Keep this open.
      </p>
      <div className="mt-2">
        <Label>Meanwhile</Label>
        <p className="max-w-[28ch] text-[13px] text-(--text-faint)">
          You can read the script and start taking notes from the tabs below.
        </p>
      </div>
    </section>
  )
}
