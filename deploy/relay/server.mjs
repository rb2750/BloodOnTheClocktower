/**
 * The relay, as a plain Node service.
 *
 * A port of workers/room, which needs Cloudflare Durable Objects. The contract
 * is the same one the client in packages/protocol speaks: GET /health, and a
 * WebSocket at /room/<id>?role=host|player. Everything crossing it is
 * ciphertext encrypted on the sending device, so this process decides who hears
 * a message and nothing else.
 *
 * One deliberate difference from the Worker. The Worker keeps a single "latest"
 * host message and replays that to a joining player, but the Storyteller opens
 * with two messages, its public key and then the seat list. A player scanning
 * after that point would hear only the seat list, and without the key it could
 * never open the role sealed to it. This keeps a bounded backlog per room and
 * replays it in order.
 */
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import webpush from 'web-push'

// A phone that has been added to the home screen can be reached by the
// system's own notifications, which is the only thing that buzzes an iPhone
// from a web app. The relay holds each seat's subscription and sends a
// notification that says nothing but "look at your phone"; the content itself
// still only ever travels sealed, over the socket.
const VAPID = JSON.parse(readFileSync(new URL('./vapid.json', import.meta.url), 'utf8'))
webpush.setVapidDetails('mailto:rob@bladen.me', VAPID.publicKey, VAPID.privateKey)

const PORT = Number(process.env.PORT ?? 8902)
const HOST = process.env.HOST ?? '127.0.0.1'

const ROOM_PATH = /^\/room\/([a-z0-9]{4,16})$/i
const MAX_MESSAGE = 64 * 1024
// A whole game's worth: every raised hand is a message now, and a sealed
// word to one phone must outlive an evening of them.
const MAX_BACKLOG = 512
const MAX_BACKLOG_BYTES = 4 * 1024 * 1024
const IDLE_MS = 12 * 60 * 60 * 1000
const SWEEP_MS = 10 * 60 * 1000
const PING_MS = 30 * 1000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const rooms = new Map()

/*
 * The Storyteller's game, kept on the server.
 *
 * One record per Storyteller, named by a long random key that only their
 * devices hold: knowing the key is the permission. The record is the app's
 * own saved state, opaque here. Each write carries the version it was based
 * on, and a write from a device that has fallen behind is refused and handed
 * the newer copy, so a phone left asleep can never overwrite a game that was
 * changed somewhere else.
 */
const STORE_DIR = process.env.STORE_DIR ?? '/var/lib/blood-relay/stores'
mkdirSync(STORE_DIR, { recursive: true })
const STORE_PATH = /^\/store\/([a-z0-9]{24,64})(\/version)?$/
const MAX_STORE = 8 * 1024 * 1024
const stores = new Map()

function readStore(key) {
  if (stores.has(key)) return stores.get(key)
  try {
    const record = JSON.parse(readFileSync(join(STORE_DIR, `${key}.json`), 'utf8'))
    stores.set(key, record)
    return record
  } catch {
    return null
  }
}

function writeStore(key, record) {
  const file = join(STORE_DIR, `${key}.json`)
  writeFileSync(`${file}.tmp`, JSON.stringify(record))
  renameSync(`${file}.tmp`, file)
  stores.set(key, record)
}

function json(response, status, body) {
  response.writeHead(status, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body))
}

function handleStore(request, response, key, versionOnly) {
  if (request.method === 'GET') {
    const record = readStore(key)
    if (!record) return json(response, 404, { version: 0 })
    return json(response, 200, versionOnly ? { version: record.version } : record)
  }
  if (request.method !== 'PUT') return json(response, 405, {})
  let size = 0
  const chunks = []
  request.on('data', (chunk) => {
    size += chunk.length
    if (size > MAX_STORE) {
      json(response, 413, {})
      request.destroy()
      return
    }
    chunks.push(chunk)
  })
  request.on('end', () => {
    if (size > MAX_STORE) return
    let body
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return json(response, 400, {})
    }
    if (typeof body?.value !== 'string' || typeof body?.base !== 'number') return json(response, 400, {})
    const current = readStore(key)
    if (current && body.base !== current.version) return json(response, 409, current)
    const record = { version: (current?.version ?? 0) + 1, updatedAt: Date.now(), value: body.value }
    try {
      writeStore(key, record)
    } catch (err) {
      console.warn(`store write failed for ${key.slice(0, 6)}: ${err?.message ?? err}`)
      return json(response, 500, {})
    }
    json(response, 200, { version: record.version })
  })
}

function room(id) {
  let found = rooms.get(id)
  if (!found) {
    found = { hosts: new Set(), players: new Set(), backlog: [], bytes: 0, subs: new Map(), claims: new Map() }
    rooms.set(id, found)
  }
  found.touched = Date.now()
  return found
}

function broadcast(sockets, body) {
  for (const socket of sockets) {
    // A socket that has gone away is not worth reporting: the client
    // reconnects and the Storyteller republishes.
    try {
      if (socket.readyState === socket.OPEN) socket.send(body)
    } catch {}
  }
}

const http = createServer((request, response) => {
  if (request.method === 'OPTIONS') return response.writeHead(204, CORS).end()
  const store = STORE_PATH.exec(request.url ?? '')
  if (store) return handleStore(request, response, store[1], Boolean(store[2]))
  if (request.url === '/health') {
    return response.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' }).end('ok')
  }
  const code = /^\/code\/([0-9A-Z]{4})$/.exec(request.url ?? '')
  if (code) {
    const text = codes.get(code[1])
    if (!text) return response.writeHead(404, { ...CORS, 'Content-Type': 'text/plain' }).end('No game with that code')
    return response.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' }).end(text)
  }
  if (request.url === '/vapid') {
    return response.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' }).end(VAPID.publicKey)
  }
  response.writeHead(404, { ...CORS, 'Content-Type': 'text/plain' }).end('Not found')
})

// Four letters read out across the table stand in for the QR code. A code
// maps to the same text the QR carries and lives as long as the process: the
// Storyteller registers it again on every connect.
const codes = new Map()

const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE })

http.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://relay.invalid')
  const match = ROOM_PATH.exec(url.pathname)
  if (!match) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    return socket.destroy()
  }

  const id = match[1].toLowerCase()
  const role = url.searchParams.get('role') === 'host' ? 'host' : 'player'

  sockets.handleUpgrade(request, socket, head, (ws) => {
    const here = room(id)
    const mine = role === 'host' ? here.hosts : here.players
    const theirs = role === 'host' ? here.players : here.hosts
    mine.add(ws)
    ws.alive = true

    // A player joining after the Storyteller has published wants the room as it
    // stands, rather than waiting for the next change.
    if (role === 'player') for (const body of here.backlog) ws.send(body)
    // A Storyteller whose screen was off when someone sat down still owes them
    // a role, so the latest claim for every seat is handed to a joining host.
    if (role === 'host') for (const body of here.claims.values()) ws.send(body)

    ws.on('pong', () => {
      ws.alive = true
    })

    ws.on('message', (data) => {
      const body = data.toString()
      // A knock from a client checking the line is answered and goes no
      // further: not to the room, not into the backlog.
      if (body === 'ping') {
        try {
          ws.send('pong')
        } catch {}
        return
      }
      // Control frames: plain text, never forwarded, never kept.
      if (body.startsWith('sub:')) {
        const [, seatId, ...rest] = body.split(':')
        try {
          const sub = JSON.parse(rest.join(':'))
          here.subs.set(seatId, sub)
          console.log(`sub for ${seatId} in ${id}: ${new URL(sub.endpoint).host}`)
        } catch (err) {
          console.warn(`bad sub for ${seatId}: ${err?.message ?? err}`)
        }
        return
      }
      if (body.startsWith('code:')) {
        if (role !== 'host') return
        const [, code, text] = body.split(':')
        if (code && text) codes.set(code, text)
        return
      }
      if (body.startsWith('push:')) {
        if (role !== 'host') return
        const [, seatId, kind] = body.split(':')
        const targets = seatId === '*' ? [...here.subs.entries()] : [[seatId, here.subs.get(seatId)]]
        if (targets.every(([, sub]) => !sub)) console.log(`push ${kind} for ${seatId} in ${id}: no subscription`)
        for (const [id, sub] of targets) {
          if (!sub) continue
          webpush
            .sendNotification(sub, JSON.stringify({ kind }), { TTL: 60, urgency: 'high' })
            .then((r) => console.log(`push ${kind} to ${id}: ${r.statusCode}`))
            .catch((err) => {
              // Gone for good: the phone unsubscribed or the app was removed.
              if (err?.statusCode === 404 || err?.statusCode === 410) here.subs.delete(id)
              else console.warn(`push to ${id} failed: ${err?.statusCode ?? ''} ${err?.message ?? err}`)
            })
        }
        return
      }
      if (body.length > MAX_MESSAGE) return ws.close(1009, 'Message too large.')
      here.touched = Date.now()

      // Everything is kept, so a phone that was asleep catches up, and a
      // player's message goes to the whole room: it is sealed to one reader,
      // the rest hold ciphertext they cannot open.
      here.backlog.push(body)
      here.bytes += body.length
      if (role === 'player') {
        try {
          const parsed = JSON.parse(body)
          if (parsed.t === 'claim' && parsed.seatId) here.claims.set(parsed.seatId, body)
        } catch {}
      }
      while (here.backlog.length > MAX_BACKLOG || here.bytes > MAX_BACKLOG_BYTES) {
        here.bytes -= here.backlog.shift().length
      }
      broadcast(theirs, body)
      if (role === 'player') broadcast([...mine].filter((s) => s !== ws), body)
    })

    ws.on('close', () => {
      mine.delete(ws)
      here.touched = Date.now()
    })

    ws.on('error', () => {
      mine.delete(ws)
    })
  })
})

// Phones sleep and venue networks drop idle connections without telling either
// end. A ping keeps the path open and reaps the sockets it does not.
setInterval(() => {
  for (const ws of sockets.clients) {
    if (!ws.alive) {
      ws.terminate()
      continue
    }
    ws.alive = false
    try {
      ws.ping()
    } catch {}
  }
}, PING_MS).unref()

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS
  for (const [id, here] of rooms) {
    if (here.hosts.size === 0 && here.players.size === 0 && here.touched < cutoff) rooms.delete(id)
  }
}, SWEEP_MS).unref()

http.listen(PORT, HOST, () => {
  console.log(`relay listening on ${HOST}:${PORT}`)
})
