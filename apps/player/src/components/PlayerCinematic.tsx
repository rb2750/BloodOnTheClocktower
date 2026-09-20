import { useEffect, useState } from 'react'
import { Cinematic } from '@botc/ui'
import { useStore } from '../state.js'

const HOLD_MS = 7000

type Shown = { phase: 'night' | 'day'; title: string; sub: string; key: string }

/**
 * The same nightfall the Storyteller's screen plays, on every phone at once.
 *
 * It is addressed to the player rather than to the room: "close your eyes",
 * not "everyone, close your eyes". It lets itself go after a few seconds,
 * because at night nobody is looking at it, and in the morning the phone is
 * about to be needed for something else.
 *
 * It plays on a change of phase and at no other time. Opening the app, coming
 * back to it, closing a message thread, refreshing and joining a game already
 * under way all arrive at a phase that simply *is*, and announcing night to
 * somebody already sitting in it is noise. The Storyteller says when the phase
 * changed, and only a change from the last few seconds is played.
 */
const FRESH_MS = 20_000
export function PlayerCinematic() {
  const phase = useStore((s) => s.phase)
  const day = useStore((s) => s.day)
  const known = useStore((s) => s.phaseKnown)
  const at = useStore((s) => s.phaseAt)
  const played = useStore((s) => s.cinematicPlayed)
  const setPlayed = useStore((s) => s.setCinematicPlayed)
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    if (!known) return
    const kind = /^night/i.test(phase) ? 'night' : /^day/i.test(phase) ? 'day' : null
    if (!kind) return
    const key = `${kind}-${day}`
    if (played === key) return
    setPlayed(key)
    if (at === null || Date.now() - at > FRESH_MS) return
    setShown({
      phase: kind,
      key,
      title: kind === 'night' ? 'Night falls' : `Day ${day}`,
      sub:
        kind === 'night'
          ? day === 1
            ? 'Close your eyes. Ravenswood Bluff sleeps.'
            : 'Close your eyes.'
          : 'Open your eyes.',
    })
  }, [phase, day, at, known, played, setPlayed])

  if (!shown) return null
  return (
    <Cinematic
      key={shown.key}
      {...shown}
      skip="Tap to carry on"
      after={HOLD_MS}
      onDone={() => setShown(null)}
    />
  )
}
