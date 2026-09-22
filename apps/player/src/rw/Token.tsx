import type { ReactNode } from 'react'
import { characterArt, teamAlignment, type Character } from '@botc/rules'

/** The player's own seat: a lantern, lit once there is a character to see. */
export function Lantern({ lit = true, size = 34 }: { lit?: boolean; size?: number }) {
  return (
    <svg
      className={`rw-lantern${lit ? '' : ' out'}`}
      width={size}
      height={Math.round((size * 40) / 34)}
      viewBox="0 0 34 40"
      fill="none"
      stroke="#D9B874"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.5 3.5h9M17 3.5v4" />
      <path d="M9 7.5h16l2 5H7z" fill="#262D3D" />
      <path d="M8 12.5h18v18.5H8z" fill="#1A2030" />
      <path d="M12.5 12.5V31M21.5 12.5V31" />
      <path d="M7 31h20l-2 5H9z" fill="#262D3D" />
      <g className="flame">
        <ellipse cx="17" cy="22" rx="9" ry="10" fill="#E9A64B" opacity=".22" stroke="none" />
        <path d="M17 27.5c-3.2-2-3.2-5.4 0-8.5 3.2 3.1 3.2 6.5 0 8.5z" fill="#E7A44A" stroke="#A8641F" strokeWidth="1" />
        <path d="M17 26c-1.3-.9-1.3-2.4 0-3.8 1.3 1.4 1.3 2.9 0 3.8z" fill="#FBE3A3" stroke="none" />
      </g>
      <path className="wick" d="M15.5 28h3" stroke="#6E6450" strokeWidth="1.4" />
    </svg>
  )
}

const initials = (name: string) => {
  const w = name.trim().split(/\s+/)
  return (w.length > 1 ? w[0]![0]! + w[1]![0]! : name.slice(0, 2)) || '?'
}

/**
 * A seat's token: dark enamel, a brass rim, and the character's art when there
 * is one. The rim takes the team's colour only for a character the app is
 * actually showing, never to guess.
 */
export function Tok({
  name,
  character,
  size = 64,
  dead = false,
  hot = false,
  team = true,
  fresh = false,
  className = '',
  children,
}: {
  name?: string
  character?: Character
  size?: number
  dead?: boolean
  hot?: boolean
  team?: boolean
  /** Died just now, so the shroud falls rather than already being there. */
  fresh?: boolean
  className?: string
  children?: ReactNode
}) {
  const align = character && team ? teamAlignment(character.team) : undefined
  return (
    <div
      className={`rw-tok ${align === 'evil' ? 'evil' : align === 'good' ? 'good' : ''} ${dead ? 'dead' : ''} ${hot ? 'hot' : ''} ${className}`}
      style={{ ['--s' as string]: `${size}px` }}
    >
      {children ??
        (character ? (
          <img src={characterArt(character, align === 'evil' ? 'e' : 'g')} alt="" draggable={false} />
        ) : (
          <span className="ini">{initials(name ?? '')}</span>
        ))}
      {dead && <span className={`rw-shroud${fresh ? ' drop' : ''}`} />}
    </div>
  )
}

export const Icon = {
  env: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 6.5h17v11h-17z" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </svg>
  ),
  hand: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={s < 18 ? 2.4 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 12V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6.5a1.5 1.5 0 0 1 3 0V13M17 13v-2.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L4 14.5a1.6 1.6 0 0 1 2.7-1.6L8 14.5" />
    </svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  chev: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  book: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </svg>
  ),
  eye: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  bell: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  menu: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
}
