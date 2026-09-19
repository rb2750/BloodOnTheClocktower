import type { ReactNode } from 'react'
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
  onBack,
  trailing,
  children,
  bottom,
  fill = false,
}: {
  title: ReactNode
  onBack?: () => void
  trailing?: ReactNode
  children: ReactNode
  bottom?: ReactNode
  /** Centre the body in the space left over instead of scrolling it. Used by
   *  the live grimoire, which should never leave a dead gap above the controls. */
  fill?: boolean
}) {
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
            className="grid size-11 place-items-center rounded-full text-(--text-dim)"
          >
            <ChevronLeft size={22} strokeWidth={2.25} />
          </button>
        ) : (
          <span className="size-11" />
        )}
        <h1 className="flex-1 text-center text-[13px] text-(--text-dim)">{title}</h1>
        <span className="flex size-11 items-center justify-center">{trailing}</span>
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
          className="shrink-0 border-t border-(--hairline) bg-(--surface) px-5 pt-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
        >
          {bottom}
        </div>
      )}
    </div>
  )
}
