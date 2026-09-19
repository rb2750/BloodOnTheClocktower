import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
  decryptJson,
  encryptJson,
  exportPublicKey,
  generateKeyMaterial,
  generateSealingPair,
  importKey,
  openSealed,
  sealFor,
} from '../src/crypto.js'

// Node exposes WebCrypto under a different global than the browser does.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}

describe('room encryption', () => {
  it('round-trips a message', async () => {
    const key = await importKey(generateKeyMaterial())
    const bytes = await encryptJson(key, { t: 'phase', phase: 'Night 2', day: 2 })
    expect(await decryptJson(key, bytes)).toEqual({ t: 'phase', phase: 'Night 2', day: 2 })
  })

  it('produces different ciphertext each time, so repeats are not recognisable', async () => {
    const key = await importKey(generateKeyMaterial())
    const a = await encryptJson(key, { t: 'phase', phase: 'Day 1', day: 1 })
    const b = await encryptJson(key, { t: 'phase', phase: 'Day 1', day: 1 })
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  it('cannot be read with a different room key', async () => {
    const mine = await importKey(generateKeyMaterial())
    const theirs = await importKey(generateKeyMaterial())
    const bytes = await encryptJson(mine, { t: 'death', seatId: 's1', alive: false })
    await expect(decryptJson(theirs, bytes)).rejects.toThrow()
  })
})

describe('per-player sealing', () => {
  it('lets the intended player open their own role', async () => {
    const storyteller = await generateSealingPair()
    const player = await generateSealingPair()

    const sealed = await sealFor(storyteller, await exportPublicKey(player), {
      character: 42,
      script: [1, 2, 3],
      scriptName: 'Trouble Brewing',
    })

    const opened = await openSealed(player, await exportPublicKey(storyteller), sealed)
    expect(opened).toEqual({ character: 42, script: [1, 2, 3], scriptName: 'Trouble Brewing' })
  })

  it('stops another player at the same table reading it', async () => {
    // This is the whole point. Everyone in the room holds the room key and the
    // relay broadcasts to all of them, so without this a curious player could
    // decrypt every other role and the game would be over before it began.
    const storyteller = await generateSealingPair()
    const player = await generateSealingPair()
    const nosyNeighbour = await generateSealingPair()

    const sealed = await sealFor(storyteller, await exportPublicKey(player), {
      character: 7,
      script: [],
      scriptName: '',
    })

    await expect(
      openSealed(nosyNeighbour, await exportPublicKey(storyteller), sealed),
    ).rejects.toThrow()
  })

  it('gives each player a different sealing key', async () => {
    const storyteller = await generateSealingPair()
    const a = await generateSealingPair()
    const b = await generateSealingPair()
    const value = { character: 1, script: [], scriptName: '' }

    const forA = await sealFor(storyteller, await exportPublicKey(a), value)
    const forB = await sealFor(storyteller, await exportPublicKey(b), value)
    expect(forA).not.toEqual(forB)

    await expect(openSealed(b, await exportPublicKey(storyteller), forA)).rejects.toThrow()
  })

  it('exports a public key as compact URL-safe text', async () => {
    const pair = await generateSealingPair()
    const text = await exportPublicKey(pair)
    expect(text).not.toMatch(/[+/=]/)
    expect(text.length).toBeLessThan(120)
  })
})
