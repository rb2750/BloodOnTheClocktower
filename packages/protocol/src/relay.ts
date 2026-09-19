import { decryptJson, encryptJson, importKey } from './crypto.js'
import { base64urlDecode, base64urlEncode } from './codec.js'
import type { RelayMessage } from './messages.js'

/**
 * Client for the optional relay.
 *
 * Three properties matter more than features here:
 *
 *  1. **Nothing awaits it.** `send` queues and returns. A background flusher
 *     drains the queue whenever a socket is up. The Storyteller's UI must never
 *     block on a network that may not exist.
 *  2. **It is end-to-end encrypted.** The key came from the QR fragment, so the
 *     relay moves bytes it cannot read.
 *  3. **Its absence is normal, not an error.** If it never connects, the apps
 *     fall back to per-player QR codes and the game is unaffected.
 */
export type RelayOptions = {
  url: string
  room: string
  key: Uint8Array
  role: 'host' | 'player'
  onMessage: (message: RelayMessage) => void
  onStatus?: (status: RelayStatus) => void
}

export type RelayStatus = 'connecting' | 'open' | 'offline'

// Short, because a phone that dimmed for a moment must be back before the
// next hand goes up. The relay is a dumb pipe and cheap to knock on.
const BACKOFF_MS = [300, 600, 1200, 2500, 5000]
/** A tiny plaintext knock the relay answers and never forwards. */
const PING_MS = 15000
const PONG_WAIT_MS = 5000

export class Relay {
  private socket: WebSocket | null = null
  private key: CryptoKey | null = null
  private outbox: RelayMessage[] = []
  private attempt = 0
  private closed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private pongDue: ReturnType<typeof setTimeout> | null = null
  private wake = () => this.reconnectNow()

  constructor(private options: RelayOptions) {}

  async start(): Promise<void> {
    this.key = await importKey(this.options.key)
    // Coming back to the app, or the network coming back, is the moment the
    // line matters most, so those are reconnects now rather than after a wait.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.wake)
      window.addEventListener('online', this.wake)
      window.addEventListener('focus', this.wake)
      window.addEventListener('pageshow', this.wake)
    }
    this.connect()
  }

  private reconnectNow() {
    if (this.closed) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    // A socket that lived through a sleep is not to be trusted, and asking
    // it costs seconds. A fresh one costs a tenth of that, and the other side
    // re-sends everything on sitting down.
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.attempt = 0
    this.socket?.close()
    this.socket = null
    this.connect()
  }

  private ping() {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    try {
      socket.send('ping')
    } catch {
      return
    }
    if (this.pongDue) clearTimeout(this.pongDue)
    this.pongDue = setTimeout(() => {
      // No answer: the socket is open in name only. Drop it and start again.
      this.pongDue = null
      socket.close()
    }, PONG_WAIT_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    if (this.pongDue) clearTimeout(this.pongDue)
    this.heartbeat = null
    this.pongDue = null
  }

  /** Queue a message. Returns immediately, whether or not anything is connected. */
  send(message: RelayMessage): void {
    this.outbox.push(message)
    void this.flush()
  }

  close(): void {
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    this.stopHeartbeat()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.wake)
      window.removeEventListener('online', this.wake)
      window.removeEventListener('focus', this.wake)
      window.removeEventListener('pageshow', this.wake)
    }
    this.socket?.close()
    this.socket = null
  }

  private connect() {
    if (this.closed) return
    this.options.onStatus?.('connecting')

    const base = this.options.url.replace(/^http/, 'ws').replace(/\/$/, '')
    const url = `${base}/room/${this.options.room}?role=${this.options.role}`

    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch {
      this.retry()
      return
    }
    this.socket = socket

    socket.addEventListener('open', () => {
      this.attempt = 0
      this.options.onStatus?.('open')
      this.stopHeartbeat()
      this.heartbeat = setInterval(() => this.ping(), PING_MS)
      void this.flush()
    })

    socket.addEventListener('message', (event) => {
      const body = String(event.data)
      if (body === 'pong') {
        if (this.pongDue) clearTimeout(this.pongDue)
        this.pongDue = null
        return
      }
      void this.receive(body)
    })

    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = null
      this.stopHeartbeat()
      this.options.onStatus?.('offline')
      this.retry()
    })

    socket.addEventListener('error', () => {
      // `close` always follows, which is where the retry is scheduled.
      this.options.onStatus?.('offline')
    })
  }

  private retry() {
    if (this.closed || this.timer) return
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!
    this.attempt += 1
    this.timer = setTimeout(() => {
      this.timer = null
      this.connect()
    }, delay)
  }

  private async flush() {
    if (!this.key || this.socket?.readyState !== WebSocket.OPEN) return
    while (this.outbox.length > 0) {
      const message = this.outbox[0]!
      try {
        const bytes = await encryptJson(this.key, message)
        this.socket.send(base64urlEncode(bytes))
        this.outbox.shift()
      } catch {
        // Leave it queued; the next open connection will try again.
        return
      }
    }
  }

  private async receive(body: string) {
    if (!this.key) return
    try {
      const message = await decryptJson<RelayMessage>(this.key, base64urlDecode(body))
      this.options.onMessage(message)
    } catch {
      // A message we cannot decrypt is one meant for a different game, or
      // corrupt. Either way it is not ours and dropping it is correct.
    }
  }
}
