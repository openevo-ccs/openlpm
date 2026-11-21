#!/usr/bin/env node
// Checks that the "When to use" field of a method in the Base Repo Explorer edit form is a multi-line box that grows,
// like the Description field (feedback bef4fc36, Susan Hanisch 2026-11-19, withdrawn by her in bd73db14 the same day).
// Nothing is saved: the form is opened and read, never submitted. The QA account is answered as admin for the one role request.
//
// Usage: node layout_check/when_to_use_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'https://openevo-ccs.github.io/openlpm/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'when-to-use')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: CORS }))

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1500)

// find a method that has a "When to use" text, so the field is filled; fall back to the first row
const search = page.locator('input[aria-label="Search all fields"]')
await search.fill('stationenlernen')
await page.waitForTimeout(500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
const editor = page.locator('[data-testid="record-editor"]')
check('edit form opens', (await editor.count()) === 1)

const info = await editor.evaluate((root) => {
  const out = []
  for (const label of root.querySelectorAll('label')) {
    const text = (label.textContent || '').trim()
    const id = label.getAttribute('for')
    const field = id ? root.querySelector('#' + CSS.escape(id)) : label.querySelector('input,textarea')
    if (!field) continue
    const r = field.getBoundingClientRect()
    out.push({ label: text, tag: field.tagName, id: field.id, height: Math.round(r.height), rows: field.rows ?? null, resize: getComputedStyle(field).resize })
  }
  return out
})
for (const f of info) console.log('   field:', JSON.stringify(f))
const when = info.find((f) => /^when to use/i.test(f.label))
const desc = info.find((f) => /^description/i.test(f.label))
check('a "When to use" field is in the form', !!when)
check('"When to use" is a multi-line box (textarea)', when?.tag === 'TEXTAREA', when ? `${when.tag}, ${when.height}px high, resize ${when.resize}` : '')
check('"Description" is a multi-line box too (for comparison)', desc?.tag === 'TEXTAREA', desc ? `${desc.tag}, ${desc.height}px high` : '')
await editor.screenshot({ path: path.join(outDir, 'editor.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
