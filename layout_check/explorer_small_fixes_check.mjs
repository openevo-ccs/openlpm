#!/usr/bin/env node
// Checks three Explorer fixes from 2026-11-14: the review-status filter pop-up stays inside the window (feedback f8dcb3ec),
// the LiteratureBase table has a Type column (804d2f67), and the new tag wording shows in English and German
// (32396e5b, 5429284f, 99969808, d7c641d3). Read-only: nothing is written to the database.
//
// Usage: node layout_check/explorer_small_fixes_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5272/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-small-fixes')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }) }))

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// --- MethodsBase: tag wording and the filter pop-up on the last column
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1200)
const bodyEn = await page.locator('table').first().innerText()
check('English: Knowledge acquisition shows', bodyEn.includes('Knowledge acquisition'))
check('English: old "Working through new material" is gone', !bodyEn.includes('Working through new material'))
check('English: Cooperative/social shows', bodyEn.includes('Cooperative/social'))
check('English: old "Collecting and judging results" is gone', !bodyEn.includes('Collecting and judging results'))

const filterBtn = page.getByRole('button', { name: /^Filter Review status/ })
await filterBtn.click()
await page.waitForTimeout(300)
const pop = page.locator('.popover').last()
const box = await pop.boundingBox()
const vp = page.viewportSize()
check('the Review status pop-up is inside the window', !!box && box.x >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, JSON.stringify(box))
const topHit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return !!el?.closest('.popover') }, { x: (box?.x ?? 0) + 20, y: (box?.y ?? 0) + 20 })
check('the pop-up is on top (not hidden behind the table)', topHit)
const lastBtnVisible = await pop.getByRole('button').last().isVisible()
check('its last choice is visible', lastBtnVisible)
await page.screenshot({ path: path.join(outDir, 'review-status-popup.png') })
await pop.getByRole('button').nth(1).click()
await page.waitForTimeout(400)
check('picking a choice closes the pop-up and filters', (await page.locator('.popover').count()) === 0)
await page.getByRole('button', { name: /Clear all/ }).click().catch(() => {})

// the learning approach filter lists the new name and the new tag is a choice in the edit form's vocabulary
await page.getByRole('button', { name: /^Filter Learning approaches/ }).click()
const popText = await page.locator('.popover').last().innerText()
check('the learning-approach filter shows Cooperative/social', popText.includes('Cooperative/social'))
await page.keyboard.press('Escape')

// German
await page.getByRole('button', { name: 'German', exact: true }).first().click()
await page.waitForTimeout(800)
const bodyDe = await page.locator('table').first().innerText()
check('German: kooperativ/sozial shows', bodyDe.includes('kooperativ/sozial'))
await page.screenshot({ path: path.join(outDir, 'methods-german.png') })
await page.getByRole('button', { name: 'English', exact: true }).first().click()

// --- LiteratureBase: Type column
await page.getByRole('button', { name: /^LiteratureBase/ }).click()
await page.waitForTimeout(1500)
await page.locator('table thead th').first().waitFor({ timeout: 15000 })
const heads = await page.locator('table thead th').allInnerTexts()
check('the LiteratureBase table has a Type column', heads.some((h) => /^type$/i.test(h.trim())), JSON.stringify(heads))
const firstRows = await page.locator('table tbody tr').first().innerText()
check('a row shows a readable type', /Journal article|Book|Preprint|Report|Conference paper|Thesis|Other|—/.test(firstRows), firstRows.replace(/\s+/g, ' ').slice(0, 160))
await page.getByRole('button', { name: /^Filter Type/ }).click()
const typeOptions = await page.locator('.popover').last().innerText()
check('the Type filter offers Journal article', typeOptions.includes('Journal article'), typeOptions.replace(/\s+/g, ' '))
await page.screenshot({ path: path.join(outDir, 'literature-type.png') })

check('no page errors', errors.length === 0, errors.join(' ; '))
await browser.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
