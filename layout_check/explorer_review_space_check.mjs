#!/usr/bin/env node
// Checks the Base Repo Explorer's review space (Dustin, 2026-11-13: "all the features for reviewing are totally taking up way too much space in the
// user interface for each base repo view ... a different way to go into the review space ... make this cleaner").
//   - A repo view has one Review button. The old Edited only / Edits to send back / Review queue buttons and the TeachingBase review cards are gone
//     from the top, so the table starts high on the page.
//   - Review opens a space with the review queue, the edits to send back and (TeachingBase) the lesson links; Back returns to the repo view.
//   - "Show the edited records in the table" leaves a chip that clears the filter.
// The QA account is answered as admin for the one role request. Nothing is written.
//
// Usage: node layout_check/explorer_review_space_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5271/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-review-space')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'en'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(5000)

const REVIEW = /^Review( \(\d+\))?$/
const firstRowTop = () => page.locator('tbody tr').first().evaluate((el) => Math.round(el.getBoundingClientRect().top))

// ---- a repo view: MethodsBase ----
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('tbody tr').first().waitFor({ timeout: 30000 })
check('one Review button in the toolbar', (await page.getByRole('button', { name: REVIEW }).count()) === 1)
check('no Edited only, Edits to send back or Review queue button any more', (await page.getByRole('button', { name: /^Edited only$/ }).count()) === 0 && (await page.getByRole('button', { name: /^Edits to send back/ }).count()) === 0 && (await page.getByRole('button', { name: /^Review queue/ }).count()) === 0)
const top = await firstRowTop()
check('the first record sits in the upper third of a 900px window', top < 360, `${top}px`)
await page.screenshot({ path: path.join(outDir, '1-methods.png') })

await page.getByRole('button', { name: REVIEW }).click()
check('Review opens a space with a Back button and the queue and edits sections', (await page.getByTestId('review-space').count()) === 1 && (await page.getByRole('tab', { name: /^Waiting for review/ }).count()) === 1 && (await page.getByRole('tab', { name: /^Edits to send back/ }).count()) === 1)
check('no Lesson links section outside TeachingBase', (await page.getByRole('tab', { name: /^Lesson links/ }).count()) === 0)
check('the table is out of the way while reviewing', (await page.locator('tbody tr').count()) === 0)
await page.screenshot({ path: path.join(outDir, '2-review-queue.png') })
await page.getByRole('tab', { name: /^Edits to send back/ }).click()
check('the edits section shows the batch panel', (await page.getByTestId('edits-export').count()) === 1)
await page.screenshot({ path: path.join(outDir, '3-review-edits.png') })
await page.getByRole('button', { name: 'Show the edited records in the table' }).click()
await page.locator('tbody tr').first().waitFor({ timeout: 15000 })
check('showing the edited records closes the space and leaves a chip', (await page.getByTestId('review-space').count()) === 0 && (await page.getByRole('button', { name: 'Edited only ×' }).count()) === 1)
await page.getByRole('button', { name: 'Edited only ×' }).click()
check('the chip clears the filter', (await page.getByRole('button', { name: 'Edited only ×' }).count()) === 0)
await page.getByRole('button', { name: REVIEW }).click()
await page.getByRole('button', { name: /^Back to MethodsBase/ }).click()
await page.locator('tbody tr').first().waitFor({ timeout: 15000 })
check('Back returns to the MethodsBase table', (await page.getByTestId('review-space').count()) === 0 && (await page.locator('tbody tr').count()) > 50)

// ---- TeachingBase: the big review cards moved into the space ----
await page.getByRole('button', { name: /^TeachingBase/ }).click()
await page.locator('tbody tr').first().waitFor({ timeout: 30000 })
check('TeachingBase: no review cards above the table', (await page.getByTestId('teachingbase-toolbar').count()) === 0 && (await page.getByTestId('reviewers-panel').count()) === 0)
check('TeachingBase: Start reviewing is one button in the toolbar', (await page.getByTestId('start-review').count()) === 1)
const tbTop = await firstRowTop()
check('TeachingBase: the first lesson sits in the upper third of the window (it was about 740px down before)', tbTop < 360, `${tbTop}px`)
await page.screenshot({ path: path.join(outDir, '4-teachingbase.png') })
await page.getByRole('button', { name: REVIEW }).click()
check('TeachingBase: Review opens on the lesson links with progress and reviewers', (await page.getByRole('tab', { name: /^Lesson links/ }).getAttribute('aria-selected')) === 'true' && (await page.getByTestId('overall-progress').count()) === 1 && (await page.getByTestId('reviewers-panel').count()) === 1)
await page.screenshot({ path: path.join(outDir, '5-teachingbase-review.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
