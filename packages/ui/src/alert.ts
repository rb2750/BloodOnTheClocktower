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


/** Say it every way at once. */
export function alert(kind: Alert) {
  try {
    navigator.vibrate?.(BUZZ[kind])
  } catch {}
  flash()
}
