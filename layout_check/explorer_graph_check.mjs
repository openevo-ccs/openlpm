#!/usr/bin/env node
// Checks the Base Repo Explorer graph.
//   31cea347 (Dustin, 2026-11-13): with every repo loaded the graph was a grid of 3,509 records and "Free spread" changed nothing.
//   Follow-up the same day (Dustin): with "Only records that have a link" ticked, a single repo showed nothing, because its links go to
//   other repos that are not in that view. The graph must never come up blank: a view with no links of its own shows every record.
// Every repo tab is opened on the Graph view and its canvas is read for drawn pixels. The QA account is answered as admin for the one role
// request. Nothing is written.
//
// Usage: node layout_check/explorer_graph_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5271/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-graph')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => { localStorage.setItem('base-repo-explorer-language', 'en'); for (const k of Object.keys(localStorage)) if (/graph/i.test(k)) localStorage.removeItem(k) })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(6000)
await page.getByRole('button', { name: /^Graph$/ }).click()
const box = page.locator('label', { hasText: 'Only records that have a link' })
await box.waitFor({ timeout: 60000 })

const settled = async () => { await page.waitForTimeout(150); await page.locator('[role=status]', { hasText: 'Drawing the graph' }).waitFor({ state: 'detached', timeout: 90000 }); await page.waitForTimeout(400) }
const text = async () => (await box.innerText()).replace(/\s+/g, ' ')
// Pixels drawn on the graph canvases (a blank graph has none)
const drawnPixels = async () => page.evaluate(() => {
  let n = 0
  for (const c of Array.from(document.querySelectorAll('div[style*="height: 560"] canvas'))) {
    const ctx2 = c.getContext('2d'); if (!ctx2 || !c.width || !c.height) continue
    const d = ctx2.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 0) n++
  }
  return n
})
const shot = async (name) => { const buf = await page.locator('div[style*="height: 560"]').first().screenshot({ path: path.join(outDir, name) }); return createHash('md5').update(buf).digest('hex') }

// The All tab: only linked records by default
await settled()
const t0 = await text()
const m = t0.match(/\((\d+) of (\d+) shown\)/)
check('All tab: only the linked records are drawn by default', !!m && Number(m[1]) < Number(m[2]) * 0.5 && Number(m[2]) > 3000, t0)
check('All tab: the box is ticked', await box.locator('input').isChecked())
check('All tab: something is drawn', (await drawnPixels()) > 500, String(await drawnPixels()))
const fixedHash = await shot('1-fixed-linked-only.png')

// Free spread runs and changes the picture
await page.getByRole('button', { name: 'Free spread' }).click()
await settled()
check('All tab: Free spread is not switched off', !/Free spread is off/.test(await page.locator('main, .page').first().innerText()))
check('All tab: Free spread changes the picture', (await shot('2-free-spread.png')) !== fixedHash)
await page.getByRole('button', { name: 'Tiers' }).click()
await settled()

// Every repo tab draws something
for (const [label, re] of [['TheoryBase', /^TheoryBase/], ['LiteratureBase', /^LiteratureBase/], ['MethodsBase', /^MethodsBase/], ['QuestionBase', /^QuestionBase/], ['QuoteBase', /^QuoteBase/], ['CompetencyBase', /^CompetencyBase/], ['ProjectBase', /^ProjectBase/], ['TeachingBase', /^TeachingBase/]]) {
  await page.getByRole('button', { name: re }).first().click()
  await settled()
  const pixels = await drawnPixels()
  const t = await text()
  const body = await page.locator('main, .page').first().innerText()
  check(`${label}: the graph is not blank`, pixels > 100, `${pixels} drawn pixels | ${t.slice(-60)}`)
  if (/none in this view/.test(t)) {
    check(`${label}: no links of its own, so every record is shown and the page says why`, /every record is shown/.test(body) && (await box.locator('input').isDisabled()))
  }
  if (label === 'MethodsBase') {
    check('MethodsBase: a small view starts with every record', /all \d+ shown/.test(t) && !(await box.locator('input').isChecked()), t)
    await box.locator('input').check()
    await settled()
    const t2 = await text()
    check('MethodsBase: ticking the box shows only the linked methods and still draws', /\(\d+ of \d+ shown\)/.test(t2) && (await drawnPixels()) > 100, t2.slice(-40))
    await box.locator('input').uncheck()
    await settled()
  }
}
await page.screenshot({ path: path.join(outDir, '3-last-tab.png') })
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
