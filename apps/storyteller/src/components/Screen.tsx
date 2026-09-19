import { useRef, type ReactNode } from 'react'
import { ChevronLeft } from '@botc/ui'

/**
 * The standard frame: a plain title bar carrying no controls, a scrolling body,
 * and a pinned bottom bar for the primary action.
 *
 * Nothing important ever goes in the top bar. Roughly half of phone use is
 * one-handed and the top corners are the hardest place to reach, so actions
 * belong within thumb range at the bottom.
 */
export function Screen({
  title,
  subtitle,
  onTitle,
  onTitleHold,
  onBack,
  trailing,
  children,
  bottom,
  fill = false,
}: {
  title: ReactNode
  /** A small caps line under the title: the count, the step. */
  subtitle?: ReactNode
  /** Makes the title a button, for the log. */
  onTitle?: () => void
  /** A long press on the title. Undo lives here during a game. */
  onTitleHold?: () => void
  onBack?: () => void
  trailing?: ReactNode
  children: ReactNode
  bottom?: ReactNode
  /** Centre the body in the space left over instead of scrolling it. Used by
   *  the live grimoire, which should never leave a dead gap above the controls. */
  fill?: boolean
}) {
  const holdTimer = useRef<number | null>(null)
  const held = useRef(false)
  const startHold = () => {
    if (!onTitleHold) return
    held.current = false
    holdTimer.current = window.setTimeout(() => {
      held.current = true
      onTitleHold()
    }, 600)
  }
  const endHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const heading = (
    <>
      <h1 className="display text-[22px] leading-none text-(--text)">{title}</h1>
      {subtitle && <div className="caps mt-1 text-(--text-faint)">{subtitle}</div>}
    </>
  )
  return (
    <div className="flex h-full flex-col bg-(--bg)">
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Back"
            className="grid size-11 place-items-center text-(--text-dim)"
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
        ) : (
          <span className="size-11" />
        )}
        {onTitle ? (
          <button
            onClick={() => {
              if (held.current) {
                held.current = false
                return
              }
              onTitle()
            }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            className="flex-1 select-none text-center"
          >
            {heading}
          </button>
        ) : (
          <div className="flex-1 text-center">{heading}</div>
        )}
        <span className="flex min-w-11 items-center justify-end">{trailing}</span>
      </header>

      <main
        className={
          fill
            ? 'flex min-h-0 flex-1 flex-col justify-center px-4'
            : 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5'
        }
      >
        {children}
      </main>

      {bottom && (
        <div
          className="shrink-0 border-t border-(--hairline) bg-(--surface) px-5 pt-3 max-h-[55dvh] overflow-y-auto overscroll-contain"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
        >
          {bottom}
        </div>
      )}
    </div>
  )
}
