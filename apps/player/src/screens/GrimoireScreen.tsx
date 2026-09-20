import { characterArt, getCharacter, teamAlignment } from '@botc/rules'
import { idsFor, type SealedGrimoire } from '@botc/protocol'
import { ChevronLeft, Grimoire, Token } from '@botc/ui'
import { useStore } from '../state.js'
import { HoldToReveal } from '../components/HoldToReveal.js'

/**
 * The Grimoire, for the one player entitled to see it.
 *
 * A whole screen, because it is a whole table: the same ring, the same tokens
 * and the same chips the Storyteller is looking at, at the size they see them.
 * Under the cover until held, like everything else worth hiding, and stamped
 * with the night it was shown, since what the Spy saw on night two is not what
 * is true on night four.
 */
export function GrimoireScreen({ onBack }: { onBack: () => void }) {
  const grimoire = useStore((s) => s.grimoire)

  return (
    <div className="flex h-full flex-col">
      <div className="safe-top flex shrink-0 items-center border-b border-(--hairline) bg-(--surface) px-2">
        <button
          onClick={onBack}
          className="flex min-h-(--tap-min) items-center gap-1 px-3 text-[16px] text-(--text)"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
          Back
        </button>
        <span className="display flex-1 text-center text-[19px] text-(--text)">The grimoire</span>
        <span className="caps min-w-[6ch] px-3 text-right text-(--text-faint)">
          {grimoire?.at ?? ''}
        </span>
      </div>

      {grimoire ? (
        <div className="safe-bottom flex min-h-0 flex-1 flex-col px-3 pb-3">
          <HoldToReveal
            fill
            label="Press and hold"
            hint="For your eyes only."
          >
            <div className="absolute inset-0 flex">
              <Grimoire
                count={grimoire.seats.length}
                keys={grimoire.seats.map((s) => s.name)}
                showClock={false}
                centre={<p className="caps text-(--text-faint)">{grimoire.at}</p>}
              >
                {(i) => <Seat seat={grimoire.seats[i]!} />}
              </Grimoire>
            </div>
          </HoldToReveal>
          <p className="mt-3 text-center text-[13px] leading-snug text-(--text-faint)">
            It covers itself the moment you let go.
          </p>
        </div>
      ) : (
        <p className="serif px-8 py-16 text-center text-[15px] text-(--text-faint)">
          The Storyteller has not shown you the grimoire.
        </p>
      )}
    </div>
  )
}

/** One seat, drawn as the Storyteller's own screen draws it. */
function Seat({ seat }: { seat: SealedGrimoire['seats'][number] }) {
  const character = getCharacter(idsFor([seat.character])[0] ?? '')
  const alignment = character ? teamAlignment(character.team) : undefined
  const shown = seat.tokens.slice(0, 2)
  const extra = seat.tokens.length - shown.length
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
          {seat.drunk && (
            <span className="chip" data-kind="drunk">
              Drunk
            </span>
          )}
          {shown.map((t) => (
            <span key={t.label} className="chip" data-kind={t.kind}>
              {t.label}
            </span>
          ))}
          {extra > 0 && <span className="chip">+{extra}</span>}
        </span>
      )}
    </span>
  )
}
