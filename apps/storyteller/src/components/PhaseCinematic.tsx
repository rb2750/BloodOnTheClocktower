import { useEffect, useRef, useState } from 'react'
import './cinematic.css'
import { useStore, phaseLabel } from '../state/store.js'

const LEAVE_MS = 520


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
 * It stays up until it is tapped: the Storyteller decides when the table is
 * ready, and a transition that dismisses itself mid-sentence is worse than
 * none. A tap at any point skips to the end.
 */
export function PhaseCinematic() {
  const game = useStore((s) => s.game)
  const enabled = useStore((s) => s.settings.cinematics)
  const played = useStore((s) => s.cinematicPlayed)
  const setPlayed = useStore((s) => s.setCinematicPlayed)
  const [shown, setShown] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<number[]>([])

  const phase = game?.phase

  useEffect(() => {
    if (!phase || (phase.k !== 'night' && phase.k !== 'day')) return
    const key = `${phase.k}-${phase.n}`
    if (played === key) return
    setPlayed(key)
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
  }, [phase, enabled, played, setPlayed])

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

      <div className="cinematic-skip">Tap when you are ready</div>
    </div>
  )
}
