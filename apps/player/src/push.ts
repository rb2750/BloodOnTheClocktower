import { RELAY_URL } from './config.js'

/**
 * Real notifications, for the one thing the web cannot do on its own: buzz an
 * iPhone. iOS allows them only for an app added to the home screen, and only
 * after a tap that asks. The subscription goes to the relay, which sends a
 * contentless notification when the Storyteller does something this phone
 * must feel.
 */
export type PushState = 'unsupported' | 'install-first' | 'off' | 'on' | 'denied'

const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
const STANDALONE =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

export function pushState(): PushState {
  if (!('PushManager' in window) || !('Notification' in window)) {
    return IOS && !STANDALONE ? 'install-first' : 'unsupported'
  }
  if (IOS && !STANDALONE) return 'install-first'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.permission === 'granted' ? 'on' : 'off'
}

function toKey(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Ask, subscribe, and return the subscription as the relay wants it. */
export async function enablePush(): Promise<string | null> {
  if (pushState() === 'install-first' || pushState() === 'unsupported') return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const registration = await navigator.serviceWorker.ready
  const key = await (await fetch(`${RELAY_URL}/vapid`)).text()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(key.trim()) as BufferSource,
    }))
  return JSON.stringify(subscription.toJSON())
}

/** The subscription this phone already holds, if the permission is still there. */
export async function currentPush(): Promise<string | null> {
  if (pushState() !== 'on') return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription ? JSON.stringify(subscription.toJSON()) : null
}
