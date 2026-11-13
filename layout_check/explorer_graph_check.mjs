#!/usr/bin/env node
// Checks Dustin's 2026-11-13 feedback row 31cea347: the Base Repo Explorer graph with every repo loaded was a grid of 3,509 records and
// "Free spread" changed nothing. Now records without a link are left out unless asked for, linked records sit in blocks, and Free spread works.
// The QA account is answered as admin for the one role request. Nothing is written.
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
await page.waitForTimeout(2500)

const text = async () => (await box.innerText()).replace(/\s+/g, ' ')
const t0 = await text()
const m = t0.match(/\((\d+) of (\d+) shown\)/)
check('the graph leaves out records without a link by default', !!m && Number(m[1]) < Number(m[2]) * 0.5, t0)
check('the all-records graph holds the 3,500 or so records', !!m && Number(m[2]) > 3000, m ? m[2] : '')
check('the box is ticked', await box.locator('input').isChecked())
const canvas = page.locator('canvas').first()
const shot = async (name) => { const buf = await page.locator('div[style*="height: 560"]').first().screenshot({ path: path.join(outDir, name) }); return createHash('md5').update(buf).digest('hex') }
const fixedHash = await shot('1-fixed-linked-only.png')

// Free spread now runs, and changes the picture
const t1 = Date.now()
await page.getByRole('button', { name: 'Free spread' }).click()
await page.waitForTimeout(150)
await page.locator('[role=status]', { hasText: 'Drawing the graph' }).waitFor({ state: 'detached', timeout: 60000 })
await page.waitForTimeout(500)
const spreadMs = Date.now() - t1
const body = await page.locator('main, .page').first().innerText()
check('Free spread is not switched off for the linked records', !/Free spread is off/.test(body))
check('the drawing message is gone once the graph is drawn', (await page.locator('[role=status]', { hasText: 'Drawing the graph' }).count()) === 0)
const spreadHash = await shot('2-free-spread.png')
check('Free spread changes the picture', spreadHash !== fixedHash)
check('Free spread finishes in under 20 seconds', spreadMs < 20000, `${spreadMs} ms`)

// Untick: every record is back, Free spread is off for that many, and the page says so
await box.locator('input').uncheck()
await page.waitForTimeout(3000)
const t2 = await text()
check('unticked: all records are shown', /all \d+ shown/.test(t2), t2)
const body2 = await page.locator('main, .page').first().innerText()
check('unticked: the page says Free spread is off for this many records and what to do', /Free spread is off for more than 1200 records/.test(body2) && /Tick the box above/.test(body2))
await page.screenshot({ path: path.join(outDir, '3-unticked.png') })

// One repo with no links at all says so instead of showing an empty canvas
await box.locator('input').check()
await page.getByRole('button', { name: /^QuoteBase/ }).click()
await page.waitForTimeout(2500)
const body3 = await page.locator('main, .page').first().innerText()
check('a repo whose records have no links says there is nothing to draw', /No record here links to another record/.test(body3))
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
