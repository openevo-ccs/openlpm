#!/usr/bin/env node
// Checks Dustin's 2026-11-13 requests for MethodsBase in the Base Repo Explorer:
//   - the method class is multi-select (a method can be a teaching method and a research method)
//   - the method space has a hierarchy: agent-based modeling is a kind of computer simulation, which is a kind of work with models
// The new methods are not in the live copy of MethodsBase until the methods repo change is merged and the copy refreshed, so the
// snapshot answer is topped up in the browser with the records from a rows file (the methods repo's new and changed records as snapshot
// rows). Nothing is written: the edit form is only opened and cancelled. The QA account is answered as admin for the one role request.
//
// Usage: node layout_check/explorer_method_hierarchy_check.mjs <new-rows.json> [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rowsFile = process.argv[2]
const base = process.argv[3] || 'http://localhost:5271/'
const outDir = process.argv[4] || path.join(ROOT, 'layout_check', 'out', 'explorer-method-hierarchy')
mkdirSync(outDir, { recursive: true })
const extra = rowsFile ? JSON.parse(readFileSync(rowsFile, 'utf8')) : []
// The search matches words anywhere in a record (Agent-Based Modeling mentions computer simulations), so a row is picked by its name.
const rowOf = (pg, name) => pg.locator('tbody tr', { has: pg.locator('td:first-child', { hasText: new RegExp('^' + name + '$') }) }).first()
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
const writes = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => { if (r.method() !== 'GET' && /base_repo_record_edits/.test(r.url())) writes.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } })
})
// Top up the methods snapshot with the new records and replace the changed one.
await page.route((u) => /\/rest\/v1\/methodsbase_snapshot$/.test(u.pathname), async (route) => {
  const response = await route.fetch()
  if (!response.ok() || extra.length === 0) return route.fulfill({ response })
  const rows = await response.json()
  const ids = new Set(extra.map((r) => r.id))
  return route.fulfill({ response, json: [...rows.filter((r) => !ids.has(r.id)), ...extra] })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'en'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1000)

// ---- the table shows both classes and filters by either ----
const headers = (await page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
const ci = headers.findIndex((t) => t.startsWith('METHOD'))
await page.locator('input[aria-label="Search all fields"]').fill('Computer simulation')
await page.waitForTimeout(600)
const rowText = (await rowOf(page, 'Computer simulation').innerText()).replace(/\s+/g, ' ')
check('the table lists Computer simulation with both classes', /Computer simulation/.test(rowText) && /pedagogical-practice, research-method/.test(rowText), rowText)
await page.locator('input[aria-label="Search all fields"]').fill('')
await page.getByRole('button', { name: /^Filter Method-class/ }).click()
const options = (await page.locator('.popover .menu button').allInnerTexts()).map((t) => t.trim())
check('the class filter offers the two classes, not the pair as a third choice', options.join('|') === 'All|pedagogical-practice|research-method', options.join(' | '))
await page.locator('.popover .menu button', { hasText: /^research-method$/ }).click()
await page.waitForTimeout(500)
const researchRows = await page.locator(`tbody tr td:nth-child(${ci + 1})`).allInnerTexts()
check('filtering by research-method includes the method that has both classes', researchRows.some((t) => /pedagogical-practice, research-method/.test(t)) && researchRows.length >= 29, `${researchRows.length} rows`)
await page.getByRole('button', { name: /^Method-class: research-method/ }).click()

// ---- the card shows the class and the ladder, and the links open the neighbours ----
await page.locator('input[aria-label="Search all fields"]').fill('Computer simulation')
await page.waitForTimeout(600)
await rowOf(page, 'Computer simulation').click()
await page.waitForTimeout(600)
if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
let card = (await page.locator('.card[style*="sticky"]').innerText()).replace(/\s+/g, ' ')
check('the card of Computer simulation shows both classes', /METHOD CLASS pedagogical-practice, research-method/i.test(card), card.slice(0, 160))
check('the card names the more general method', /MORE GENERAL METHOD Models as a teaching method/i.test(card))
check('the card names the more specific method', /MORE SPECIFIC METHODS Agent-Based Modeling/i.test(card))
await page.screenshot({ path: path.join(outDir, '1-card.png') })
await page.locator('.card[style*="sticky"] button', { hasText: 'Agent-Based Modeling' }).click()
await page.waitForTimeout(600)
card = (await page.locator('.card[style*="sticky"]').innerText()).replace(/\s+/g, ' ')
check('the link opens the more specific method, which names Computer simulation above it', /Agent-Based Modeling/.test(card) && /MORE GENERAL METHOD Computer simulation/i.test(card))

// ---- the edit form: two classes can be picked, the broader method is chosen from the other methods ----
await page.locator('input[aria-label="Search all fields"]').fill('Computer simulation')
await page.waitForTimeout(600)
await rowOf(page, 'Computer simulation').click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /^Edit$/ }).click()
await page.waitForTimeout(500)
const form = page.locator('[data-testid="record-editor"]')
const labels = (await form.locator('label').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
check('the form has Method-class and More general method', labels.some((l) => l.startsWith('METHOD-CLASS')) && labels.some((l) => l.startsWith('MORE GENERAL METHOD')), labels.slice(0, 8).join(' | '))
const classChips = (await form.locator('div:has(> label[for="edit-methodClass"]) button.btn-mini').allInnerTexts()).map((t) => t.trim())
check('both classes of Computer simulation are shown as chips', classChips.some((t) => /^pedagogical-practice/.test(t)) && classChips.some((t) => /^research-method/.test(t)), classChips.join(' | '))
check('Save is off while nothing changed', (await form.getByRole('button', { name: /Save \(no changes yet\)/ }).count()) === 1)
await form.locator('div:has(> label[for="edit-methodClass"]) button.btn-mini', { hasText: /^research-method/ }).click()
check('removing one class counts as one change', (await form.getByRole('button', { name: /Save 1 change/ }).count()) === 1)
await form.locator('#edit-methodClass').selectOption('research-method')
check('adding it back is no change again', (await form.getByRole('button', { name: /Save \(no changes yet\)/ }).count()) === 1)
const broaderOptions = await form.locator('#edit-broaderMethods option').allInnerTexts()
check('the broader method menu lists other methods and not the method itself', broaderOptions.some((t) => /Agent-Based Modeling/.test(t)) && !broaderOptions.some((t) => /^Computer simulation$/.test(t.trim())), `${broaderOptions.length} options`)
await page.screenshot({ path: path.join(outDir, '2-edit-form.png'), fullPage: true })
await form.getByRole('button', { name: 'Cancel' }).click()
check('nothing was written to the edits table', writes.length === 0, writes.join(' | '))

// ---- the hierarchy view ----
await page.locator('input[aria-label="Search all fields"]').fill('')
await page.getByRole('button', { name: /^Hierarchy$/ }).click()
await page.waitForTimeout(800)
const tree = page.getByTestId('method-tree')
const treeText = (await tree.innerText()).replace(/\s+/g, ' ')
check('the hierarchy shows models, then computer simulation, then agent-based modeling', treeText.indexOf('Models as a teaching method') >= 0 && treeText.indexOf('Computer simulation') > treeText.indexOf('Models as a teaching method') && treeText.indexOf('Agent-Based Modeling') > treeText.indexOf('Computer simulation'), treeText.slice(0, 220))
check('it says how many methods are placed so far', /3 of \d+ methods are placed in the hierarchy so far/.test(treeText), treeText.slice(0, 120))
const indent = async (name) => tree.getByRole('button', { name }).first().evaluate((el) => el.getBoundingClientRect().left)
const [l0, l1, l2] = [await indent('Models as a teaching method'), await indent('Computer simulation'), await indent('Agent-Based Modeling')]
check('each step is indented under the one above', l1 > l0 && l2 > l1, `${Math.round(l0)} < ${Math.round(l1)} < ${Math.round(l2)}`)
await page.screenshot({ path: path.join(outDir, '3-hierarchy.png') })
await tree.getByRole('button', { name: 'Computer simulation' }).click()
await page.waitForTimeout(500)
check('a click in the tree opens the method card', /Computer simulation/.test(await page.locator('.card[style*="sticky"]').innerText()))

// ---- German ----
await page.getByRole('group', { name: 'Language of the texts' }).getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /^Table$/ }).click()
await page.locator('input[aria-label="Search all fields"]').fill('Computersimulation')
await page.waitForTimeout(700)
const deRow = (await rowOf(page, 'Computersimulation').innerText()).replace(/\s+/g, ' ')
check('German view: both classes read Unterrichtsmethoden, Forschungsmethoden', /Unterrichtsmethoden, Forschungsmethoden/.test(deRow), deRow)

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
