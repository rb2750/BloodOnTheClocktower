/**
 * What a QR code carries.
 *
 * Two shapes, because the app has to work whether or not there is a network.
 *
 *  - `room`: one code the whole table scans. Carries a room id and a secret
 *    key, nothing else. Players claim a seat and the Storyteller sends each of
 *    them their own role through the relay, encrypted with that key.
 *
 *  - `seat`: one code per player, for when there is no relay. Carries the
 *    player's character outright. No server is involved at all.
 *
 * Both live in the URL **fragment**, which browsers never send to the server.
 * On static hosting the request is a bare `GET /p`; the role is private by
 * construction rather than by promise.
 *
 * Payloads are deliberately tiny. A QR shown on one phone and scanned by
 * another in a dim room wants to be a chunky low-version code, not a dense
 * one: the practical ceiling is around 500 bytes, and the target is well under
 * 300. Character ids are sent as indexes into the roster both apps already
 * bundle, so nothing spends bytes on strings.
 */

export const PROTOCOL_VERSION = 1

export type RoomPayload = {
  kind: 'room'
  /** Room id, also rendered as a short human-readable code under the QR. */
  room: string
  /** Raw key material for the shared AES-GCM key. Never leaves the fragment. */
  key: Uint8Array
  /** Index of the edition, or 0xff when the script travelled separately. */
  scriptHash: number
}

export type SeatPayload = {
  kind: 'seat'
  /** Index into the bundled character roster. */
  character: number
  seat: number
  /** Character indexes making up the script, so the player can browse it. */
  script: number[]
}

export type Payload = RoomPayload | SeatPayload

const KIND_ROOM = 0x01
const KIND_SEAT = 0x02

/**
 * Crockford-style alphabet with I, L, O and U removed, so a code read aloud or
 * typed in a dim room cannot be confused between 1/I/L and 0/O.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function roomCode(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes.slice(0, 3)) {
    out += ALPHABET[b >> 3]! + ALPHABET[((b & 0b111) << 2) % ALPHABET.length]!
  }
  return out.slice(0, 4)
}

export function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export class PayloadError extends Error {}

export function encodePayload(payload: Payload): string {
  if (payload.kind === 'room') {
    const room = new TextEncoder().encode(payload.room)
    if (room.length > 12) throw new PayloadError('Room id is too long.')
    const bytes = new Uint8Array(4 + room.length + payload.key.length)
    bytes[0] = PROTOCOL_VERSION
    bytes[1] = KIND_ROOM
    bytes[2] = payload.scriptHash & 0xff
    bytes[3] = room.length
    bytes.set(room, 4)
    bytes.set(payload.key, 4 + room.length)
    return base64urlEncode(bytes)
  }

  // Character indexes fit in two bytes each; the roster is 181 entries today
  // and two bytes leaves room for it to grow without a format change.
  const bytes = new Uint8Array(6 + payload.script.length * 2)
  bytes[0] = PROTOCOL_VERSION
  bytes[1] = KIND_SEAT
  bytes[2] = (payload.character >> 8) & 0xff
  bytes[3] = payload.character & 0xff
  bytes[4] = payload.seat & 0xff
  bytes[5] = payload.script.length & 0xff
  payload.script.forEach((index, i) => {
    bytes[6 + i * 2] = (index >> 8) & 0xff
    bytes[7 + i * 2] = index & 0xff
  })
  return base64urlEncode(bytes)
}

export function decodePayload(text: string): Payload {
  let bytes: Uint8Array
  try {
    bytes = base64urlDecode(text)
  } catch {
    throw new PayloadError('That code is not readable.')
  }
  if (bytes.length < 4) throw new PayloadError('That code is too short to be valid.')
  if (bytes[0] !== PROTOCOL_VERSION) {
    throw new PayloadError(
      'That code was made by a different version of the app. Ask for a fresh one.',
    )
  }

  if (bytes[1] === KIND_ROOM) {
    const roomLength = bytes[3]!
    if (bytes.length < 4 + roomLength) throw new PayloadError('That code is incomplete.')
    return {
      kind: 'room',
      scriptHash: bytes[2]!,
      room: new TextDecoder().decode(bytes.slice(4, 4 + roomLength)),
      key: bytes.slice(4 + roomLength),
    }
  }

  if (bytes[1] === KIND_SEAT) {
    if (bytes.length < 6) throw new PayloadError('That code is incomplete.')
    const count = bytes[5]!
    const script: number[] = []
    for (let i = 0; i < count; i++) {
      const hi = bytes[6 + i * 2]
      const lo = bytes[7 + i * 2]
      if (hi === undefined || lo === undefined) break
      script.push((hi << 8) | lo)
    }
    return {
      kind: 'seat',
      character: ((bytes[2]! << 8) | bytes[3]!) >>> 0,
      seat: bytes[4]!,
      script,
    }
  }

  throw new PayloadError('That code is not one this app understands.')
}

/** Build the link a QR encodes. The payload always sits in the fragment. */
export function payloadUrl(origin: string, payload: Payload): string {
  return `${origin.replace(/\/$/, '')}/#${encodePayload(payload)}`
}

/** Read a payload back out of the current location, if there is one. */
export function payloadFromHash(hash: string): Payload | null {
  const text = hash.replace(/^#/, '').trim()
  if (!text) return null
  return decodePayload(text)
}
