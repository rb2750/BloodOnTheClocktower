/**
 * Renders the app icons.
 *
 * The Storyteller's icon is the clock face from the home screen; the player's
 * is the back of a token, the seal from the reveal cover. Both are flat cream
 * on black, drawn as SVG here and rasterised once with the bundled browser.
 *
 *   pnpm icons
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BG = '#0c0c0d'
const CREAM = '#ede8db'

const ticks = (r: number, len: number, w: number) =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    const x1 = 256 + Math.cos(a) * r
    const y1 = 256 + Math.sin(a) * r
    const x2 = 256 + Math.cos(a) * (r - len)
    const y2 = 256 + Math.sin(a) * (r - len)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CREAM}" stroke-width="${w}" stroke-linecap="round"/>`
  }).join('')

/** The clock face, with the hand a little past eleven: the last wake. */
const storyteller = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="${CREAM}" stroke-width="7"/>
  ${ticks(176, 22, 6)}
  <line x1="256" y1="256" x2="${256 + Math.cos(-1.92) * 118}" y2="${256 + Math.sin(-1.92) * 118}" stroke="${CREAM}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="9" fill="${CREAM}"/>
</svg>`

/** The back of a token: a cream disc with the seal pressed into it. */
const player = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <circle cx="256" cy="256" r="184" fill="${CREAM}"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="${BG}" stroke-width="5"/>
  <circle cx="256" cy="256" r="58" fill="none" stroke="${BG}" stroke-width="5"/>
  ${ticks(150, 18, 5).replaceAll(CREAM, BG)}
</svg>`

async function render(svg: string, dir: string) {
  await mkdir(dir, { recursive: true })
  // Same convention as capture.ts: the environment ships Chromium already.
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  await page.setContent(
    `<body style="margin:0;background:${BG}"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="512" height="512"></body>`,
  )
  await writeFile(join(dir, 'icon-512.png'), await page.screenshot())
  await page.setViewportSize({ width: 192, height: 192 })
  await page.evaluate(() => {
    const img = document.querySelector('img')!
    img.width = 192
    img.height = 192
  })
  await writeFile(join(dir, 'icon-192.png'), await page.screenshot())
  await browser.close()
}

await render(storyteller, join(ROOT, 'apps/storyteller/public'))
await render(player, join(ROOT, 'apps/player/public'))
console.log('Icons written.')
