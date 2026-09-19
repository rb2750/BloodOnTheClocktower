import { useEffect, useRef, useState } from 'react'
import './cinematic.css'
import { useStore, phaseLabel } from '../state/store.js'

const FULL_MS = 2100
const LEAVE_MS = 420

type Shown = { phase: 'night' | 'day'; title: string; sub: string; key: string }

/**
 * The cinematic that marks a phase change.
 *
 * The dawn one earns its place twice over: the official Storyteller reminder
 * for dawn says to wait about ten seconds before calling for eyes open, so that
 * the final wake of the night cannot be timed by anyone listening. The
 * animation fills part of that mandated pause, which makes it functional rather
 * than decorative.
 *
 * It is always skippable with a tap, because a beautiful transition becomes a
 * tax by the fifth night.
 */
export function PhaseCinematic() {
  const game = useStore((s) => s.game)
  const enabled = useStore((s) => s.settings.cinematics)
  const [shown, setShown] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState(false)
  const lastKey = useRef<string | null>(null)
  const timers = useRef<number[]>([])

  const phase = game?.phase

  useEffect(() => {
    if (!phase || (phase.k !== 'night' && phase.k !== 'day')) return
    const key = `${phase.k}-${phase.n}`
    if (lastKey.current === key) return
    lastKey.current = key
    if (!enabled) return

    setShown({
      phase: phase.k,
      key,
      title: phase.k === 'night' ? 'Night falls' : `Day ${phase.n}`,
      sub:
        phase.k === 'night'
          ? phase.n === 1
            ? 'Everyone, close your eyes. Ravenswood Bluff sleeps.'
            : 'Everyone, close your eyes.'
          : 'Wait ten seconds, then call for eyes open and announce the dead.',
    })
    setLeaving(false)
  }, [phase, enabled])

  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    timers.current.push(
      window.setTimeout(() => {
        setShown(null)
        setLeaving(false)
      }, LEAVE_MS),
    )
  }

  useEffect(() => {
    if (!shown || leaving) return
    const t = window.setTimeout(dismiss, FULL_MS)
    timers.current.push(t)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.key, leaving])

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t)
    },
    [],
  )

  if (!shown) return null

  return (
    <div
      className="cinematic"
      data-phase={shown.phase}
      data-leaving={leaving || undefined}
      onPointerDown={dismiss}
      role="status"
      aria-live="polite"
      aria-label={`${phaseLabel(phase!)}. ${shown.sub}`}
    >
      <div className="cinematic-wash" />

      <span className="cinematic-bar" data-edge="top" />
      <span className="cinematic-bar" data-edge="bottom" />

      <div className="cinematic-title">
        <div className="line">{shown.title}</div>
        <div className="sub">{shown.sub}</div>
      </div>

      <div className="cinematic-skip">tap to continue</div>
    </div>
  )
}
