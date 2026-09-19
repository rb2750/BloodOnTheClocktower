import { useEffect, useRef, useState } from 'react'
import './cinematic.css'

const LEAVE_MS = 520

/**
 * The cinematic that marks a phase change, on every screen in the room.
 *
 * Purely the picture: who decides it should play, and when it has played, is
 * the caller's business, because the Storyteller and a player answer those
 * questions differently. The Storyteller's stays until tapped, since they
 * decide when the table is ready. A player's can also let itself go, because
 * a phone left face up on the table should not hold a title all night.
 */
export function Cinematic({
  phase,
  title,
  sub,
  skip = 'Tap when you are ready',
  after,
  onDone,
}: {
  phase: 'night' | 'day'
  title: string
  sub: string
  skip?: string
  /** Leave on its own after this long. Omit to wait for a tap. */
  after?: number
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<number[]>([])

  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    timers.current.push(window.setTimeout(onDone, LEAVE_MS))
  }

  useEffect(() => {
    if (after !== undefined) timers.current.push(window.setTimeout(dismiss, after))
    return () => {
      for (const t of timers.current) window.clearTimeout(t)
    }
    // Runs once per showing; the timer must not restart on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="cinematic"
      data-phase={phase}
      data-leaving={leaving || undefined}
      onPointerDown={dismiss}
      role="status"
      aria-live="polite"
      aria-label={`${title}. ${sub}`}
    >
      <div className="cinematic-wash" />

      <span className="cinematic-bar" data-edge="top" />
      <span className="cinematic-bar" data-edge="bottom" />

      <div className="cinematic-title">
        <div className="line">{title}</div>
        <div className="sub">{sub}</div>
      </div>

      <div className="cinematic-skip">{skip}</div>
    </div>
  )
}
