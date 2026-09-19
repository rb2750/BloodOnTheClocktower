import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import {
  PayloadError,
  base64urlDecode,
  base64urlEncode,
  decodePayload,
  encodePayload,
  payloadFromHash,
  payloadUrl,
  roomCode,
  characterIndex,
  characterAt,
  idsFor,
  indexesFor,
  type Payload,
} from '../src/index.js'
import { editionScript } from '@botc/rules'

const KEY = new Uint8Array(16).fill(7)

describe('base64url', () => {
  it('round-trips arbitrary bytes', () => {
    for (const length of [0, 1, 2, 3, 16, 39, 100]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37) % 256)
      expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes)
    }
  })

  it('produces URL-safe output with no padding', () => {
    const text = base64urlEncode(new Uint8Array([251, 255, 254, 0, 1]))
    expect(text).not.toMatch(/[+/=]/)
  })
})

describe('room payloads', () => {
  const payload: Payload = { kind: 'room', room: 'ab12cd34', key: KEY, scriptHash: 3 }

  it('round-trips', () => {
    const decoded = decodePayload(encodePayload(payload))
    expect(decoded.kind).toBe('room')
    if (decoded.kind !== 'room') throw new Error('wrong kind')
    expect(decoded.room).toBe('ab12cd34')
    expect(decoded.scriptHash).toBe(3)
    expect(Array.from(decoded.key)).toEqual(Array.from(KEY))
  })

  it('stays small enough to be a chunky, easily-scanned code', () => {
    // A phone screen scanned by another phone in a dim room wants a low QR
    // version. Anything under ~270 bytes fits version 10 at error correction L
    // with room to spare.
    expect(encodePayload(payload).length).toBeLessThan(60)
  })
})

describe('seat payloads', () => {
  const tb = editionScript('tb', 'Trouble Brewing')
  const payload: Payload = {
    kind: 'seat',
    character: characterIndex('imp'),
    seat: 4,
    script: indexesFor(tb.characterIds),
  }

  it('round-trips, including the whole script', () => {
    const decoded = decodePayload(encodePayload(payload))
    if (decoded.kind !== 'seat') throw new Error('wrong kind')
    expect(characterAt(decoded.character)).toBe('imp')
    expect(decoded.seat).toBe(4)
    expect(idsFor(decoded.script)).toEqual(tb.characterIds)
  })

  it('carries a full edition in well under the practical QR ceiling', () => {
    const encoded = encodePayload(payload)
    // Trouble Brewing is 27 characters, so 6 + 54 bytes before base64.
    expect(encoded.length).toBeLessThan(120)
  })
})

describe('QR versions', () => {
  it('encodes a room code as a low version that scans across a dim table', async () => {
    const url = payloadUrl('https://example.com/p', {
      kind: 'room',
      room: 'ab12cd34',
      key: KEY,
      scriptHash: 1,
    })
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
    // Version 6 is 41x41 modules: at 8 CSS pixels per module that is a 328px
    // code, which reads instantly at arm's length and at an angle.
    expect(qr.version).toBeLessThanOrEqual(6)
  })

  it('keeps a per-player fallback code scannable with a full script inside', async () => {
    const tb = editionScript('tb', 'Trouble Brewing')
    const url = payloadUrl('https://example.com/p', {
      kind: 'seat',
      character: characterIndex('imp'),
      seat: 1,
      script: indexesFor(tb.characterIds),
    })
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
    expect(qr.version).toBeLessThanOrEqual(12)
  })
})

describe('room codes', () => {
  it('avoids characters that are misread in a dim room', () => {
    for (let i = 0; i < 200; i++) {
      const bytes = new Uint8Array([i, (i * 7) % 256, (i * 13) % 256])
      const code = roomCode(bytes)
      expect(code).toHaveLength(4)
      expect(code).not.toMatch(/[ILOU]/)
    }
  })
})

describe('bad input', () => {
  it('rejects an empty or truncated code', () => {
    expect(() => decodePayload('')).toThrow(PayloadError)
    expect(() => decodePayload('AQ')).toThrow(PayloadError)
  })

  it('rejects a code from a different protocol version', () => {
    const bytes = base64urlDecode(
      encodePayload({ kind: 'room', room: 'abc', key: KEY, scriptHash: 0 }),
    )
    bytes[0] = 99
    expect(() => decodePayload(base64urlEncode(bytes))).toThrow(/different version/)
  })

  it('rejects an unknown payload kind', () => {
    const bytes = base64urlDecode(
      encodePayload({ kind: 'room', room: 'abc', key: KEY, scriptHash: 0 }),
    )
    bytes[1] = 42
    expect(() => decodePayload(base64urlEncode(bytes))).toThrow(PayloadError)
  })

  it('returns null for a location with no payload', () => {
    expect(payloadFromHash('')).toBeNull()
    expect(payloadFromHash('#')).toBeNull()
  })
})

describe('character indexing', () => {
  it('maps ids to indexes and back', () => {
    for (const id of ['imp', 'washerwoman', 'lilmonsta', 'gnome']) {
      expect(characterAt(characterIndex(id))).toBe(id)
    }
  })

  it('throws on an unknown id rather than silently sending the wrong role', () => {
    expect(() => characterIndex('nosuchcharacter')).toThrow()
  })
})
