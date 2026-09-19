import { expect, test, type Page } from '@playwright/test'

const PLAYERS = ['Alice', 'Bran', 'Cora', 'Dev', 'Esme', 'Finn', 'Greta']

async function openSetup(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /^New game$/ }).click()
}

async function dealGame(page: Page, count = PLAYERS.length) {
  await openSetup(page)
  for (const name of PLAYERS.slice(0, count)) {
    await page.getByPlaceholder('Add a name').fill(name)
    await page.getByPlaceholder('Add a name').press('Enter')
  }
  await page.getByRole('button', { name: /Choose a script/ }).click()
  await page.getByRole('button', { name: /Trouble Brewing/ }).click()
  await page.getByRole('button', { name: /^Deal \d+ characters$/ }).click()
  await expect(page.getByText(/In play/)).toBeVisible()
}

async function startNight(page: Page) {
  await page.getByRole('button', { name: /Begin the first night/ }).click()
  // Skip the cinematic rather than waiting it out.
  await page.locator('.cinematic').click({ timeout: 5000 }).catch(() => {})
  await expect(page.getByText(/Step \d+ of \d+/)).toBeVisible({ timeout: 10_000 })
}

test('deals a seven-player game and walks the first night to dawn', async ({ page }) => {
  await dealGame(page)
  await startNight(page)

  // Trouble Brewing's first night, in the official order.
  await expect(page.getByText('Dusk', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Minion Info', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Demon Info & Bluffs', { exact: true })).toBeVisible()

  // Walk to the end and cross into the day.
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole('button', { name: 'Next' })
    if (!(await next.isVisible().catch(() => false))) break
    await next.click()
  }
  await page.getByRole('button', { name: /Call for eyes open/ }).click()
  await page.locator('.cinematic').click({ timeout: 5000 }).catch(() => {})
  // The phase name appears in several places at once, so anchor on the header.
  await expect(page.getByRole('button', { name: /Day 1\s+\d+ alive/ })).toBeVisible({
    timeout: 10_000,
  })
})

test('kills a player, then undoes it', async ({ page }) => {
  await dealGame(page)
  await startNight(page)

  await page.locator('.circle > li button').first().click()
  await page.getByRole('button', { name: /^Kill$/ }).click()

  await expect(page.locator('.token[data-dead="true"]').first()).toBeVisible()

  // Close the seat sheet first. Killing also raises an undo toast, so with the
  // sheet open there are two controls called Undo and the toast is mid-animation.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Kill$/ })).toBeHidden()

  // Undo lives in the log, which opens from the phase title.
  await page.getByRole('button', { name: /Night 1\s+\d+ alive/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Undo$/ }).click()
  await expect(page.locator('.token[data-dead="true"]')).toHaveCount(0)
})

test('takes a vote by tapping seats on the ring', async ({ page }) => {
  await dealGame(page)
  await startNight(page)
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole('button', { name: 'Next' })
    if (!(await next.isVisible().catch(() => false))) break
    await next.click()
  }
  await page.getByRole('button', { name: /Call for eyes open/ }).click()
  await page.locator('.cinematic').click({ timeout: 5000 }).catch(() => {})

  await page.getByRole('button', { name: /^Nominate$/ }).click()
  await page.getByRole('button', { name: /Alice/ }).first().click()
  await page.getByRole('button', { name: /Cora/ }).first().click()

  // During the vote the ring is the ballot: a tap raises a hand, a second
  // tap lowers it, and the seat sheet stays closed.
  const seats = page.locator('.circle > li button')
  await seats.nth(1).click()
  await seats.nth(2).click()
  await expect(page.locator('.token[data-now="true"]')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Kill$/ })).toBeHidden()
  await seats.nth(2).click()
  await expect(page.locator('.token[data-now="true"]')).toHaveCount(1)

  await page.getByRole('button', { name: /Hands down/ }).click()
  await expect(page.locator('.token[data-now="true"]')).toHaveCount(0)
})

test('moves a player to another chair by dragging their token', async ({ page }) => {
  await dealGame(page)
  await startNight(page)
  await expect(page.locator('.cinematic')).toHaveCount(0)

  const seats = page.locator('.circle > li')
  const from = (await seats.nth(0).boundingBox())!
  const to = (await seats.nth(2).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // Hold still until the seat lifts, then carry it round the ring.
  await expect(page.locator('.circle > li[data-dragging]')).toHaveCount(1)
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(
      from.x + from.width / 2 + ((to.x - from.x) * i) / 8,
      from.y + from.height / 2 + ((to.y - from.y) * i) / 8,
    )
  }
  await page.mouse.up()

  await expect(page.locator('.circle > li[data-dragging]')).toHaveCount(0)
  const names = await page.locator('.seat-name').allTextContents()
  expect(names.map((n) => n.toLowerCase())).toEqual(['bran', 'cora', 'alice', 'dev', 'esme', 'finn', 'greta'])
  // The drag did not open the seat sheet.
  await expect(page.getByRole('button', { name: /^Kill$/ })).toBeHidden()
})

test('keeps the game across a reload', async ({ page }) => {
  await dealGame(page)
  await startNight(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.waitForTimeout(600) // let IndexedDB settle
  await page.reload()

  await expect(page.getByRole('button', { name: /Night 1\s+\d+ alive/ })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('.circle > li')).toHaveCount(PLAYERS.length)
})

test('boots with no network at all', async ({ page, context }) => {
  await page.goto('/')
  // Let the service worker install and precache the shell.
  await page.waitForTimeout(2500)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('button', { name: /^New game$/ })).toBeVisible({ timeout: 15_000 })
  await context.setOffline(false)
})

test('never puts a player in a seat with no character', async ({ page }) => {
  // The composition table stops at fifteen, so a larger game has to fill the
  // extra seats with Travellers rather than leaving them blank.
  await openSetup(page)
  const many = [...PLAYERS, 'Hal', 'Isla', 'Jonah', 'Kit', 'Lena', 'Mo', 'Nadia', 'Otto', 'Priya']
  for (const name of many) {
    await page.getByPlaceholder('Add a name').fill(name)
    await page.getByPlaceholder('Add a name').press('Enter')
  }
  await page.getByRole('button', { name: /Choose a script/ }).click()
  await page.getByRole('button', { name: /Trouble Brewing/ }).click()
  await page.getByRole('button', { name: /^Deal \d+ characters$/ }).click()
  await expect(page.getByText(/Travellers —/)).toBeVisible()

  await startNight(page)
  await expect(page.locator('.circle > li')).toHaveCount(many.length)
  await expect(page.locator('.circle > li .token-art')).toHaveCount(many.length)
})
