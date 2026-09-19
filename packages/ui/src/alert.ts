/**
 * Every alert, every way a phone can say it.
 *
 * A buzz where the browser allows one, which is Android. A short chime where
 * it does not, which is every iPhone, because Safari has no vibration for web
 * pages at all; the chime needs the page to have been tapped once, which the
 * seat pick and the hold both are, and it is silenced by the ringer switch.
 * And a flash of the screen edge, which needs nothing and works everywhere.
 */
let context: AudioContext | null = null

function unlock() {
  if (context) return
  try {
    context = new AudioContext()
    void context.resume()
  } catch {
    context = null
  }
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, unlock, { passive: true })
  }
}

function chime(notes: number[]) {
  if (!context) return
  void context.resume()
  const at = context.currentTime
  notes.forEach((frequency, i) => {
    const osc = context!.createOscillator()
    const gain = context!.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0, at + i * 0.14)
    gain.gain.linearRampToValueAtTime(0.25, at + i * 0.14 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, at + i * 0.14 + 0.13)
    osc.connect(gain).connect(context!.destination)
    osc.start(at + i * 0.14)
    osc.stop(at + i * 0.14 + 0.14)
  })
}

function flash() {
  document.documentElement.classList.remove('alerting')
  void document.documentElement.offsetWidth
  document.documentElement.classList.add('alerting')
  window.setTimeout(() => document.documentElement.classList.remove('alerting'), 900)
}

export type Alert = 'word' | 'role' | 'vote' | 'closed' | 'night' | 'day' | 'hand' | 'seat'

const BUZZ: Record<Alert, number | number[]> = {
  word: [60, 40, 60],
  role: [80, 60, 80],
  vote: [40, 50, 40],
  closed: 120,
  night: [30, 40, 30, 40, 30],
  day: 60,
  hand: 25,
  seat: [30, 30, 30],
}

const NOTES: Record<Alert, number[]> = {
  word: [880, 1174],
  role: [660, 880, 1174],
  vote: [988, 988],
  closed: [784, 523],
  night: [523, 392],
  day: [659, 988],
  hand: [1318],
  seat: [784, 988],
}

/** Say it every way at once. */
export function alert(kind: Alert) {
  try {
    navigator.vibrate?.(BUZZ[kind])
  } catch {}
  chime(NOTES[kind])
  flash()
}
