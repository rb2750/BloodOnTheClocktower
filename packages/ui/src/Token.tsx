import type { CSSProperties, ReactNode } from 'react'
import type { Alignment } from '@botc/rules'

export type TokenProps = {
  /** Art URL. When absent the token falls back to initials, which is fine offline. */
  src?: string
  name: string
  alignment?: Alignment | 'unknown'
  dead?: boolean
  /** Ghost vote already spent, shown as a faded shroud. */
  voteSpent?: boolean
  /** Acting right now: awake at night, or a hand raised in a vote. */
  now?: boolean
  size?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/**
 * The circular token: the one motif this design repeats everywhere. It is the
 * button, the avatar and the card.
 */
export function Token({
  src,
  name,
  alignment = 'unknown',
  dead = false,
  voteSpent = false,
  now = false,
  size,
  className = '',
  style,
  children,
}: TokenProps) {
  return (
    <div
      className={`token ${className}`}
      data-align={alignment === 'unknown' ? undefined : alignment}
      data-dead={dead || undefined}
      data-now={now || undefined}
      style={size ? ({ ...style, ['--size' as string]: size } as CSSProperties) : style}
    >
      {dead && (
        <span
          className="shroud-banner"
          style={voteSpent ? { opacity: 0.4 } : undefined}
          aria-hidden
        />
      )}
      {src ? (
        <img className="token-art" src={src} alt="" loading="lazy" decoding="async" />
      ) : children ? null : (
        <span className="token-initials">{initials(name)}</span>
      )}
      {children}
    </div>
  )
}
