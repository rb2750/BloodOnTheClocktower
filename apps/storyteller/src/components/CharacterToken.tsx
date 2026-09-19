import { characterArt, teamAlignment, type Character } from '@botc/rules'
import { Token } from '@botc/ui'
import type { CSSProperties } from 'react'

export function CharacterToken({
  character,
  size,
  dead,
  voteSpent,
  now,
  alignment,
  className,
  style,
}: {
  character?: Character
  size?: string
  dead?: boolean
  voteSpent?: boolean
  now?: boolean
  /** Overrides the character's usual alignment, for a Bounty Hunter or a Traveller. */
  alignment?: 'good' | 'evil'
  className?: string
  style?: CSSProperties
}) {
  const align = alignment ?? (character ? teamAlignment(character.team) : undefined)
  return (
    <Token
      src={character ? characterArt(character, align === 'evil' ? 'e' : 'g') : undefined}
      name={character?.name ?? 'Unassigned'}
      alignment={align ?? 'unknown'}
      dead={dead}
      voteSpent={voteSpent}
      now={now}
      size={size}
      className={className}
      style={style}
    />
  )
}
