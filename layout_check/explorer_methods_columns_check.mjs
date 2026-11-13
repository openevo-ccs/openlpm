#!/usr/bin/env node
// Checks Susan Hanisch's 2026-11-12 feedback rows on the Base Repo Explorer's MethodsBase tab:
//   68661322  a "Lesson phases" column with filter and sort
//   cf57a372  the learning-approach row is shown on every classroom method, also when it is empty
//   5824a32e  the learning approach "konzeptbasiert/vernetzend" is spelled correctly (old stored spelling is read as the new one)
// The QA account is answered as admin for the one role request, so the account and database stay unchanged.
//
// Usage: node layout_check/explorer_methods_columns_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5263/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-methods-columns')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
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
await page.waitForTimeout(800)
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1200)

const headers = async () => (await page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
const h = await headers()
check('column "Lesson phases" is in the table', h.some((t) => t.startsWith('LESSON PHASES')), h.join(' | '))
const colIndex = h.findIndex((t) => t.startsWith('LESSON PHASES'))
const colTexts = async () => page.locator(`tbody tr td:nth-child(${colIndex + 1})`).allInnerTexts()

// English view: tags read in English, no German tag words
const cells = (await colTexts()).map((t) => t.trim())
check('cells show lesson phases', cells.some((t) => t && t !== '—'), cells.slice(0, 4).join(' || '))
check('English view shows English readings, no German tag words', !cells.some((t) => /Einstieg|Erarbeitung|Festigung|Reflexion|Ergebnisermittlung/.test(t)), cells.slice(0, 4).join(' || '))
check('a method with no lesson phase shows a dash', cells.some((t) => t === '—'))
check('a count says how many records are shown (feedback 452bcae4)', /^\d[\d,]* records$/.test((await page.getByTestId('result-count').innerText()).trim()), await page.getByTestId('result-count').innerText())
await page.screenshot({ path: path.join(outDir, '1-table.png') })

// Filter
await page.getByRole('button', { name: /^Filter Lesson phases/ }).click()
const optionTexts = (await page.locator('.popover .menu button').allInnerTexts()).map((t) => t.trim())
check('filter offers All and the five phases', optionTexts.length === 6 && optionTexts[0] === 'All', optionTexts.join(' | '))
await page.locator('.popover .menu button', { hasText: 'Introduction' }).click()
await page.waitForTimeout(500)
const filtered = (await colTexts()).map((t) => t.trim())
check('after filtering by Introduction every row lists it', filtered.length > 0 && filtered.every((t) => t.includes('Introduction')), `${filtered.length} rows`)
const countText = (await page.getByTestId('result-count').innerText()).trim()
check('the count shows how many match out of all', new RegExp('^' + filtered.length + ' of [0-9]+ records match$').test(countText), countText)
await page.screenshot({ path: path.join(outDir, '2-filtered.png') })
await page.getByRole('button', { name: /^Filter Lesson phases/ }).click()
await page.locator('.popover .menu button', { hasText: /^All$/ }).click()
await page.waitForTimeout(500)

// Sort
await page.getByRole('button', { name: /Lesson phases/i, exact: false }).filter({ hasText: /Lesson phases/i }).first().click()
await page.waitForTimeout(500)
const asc = (await colTexts()).map((t) => t.trim())
const key = (t) => (t === '—' ? '' : t)
const sortedAsc = asc.every((t, i) => i === 0 || key(asc[i - 1]).localeCompare(key(t), 'en', { sensitivity: 'base' }) <= 0)
check('sorting by the column orders the rows', sortedAsc, asc.slice(0, 3).join(' || ') + ' ... ' + asc.slice(-2).join(' || '))
await page.screenshot({ path: path.join(outDir, '3-sorted.png') })

// Empty learning approach on a classroom method shows the placeholder; research methods show no row
await page.locator('input[aria-label="Search all fields"]').fill('')
const laIndex = h.findIndex((t) => t.startsWith('LEARNING APPROACHES'))
const classIndex = h.findIndex((t) => t.startsWith('METHOD'))
const rowsInfo = await page.locator('tbody tr').evaluateAll((trs, [la, cls]) => trs.map((tr, i) => ({ i, la: tr.children[la]?.innerText.trim(), cls: tr.children[cls]?.innerText.replace(/\s+/g, ' ').trim() })), [laIndex, classIndex])
const emptyPed = rowsInfo.find((r) => r.la === '—' && /pedagogical/.test(r.cls))
const research = rowsInfo.find((r) => /research/.test(r.cls))
check('found a classroom method with no learning approach', !!emptyPed)
if (emptyPed) {
  await page.locator('tbody tr').nth(emptyPed.i).click()
  await page.waitForTimeout(700)
  await page.locator('summary', { hasText: 'Full record' }).click()
  const panel = await page.locator('.card[style*="sticky"]').innerText()
  check('its card shows "Learning approach" with a "Not set yet" note', /LEARNING APPROACH\s*\n?\s*Not set yet/i.test(panel), panel.slice(0, 200).replace(/\n/g, ' / '))
  await page.screenshot({ path: path.join(outDir, '4-empty-learning-approach.png') })
}
if (research) {
  await page.locator('tbody tr').nth(research.i).click()
  await page.waitForTimeout(700)
  const open = page.locator('summary', { hasText: 'Full record' })
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await open.click()
  const panel = await page.locator('.card[style*="sticky"]').innerText()
  check('a research method card shows no "Learning approach" row', !/LEARNING APPROACH/i.test(panel))
}

// Spelling: no table cell or card shows the old misspelling, in either language
const allText = async () => (await page.locator('tbody').innerText()) + '\n' + (await page.locator('.card[style*="sticky"]').innerText().catch(() => ''))
check('English view: old spelling "vernetztend" not shown anywhere', !/vernetztend/.test(await allText()))
await page.locator('input[aria-label="Search all fields"]').fill('Causal')
await page.waitForTimeout(500)
check('English view: the approach is called Conceptual/networked (feedback 3c00e8fb)', /Conceptual\/networked/.test(await page.locator('tbody').innerText()) && !/Concept-based and connecting/.test(await allText()))
await page.locator('input[aria-label="Search all fields"]').fill('')
await page.getByRole('group', { name: 'Language of the texts' }).getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(800)
const deText = await allText()
check('German view: old spelling not shown, corrected spelling shown', !/vernetztend/.test(deText) && /konzeptbasiert\/vernetzend/.test(deText))
await page.screenshot({ path: path.join(outDir, '5-german.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
