import { characterArt, teamAlignment, type Character } from '@botc/rules'
import { Token } from '@botc/ui'

export function CharacterRow({
  character,
  onClick,
  trailing,
}: {
  character: Character
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  const alignment = teamAlignment(character.team)
  return (
    <button
      onClick={onClick}
      className="flex min-h-(--tap-min) w-full items-center gap-3 rounded-(--radius-surface) border border-(--hairline) px-3 py-2 text-left"
    >
      <Token
        src={characterArt(character, alignment === 'evil' ? 'e' : 'g')}
        name={character.name}
        alignment={alignment}
        size="40px"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-(--text)">{character.name}</span>
        <span className="serif line-clamp-2 block text-[14px] leading-snug text-(--text-faint)">
          {character.ability}
        </span>
      </span>
      {trailing}
    </button>
  )
}
