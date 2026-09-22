import type { EffectKind, Expiry } from './state/types.js'

/*
 * What a reminder token does to the seat it sits on, and how long it stays.
 *
 * Most tokens mark a state that ends at the close of the next day: a Sailor's
 * or Innkeeper's drunk, a night's protection, the Devil's Advocate's save.
 * Others must outlive a dusk, because a later step reads them: the Pukka's
 * poison is how the coach knows who dies on its next turn, and the grandchild
 * is remembered all game.
 */
const UNTIL_DUSK = new Set(['Drunk', 'Safe', 'Survives Execution', 'Exorcised', 'Cannot Die', 'Died Today'])

export function effectFor(label: string, sourceCharacterId: string): { kind: EffectKind; expiry: Expiry } {
  const lower = label.toLowerCase()
  const kind: EffectKind = lower === 'poisoned' ? 'poisoned' : lower.startsWith('drunk') ? 'drunk' : lower === 'safe' ? 'protected' : 'custom'
  if (sourceCharacterId === 'pukka') return { kind, expiry: { kind: 'permanent' } }
  if (sourceCharacterId === 'courtier') return { kind, expiry: { kind: 'permanent' } }
  return { kind, expiry: UNTIL_DUSK.has(label) || kind === 'poisoned' ? { kind: 'dusk' } : { kind: 'permanent' } }
}
