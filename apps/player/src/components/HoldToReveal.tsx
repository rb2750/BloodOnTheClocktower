import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './reveal.css'

/**
 * Shows a secret only while a finger is held on it.
 *
 * The threat here is not a recording adversary, it is a friend glancing
 * sideways for a second and a phone left face-up on a table. So:
 *
 *  - The cover is **opaque, not blurred**. A blurred character token still
 *    leaks its blue or red ring, and alignment is most of the secret.
 *  - It covers the whole card, picture, name and ability together. An ability
 *    left in the open names the character as surely as its picture does.
 *  - Visible only while the pointer is down. No timer, no toggle, nothing that
 *    can be left open, which also makes "pass me your phone" useless.
 *  - It re-covers itself after a few seconds even if held, so the phone cannot
 *    be propped face-up with something resting on it.
 *  - It re-covers on `visibilitychange` and `blur`. This one matters on iOS,
 *    where the system screenshots the page for the app switcher.
 *  - The reveal grows from the centre as a circular mask, so the alignment ring
 *    is the last thing to appear rather than flashing across the whole card.
 */
const AUTO_COVER_MS = 6000

export function HoldToReveal({
  children,
  label = 'Press and hold',
  hint = 'Cup your hands so nobody else can see.',
  onFirstReveal,
}: {
  children: ReactNode
  label?: string
  hint?: string
  onFirstReveal?: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const timer = useRef<number | null>(null)
  const seen = useRef(false)

  const cover = useCallback(() => {
    setRevealed(false)
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const reveal = useCallback(() => {
    setRevealed(true)
    if (!seen.current) {
      seen.current = true
      onFirstReveal?.()
    }
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(cover, AUTO_COVER_MS)
  }, [cover, onFirstReveal])

  useEffect(() => {
    const onHidden = () => cover()
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('blur', onHidden)
    window.addEventListener('pagehide', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('blur', onHidden)
      window.removeEventListener('pagehide', onHidden)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [cover])

  return (
    <div
      className="reveal"
      data-revealed={revealed || undefined}
      onPointerDown={reveal}
      onPointerUp={cover}
      onPointerCancel={cover}
      onPointerLeave={cover}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label={revealed ? 'Your character is showing' : label}
      // Keyboard access without leaving it open: held, then released.
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          reveal()
        }
      }}
      onKeyUp={cover}
      onBlur={cover}
    >
      <div className="reveal-content" aria-hidden={!revealed}>
        {children}
      </div>

      <div className="reveal-cover" aria-hidden={revealed}>
        <span className="reveal-seal" />
        <span className="reveal-label">{label}</span>
        <span className="reveal-hint">{hint}</span>
      </div>
    </div>
  )
}
