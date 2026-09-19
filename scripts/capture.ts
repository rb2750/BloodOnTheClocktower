/**
 * Design capture harness.
 *
 * Drives the built app with Playwright and writes screenshots and animation
 * clips to `design/<date>/`, so the design is reviewed by looking at it rather
 * than by assuming. Two artefacts per transition, because they answer different
 * questions: a video shows whether the motion *feels* right, and a
 * deterministic frame strip lets two iterations be compared honestly.
 *
 *   pnpm shots              everything
 *   pnpm shots screens      screenshots only
 *   pnpm shots motion       animation clips and frame strips only
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, rm, readdir, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from '@playwright/test'
import { characterIndex, encodePayload, indexesFor } from '../packages/protocol/src/index.js'
import { editionScript } from '../packages/rules/src/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Playwright ships a minimal ffmpeg (webm + PNG only); we no longer need it.
const PORT = 4178
const PLAYER_PORT = 4180
const URL = `http://localhost:${PORT}/`
const PLAYER_URL = `http://localhost:${PLAYER_PORT}/`

const STAMP = new Date().toISOString().slice(0, 10)
const OUT = join(ROOT, 'design', STAMP)

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 430, height: 932 },
  { name: 'tablet', width: 820, height: 1180 },
] as const

const PLAYERS = [
  'Alice', 'Bran', 'Cora', 'Dev', 'Esme', 'Finn', 'Greta', 'Hal', 'Isla', 'Jonah',
  'Kit', 'Lena', 'Mo', 'Nadia', 'Otto', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq',
]

async function serve(pkg: string, port: number, url: string): Promise<ChildProcess> {
  const proc = spawn(
    'pnpm',
    ['--filter', pkg, 'exec', 'vite', 'preview', '--port', String(port), '--host'],
    { cwd: ROOT, stdio: 'ignore' },
  )
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return proc
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  proc.kill()
  throw new Error(`Preview server for ${pkg} did not start.`)
}

/** The Storyteller's QR sheet, and what a player sees after scanning it. */
async function player(browser: Browser) {
  const dir = join(OUT, 'player')
  await mkdir(dir, { recursive: true })

  // The Storyteller side: the code being held out to a player.
  const stContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const st = await stContext.newPage()
  await setUpGame(st, 8)
  await st.getByRole('button', { name: /Hand out characters/ }).click()
  await st.waitForTimeout(600)
  await st.screenshot({ path: join(dir, '01-storyteller-qr.png') })
  await stContext.close()

  // The player side. The payload is built here rather than decoded out of the
  // rendered QR: it is the same codec the app uses, and it keeps the capture
  // from depending on camera emulation.
  const payload = encodePayload({
    kind: 'seat',
    character: characterIndex('fortuneteller'),
    seat: 3,
    script: indexesFor(editionScript('tb', 'Trouble Brewing').characterIds),
  })

  const mobile = {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  } as const

  // Before scanning anything.
  const cold = await browser.newContext(mobile)
  const coldPage = await cold.newPage()
  await coldPage.goto(PLAYER_URL)
  await coldPage.waitForTimeout(400)
  await coldPage.screenshot({ path: join(dir, '02-before-scan.png') })
  await cold.close()

  // A fresh context, navigating straight to the code. Going from `/` to
  // `/#payload` in the same page is a same-document navigation, so nothing
  // would remount and the capture would silently show the empty state.
  const context = await browser.newContext(mobile)
  const page = await context.newPage()
  await page.goto(`${PLAYER_URL}#${payload}`)
  await page.waitForSelector('.reveal', { timeout: 15000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(dir, '03-covered.png') })

  // Hold the token to reveal it, and capture while the finger is still down.
  const reveal = page.locator('.reveal')
  const box = await reveal.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(dir, '04-revealed.png') })
    await page.mouse.up()
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(dir, '05-recovered.png') })
  }

  await page.getByRole('button', { name: 'Script' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(dir, '06-script.png') })

  await page.getByRole('button', { name: 'Notes' }).click()
  await page.waitForTimeout(300)
  for (const name of ['Alice', 'Bran', 'Cora', 'Dev']) {
    await page.getByPlaceholder('Add a name').fill(name)
    await page.getByPlaceholder('Add a name').press('Enter')
  }
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(dir, '07-notes.png') })

  await page.getByRole('button', { name: /Alice/ }).first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(dir, '08-note-sheet.png') })

  await context.close()
}

/** Walk the app from cold to a live game, capturing along the way. */
async function setUpGame(page: Page, playerCount: number, shoot?: (name: string) => Promise<void>) {
  await page.goto(URL)
  await page.waitForSelector('text=Grimoire')
  await shoot?.('00-home')
  await page.getByRole('button', { name: /^New game$/ }).click()
  await page.waitForSelector('text=Who is playing')
  await shoot?.('01-empty')

  for (const name of PLAYERS.slice(0, playerCount)) {
    await page.getByPlaceholder('Add a name').fill(name)
    await page.getByPlaceholder('Add a name').press('Enter')
  }
  await shoot?.('02-players')

  await page.getByRole('button', { name: /Choose a script/ }).click()
  await shoot?.('03-scripts')

  await page.getByRole('button', { name: /Trouble Brewing/ }).click()
  await page.getByRole('button', { name: /^Deal \d+ characters$/ }).click()
  await page.waitForSelector('text=In play')
  await shoot?.('04-deal')

  await page.getByRole('button', { name: /Begin the first night/ }).click()
  // The cinematic stays up until it is tapped, so tap it once it has played.
  await page.waitForTimeout(2600)
  await page.locator('.cinematic').click({ timeout: 3000 }).catch(() => {})
  await page.waitForSelector('.cinematic', { state: 'detached', timeout: 5000 }).catch(() => {})
}

async function screens(browser: Browser) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 3,
      isMobile: vp.name !== 'tablet',
      hasTouch: true,
      colorScheme: 'dark',
    })
    const page = await context.newPage()
    const dir = join(OUT, vp.name)
    await mkdir(dir, { recursive: true })
    const shoot = async (name: string) => {
      await page.screenshot({ path: join(dir, `${name}.png`) })
    }

    await setUpGame(page, 12, shoot)
    await shoot('05-night-walk')

    // Step a few times through the night order.
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Next' }).click()
      await page.waitForTimeout(120)
    }
    await shoot('06-night-step')

    // Roles hidden, for when someone can see the phone.
    await page.getByRole('button', { name: 'Hide roles' }).click()
    await page.waitForTimeout(300)
    await shoot('06b-concealed')
    await page.getByRole('button', { name: 'Show roles' }).click()

    // A seat sheet.
    await page.locator('.circle > li button').first().click()
    await page.waitForTimeout(450)
    await shoot('07-seat-sheet')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    // Into the day.
    while (await page.getByRole('button', { name: 'Next' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Next' }).click()
      await page.waitForTimeout(60)
    }
    await page.getByRole('button', { name: /Call for eyes open/ }).click()
    await page.waitForTimeout(2600)
    await page.locator('.cinematic').click({ timeout: 3000 }).catch(() => {})
    await page.waitForSelector('.cinematic', { state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(2600)
    await shoot('08-day')

    // A nomination and a live vote.
    await page.getByRole('button', { name: /^Nominate$/ }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Alice/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Cora/ }).first().click()
    await page.waitForTimeout(500)
    await shoot('09-vote')

    // The end: hands down, then end the game from the actions sheet, which
    // opens the recap.
    await page.getByRole('button', { name: /Hands down/ }).click()
    await page.getByRole('button', { name: /Day 1\s+\d+ alive/ }).click()
    await page.getByRole('button', { name: /End the game/ }).click()
    await page.getByRole('button', { name: /^Good wins$/ }).click()
    await page.waitForSelector('text=The recap')
    await page.waitForTimeout(400)
    await shoot('10-recap')
    await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 900))
    await page.waitForTimeout(200)
    await shoot('11-recap-honours')
    await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 99999))
    await page.waitForTimeout(200)
    await shoot('12-recap-story')

    await context.close()
  }
}

/** The grimoire at the counts where a circular layout tends to break. */
async function seatCounts(browser: Browser) {
  const dir = join(OUT, 'seat-counts')
  await mkdir(dir, { recursive: true })
  for (const count of [5, 10, 15, 20]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    // Driven through the real UI, so this genuinely exercises the layout rather
    // than poking state in behind it.
    await setUpGame(page, count)
    await page.screenshot({ path: join(dir, `${String(count).padStart(2, '0')}-seats.png`) })
    await context.close()
  }
}

/** Video plus a deterministic frame strip for each transition. */
async function motion(browser: Browser) {
  const dir = join(OUT, 'motion')
  await mkdir(dir, { recursive: true })

  for (const phase of ['night', 'day'] as const) {
    const videoDir = join(dir, `${phase}-raw`)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
    })
    const page = await context.newPage()

    if (phase === 'night') {
      await page.goto(URL)
      await page.getByRole('button', { name: /^New game$/ }).click()
      for (const name of PLAYERS.slice(0, 8)) {
        await page.getByPlaceholder('Add a name').fill(name)
        await page.getByPlaceholder('Add a name').press('Enter')
      }
      await page.getByRole('button', { name: /Choose a script/ }).click()
      await page.getByRole('button', { name: /Trouble Brewing/ }).click()
      await page.getByRole('button', { name: /^Deal \d+ characters$/ }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Begin the first night/ }).click()
    } else {
      await setUpGame(page, 8)
      while (await page.getByRole('button', { name: 'Next' }).isVisible().catch(() => false)) {
        await page.getByRole('button', { name: 'Next' }).click()
        await page.waitForTimeout(40)
      }
      await page.getByRole('button', { name: /Call for eyes open/ }).click()
    await page.waitForTimeout(2600)
    await page.locator('.cinematic').click({ timeout: 3000 }).catch(() => {})
    await page.waitForSelector('.cinematic', { state: 'detached', timeout: 5000 }).catch(() => {})
    }
    await page.waitForTimeout(3200)
    await context.close()

    // Playwright names videos by page guid; normalise it.
    //
    // The clip stays WebM. The ffmpeg that ships with Playwright is a minimal
    // build with only the image2 and webm muxers and a PNG encoder, so there is
    // no GIF or MP4 to convert to. WebM plays inline in every current browser,
    // which is all this needs to do.
    const files = await readdir(videoDir).catch(() => [])
    const webm = files.find((f) => f.endsWith('.webm'))
    if (webm) {
      await rename(join(videoDir, webm), join(dir, `${phase}.webm`))
      await rm(videoDir, { recursive: true, force: true })
    }
  }

  // Deterministic frame strip: freeze the cinematic and seek it, so the same
  // frames come back on every run and two iterations can be compared honestly.
  for (const phase of ['night', 'day'] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()

    // Get to the moment *before* the transition, without letting it play.
    await page.goto(URL)
    await page.getByRole('button', { name: /^New game$/ }).click()
    for (const name of PLAYERS.slice(0, 8)) {
      await page.getByPlaceholder('Add a name').fill(name)
      await page.getByPlaceholder('Add a name').press('Enter')
    }
    await page.getByRole('button', { name: /Choose a script/ }).click()
    await page.getByRole('button', { name: /Trouble Brewing/ }).click()
    await page.getByRole('button', { name: /^Deal \d+ characters$/ }).click()
    await page.waitForSelector('text=In play')

    if (phase === 'day') {
      await page.getByRole('button', { name: /Begin the first night/ }).click()
      await page.waitForTimeout(2600)
      while (await page.getByRole('button', { name: 'Next' }).isVisible().catch(() => false)) {
        await page.getByRole('button', { name: 'Next' }).click()
        await page.waitForTimeout(40)
      }
      await page.getByRole('button', { name: /Call for eyes open/ }).click()
    await page.waitForTimeout(2600)
    await page.locator('.cinematic').click({ timeout: 3000 }).catch(() => {})
    await page.waitForSelector('.cinematic', { state: 'detached', timeout: 5000 }).catch(() => {})
    } else {
      await page.getByRole('button', { name: /Begin the first night/ }).click()
    }

    const frameDir = join(dir, `${phase}-frames`)
    await mkdir(frameDir, { recursive: true })

    await page.waitForSelector('.cinematic', { timeout: 3000 })
    // Freeze ONLY the overlay's own animations. `document.getAnimations()` also
    // returns the seats' CSS transitions, and pausing those at zero parks every
    // token at the centre of the ring, which makes the strip a picture of a bug
    // that is not there.
    await page.evaluate(() => {
      const overlay = document.querySelector('.cinematic')
      for (const a of document.getAnimations()) {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null
        if (overlay && target && overlay.contains(target)) a.pause()
      }
    })

    const times = [0, 150, 300, 500, 750, 1000, 1400, 1800]
    for (const [i, t] of times.entries()) {
      await page.evaluate((ms) => {
        const overlay = document.querySelector('.cinematic')
        for (const a of document.getAnimations()) {
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null
          if (overlay && target && overlay.contains(target)) a.currentTime = ms
        }
      }, t)
      await page.waitForTimeout(60)
      await page.screenshot({
        path: join(frameDir, `${String(i).padStart(2, '0')}-${t}ms.png`),
      })
    }

    await buildStrip(browser, frameDir, times, join(dir, `${phase}-strip.png`))
    await context.close()
  }
}

/** Lay the seeked frames out in a labelled row and screenshot that. */
async function buildStrip(
  browser: Browser,
  frameDir: string,
  times: number[],
  out: string,
) {
  const files = (await readdir(frameDir)).filter((f) => f.endsWith('.png')).sort()
  if (files.length === 0) return
  // Inlined as data URLs: a page created with setContent has an opaque origin,
  // and Chromium refuses to load file:// subresources into it.
  const cells = (
    await Promise.all(
      files.map(async (f, i) => {
        const data = await readFile(join(frameDir, f))
        return `
      <figure>
        <img src="data:image/png;base64,${data.toString('base64')}">
        <figcaption>${times[i] ?? '?'}ms</figcaption>
      </figure>`
      }),
    )
  ).join('')

  const page = await browser.newPage({ viewport: { width: 1600, height: 500 } })
  await page.setContent(`<!doctype html><html><body>
    <style>
      body { margin:0; background:#0b0d12; font:12px/1 ui-sans-serif,system-ui;
             color:#9a8f7c; display:flex; gap:10px; padding:14px; width:max-content; }
      figure { margin:0; display:flex; flex-direction:column; gap:6px; align-items:center; }
      img { width:170px; display:block; border:1px solid #31394c; border-radius:6px; }
      figcaption { letter-spacing:.08em; }
    </style>${cells}</body></html>`)
  await page.waitForLoadState('load')
  const body = page.locator('body')
  await body.screenshot({ path: out })
  await page.close()
}


async function main() {
  const which = process.argv[2] ?? 'all'
  await mkdir(OUT, { recursive: true })
  const server = await serve('@botc/storyteller', PORT, URL)
  const playerServer = await serve('@botc/player', PLAYER_PORT, PLAYER_URL)
  // The environment ships Chromium already; never download one.
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  })

  try {
    if (which === 'all' || which === 'screens') {
      await screens(browser)
      await seatCounts(browser)
    }
    if (which === 'all' || which === 'motion') await motion(browser)
    if (which === 'all' || which === 'player') await player(browser)
    console.log(`\nCaptures written to design/${STAMP}`)
  } finally {
    await browser.close()
    server.kill()
    playerServer.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
