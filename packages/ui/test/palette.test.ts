import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETTE, contrastRatio } from '../src/palette.js'

const THEME = readFileSync(join(import.meta.dirname, '../src/theme.css'), 'utf8')
/** Comments mention the colours we forbid, so strip them before checking values. */
const THEME_DECLARATIONS = THEME.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Guards on the look that do not need an eye.
 *
 * A palette tweak months from now must not quietly make text illegible in a dim
 * room, which is exactly the sort of regression a screenshot review misses.
 */
describe('Midnight Grimoire palette', () => {
  it('is in step with the stylesheet', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(THEME, `--color-${name} missing from theme.css`).toContain(`--color-${name}: ${hex}`)
    }
  })

  it('never uses pure black or pure white', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(hex.toLowerCase(), `${name} is pure black`).not.toBe('#000000')
      expect(hex.toLowerCase(), `${name} is pure white`).not.toBe('#ffffff')
    }
    expect(THEME_DECLARATIONS).not.toMatch(/#fff\b|#ffffff|#000\b|#000000/i)
  })

  it('clears 4.5:1 for body text on every surface it can sit on', () => {
    const surfaces = ['ink-900', 'ink-800', 'ink-700'] as const
    for (const surface of surfaces) {
      const ratio = contrastRatio(PALETTE['parch-100'], PALETTE[surface])
      expect(ratio, `parch-100 on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears 4.5:1 for secondary text on the two main surfaces', () => {
    for (const surface of ['ink-900', 'ink-800'] as const) {
      const ratio = contrastRatio(PALETTE['parch-300'], PALETTE[surface])
      expect(ratio, `parch-300 on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears 3:1 for the accent and the alignment text colours', () => {
    const pairs = [
      ['brass-400', 'ink-900'],
      ['brass-300', 'ink-900'],
      ['good-300', 'ink-900'],
      ['evil-300', 'ink-900'],
    ] as const
    for (const [fg, bg] of pairs) {
      const ratio = contrastRatio(PALETTE[fg], PALETTE[bg])
      expect(ratio, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
  })

  it('documents that evil-500 is too dark for text, which is why evil-300 exists', () => {
    // This is the trap: the semantically correct oxblood fails as body text.
    // Keeping it asserted means nobody "fixes" a component by reaching for it.
    const asText = contrastRatio(PALETTE['evil-500'], PALETTE['ink-900'])
    expect(asText).toBeLessThan(4.5)
    const properly = contrastRatio(PALETTE['evil-300'], PALETTE['ink-900'])
    expect(properly).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps each elevation step visibly distinct without needing shadow', () => {
    const steps = ['ink-900', 'ink-800', 'ink-700', 'ink-600'] as const
    for (let i = 1; i < steps.length; i++) {
      const ratio = contrastRatio(PALETTE[steps[i]!], PALETTE[steps[i - 1]!])
      expect(ratio, `${steps[i]} vs ${steps[i - 1]}`).toBeGreaterThan(1.1)
    }
  })

  it('keeps the tap-target floor at 48px in the stylesheet', () => {
    expect(THEME).toContain('--tap-min: 48px')
    expect(THEME).toContain('--tap-live: 64px')
  })

  it('substitutes a crossfade under reduced motion rather than removing the signal', () => {
    expect(THEME).toContain('prefers-reduced-motion')
    // The phase change still communicates; only the movement goes.
    expect(THEME).toMatch(/transition-duration:\s*200ms/)
  })
})
