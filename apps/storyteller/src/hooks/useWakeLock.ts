import { useEffect, useRef } from 'react'

/**
 * Hold the screen awake during a game.
 *
 * Supported everywhere now, including installed iOS web apps since 18.4. The
 * lock is released whenever the page is hidden, which bites everyone, so it is
 * re-acquired on `visibilitychange`.
 */
export function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelled = false

    const acquire = async () => {
      if (!active || cancelled) return
      try {
        lock.current = await navigator.wakeLock?.request('screen')
      } catch {
        // Denied, unsupported, or the tab is not visible. Not worth surfacing:
        // the game is unaffected, the screen just dims as usual.
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void lock.current?.release().catch(() => {})
      lock.current = null
    }
  }, [active])
}
