/**
 * The palette, mirrored in TypeScript so the contrast guards can assert against
 * the same values the stylesheet uses. Keep these in step with `theme.css`; a
 * test checks that every token here appears there.
 */
export const PALETTE = {
  'ink-900': '#0b0d12',
  'ink-800': '#161a24',
  'ink-700': '#222838',
  'ink-600': '#31394c',
  'ink-500': '#454e63',
  'parch-100': '#f4ede0',
  'parch-300': '#cfc4b0',
  'parch-500': '#9a8f7c',
  'brass-300': '#e3c46a',
  'brass-400': '#c9a227',
  'brass-600': '#8a6d18',
  'good-500': '#4b87c9',
  'good-300': '#8fb8e0',
  'evil-500': '#b3312b',
  'evil-300': '#e0766d',
  shroud: '#6b7280',
  ok: '#6e8b5b',
} as const

export type PaletteToken = keyof typeof PALETTE

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
