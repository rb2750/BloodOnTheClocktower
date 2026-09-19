import type { SVGProps } from 'react'

/**
 * The icon set.
 *
 * Drawn on the same 24px grid as Lucide, so the `size` prop is a drop-in, but
 * in an ink line: 1.5px strokes with round terminals, solid fills where an
 * engraving would be solid, and a vocabulary taken from the game's own
 * objects. Death is a shroud, not a skull. A nomination is a pointing hand,
 * not a gavel. A Traveller is a signpost, not an aeroplane.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number | string
  strokeWidth?: number
}

function make(name: string, children: React.ReactNode) {
  function Icon({ size = 20, strokeWidth = 1.5, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...rest}
      >
        {children}
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

/** A filled shape: the fill takes the stroke colour, and has no outline. */
const F = { fill: 'currentColor', stroke: 'none' } as const

// --- The game ------------------------------------------------------------

/** Death. The grey cloth laid over a token. */
export const Shroud = make(
  'Shroud',
  <>
    <path d="M5.5 4.5C7 3.5 9.5 3 12 3s5 .5 6.5 1.5v10.5c0 1.6-.8 2.6-1.2 4L16 21l-2-2.2L12 21l-2-2.2L8 21l-1.3-2c-.4-1.4-1.2-2.4-1.2-4z" />
    <path d="M9 4.2c.8 3 .8 7.5 0 12M15 4.2c-.8 3-.8 7.5 0 12" />
  </>,
)

export const Moon = make(
  'Moon',
  <>
    <path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.5A7.5 7.5 0 0 1 14.5 3.5z" />
    <path {...F} d="M5 4l.7 1.8 1.8.7-1.8.7L5 9l-.7-1.8L2.5 6.5l1.8-.7z" />
  </>,
)

export const Dawn = make(
  'Dawn',
  <>
    <path d="M2 18h20M6.5 18a5.5 5.5 0 0 1 11 0" />
    <path d="M12 7V3.5M6 9.5 4 7.5M18 9.5l2-2M8.5 7.8 7.3 5.5M15.5 7.8l1.2-2.3" />
    <path d="M4 21.5h16" strokeDasharray="1 2.5" />
  </>,
)

/** A raised hand: a vote. */
export const Hand = make(
  'Hand',
  <path d="M8 13.5V6.5a1.5 1.5 0 0 1 3 0V12M11 12V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6a1.5 1.5 0 0 1 3 0v7.5M17 13.5v-2a1.5 1.5 0 0 1 3 0V15c0 4-2.5 7-6.5 7S7.6 19.6 6.6 17.6L4 13.2a1.6 1.6 0 0 1 2.7-1.7L8 13.5" />,
)

/** A pointing hand: a nomination. */
export const Point = make(
  'Point',
  <>
    <path {...F} d="M2 8.5h3v9H2z" />
    <path d="M5 9.5h7.5a1.5 1.5 0 0 1 0 3H9.5M9.5 12.5H18a1.5 1.5 0 0 1 0 3h-1M17 15.5a1.5 1.5 0 0 1 0 3h-1M16 18.5a1.5 1.5 0 0 1 0 3H8.5c-1.6 0-2.7-.9-3.5-2.5" />
  </>,
)

export const Ghost = make(
  'Ghost',
  <>
    <path d="M12 3a7 7 0 0 0-7 7v10.5l2.3-2 2.3 2 2.4-2 2.4 2 2.3-2 2.3 2V10a7 7 0 0 0-7-7z" />
    <circle {...F} cx="9.5" cy="10.5" r="1.1" />
    <circle {...F} cx="14.5" cy="10.5" r="1.1" />
  </>,
)

export const Quill = make(
  'Quill',
  <>
    <path d="M21 3c-6.5.8-11.5 4.8-13.5 11l-1.5 5 5-1.5C17.2 15.5 21 10 21 3z" />
    <path d="M3 21l7-8.5M11.5 12.5c1.8-.4 3.5-1.3 5-2.7" />
  </>,
)

/** A sealed scroll: the script. */
export const Scroll = make(
  'Scroll',
  <>
    <path d="M6 4h12a2 2 0 0 1 2 2v10M6 4a2 2 0 0 0-2 2v1.5h4V6a2 2 0 0 0-2-2z" />
    <path d="M8 7.5v10.5a2 2 0 0 1-2 2h12a2 2 0 0 0 2-2V16h-8" />
    <path d="M11 10h6M11 13h6" />
    <circle {...F} cx="16" cy="18.2" r="1.6" />
  </>,
)

/** An open book: the grimoire, the log. */
export const Book = make(
  'Book',
  <>
    <path d="M12 6.5c-2-1.6-5-2.2-9-2.2v14c4 0 7 .6 9 2.2 2-1.6 5-2.2 9-2.2v-14c-4 0-7 .6-9 2.2z" />
    <path d="M12 6.5v14M6 8.5c1.4.1 2.7.3 3.8.7M6 11.5c1.4.1 2.7.3 3.8.7M14.2 9.2c1.1-.4 2.4-.6 3.8-.7M14.2 12.2c1.1-.4 2.4-.6 3.8-.7" />
  </>,
)

export const Candle = make(
  'Candle',
  <>
    <path d="M9 10.5h6V21H9zM7 21h10M12 10.5V8.5" />
    <path {...F} d="M12 8.5c-1.8-1.6-1.8-4 0-6 1.8 2 1.8 4.4 0 6z" />
  </>,
)

export const Hourglass = make(
  'Hourglass',
  <>
    <path d="M6 3h12M6 21h12M7.5 3v2.3c0 2.6 2 4.4 4.5 6.7 2.5-2.3 4.5-4.1 4.5-6.7V3M7.5 21v-2.3c0-2.6 2-4.4 4.5-6.7 2.5 2.3 4.5 4.1 4.5 6.7V21" />
    <path {...F} d="M10.2 9h3.6L12 10.8zM9 19.6h6c0-1.4-1.2-2.8-3-4-1.8 1.2-3 2.6-3 4z" />
  </>,
)

export const Lock = make(
  'Lock',
  <>
    <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4" />
    <path {...F} d="M12 14.2a1.4 1.4 0 0 1 .7 2.6l.5 2.2h-2.4l.5-2.2a1.4 1.4 0 0 1 .7-2.6z" />
  </>,
)

export const Unlock = make(
  'Unlock',
  <>
    <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 7.6-1.7" />
    <path {...F} d="M12 14.2a1.4 1.4 0 0 1 .7 2.6l.5 2.2h-2.4l.5-2.2a1.4 1.4 0 0 1 .7-2.6z" />
  </>,
)

/** A signpost: a Traveller. */
export const Signpost = make(
  'Signpost',
  <>
    <path d="M12 3v18M8.5 21h7" />
    <path d="M6 6.5h11l2 2-2 2H6zM18 13H8l-2 2 2 2h10z" />
  </>,
)

export const Vial = make(
  'Vial',
  <>
    <path d="M9.5 3h5M10.5 3v5.2L6.6 16a3 3 0 0 0 2.7 4.5h5.4A3 3 0 0 0 17.4 16L13.5 8.2V3" />
    <path {...F} d="M8.4 15.5h7.2l.9 1.8a1.6 1.6 0 0 1-1.4 2.2H8.9a1.6 1.6 0 0 1-1.4-2.2z" />
  </>,
)

export const Tankard = make(
  'Tankard',
  <>
    <path d="M6 8h9v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM15 10.5h2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2" />
    <path d="M5.5 8c-.8-1.3 0-3 1.7-3 .6 0 1.1.2 1.5.6C9.2 4.6 10 4 11 4c1.3 0 2 .8 2.4 1.5.4-.4 1-.6 1.6-.6 1.5 0 2.3 1.6 1.4 3" />
  </>,
)

export const Shield = make(
  'Shield',
  <>
    <path d="M12 3 5 6v6c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6z" />
    <path d="M12 7v10M8.5 11h7" />
  </>,
)

/** A mask: a player who is not what their token says, and "me". */
export const Mask = make(
  'Mask',
  <>
    <path d="M4 5c2.5 1 5.5 1.5 8 1.5S17.5 6 20 5v6c0 5-3.5 8.5-8 9.5C7.5 19.5 4 16 4 11z" />
    <path {...F} d="M7.5 10.5c1.2-.8 2.6-.8 3.5.3-1 .8-2.4.8-3.5-.3zM16.5 10.5c-1.2-.8-2.6-.8-3.5.3 1 .8 2.4.8 3.5-.3z" />
    <path d="M9 15.5c1.8 1.4 4.2 1.4 6 0" />
  </>,
)

/** A seat at the ring: players. */
export const Ring = make(
  'Ring',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle {...F} cx="12" cy="3.5" r="2" />
    <circle {...F} cx="4.6" cy="16.3" r="2" />
    <circle {...F} cx="19.4" cy="16.3" r="2" />
  </>,
)

/** Two dice: the deal. */
export const Dice = make(
  'Dice',
  <>
    <rect x="3" y="9" width="12" height="12" rx="1.5" />
    <path d="M9 9V5.5A1.5 1.5 0 0 1 10.5 4h9A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5H15" />
    <circle {...F} cx="6.5" cy="12.5" r="1" />
    <circle {...F} cx="11.5" cy="17.5" r="1" />
    <circle {...F} cx="9" cy="15" r="1" />
    <circle {...F} cx="16" cy="8" r="1" />
  </>,
)

export const Heart = make(
  'Heart',
  <path d="M12 20.5 4.6 13a4.5 4.5 0 0 1 6.4-6.4l1 1 1-1a4.5 4.5 0 0 1 6.4 6.4z" />,
)

export const Eye = make(
  'Eye',
  <>
    <path d="M2.5 12c2.3-4 5.5-6 9.5-6s7.2 2 9.5 6c-2.3 4-5.5 6-9.5 6s-7.2-2-9.5-6z" />
    <circle cx="12" cy="12" r="2.8" />
    <circle {...F} cx="12" cy="12" r="1.2" />
  </>,
)

export const EyeOff = make(
  'EyeOff',
  <>
    <path d="M4 4l16 16" />
    <path d="M10.6 6.3A10 10 0 0 1 12 6c4 0 7.2 2 9.5 6-.8 1.4-1.7 2.5-2.7 3.4M6.6 8.1C5 9.1 3.6 10.4 2.5 12c2.3 4 5.5 6 9.5 6 1.3 0 2.6-.2 3.7-.7" />
    <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
  </>,
)

/** Two columns of dots: drag me. */
export const Grip = make(
  'Grip',
  <>
    <circle {...F} cx="9" cy="6" r="1.3" />
    <circle {...F} cx="15" cy="6" r="1.3" />
    <circle {...F} cx="9" cy="12" r="1.3" />
    <circle {...F} cx="15" cy="12" r="1.3" />
    <circle {...F} cx="9" cy="18" r="1.3" />
    <circle {...F} cx="15" cy="18" r="1.3" />
  </>,
)

export const Qr = make(
  'Qr',
  <>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
    <path {...F} d="M6 6h2v2H6zM16 6h2v2h-2zM6 16h2v2H6zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z" />
  </>,
)

/** Two links of chain: a jinx, a seating constraint. */
export const Link = make(
  'Link',
  <>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  </>,
)

/** An opening quotation mark: a line to say aloud. */
export const Quote = make(
  'Quote',
  <path {...F} d="M5 16.5c0-3.5 1.6-6.4 4.8-8.5l.9 1.4C8.8 10.7 8 12.2 7.8 13.6a2.8 2.8 0 1 1-2.8 2.9zM13.5 16.5c0-3.5 1.6-6.4 4.8-8.5l.9 1.4c-1.9 1.3-2.7 2.8-2.9 4.2a2.8 2.8 0 1 1-2.8 2.9z" />,
)

// --- Plain UI --------------------------------------------------------------

export const ChevronLeft = make('ChevronLeft', <path d="m14.5 5-7 7 7 7" />)
export const ChevronRight = make('ChevronRight', <path d="m9.5 5 7 7-7 7" />)
export const Plus = make('Plus', <path d="M12 5v14M5 12h14" />)
export const Close = make('Close', <path d="M6 6l12 12M18 6 6 18" />)
export const Check = make('Check', <path d="m4.5 12.5 5 5L19.5 7" />)
export const Undo = make('Undo', <path d="M8.5 13.5 4 9l4.5-4.5M4 9h10a5.5 5.5 0 0 1 0 11h-3.5" />)
export const Swap = make('Swap', <path d="M4 8h13l-3-3M20 16H7l3 3" />)
export const Trash = make(
  'Trash',
  <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l.8 13a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-13M10 10.5v6M14 10.5v6" />,
)
/** Leaving the game. */
export const Leave = make(
  'Leave',
  <path d="M13 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M10 12h11M17.5 8.5 21 12l-3.5 3.5" />,
)
export const Import = make(
  'Import',
  <path d="M12 3v11M8 10l4 4 4-4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
)
export const Export = make(
  'Export',
  <path d="M12 14V3M8 7l4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
)
export const Question = make(
  'Question',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7" />
    <circle {...F} cx="12" cy="17" r="1" />
  </>,
)
export const Warning = make(
  'Warning',
  <>
    <path d="M12 3.5 2.5 20h19z" />
    <path d="M12 9v5" />
    <circle {...F} cx="12" cy="17" r="1" />
  </>,
)
