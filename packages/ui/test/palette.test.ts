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
describe('Grimoire palette', () => {
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

  it('has no gradient anywhere in the base theme', () => {
    expect(THEME_DECLARATIONS).not.toMatch(/gradient\(/)
  })

  it('clears 4.5:1 for body text on every surface it can sit on', () => {
    for (const surface of ['ink-0', 'ink-1', 'ink-2'] as const) {
      const ratio = contrastRatio(PALETTE.cream, PALETTE[surface])
      expect(ratio, `cream on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears 4.5:1 for secondary text on the two main surfaces', () => {
    for (const surface of ['ink-0', 'ink-1'] as const) {
      const ratio = contrastRatio(PALETTE['cream-2'], PALETTE[surface])
      expect(ratio, `cream-2 on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears 4.5:1 for the alignment text colours and the "now" highlight', () => {
    for (const fg of ['blue-2', 'red-2', 'now'] as const) {
      const ratio = contrastRatio(PALETTE[fg], PALETTE['ink-0'])
      expect(ratio, `${fg} on ink-0 is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('documents that red is too dark for text, which is why red-2 exists', () => {
    // This is the trap: the semantically correct red fails as body text.
    // Keeping it asserted means nobody "fixes" a component by reaching for it.
    expect(contrastRatio(PALETTE.red, PALETTE['ink-0'])).toBeLessThan(4.5)
    expect(contrastRatio(PALETTE['red-2'], PALETTE['ink-0'])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the alignment rings readable against the cream token disc', () => {
    for (const ring of ['blue', 'red'] as const) {
      const ratio = contrastRatio(PALETTE[ring], PALETTE.cream)
      expect(ratio, `${ring} ring on cream is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps each elevation step visibly distinct without needing shadow', () => {
    const steps = ['ink-0', 'ink-1', 'ink-2', 'ink-3', 'ink-4'] as const
    for (let i = 1; i < steps.length; i++) {
      const ratio = contrastRatio(PALETTE[steps[i]!], PALETTE[steps[i - 1]!])
      expect(ratio, `${steps[i]} vs ${steps[i - 1]}`).toBeGreaterThan(1.05)
    }
  })

  it('keeps the tap-target floor at 48px in the stylesheet', () => {
    expect(THEME).toContain('--tap-min: 48px')
    expect(THEME).toContain('--tap-live: 64px')
  })

  it('substitutes a crossfade under reduced motion rather than removing the signal', () => {
    expect(THEME).toContain('prefers-reduced-motion')
    expect(THEME).toMatch(/transition-duration:\s*200ms/)
  })
})
