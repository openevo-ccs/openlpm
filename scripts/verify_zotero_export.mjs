import { chromium } from 'playwright'
import { mintQaSession } from './mint_qa_session.mjs'

const BASE = process.argv[2] || 'http://localhost:5175'
const SLUG = 'evomentor-thuringia'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(BASE)
await mintQaSession(page, BASE)
await page.goto(`${BASE}/#/dashboard/${SLUG}/literature`)
await page.waitForTimeout(1500)

// Click the Zotero engine chip and confirm the credentials form shows.
const zoteroChip = page.getByRole('button', { name: /My Zotero library/i })
console.log('zotero chip present:', await zoteroChip.count())
if (await zoteroChip.count()) {
  await zoteroChip.click()
  await page.waitForTimeout(400)
  const body = await page.locator('body').innerText()
  console.log('zotero form shown:', body.includes('Zotero API key'))
}

// Export button + download.
const exportBtn = page.getByRole('button', { name: /^Export$/ })
console.log('export button present:', await exportBtn.count())
if (await exportBtn.count()) {
  await exportBtn.click()
  await page.waitForTimeout(300)
  const bibtexOpt = page.getByRole('button', { name: /BibTeX/ })
  if (await bibtexOpt.count()) {
    const [download] = await Promise.all([page.waitForEvent('download'), bibtexOpt.click()])
    console.log('download triggered:', download.suggestedFilename())
  } else {
    console.log('no BibTeX option visible (likely zero saved references)')
  }
}

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
await browser.close()
