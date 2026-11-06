// One-off verification for the new literature-collections panel, run
// against a local dev server pointed at real production Supabase (the
// migration adding its tables hasn't been pushed yet, so this checks the
// panel degrades safely -- no crash, no console error -- rather than
// checking real collection data, which isn't live until the migration runs).
import { chromium } from 'playwright'
import { mintQaSession } from './mint_qa_session.mjs'

const BASE = process.argv[2] || 'http://localhost:5205'
const SLUG = 'evomentor-thuringia'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })

await page.goto(BASE)
await mintQaSession(page, BASE)

const routes = [
  ['literature', `/dashboard/${SLUG}/literature`],
  ['strands', `/dashboard/${SLUG}/strands`],
  ['curriculum-repository', `/dashboard/${SLUG}/curriculum-repository`],
]

for (const [name, path] of routes) {
  errors.length = 0
  await page.goto(`${BASE}/#${path}`)
  await page.waitForTimeout(1800)
  const bodyText = await page.locator('body').innerText()
  const hasPanel = bodyText.includes('Literature collections')
  await page.screenshot({ path: `scratchpad-${name}.png` }).catch(() => {})
  console.log(`--- ${name} (${path}) ---`)
  console.log('panel rendered:', hasPanel)
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
}

// Now drill into one strand and one repository record if any exist, and
// try actually opening the "Attach a collection" picker to confirm it
// degrades to an empty list rather than crashing pre-migration.
await page.goto(`${BASE}/#/dashboard/${SLUG}/strands`)
await page.waitForTimeout(1500)
const firstStrand = page.locator('.btn-linklike').first()
if (await firstStrand.count()) {
  errors.length = 0
  await firstStrand.click()
  await page.waitForTimeout(1200)
  const attachBtn = page.getByRole('button', { name: /Attach a collection/i })
  if (await attachBtn.count()) {
    await attachBtn.click()
    await page.waitForTimeout(800)
    console.log('--- strand detail: picker opened, errors:', errors.length ? errors : 'none')
  } else {
    console.log('--- strand detail: no "Attach a collection" button found (canManage may be false for this role, or no strand selected)')
  }
}

// Now a Curriculum Repository record's own detail view.
await page.goto(`${BASE}/#/dashboard/${SLUG}/curriculum-repository`)
await page.waitForTimeout(1500)
const recordLinks = page.locator('button.btn-linklike, [class*="card"] button').filter({ hasText: /.+/ })
const count = await recordLinks.count()
console.log('--- curriculum-repository list: clickable candidates:', count)
if (count > 0) {
  errors.length = 0
  await recordLinks.first().click()
  await page.waitForTimeout(1200)
  const bodyText = await page.locator('body').innerText()
  console.log('--- repository record detail: panel rendered:', bodyText.includes('Literature collections'))
  console.log('--- repository record detail: errors:', errors.length ? errors.slice(0, 5) : 'none')
  await page.screenshot({ path: 'scratchpad-repo-record.png' }).catch(() => {})
}

await browser.close()
