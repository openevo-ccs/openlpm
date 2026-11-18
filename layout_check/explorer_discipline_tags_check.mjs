#!/usr/bin/env node
// Checks Discipline as tags in the Base Repo Explorer (feedback 3bef962e, Susan Hanisch; Dustin chose tags and keeping the old line, 2026-11-18).
// Read-only: the QA account is answered as admin for the one role request and nothing is written. Until the Explorer's copy of MethodsBase has been
// refreshed from the repo, the page is served the tags from a local MethodsBase checkout, exactly as the refresh would store them.
//
// Usage: METHODSBASE_PATH=<methodsbase checkout> node layout_check/explorer_discipline_tags_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import yaml from 'js-yaml'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5276/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-discipline-tags')
const MB = process.env.METHODSBASE_PATH ?? path.join(ROOT, '..', 'methodsbase')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const methods = yaml.load(readFileSync(path.join(MB, 'records', 'methods.yaml'), 'utf8')).methods
const vocab = yaml.load(readFileSync(path.join(MB, 'vocabularies', 'method-tags.yaml'), 'utf8')).disciplineTags
const tagsById = new Map(methods.filter((m) => m.disciplineTags).map((m) => [m.id, m.disciplineTags]))
const german = Object.fromEntries(vocab.map((v) => [v.term, v.de]))
check('the local MethodsBase has 58 tagged methods and 25 disciplines', tagsById.size === 58 && vocab.length === 25, `${tagsById.size} / ${vocab.length}`)

const rowOf = (pg, name) => pg.locator('tbody tr', { has: pg.locator('td:first-child', { hasText: name }) }).first()
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
const writes = []
page.on('pageerror', (e) => errors.push(e?.message ?? JSON.stringify(e)))
page.on('request', (r) => { if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS' && /base_repo_record_edits/.test(r.url())) writes.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
await page.route((u) => /\/rest\/v1\/methodsbase_snapshot$/.test(u.pathname), async (route) => {
  const res = await route.fetch()
  const json = await res.json()
  const patch = (r) => (tagsById.has(r.id) ? { ...r, data: { ...r.data, disciplineTags: tagsById.get(r.id) } } : r)
  await route.fulfill({ status: res.status(), contentType: res.headers()['content-type'] ?? 'application/json', headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body: JSON.stringify(Array.isArray(json) ? json.map(patch) : patch(json)) })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)

const openMethods = async (lang) => {
  await page.evaluate((l) => localStorage.setItem('base-repo-explorer-language', l), lang)
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
  await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: /^MethodsBase/ }).click()
  await page.locator('thead th').first().waitFor({ timeout: 40000 })
  await page.waitForTimeout(1200)
}
const openCard = async (name) => {
  await page.locator('input[aria-label="Search all fields"]').fill(name)
  await page.waitForTimeout(600)
  await rowOf(page, name).click()
  await page.waitForTimeout(600)
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
  return (await page.locator('.card[style*="sticky"]').innerText()).replace(/\s+/g, ' ')
}

// ---- English ----
await openMethods('en')
const heads = (await page.locator('thead th').allInnerTexts()).map((t) => t.replace(/[^A-Za-z ]/g, '').trim())
check('the table has a Discipline column', heads.some((h) => /^discipline/i.test(h)), heads.join(' | '))
let card = await openCard('Dictator Game')
check('the card of the Dictator Game shows the tag Behavioral economics', /DISCIPLINE Behavioral economics/i.test(card), card.slice(0, 300))
check('and keeps the old free-text line as a note', /DISCIPLINE NOTE behavioral economics \/ experimental game theory/i.test(card))
await page.screenshot({ path: path.join(outDir, '1-card-english.png') })
await page.getByRole('button', { name: 'Edit', exact: true }).click()
const editor = page.locator('[data-testid="record-editor"]')
await editor.waitFor({ timeout: 10000 })
const options = await editor.locator('#edit-disciplineTags option').allInnerTexts()
// The box offers the disciplines the record does not carry yet, after an "Add…" line; the Dictator Game carries one.
check('the edit form has a Discipline tag box that offers the other 24 disciplines, named in English', options.filter((o) => o !== 'Add…').length === 24 && options.includes('Social studies') && !options.some((o) => /Verhaltens|Gesellschaftslehre/.test(o)), `${options.length} options: ${options.slice(0, 6).join(', ')}`)
const labels = (await editor.locator('label').allInnerTexts()).map((t) => t.trim().toLowerCase())
check('the free-text line is offered as "Discipline note (English)"', labels.some((l) => l.startsWith('discipline note (english)')), labels.filter((l) => l.startsWith('discipline')).join(' | '))
await page.screenshot({ path: path.join(outDir, '2-edit-form-english.png') })
await page.getByRole('button', { name: /Cancel|Close/ }).first().click().catch(() => {})

// ---- the filter: choosing Behavioral economics keeps the six methods that carry it ----
await openMethods('en')
const expected = [...tagsById.entries()].filter(([, t]) => t.includes('Behavioral economics')).length
await page.locator('input[aria-label="Search all fields"]').fill('')
const discHeader = page.locator('thead th', { hasText: /^discipline/i }).first()
await discHeader.locator('button').last().click().catch(async () => { await discHeader.click() })
await page.waitForTimeout(500)
const popup = page.locator('[role="dialog"], [data-testid*="filter"], .filter-popup, div[style*="position: fixed"]').last()
const optionLabel = popup.getByText('Behavioral economics', { exact: true }).first()
const popupOk = await optionLabel.count()
check('the Discipline filter lists the discipline names', popupOk > 0)
if (popupOk > 0) {
  await optionLabel.click()
  await page.waitForTimeout(700)
  const rows = await page.locator('tbody tr').count()
  check(`choosing Behavioral economics leaves the ${expected} methods that carry it`, rows === expected, `${rows} rows`)
  await page.screenshot({ path: path.join(outDir, '3-filtered.png') })
}

// ---- German ----
await openMethods('de')
card = await openCard('Diktatorspiel').catch(() => '')
if (!card) {
  await page.locator('input[aria-label="Search all fields"]').fill('')
  const first = await page.locator('tbody tr td:first-child').first().innerText()
  card = await openCard(first)
}
const de = await page.locator('tbody tr').first().innerText()
check('in German the Discipline column uses the German names', /Verhaltensökonomik|Naturwissenschaftsdidaktik|Bildungsforschung|Computergestützte Textanalyse|Gesellschaftslehre|Naturwissenschaften/.test(await page.locator('tbody').innerText()) && !/Behavioral economics/.test(await page.locator('tbody').innerText()), de.slice(0, 160))
await page.screenshot({ path: path.join(outDir, '4-table-german.png') })

check('no page error', errors.length === 0, errors.join(' | ').slice(0, 200))
check('nothing is written to the database', writes.length === 0, writes.join(' | ').slice(0, 200))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
