import { useEffect, useState } from 'react'
import { Button, Sheet, inputClass, haptic } from '@botc/ui'
import { useStore } from '../state/store.js'

const QUICK = [30, 60, 120, 180, 300]
const LABELS = ['Discussion', 'Private chats', 'Nominations', 'Break']

export function clock(ms: number) {
  const s = Math.max(0, Math.ceil((ms - 200) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A once-a-second tick, for anything that shows a countdown. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])
  return now
}

export function TimerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const timer = useStore((s) => s.game?.timer ?? null)
  const startTimer = useStore((s) => s.startTimer)
  const stopTimer = useStore((s) => s.stopTimer)
  const [label, setLabel] = useState('Discussion')
  const [minutes, setMinutes] = useState('')
  const now = useNow()
  const left = timer ? timer.endsAt - now : 0

  const start = (seconds: number) => {
    haptic('confirm')
    startTimer(seconds, label)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={timer ? (left > 0 ? `${clock(left)} left` : 'Time is up') : 'Start a timer'}
      subtitle="Every phone shows the countdown and buzzes for a few seconds when it ends."
    >
      {timer && (
        <div className="mb-4 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              haptic('tap')
              startTimer(Math.max(0, Math.round(left / 1000)) + 60, timer.label)
              onClose()
            }}
          >
            Add a minute
          </Button>
          <Button
            variant="primary"
            className="flex-1 text-(--color-red-2)"
            onClick={() => {
              haptic('warn')
              stopTimer()
              onClose()
            }}
          >
            Stop
          </Button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {LABELS.map((l) => (
          <button
            key={l}
            onClick={() => setLabel(l)}
            className={`min-h-9 rounded-full border px-3 text-[13px] font-medium ${label === l ? 'border-(--now) text-(--now)' : 'border-(--hairline-strong) text-(--text)'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {QUICK.map((s) => (
          <Button key={s} live onClick={() => start(s)}>
            {s < 60 ? `${s}s` : `${s / 60}m`}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 pb-2">
        <input
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Minutes"
          className={`${inputClass} flex-1`}
        />
        <Button disabled={!minutes || Number(minutes) <= 0} onClick={() => start(Number(minutes) * 60)}>
          Start
        </Button>
      </div>
    </Sheet>
  )
}
