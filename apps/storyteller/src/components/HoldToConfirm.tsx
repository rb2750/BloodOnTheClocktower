import { useCallback, useEffect, useRef, useState } from 'react'
import { UserMinus } from 'lucide-react'

const HOLD_MS = 650

/**
 * A destructive action that needs a deliberate hold.
 *
 * The rule this follows: frequent and reversible actions are instant with an
 * undo, and rare irreversible ones are confirmed. A hold is the right shape for
 * the second kind in a dim room, because it cannot be triggered by a stray tap
 * and it gives continuous feedback, where a dialog is just one more thing to
 * find and dismiss in the dark.
 */
export function HoldToConfirm({
  label,
  onConfirm,
}: {
  label: string
  onConfirm: () => void
}) {
  const [progress, setProgress] = useState(0)
  const frame = useRef<number | null>(null)
  const start = useRef(0)

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setProgress(0)
  }, [])

  const begin = useCallback(() => {
    start.current = performance.now()
    const tick = () => {
      const elapsed = performance.now() - start.current
      const next = Math.min(1, elapsed / HOLD_MS)
      setProgress(next)
      if (next >= 1) {
        stop()
        onConfirm()
        return
      }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [onConfirm, stop])

  useEffect(() => stop, [stop])

  return (
    <button
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="relative flex min-h-(--tap-min) flex-1 items-center justify-center gap-2 overflow-hidden rounded-(--radius-surface) border border-(--hairline) px-4 text-[15px] text-(--color-evil-300)"
    >
      <span
        className="absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--color-evil-500)_26%,transparent)] transition-none"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <UserMinus size={17} className="relative" />
      <span className="relative">{label}</span>
    </button>
  )
}
