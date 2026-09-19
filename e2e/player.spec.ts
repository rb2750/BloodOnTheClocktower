import { expect, test } from '@playwright/test'
import { characterIndex, encodePayload, indexesFor } from '../packages/protocol/src/index.js'
import { editionScript } from '../packages/rules/src/index.js'

const PLAYER = 'http://localhost:4174'

function codeFor(characterId: string) {
  return encodePayload({
    kind: 'seat',
    character: characterIndex(characterId),
    seat: 1,
    script: indexesFor(editionScript('tb', 'Trouble Brewing').characterIds),
  })
}

test('reveals a character only while it is held', async ({ page }) => {
  await page.goto(`${PLAYER}/#${codeFor('fortuneteller')}`)
  const reveal = page.locator('.reveal')
  await expect(reveal).toBeVisible()

  // Covered to begin with.
  await expect(reveal).not.toHaveAttribute('data-revealed', 'true')
  await expect(page.getByText('Cup your hands')).toBeVisible()

  const box = await reveal.boundingBox()
  if (!box) throw new Error('no reveal box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.getByText('Fortune Teller')).toBeVisible()

  // And covered again the instant the finger lifts.
  await page.mouse.up()
  await expect(reveal).not.toHaveAttribute('data-revealed', 'true')
})

test('strips the code from the address bar so it cannot leak', async ({ page }) => {
  await page.goto(`${PLAYER}/#${codeFor('imp')}`)
  await expect(page.locator('.reveal')).toBeVisible()
  expect(page.url()).not.toContain('#')
})

test('never names the character in the document title', async ({ page }) => {
  await page.goto(`${PLAYER}/#${codeFor('imp')}`)
  await expect(page.locator('.reveal')).toBeVisible()
  // The title shows in the tab, the app switcher and the share sheet, all of
  // which someone sitting next to you can see.
  expect(await page.title()).not.toMatch(/imp/i)
})

test('keeps the character across a reload, with no network', async ({ page, context }) => {
  await page.goto(`${PLAYER}/#${codeFor('washerwoman')}`)
  await expect(page.locator('.reveal')).toBeVisible()
  await page.waitForTimeout(2500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.reveal')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(false)
})

test('lists the whole script and records a claim in one tap', async ({ page }) => {
  await page.goto(`${PLAYER}/#${codeFor('chef')}`)
  await expect(page.locator('.reveal')).toBeVisible()

  await page.getByRole('button', { name: 'Script' }).click()
  // "Imp" also appears inside other characters' ability text, so match the
  // row rather than the word.
  await expect(page.getByRole('button', { name: /^Washerwoman/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Imp/ })).toBeVisible()

  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByPlaceholder('Add a name').fill('Bran')
  await page.getByPlaceholder('Add a name').press('Enter')
  await expect(page.getByText('no claim yet').first()).toBeVisible()

  await page.getByRole('button', { name: /Bran/ }).first().click()
  await page.getByRole('button', { name: /Record a claim/ }).click()
  await page.getByRole('button', { name: /Empath/ }).first().click()
  await expect(page.getByText(/claims Empath/)).toBeVisible()
})
