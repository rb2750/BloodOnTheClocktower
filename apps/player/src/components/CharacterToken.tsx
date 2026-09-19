import { characterArt, teamAlignment, type Character } from '@botc/rules'
import { Token } from '@botc/ui'

export function CharacterToken({
  character,
  size,
  alignment,
  /** For a claim, which is hearsay rather than fact: no alignment ring. */
  muted = false,
}: {
  character?: Character
  size?: string
  alignment?: 'good' | 'evil'
  muted?: boolean
}) {
  const align = alignment ?? (character ? teamAlignment(character.team) : undefined)
  return (
    <Token
      src={character ? characterArt(character, align === 'evil' ? 'e' : 'g') : undefined}
      name={character?.name ?? '—'}
      alignment={muted ? 'unknown' : (align ?? 'unknown')}
      size={size}
    />
  )
}
