#!/usr/bin/env node
// Checks Dustin's 2026-11-11 feedback row 62fd80e2 (one English/German view for the whole Base Repo Explorer, no German-name column,
// no German words in the English view) and Susan's row 3a1ca563 (no "All spaces" link for someone with a single space).
// The QA account is answered as admin for the one role request, so the account and database stay unchanged.
//
// Usage: node layout_check/explorer_language_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5200/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-language')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// The QA account's stored role is admin, so every answer here sets the role the page sees: admin for the Explorer, a plain
// member for the single-space check. Nothing is written to the account.
let roleSeen = 'admin'
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: roleSeen }), headers: { 'access-control-allow-origin': '*' } })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
const go = async (hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(800) }

await go('/dashboard/admin/explore')
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1000)

const headers = async () => (await page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
const h = await headers()
check('no "German name" column', !h.some((t) => t.includes('GERMAN NAME')), h.join(' | '))
await page.getByRole('group', { name: 'Language of the texts' }).waitFor({ timeout: 10000 }).catch(() => {})
check('language switch is on the page', (await page.getByRole('group', { name: 'Language of the texts' }).count()) === 1)

// English view: open ABC Method
await page.locator('input[aria-label="Search all fields"]').fill('ABC')
await page.waitForTimeout(500)
const firstRow = page.locator('tbody tr').filter({ hasText: 'ABC Method' }).first()
await firstRow.click()
await page.waitForTimeout(600)
await page.locator('summary', { hasText: 'Full record' }).click()
const panelEn = await page.locator('.card[style*="sticky"]').innerText()
check('EN: panel title is the English name', /^ABC Method/m.test(panelEn))
check('EN: no "(Einstieg)" style German tag words', !/\((Einstieg|Erarbeitung|Festigung|Reflexion|Ergebnisermittlung)/.test(panelEn))
check('EN: no "(ABC-Methode)" gloss in the text', !/\(ABC-Methode\)/.test(panelEn))
const rowsText = await page.locator('tbody').innerText()
check('EN: table shows no German method names', !/ABC-Methode/.test(rowsText))
await page.screenshot({ path: path.join(outDir, 'en-view.png') })

// German view
await page.locator('input[aria-label="Search all fields"]').fill('')
await page.getByRole('group', { name: 'Language of the texts' }).getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(700)
await page.locator('input[aria-label="Search all fields"]').fill('ABC')
await page.waitForTimeout(500)
const deRow = page.locator('tbody tr').filter({ hasText: 'ABC-Methode' }).first()
check('DE: table shows the German name', (await deRow.count()) === 1)
await deRow.click()
await page.waitForTimeout(600)
const panelDe = await page.locator('.card[style*="sticky"]').innerText()
check('DE: panel title is the German name', /^ABC-Methode/m.test(panelDe))
await page.screenshot({ path: path.join(outDir, 'de-view.png') })

// The choice is remembered
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(800)
check('DE choice remembered after reload', (await page.locator('.chip-btn.active').first().innerText()).trim() === 'German')

// Single-space link. The QA account belongs to several spaces, so its link must stay (answered as a plain member). Then the same page is loaded with the
// membership answer cut down to one space (the real answer is fetched and trimmed in the browser; nothing is written).
roleSeen = 'member'
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'en'))
const topLinks = async () => { await page.waitForTimeout(2000); return page.locator('.project-side-top a').allInnerTexts() }
await page.goto(base + '#/dashboard/evomentor-thuringia', { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' })
const many = await topLinks()
check('several spaces: "All spaces" link stays', many.some((t) => /Alle Bereiche|All spaces|All project spaces/.test(t)), JSON.stringify(many))
await page.route((u) => /\/rest\/v1\/project_members$/.test(u.pathname) && /projects/.test(decodeURIComponent(u.search)) && /user_id=eq\./.test(u.search), async (route) => {
  const res = await route.fetch()
  const rows = await res.json()
  await route.fulfill({ response: res, json: Array.isArray(rows) ? rows.slice(0, 1) : rows })
})
await page.goto(base + '#/dashboard/evomentor-thuringia', { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' })
const one = await topLinks()
check('one space: "All spaces" link is gone', !one.some((t) => /Alle Bereiche|All spaces|All project spaces/.test(t)), JSON.stringify(one))
await page.screenshot({ path: path.join(outDir, 'one-space.png') })

check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
