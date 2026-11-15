#!/usr/bin/env node
// Checks two Base Repo Explorer fixes from 2026-11-15 (Susan Hanisch's feedback):
//   661e87ee: the column filter pop-up closed when its own list was scrolled ("one can't scroll down the list - the window disappears").
//   0279d2dc: two records joined in two ways (WebQuest and Digital Media Integration: a related approach and a more general method) were
//             drawn with two arrows. A pair gets one line.
// The QA account is answered as admin for the one role request. Nothing is written.
//
// Usage: node layout_check/explorer_popup_scroll_and_one_line_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5273/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-popup-one-line')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 560 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }) }))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1200)

// --- 661e87ee: scrolling inside the pick-list keeps it open; scrolling the page still closes it
await page.getByRole('button', { name: /^Filter Learning approaches/ }).click()
await page.waitForTimeout(300)
const pop = page.locator('.popover').last()
const dims = await pop.evaluate((el) => ({ scrollable: el.scrollHeight > el.clientHeight, top: el.scrollTop }))
check('the pick-list is longer than its box (so it has to scroll)', dims.scrollable)
const box = await pop.boundingBox()
await page.mouse.move(box.x + 30, box.y + 40)
await page.mouse.wheel(0, 150)
await page.waitForTimeout(400)
check('the pop-up is still open after scrolling its list', (await page.locator('.popover').count()) === 1)
const moved = await page.locator('.popover').last().evaluate((el) => el.scrollTop)
check('the list really moved', moved > 0, `scrollTop ${moved}`)
const lastVisible = await page.locator('.popover').last().getByRole('button').last().isVisible()
check('its last choice can be reached', lastVisible)
await page.locator('.popover').last().getByRole('button').last().scrollIntoViewIfNeeded()
check('still open after scrolling to the last choice', (await page.locator('.popover').count()) === 1)
await page.mouse.move(40, 300)
await page.mouse.wheel(0, 200)
await page.waitForTimeout(400)
check('scrolling the page (outside the list) still closes it', (await page.locator('.popover').count()) === 0)
await page.keyboard.press('Escape')
await page.getByRole('button', { name: /^Filter Review status/ }).click().catch(() => {})
await page.keyboard.press('Escape')

// --- 0279d2dc: no pair of records is drawn with two lines
await page.evaluate(() => window.scrollTo(0, 0))
await page.getByRole('button', { name: 'Graph', exact: true }).click()
await page.waitForTimeout(2500)
const hook = await page.evaluate(() => { const el = document.querySelector('[data-edge-count]'); return el ? { count: Number(el.getAttribute('data-edge-count')), twice: Number(el.getAttribute('data-edge-pairs-twice')) } : null })
check('the graph reports its lines', !!hook && hook.count > 0, JSON.stringify(hook))
check('no pair of methods has two lines', !!hook && hook.twice === 0, `pairs with two lines: ${hook?.twice}`)
await page.screenshot({ path: path.join(outDir, 'methods-graph.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 200))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
