#!/usr/bin/env node
// Checks Susan's 2026-11-13 feedback rows on the Base Repo Explorer's MethodsBase tab:
//   b28a398a  German view reads the method classes as Unterrichtsmethoden / Forschungsmethoden
//   c950e8f8  the edit form offers a German label box for a method that has only an English one
//   53ccb804  primary sources can be edited (one line each, citation | link)
// Nothing is saved: the edit form is opened and read, then cancelled. The QA account is answered as admin for the one role request.
//
// Usage: node layout_check/explorer_followups_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5271/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-followups')
mkdirSync(outDir, { recursive: true })
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
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'de'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1200)

// b28a398a: German class names, in the cells and in the filter list
const headers = (await page.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
const ci = headers.findIndex((t) => t.startsWith('METHOD'))
const cells = (await page.locator(`tbody tr td:nth-child(${ci + 1})`).allInnerTexts()).map((t) => t.trim())
check('German view: class cells read Unterrichtsmethoden or Forschungsmethoden', cells.length > 0 && cells.every((t) => t === 'Unterrichtsmethoden' || t === 'Forschungsmethoden'), [...new Set(cells)].join(' | '))
await page.getByRole('button', { name: /^Filter Method-class/ }).click()
const opts = (await page.locator('.popover .menu button').allInnerTexts()).map((t) => t.trim())
check('German view: the filter list offers the German names', opts.includes('Unterrichtsmethoden') && opts.includes('Forschungsmethoden') && !opts.includes('pedagogical-practice'), opts.join(' | '))
await page.locator('.popover .menu button', { hasText: 'Forschungsmethoden' }).click()
await page.waitForTimeout(500)
const chip = await page.locator('main, .page').first().innerText()
check('German view: the filter chip reads Forschungsmethoden', /Method-class: Forschungsmethoden/.test(chip))
check('filtering by Forschungsmethoden leaves only research methods', (await page.locator('tbody tr').count()) === 28, String(await page.locator('tbody tr').count()))
await page.screenshot({ path: path.join(outDir, '1-german-classes.png') })

// Switching the language clears the filter instead of leaving a stale German word that matches nothing
await page.getByRole('group', { name: 'Language of the texts' }).getByRole('button', { name: 'English' }).click()
await page.waitForTimeout(700)
check('after switching to English the filter is cleared and rows show', (await page.locator('tbody tr').count()) === 121, String(await page.locator('tbody tr').count()))
const enCells = (await page.locator(`tbody tr td:nth-child(${ci + 1})`).allInnerTexts()).map((t) => t.trim())
check('English view still shows the stored class names', enCells.includes('pedagogical-practice') && enCells.includes('research-method'))

// c950e8f8 and 53ccb804: the edit form of The Noticing Tool
await page.locator('input[aria-label="Search all fields"]').fill('Noticing')
await page.waitForTimeout(600)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: /^Edit$/ }).click()
await page.waitForTimeout(500)
const form = page.locator('[data-testid="record-editor"]')
const labels = (await form.locator('label').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim().toUpperCase())
check('edit form has Label (English) and Label (German)', labels.some((l) => l.startsWith('LABEL (ENGLISH)')) && labels.some((l) => l.startsWith('LABEL (GERMAN)')), labels.slice(0, 6).join(' | '))
check('edit form has a "Primary sources" box', labels.some((l) => l.startsWith('PRIMARY SOURCES')))
const src = await form.locator('#edit-primarySources').inputValue()
check('the primary sources box holds one line per source, with the link after a bar', src.split('\n').length >= 1 && src.length > 20, src.slice(0, 160).replace(/\n/g, ' // '))
await page.screenshot({ path: path.join(outDir, '2-edit-form.png'), fullPage: true })
await page.getByRole('button', { name: 'Cancel' }).click()
check('nothing was written to the edits table', writes.length === 0, writes.join(' | '))
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
