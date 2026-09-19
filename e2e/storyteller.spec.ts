import { expect, test, type Page } from '@playwright/test'

const PLAYERS = ['Alice', 'Bran', 'Cora', 'Dev', 'Esme', 'Finn', 'Greta']

async function dealGame(page: Page, count = PLAYERS.length) {
  await page.goto('/')
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
  await expect(page.getByRole('button', { name: /Day 1 · \d+ alive/ })).toBeVisible({
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

  await page.locator('.circle').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.token[data-dead="true"]')).toHaveCount(0)
})

test('keeps the game across a reload', async ({ page }) => {
  await dealGame(page)
  await startNight(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.waitForTimeout(600) // let IndexedDB settle
  await page.reload()

  await expect(page.getByRole('button', { name: /Night 1 · \d+ alive/ })).toBeVisible({
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

  await expect(page.getByPlaceholder('Add a name')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(false)
})

test('never puts a player in a seat with no character', async ({ page }) => {
  // The composition table stops at fifteen, so a larger game has to fill the
  // extra seats with Travellers rather than leaving them blank.
  await page.goto('/')
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
