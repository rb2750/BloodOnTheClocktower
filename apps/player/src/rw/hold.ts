import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Press and hold, told apart from a tap and from a scroll.
 *
 * A tap is a press released within a quarter of a second without moving. A
 * hold fills over `ms` and fires `onDone`; `onEnd` fires when a completed hold
 * is let go, which is how anything held open closes again. Moving the finger
 * more than a few pixels is a scroll and cancels everything.
 */
export function useHold({
  ms,
  onDone,
  onTap,
  onEnd,
  enabled = true,
}: {
  ms: number
  onDone: () => void
  onTap?: () => void
  onEnd?: () => void
  enabled?: boolean
}) {
  const [p, setP] = useState(0)
  const state = useRef<{ t0: number; x: number; y: number; done: boolean; raf: number } | null>(null)
  const cb = useRef({ onDone, onTap, onEnd })
  cb.current = { onDone, onTap, onEnd }

  const stop = useCallback((tap: boolean) => {
    const s = state.current
    if (!s) return
    cancelAnimationFrame(s.raf)
    state.current = null
    setP(0)
    if (s.done) cb.current.onEnd?.()
    else if (tap) cb.current.onTap?.()
  }, [])

  useEffect(() => {
    const up = () => {
      const s = state.current
      if (!s) return
      stop(!s.done && performance.now() - s.t0 < 250)
    }
    const move = (e: PointerEvent) => {
      const s = state.current
      if (!s || s.done) return
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) stop(false)
    }
    const hide = () => stop(false)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', hide)
    window.addEventListener('pointermove', move)
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', hide)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [stop])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (!enabled) {
      state.current = { t0: performance.now(), x: e.clientX, y: e.clientY, done: false, raf: 0 }
      return
    }
    const t0 = performance.now()
    const tick = () => {
      const s = state.current
      if (!s) return
      const elapsed = performance.now() - t0
      // Nothing shows for the first moment, so a tap never flashes the ring.
      const pct = elapsed < 120 ? 0 : Math.min(100, ((elapsed - 120) / (ms - 120)) * 100)
      setP(pct)
      if (pct >= 100 && !s.done) {
        s.done = true
        cb.current.onDone()
        return
      }
      s.raf = requestAnimationFrame(tick)
    }
    state.current = { t0, x: e.clientX, y: e.clientY, done: false, raf: requestAnimationFrame(tick) }
  }

  return {
    p,
    bind: {
      onPointerDown,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  }
}
