#!/usr/bin/env node
// Checks that a learning approach tag leads to its general method (feedback 5844bcd2, Susan Hanisch 2026-11-15; Dustin chose on 2026-11-17 to work the
// link out from the tag instead of entering it twice). Read-only: the QA account is answered as admin for the one role request, nothing is written.
//
// Usage: node layout_check/explorer_tag_links_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5274/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-tag-links')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }
const rowOf = (pg, name) => pg.locator('tbody tr', { has: pg.locator('td:first-child', { hasText: new RegExp('^' + name + '$') }) }).first()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
const writes = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => { if (r.method() !== 'GET' && /base_repo_record_edits/.test(r.url())) writes.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'en'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1000)

const openCard = async (name) => {
  await page.locator('input[aria-label="Search all fields"]').fill(name)
  await page.waitForTimeout(600)
  await rowOf(page, name).click()
  await page.waitForTimeout(600)
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
  return (await page.locator('.card[style*="sticky"]').innerText()).replace(/\s+/g, ' ')
}

// ---- the card of a method with the tag "bewegt" names Movement-Based Learning above it, and the general method lists it below ----
let card = await openCard('Movement-Based Learning')
const specific = (card.match(/MORE SPECIFIC METHODS (.*?)(?: LEARNING APPROACH| LESSON PHASES| DISCIPLINE| WHEN TO USE|$)/i) ?? [])[1] ?? ''
check('Movement-Based Learning lists methods that carry the tag bewegt as more specific methods', specific.split(',').length >= 4, specific.slice(0, 200))
const firstChild = specific.split(',')[0].trim()
await page.screenshot({ path: path.join(outDir, '1-general-method-card.png') })
await page.locator('.card[style*="sticky"] button', { hasText: new RegExp('^' + firstChild.replace(/[()]/g, '\$&') + '$') }).first().click()
await page.waitForTimeout(600)
card = (await page.locator('.card[style*="sticky"]').innerText()).replace(/\s+/g, ' ')
check(`the card of ${firstChild} names Movement-Based Learning, through the tag`, /MORE GENERAL METHOD .*Movement-Based Learning \(through the tag Movement-based\)/i.test(card), card.slice(0, 220))
await page.screenshot({ path: path.join(outDir, '2-specific-method-card.png') })

// ---- a method that already names its general method by hand is not listed twice ----
card = await openCard('Agent-Based Modeling')
check('Agent-Based Modeling keeps Computer simulation and adds the general methods of its tags (inquiry, digital) once each', /MORE GENERAL METHOD Computer simulation, Inquiry-Based Learning \(through the tag Inquiry-based\)/i.test(card) && /Digital Media Integration \(through the tag Digital\)/i.test(card) && (card.match(/Inquiry-Based Learning/g) ?? []).length === 1, card.slice(0, 300))
await page.locator('input[aria-label="Search all fields"]').fill('')

// ---- graph and hierarchy layout ----
await page.getByRole('button', { name: /^Graph$/ }).click()
await page.locator('label', { hasText: /Only records that have a link|Only records that are part of a hierarchy/ }).waitFor({ timeout: 30000 })
const drawn = async () => { await page.waitForTimeout(150); await page.locator('[role=status]', { hasText: 'Drawing the graph' }).waitFor({ state: 'detached', timeout: 90000 }); await page.waitForTimeout(400) }
const hook = async () => page.evaluate(() => { const el = document.querySelector('[data-edge-count]'); return el ? { count: Number(el.getAttribute('data-edge-count')), twice: Number(el.getAttribute('data-edge-pairs-twice')) } : null })
await drawn()
const h1 = await hook()
check('the graph has no pair of methods with two lines', !!h1 && h1.twice === 0, JSON.stringify(h1))
await page.getByRole('button', { name: /^Hierarchy$/ }).click()
await drawn()
const tiers = JSON.parse((await page.locator('div[style*="height: 560"]').first().getAttribute('data-hierarchy-tiers')) ?? '{}')
check('Movement-Based Learning is at the top of its tree', tiers['Movement-Based Learning'] === 0, String(tiers['Movement-Based Learning']))
check(`${firstChild} sits one tier below Movement-Based Learning`, tiers[firstChild] === 1, String(tiers[firstChild]))
const inTrees = Object.keys(tiers).length
const note = (await page.getByTestId('hierarchy-note').innerText()).replace(/\s+/g, ' ')
check('many more methods are part of a hierarchy than the three of the hand-made ladder', inTrees >= 30, `${inTrees} records; ${note.slice(0, 80)}`)
await page.screenshot({ path: path.join(outDir, '3-hierarchy-layout.png') })
const h2 = await hook()
check('the hierarchy layout has no pair with two lines either', !!h2 && h2.twice === 0, JSON.stringify(h2))

check('nothing was written to the edits table', writes.length === 0, writes.join(' | '))
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
