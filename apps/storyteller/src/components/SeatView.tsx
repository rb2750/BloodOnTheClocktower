import { getCharacter, teamAlignment } from '@botc/rules'
import { Mask } from '@botc/ui'
import { CharacterToken } from './CharacterToken.js'
import { ReminderMini } from './ReminderChip.js'
import type { Seat } from '../state/types.js'

/** Two chips plus a count. Thirty visible chips on a fifteen-player grimoire is
 *  exactly the overwhelm this design forbids; the rest live in the seat sheet. */
const MAX_CHIPS = 2

export function SeatView({
  seat,
  disabled,
  now = false,
  concealed = false,
  onOpen,
}: {
  seat: Seat
  disabled?: boolean
  /** Awake at night, or a hand raised in a vote. */
  now?: boolean
  /** Roles hidden: the token shows its back and reminders are not drawn. */
  concealed?: boolean
  onOpen: () => void
}) {
  const character = getCharacter(seat.characterId ?? '')
  const trueCharacter = getCharacter(seat.trueCharacterId ?? '')
  const alignment =
    seat.alignmentOverride ??
    (trueCharacter
      ? teamAlignment(trueCharacter.team)
      : character
        ? teamAlignment(character.team)
        : undefined)

  const visible = seat.effects.slice(0, MAX_CHIPS)
  const extra = seat.effects.length - visible.length

  return (
    <button
      onClick={onOpen}
      aria-disabled={disabled}
      className="relative flex flex-col items-center"
      aria-label={`${seat.name}${concealed ? '' : `, ${character?.name ?? 'no character'}`}${seat.alive ? '' : ', dead'}`}
      style={{ touchAction: 'none' }}
    >
      <CharacterToken
        character={character}
        dead={!seat.alive}
        voteSpent={!seat.alive && !seat.deadVoteAvailable}
        alignment={alignment}
        now={now && !concealed}
        back={concealed}
      />

      {/* A player who is not what their token says carries a quiet mark, so the
          Storyteller is reminded every time they look at the grimoire. */}
      {trueCharacter && !concealed && (
        <span
          className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-(--hairline-strong) bg-(--bg) text-(--text)"
          title={`Really the ${trueCharacter.name}`}
        >
          <Mask size={12} />
        </span>
      )}

      <span className="seat-name">{seat.name}</span>

      {seat.effects.length > 0 && !concealed && (
        <span className="chips">
          {visible.map((e) => (
            <span key={e.id} title={e.label}>
              <ReminderMini kind={e.kind} sourceCharacterId={e.sourceCharacterId} size="16px" />
            </span>
          ))}
          {extra > 0 && <span className="chip">+{extra}</span>}
        </span>
      )}
    </button>
  )
}
