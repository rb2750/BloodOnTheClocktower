/**
 * Every alert, every silent way a phone can say it.
 *
 * A buzz where the browser allows one, which is Android, and a flash of the
 * screen edge everywhere. Never a sound: a table at night is pretending to be
 * asleep. Safari has no vibration for web pages at all, so an iPhone's buzz
 * comes from a real notification instead, sent by the relay to a phone that
 * has been added to the home screen; see push.ts.
 */
function flash() {
  document.documentElement.classList.remove('alerting')
  void document.documentElement.offsetWidth
  document.documentElement.classList.add('alerting')
  window.setTimeout(() => document.documentElement.classList.remove('alerting'), 900)
}

export type Alert = 'word' | 'role' | 'vote' | 'closed' | 'night' | 'day' | 'hand' | 'seat' | 'chat' | 'nudge' | 'timesup' | 'over'

const BUZZ: Record<Alert, number | number[]> = {
  word: [60, 40, 60],
  role: [80, 60, 80],
  vote: [40, 50, 40],
  closed: 120,
  night: [30, 40, 30, 40, 30],
  day: 60,
  hand: 25,
  seat: [30, 30, 30],
  chat: [50, 40, 50],
  nudge: [140, 70, 140, 70, 140],
  // Three seconds: the one alarm in the app, for a timer running out.
  timesup: [400, 200, 400, 200, 400, 200, 400, 200, 400],
  over: [200, 100, 200, 100, 500],
}


let audio: AudioContext | null = null

/**
 * Sound needs a tap before the browser allows it, so the first touch on the
 * page opens the audio context and keeps it warm. Playback mode lets an
 * iPhone with the mute switch on still sound the alarm.
 */
export function unlockAudio() {
  const open = () => {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
      if (session) session.type = 'playback'
      audio ??= new AudioContext()
      if (audio.state !== 'running') void audio.resume()
    } catch {}
  }
  for (const ev of ['touchend', 'pointerup', 'keydown']) document.addEventListener(ev, open, { passive: true })
}

/** The one sound in the app: a timer running out, rung for three seconds. */
export function alarm() {
  try {
    if (!audio) audio = new AudioContext()
    const ctx = audio
    const play = () => {
      const t0 = ctx.currentTime + 0.02
      for (let i = 0; i < 6; i++) {
        for (const [freq, off] of [[880, 0], [1320, 0.12]] as const) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = freq
          const t = t0 + i * 0.5 + off
          gain.gain.setValueAtTime(0.0001, t)
          gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.25)
        }
      }
    }
    if (ctx.state !== 'running') void ctx.resume().then(play)
    else play()
  } catch {}
}

/** Say it every way at once. */
export function alert(kind: Alert) {
  try {
    navigator.vibrate?.(BUZZ[kind])
  } catch {}
  flash()
}

export type Haptic = 'tap' | 'pick' | 'tick' | 'drop' | 'confirm' | 'warn'

const HAPTIC: Record<Haptic, number | number[]> = {
  tap: 8,
  pick: 18,
  tick: 6,
  drop: [12, 40, 22],
  confirm: 35,
  warn: [30, 60, 30],
}

/**
 * Feedback for something this phone just did, as opposed to something that
 * arrived: a buzz and nothing else. No flash, because the eye is already on
 * the thing that moved, and no sound anywhere in this app.
 */
export function haptic(kind: Haptic) {
  try {
    navigator.vibrate?.(HAPTIC[kind])
  } catch {}
}
