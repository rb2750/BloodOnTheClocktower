import type { CSSProperties, ReactNode } from 'react'

export type GrimoireProps = {
  count: number
  /** Rendered once per seat, in seating order starting at the top. */
  children: (index: number) => ReactNode
  /** Drawn in the middle of the ring: the phase, the primary action, the tally. */
  centre?: ReactNode
  /** Nomination arrows and other curves, drawn beneath the seats. */
  overlay?: ReactNode
  showClock?: boolean
  className?: string
}

const TICKS = Array.from({ length: 12 }, (_, i) => i)

/**
 * The town square.
 *
 * Seats are laid out by CSS trigonometry from `--i` and `--n`, so any count
 * from five to twenty works with no generated CSS, and adding or removing a
 * player animates because the browser interpolates `translate`.
 */
export function Grimoire({
  count,
  children,
  centre,
  overlay,
  showClock = true,
  className = '',
}: GrimoireProps) {
  return (
    // The ring is absolutely positioned inside this box so it always has a
    // definite size. `height: 100%` against an auto-height flex parent does not
    // resolve, and `container-type: size` then reports zero, which silently
    // collapses the whole layout into a flat sliver.
    <div className={`relative min-h-0 flex-1 ${className}`}>
      <ul className="circle" style={{ ['--n' as string]: count } as CSSProperties}>
        {showClock && (
          <div className="clock-ring" aria-hidden>
            {TICKS.map((t) => (
              <span
                key={t}
                className="clock-tick"
                style={{ ['--ta' as string]: `${(t / 12) * 360 - 90}deg` } as CSSProperties}
              />
            ))}
          </div>
        )}

        {overlay && (
          <svg className="nomination-layer" aria-hidden>
            {overlay}
          </svg>
        )}

        {Array.from({ length: count }, (_, i) => (
          <li key={i} style={{ ['--i' as string]: i } as CSSProperties}>
            {children(i)}
          </li>
        ))}

        {centre && (
          <div className="pointer-events-none absolute inset-[22%] grid place-items-center">
            <div className="pointer-events-auto text-center">{centre}</div>
          </div>
        )}
      </ul>
    </div>
  )
}
