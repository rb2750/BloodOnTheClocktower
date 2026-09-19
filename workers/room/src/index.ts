/// <reference types="@cloudflare/workers-types" />

/**
 * The relay.
 *
 * It is a dumb pipe and nothing more. Every message that crosses it was
 * encrypted on the sending device with a key that only ever travelled inside a
 * QR code's URL fragment, so this Worker cannot read a role, a name or a script
 * even in principle. That is deliberate: it removes the entire question of what
 * the server knows, and with it any need for a privacy policy.
 *
 * It is also strictly optional. The apps fall back to per-player QR codes when
 * it is unreachable, and the Storyteller app never awaits it for anything.
 */

export interface Env {
  ROOMS: DurableObjectNamespace
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (url.pathname === '/health') {
      return new Response('ok', { headers: CORS })
    }

    const match = /^\/room\/([a-z0-9]{4,16})$/i.exec(url.pathname)
    if (!match) return new Response('Not found', { status: 404, headers: CORS })

    const id = env.ROOMS.idFromName(match[1]!.toLowerCase())
    return env.ROOMS.get(id).fetch(request)
  },
} satisfies ExportedHandler<Env>

type Role = 'host' | 'player'

export class Room implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade.', { status: 426, headers: CORS })
    }

    const url = new URL(request.url)
    const role: Role = url.searchParams.get('role') === 'host' ? 'host' : 'player'

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    // Hibernation: the runtime may evict this object between messages and
    // rehydrate it on the next one, and an object eligible for hibernation is
    // not billed for duration. The attachment is how the socket remembers which
    // side it is after that happens.
    this.state.acceptWebSocket(server, [role])
    server.serializeAttachment({ role })

    // A player joining after the Storyteller has already published wants the
    // current state immediately rather than waiting for the next change.
    if (role === 'player') {
      const latest = await this.state.storage.get<string>('latest')
      if (latest) server.send(latest)
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const { role } = (ws.deserializeAttachment() ?? { role: 'player' }) as { role: Role }
    const body = typeof message === 'string' ? message : new TextDecoder().decode(message)

    // Cap what a room will hold, so a stuck client cannot grow it without bound.
    if (body.length > 64 * 1024) {
      ws.close(1009, 'Message too large.')
      return
    }

    if (role === 'host') {
      // The host's broadcast is the room's state. It is opaque ciphertext here.
      await this.state.storage.put('latest', body)
      this.broadcast(body, 'player')
    } else {
      // Players only ever send claims, which go to the Storyteller.
      this.broadcast(body, 'host')
    }
  }

  webSocketClose(ws: WebSocket, code: number) {
    // 1005 means no status was given, which `close` rejects as an argument.
    ws.close(code === 1005 ? 1000 : code)
  }

  private broadcast(body: string, to: Role) {
    for (const socket of this.state.getWebSockets(to)) {
      try {
        socket.send(body)
      } catch {
        // A socket that has gone away is not an error worth surfacing; the
        // client reconnects and the host republishes.
      }
    }
  }
}
