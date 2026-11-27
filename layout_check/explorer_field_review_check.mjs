#!/usr/bin/env node
// Checks the thumbs-up and flag on single fields in the Base Repo Explorer's edit form (feedback 1551a6e1, Susan Hanisch, 2026-11-25).
// Nothing is written to the database. The QA account is answered as admin for the one role request. The new table (migration 259) is served by
// a stand-in inside the browser: reads come back from a local list, and the one write the controls make is caught, recorded and added to that
// list, so the page behaves as it will once the migration is live. Any other write fails the check.
//
// Usage: node layout_check/explorer_field_review_check.mjs [base] [outDir]   (needs .supabase-secrets/service-role-key.txt)

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5290/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-field-review')
mkdirSync(outDir, { recursive: true })
const keyFile = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(keyFile)) process.env.SUPABASE_SERVICE_ROLE_KEY = readFileSync(keyFile, 'utf8').trim()
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
const posted = []
const standIn = []
const otherWrites = []
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
page.on('pageerror', (e) => errors.push(e?.message ?? JSON.stringify(e)))
page.on('request', (r) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !/base_repo_field_reviews|base_repo_review_targets/.test(r.url()) && !/student_activity_events|auth\/v1/.test(r.url())) otherWrites.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: cors }))
await page.route((u) => /\/rest\/v1\/base_repo_field_reviews$/.test(u.pathname), async (route) => {
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'POST') {
    const rows = req.postDataJSON()
    for (const r of Array.isArray(rows) ? rows : [rows]) {
      posted.push(r)
      standIn.push({ ...r, id: `standin-${standIn.length}`, reviewed_at: new Date().toISOString(), exported_at: null, export_batch: null, reviewer: { name: 'QA check', email: null } })
    }
    return route.fulfill({ status: 201, headers: cors, body: '' })
  }
  const repo = (new URL(req.url()).searchParams.get('base_repo') ?? '').replace(/^eq\./, '')
  return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(standIn.filter((r) => r.base_repo === repo)) })
})
// Opening a card registers an empty review target for the record when it has none. Answered here so the check leaves nothing behind.
await page.route((u) => /\/rest\/v1\/base_repo_review_targets$/.test(u.pathname), async (route) => {
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'POST') return route.fulfill({ status: 201, headers: { ...cors, 'content-type': 'application/vnd.pgrst.object+json' }, body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }) })
  return route.continue()
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'de'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1500)

const card = () => page.locator('.card[style*="sticky"]')
const cardText = async () => (await card().innerText()).replace(/\s+/g, ' ')
const openFullRecord = async () => {
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
  await page.waitForTimeout(300)
}

// Find a method whose German description still carries the "Claude draft" tag.
const total = await page.locator('tbody tr').count()
let found = null
for (let i = 0; i < Math.min(total, 40) && !found; i++) {
  await page.locator('tbody tr').nth(i).click()
  await page.waitForTimeout(350)
  if ((await page.locator('summary', { hasText: 'Full record' }).count()) === 0) continue
  await openFullRecord()
  const t = await cardText()
  if (/Description.{0,400}Claude draft/i.test(t)) found = { i, name: (await page.locator('tbody tr').nth(i).locator('td').first().innerText()).trim() }
}
check('a method with a drafted German description was found to test with', !!found, found ? found.name : `looked at ${Math.min(total, 40)} rows`)
if (!found) { await browser.close(); process.exit(1) }
console.log(`      testing with: ${found.name}`)
await page.screenshot({ path: path.join(outDir, '1-card-with-draft-tag.png') })

// ---- the form shows the controls ----
await page.getByRole('button', { name: /^Edit$/ }).first().click()
await page.locator('[data-testid="record-editor"]').waitFor({ timeout: 10000 })
const nControls = await page.locator('[data-testid="field-review"]').count()
check('every field of the edit form has a thumbs-up and a flag', nControls >= 4, `${nControls} fields with controls`)
const approve = page.locator('button[aria-label="Approve Description (German)"]')
const flag = page.locator('button[aria-label="Flag Description (German)"]')
check('the Description field has both buttons', (await approve.count()) === 1 && (await flag.count()) === 1)
await page.screenshot({ path: path.join(outDir, '2-edit-form-controls.png') })

// ---- thumbs-up saves at once, with the text it covers ----
const descriptionText = await page.locator('#edit-description\\.de').inputValue()
await approve.click()
await page.waitForFunction(() => document.querySelector('[data-testid="field-review"][data-state="approved"]'), null, { timeout: 8000 }).catch(() => {})
check('the thumbs-up wrote exactly one row', posted.length === 1, JSON.stringify(posted.map((p) => [p.verdict, p.field_path])))
check('the row says approved, for description.de, with the text that was approved', posted[0]?.verdict === 'approved' && posted[0]?.field_path === 'description.de' && posted[0]?.value_seen === descriptionText, String(posted[0]?.value_seen).slice(0, 60))
check('the control now reads "Approved by" with the reviewer and date', /Approved by QA check/.test(await page.locator('[data-testid="field-review"][data-state="approved"]').first().innerText()))
check('the thumbs-up button shows as pressed', (await approve.getAttribute('aria-pressed')) === 'true')

// ---- a change in the box holds the buttons back ----
await page.locator('#edit-description\\.de').fill(descriptionText + ' Zusatz.')
await page.waitForTimeout(200)
const flagDisabled = await flag.isDisabled()
check('while the Description box has an unsaved change, the flag waits and says why', flagDisabled && /Save your change/.test((await flag.getAttribute('title')) ?? ''), (await flag.getAttribute('title')) ?? '')
await page.locator('#edit-description\\.de').fill(descriptionText)
await page.waitForTimeout(200)

// ---- a flag asks what looks wrong, then saves ----
await flag.click()
const noteBox = page.locator('[data-testid="field-flag-note"]')
check('pressing the flag asks what looks wrong', (await noteBox.count()) === 1)
await noteBox.fill('Klingt, als hätte die Evolution ein Ziel')
await page.locator('[data-testid="field-flag-save"]').click()
await page.waitForFunction(() => document.querySelector('[data-testid="field-review"][data-state="flagged"]'), null, { timeout: 8000 }).catch(() => {})
const flagRow = posted[1]
check('the flag wrote a row with the note', flagRow?.verdict === 'flagged' && flagRow?.field_path === 'description.de' && /Ziel/.test(flagRow?.note ?? ''), JSON.stringify(flagRow))
check('the flag replaces the thumbs-up on that field (latest decision counts)', (await approve.getAttribute('aria-pressed')) === 'false' && (await flag.getAttribute('aria-pressed')) === 'true')
check('the flag shows who and what', /Flagged by QA check.*Ziel/.test(await page.locator('[data-testid="field-review"][data-state="flagged"]').first().innerText()))
await page.screenshot({ path: path.join(outDir, '3-flagged.png') })

// ---- taking the flag away, then approving again ----
await flag.click()
await page.waitForFunction(() => !document.querySelector('[data-testid="field-review"][data-state="flagged"]'), null, { timeout: 8000 }).catch(() => {})
check('pressing the flag again takes it away (a cleared row)', posted[2]?.verdict === 'cleared')
await approve.click()
await page.waitForFunction(() => document.querySelector('[data-testid="field-review"][data-state="approved"]'), null, { timeout: 8000 }).catch(() => {})
check('approving again writes a second approval', posted[3]?.verdict === 'approved')

// ---- leaving the form: the draft tag is gone from an approved text ----
await page.getByRole('button', { name: /^Cancel$/ }).click()
await page.waitForTimeout(500)
await openFullRecord()
const afterText = await cardText()
check('the "Claude draft" tag is gone from the approved description', !/Description.{0,400}Claude draft/i.test(afterText), afterText.match(/Description.{0,200}/i)?.[0] ?? '')
check('no flag summary shows, because the flag was taken away', (await page.locator('[data-testid="flagged-fields"]').count()) === 0)
await page.screenshot({ path: path.join(outDir, '4-card-after-approval.png') })

// ---- an approval for words that have changed since shows as out of date ----
standIn.push({ id: 'standin-old', base_repo: 'methodsbase', record_id: standIn[0].record_id, field_path: 'description.de', verdict: 'approved', value_seen: 'Ein früherer Wortlaut.', note: null, reviewed_by: 'u0', reviewed_at: new Date(Date.now() + 60000).toISOString(), exported_at: null, export_batch: null, reviewer: { name: 'Susan', email: null } })
await page.getByRole('button', { name: /^Edit$/ }).first().click()
await page.locator('[data-testid="record-editor"]').waitFor({ timeout: 10000 })
// the page reads reviews again after a save, so make it do that without writing: flag and clear another field
const otherFlag = page.locator('button[aria-label^="Flag "]').nth(1)
await otherFlag.click(); await page.locator('[data-testid="field-flag-save"]').click()
await page.waitForTimeout(800)
check('an approval of earlier words shows as "before the text changed"', (await page.locator('[data-testid="field-approval-outdated"]').count()) === 1)

// ---- the flagged field shows on the card ----
await page.getByRole('button', { name: /^Cancel$/ }).click()
await page.waitForTimeout(500)
check('the card says how many fields are flagged', (await page.locator('[data-testid="flagged-fields"]').count()) === 1, await page.locator('[data-testid="flagged-fields"]').innerText().catch(() => ''))

check('no other write left the page', otherWrites.length === 0, otherWrites.join(' | ').slice(0, 300))
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
