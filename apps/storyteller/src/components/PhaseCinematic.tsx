import { useEffect, useRef, useState } from 'react'
import { Cinematic, haptic } from '@botc/ui'
import { useStore } from '../state/store.js'

type Shown = { phase: 'night' | 'day'; title: string; sub: string; key: string }

/**
 * When the Storyteller's screen plays the phase change.
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
 *
 * It plays on a change of phase and at no other time. A refresh, or a screen
 * coming back, arrives at a phase that simply *is*: the first phase this
 * screen sees is recorded and not played.
 */
export function PhaseCinematic() {
  const game = useStore((s) => s.game)
  const enabled = useStore((s) => s.settings.cinematics)
  const played = useStore((s) => s.cinematicPlayed)
  const setPlayed = useStore((s) => s.setCinematicPlayed)
  const [shown, setShown] = useState<Shown | null>(null)
  const seen = useRef(false)

  const phase = game?.phase

  useEffect(() => {
    if (!phase || (phase.k !== 'night' && phase.k !== 'day')) return
    const key = `${phase.k}-${phase.n}`
    if (!seen.current) {
      seen.current = true
      // Arriving at a phase is not the same as it changing. The exception is a
      // game that has played nothing yet, which is a night that has just begun.
      if (played !== null) {
        setPlayed(key)
        return
      }
    }
    if (played === key) return
    setPlayed(key)
    if (!enabled) return

    haptic(phase.k === 'night' ? 'warn' : 'confirm')
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
  }, [phase, enabled, played, setPlayed])

  if (!shown) return null
  return <Cinematic key={shown.key} {...shown} onDone={() => setShown(null)} />
}
