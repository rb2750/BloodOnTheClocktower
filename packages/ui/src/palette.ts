/**
 * The palette, mirrored in TypeScript so the contrast guards can assert against
 * the same values the stylesheet uses. Keep these in step with `theme.css`; a
 * test checks that every token here appears there.
 */
export const PALETTE = {
  'ink-0': '#0c0c0d',
  'ink-1': '#141416',
  'ink-2': '#1c1c1f',
  'ink-3': '#2a2a2f',
  'ink-4': '#3b3b42',
  cream: '#ede8db',
  'cream-2': '#b8b3a7',
  'cream-3': '#7d796f',
  blue: '#3f7cc4',
  'blue-2': '#8db4e2',
  red: '#b33029',
  'red-2': '#e07c72',
  shroud: '#8a8f96',
  now: '#ffe3a3',
  ok: '#7f9b6b',
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
