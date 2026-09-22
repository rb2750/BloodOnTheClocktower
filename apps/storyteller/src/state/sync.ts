import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'
import { RELAY_URL } from '../config.js'

/*
 * The game lives on the server, with this phone keeping a copy.
 *
 * Every Storyteller has one long random key, and the server keeps one saved
 * game per key. Opening the app with `#host=<key>` in the address adopts that
 * key, which is how a game is opened on another device. Without a network the
 * phone's own copy carries on and catches up when the line comes back.
 *
 * Each write says which server version it was based on. If another device got
 * there first the server refuses, hands back its copy, and this phone takes
 * it: a phone left asleep in a pocket must never overwrite the live game.
 */

const KEY = 'botc-host-key'
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => alphabet[b % 36]).join('')

const fromHash = (() => {
  const m = /[#&]host=([a-z0-9]{24,64})/.exec(window.location.hash)
  if (!m) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return m[1]!
})()

const keyReady: Promise<string> = (async () => {
  let key = fromHash
  if (!key) {
    try {
      key = localStorage.getItem(KEY)
    } catch {}
  }
  if (!key) key = ((await idbGet(KEY)) as string | undefined) ?? null
  if (!key) key = fresh()
  try {
    localStorage.setItem(KEY, key)
  } catch {}
  await idbSet(KEY, key)
  return key
})()

export const hostKey = () => keyReady

let version = 0
let serverValue: string | null = null
let latest: string | null = null
let timer: number | null = null
let inflight = false
let hydrating = true
let onRemote: (() => void) | null = null

const url = (key: string, tail = '') => `${RELAY_URL}/store/${key}${tail}`

async function push() {
  timer = null
  if (!RELAY_URL || latest === null || latest === serverValue || inflight) return
  inflight = true
  const value = latest
  try {
    const key = await keyReady
    const res = await fetch(url(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base: version, value }),
    })
    if (res.ok) {
      version = (await res.json()).version
      serverValue = value
    } else if (res.status === 409) {
      // Somebody else's copy is newer: take it, and drop ours.
      const record = await res.json()
      version = record.version
      serverValue = record.value
      latest = record.value
      await idbSet('botc-storyteller', record.value)
      onRemote?.()
    } else throw new Error(String(res.status))
  } catch {
    // Offline or the server hiccupped: try again shortly, the phone copy is safe.
    schedule(5000)
  } finally {
    inflight = false
    if (latest !== serverValue && timer === null) schedule(400)
  }
}

function schedule(ms: number) {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => void push(), ms)
}

export const serverStorage: StateStorage = {
  getItem: async (name) => {
    const local = ((await idbGet(name)) as string | undefined) ?? null
    if (!RELAY_URL) return local
    try {
      const key = await keyReady
      const res = await fetch(url(key), { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const record = await res.json()
        version = record.version
        serverValue = record.value
        latest = record.value
        await idbSet(name, record.value)
        return record.value as string
      }
      if (res.status === 404 && local) {
        // First time this key has been seen: the game on this phone goes up.
        version = 0
        latest = local
        schedule(200)
      }
    } catch {
      // No network: carry on from the phone's own copy.
    }
    return local
  },
  setItem: async (name, value) => {
    await idbSet(name, value)
    latest = value
    if (hydrating) {
      // Writing back what was just read is not a change.
      if (serverValue === null) serverValue = value
      return
    }
    schedule(400)
  },
  removeItem: async (name) => {
    await idbDel(name)
  },
}

/**
 * Watch the server for changes made on another device, and take them.
 * `rehydrate` reloads the store from `getItem`, which fetches the newest copy.
 */
export function startSync(rehydrate: () => Promise<void>, hydrated: () => boolean) {
  const reload = async () => {
    hydrating = true
    try {
      await rehydrate()
    } finally {
      hydrating = false
    }
  }
  onRemote = () => void reload()
  const settle = window.setInterval(() => {
    if (hydrated()) {
      hydrating = false
      window.clearInterval(settle)
    }
  }, 100)
  if (!RELAY_URL) return () => window.clearInterval(settle)
  const check = async () => {
    if (document.visibilityState !== 'visible' || inflight || timer !== null || latest !== serverValue) return
    try {
      const key = await keyReady
      const res = await fetch(url(key, '/version'), { cache: 'no-store' })
      if (!res.ok) return
      const { version: v } = await res.json()
      if (v > version) await reload()
    } catch {}
  }
  const poll = window.setInterval(() => void check(), 4000)
  const onShow = () => void check()
  document.addEventListener('visibilitychange', onShow)
  return () => {
    window.clearInterval(settle)
    window.clearInterval(poll)
    document.removeEventListener('visibilitychange', onShow)
  }
}
