#!/usr/bin/env node
// Checks "Add entry" and the always-visible Sources row in the Base Repo Explorer (feedback 5016dccd and 3db809fe, Susan Hanisch, 2026-11-18).
// Nothing is written to the database. The QA account is answered as admin for the one role request, and the one write the flow makes (the edit
// log of MethodsBase) is caught in the browser and answered as saved. A stand-in list of those rows is served back on the next read, so the page
// behaves as it would after a save.
//
// Usage: node layout_check/explorer_add_entry_check.mjs [base] [outDir]   (needs SUPABASE_SERVICE_ROLE_KEY, or .supabase-secrets/service-role-key.txt)

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5276/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-add-entry')
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
page.on('pageerror', (e) => errors.push(e?.message ?? JSON.stringify(e)))
page.on('request', (r) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !/base_repo_record_edits|base_repo_review_targets/.test(r.url()) && !/student_activity_events|auth\/v1/.test(r.url())) otherWrites.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
await page.route((u) => /\/rest\/v1\/base_repo_record_edits$/.test(u.pathname), async (route) => {
  const req = route.request()
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'POST') {
    const rows = req.postDataJSON()
    for (const r of Array.isArray(rows) ? rows : [rows]) {
      posted.push(r)
      standIn.push({ ...r, id: `standin-${standIn.length}`, edited_at: new Date().toISOString(), exported_at: null, export_batch: null, editor: { name: 'QA check', email: null } })
    }
    return route.fulfill({ status: 201, headers: cors, body: '' })
  }
  const res = await route.fetch()
  const json = await res.json()
  const mine = standIn.filter((r) => r.base_repo === (new URL(req.url()).searchParams.get('base_repo') ?? '').replace(/^eq\./, ''))
  await route.fulfill({ status: res.status(), contentType: 'application/json', headers: { ...res.headers(), ...cors }, body: JSON.stringify(Array.isArray(json) ? [...json, ...mine] : json) })
})

// Opening a card registers an empty review target for the record when it has none. For the stand-in entry that is answered here too, so the
// check leaves nothing behind.
await page.route((u) => /\/rest\/v1\/base_repo_review_targets$/.test(u.pathname), async (route) => {
  const req = route.request()
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'POST') return route.fulfill({ status: 201, headers: { ...cors, 'content-type': 'application/vnd.pgrst.object+json' }, body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }) })
  return route.continue()
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.evaluate(() => localStorage.setItem('base-repo-explorer-language', 'en'))
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.locator('thead th').first().waitFor({ timeout: 40000 })
await page.waitForTimeout(1500)

const search = page.locator('input[aria-label="Search all fields"]')
const card = () => page.locator('.card[style*="sticky"]')
const openCard = async (name) => {
  await search.fill(name)
  await page.waitForTimeout(600)
  await page.locator('tbody tr', { has: page.locator('td:first-child', { hasText: name }) }).first().click()
  await page.waitForTimeout(600)
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
  return (await card().innerText()).replace(/\s+/g, ' ')
}

// ---- Sources row (3db809fe) ----
const rows = await page.locator('tbody tr').count()
let text = await openCard('Teaching genetic drift')
check('a method with no sources shows a Sources row that says so', /SOURCES None yet\. Press Edit to add one\./i.test(text), text.slice(0, 260))
await page.screenshot({ path: path.join(outDir, '1-sources-none-yet.png') })
text = await openCard("Tinbergen's Questions")
check('a method with sources lists them under Sources, without "None yet"', /SOURCES/i.test(text) && !/SOURCES None yet/i.test(text), text.match(/SOURCES.{0,160}/i)?.[0] ?? '')
check('the old wording "Primary sources" is gone from the card', !/Primary sources/i.test(text))
await search.fill('')

// ---- the edit form calls the box Sources ----
await openCard('Teaching genetic drift')
await page.getByRole('button', { name: 'Edit', exact: true }).click()
const editor = page.locator('[data-testid="record-editor"]')
await editor.waitFor({ timeout: 10000 })
const labels = (await editor.locator('label').allInnerTexts()).map((t) => t.trim().toLowerCase())
check('the edit form has a box called Sources', labels.some((l) => l.startsWith('sources')), labels.join(' | ').slice(0, 200))
await page.getByRole('button', { name: /^Cancel$/ }).first().click()
await search.fill('')

// ---- Add entry (5016dccd) ----
const addBtn = page.locator('[data-testid="open-new-entry"]')
check('the Methods tab has an Add entry button', (await addBtn.count()) === 1)
await addBtn.click()
const panel = page.locator('[data-testid="new-entry-panel"]')
await panel.waitFor({ timeout: 5000 })
const create = panel.locator('[data-testid="create-entry"]')
check('Create is disabled while the title is empty', await create.isDisabled())
await panel.locator('#new-entry-title').fill('ABC Method')
await page.waitForTimeout(300)
check('a title that is taken is refused with a plain message', (await panel.locator('[data-testid="new-entry-problem"]').innerText().catch(() => '')).includes('already exists') && (await create.isDisabled()))
const title = 'Check entry: model a tree with Straws'
await panel.locator('#new-entry-title').fill(title)
await page.waitForTimeout(300)
check('a free title shows the permanent id it will get', (await panel.innerText()).includes('OE-METHOD-check-entry-model-a-tree-with-straws'))
await page.screenshot({ path: path.join(outDir, '2-add-panel.png') })
await create.click()
await page.locator('[data-testid="record-editor"]').waitFor({ timeout: 15000 })
check('creating it saves the marker row and the English title, nothing else', posted.length === 2 && posted[0].field_path === '$new' && posted[1].field_path === 'label.en' && posted[1].after_value === title && posted.every((r) => r.base_repo === 'methodsbase' && r.record_id === 'OE-METHOD-check-entry-model-a-tree-with-straws'), JSON.stringify(posted).slice(0, 300))
check('the marker holds the id, slug, method class and status the repo needs', posted[0]?.after_value?.id === 'OE-METHOD-check-entry-model-a-tree-with-straws' && posted[0]?.after_value?.slug === 'check-entry-model-a-tree-with-straws' && posted[0]?.after_value?.status === 'active' && posted[0]?.after_value?.methodClass === 'pedagogical-practice', JSON.stringify(posted[0]?.after_value))
const edLabels = await page.locator('[data-testid="record-editor"] input#edit-label\\.en, [data-testid="record-editor"] [id="edit-label.en"]').first().inputValue().catch(() => '')
check('the edit form opens on the new entry with its English title filled in', edLabels === title, edLabels)
await page.screenshot({ path: path.join(outDir, '3-new-entry-in-edit-form.png') })
await page.getByRole('button', { name: /^Cancel$/ }).first().click()
const chip = await page.locator('[data-testid="new-entry-chip"]').innerText().catch(() => '')
check('the card says it is a new entry that is only in OpenLPM', /new entry, only in OpenLPM/.test(chip) && /waiting to be added to the repo/.test(chip), chip)
await search.fill('straws')
await page.waitForTimeout(600)
const listed = await page.locator('tbody tr td:first-child', { hasText: title }).count()
check('the new entry is in the table', listed === 1, `${listed} rows for the new title`)
await page.screenshot({ path: path.join(outDir, '4-new-entry-in-table.png') })
await search.fill('')
await page.waitForTimeout(600)
const after = await page.locator('tbody tr').count()
check('the table has exactly one more row than before', after === rows + 1, `${rows} -> ${after}`)

// a second try with the same title is now refused
await addBtn.click()
await page.locator('[data-testid="new-entry-panel"] #new-entry-title').fill(title)
await page.waitForTimeout(300)
check('the same title cannot be added twice', (await page.locator('[data-testid="new-entry-problem"]').innerText().catch(() => '')).includes('already exists'))

check('no page error', errors.length === 0, errors.join(' | ').slice(0, 200))
check('nothing was written anywhere except the caught edit-log rows', otherWrites.length === 0, otherWrites.join(' | ').slice(0, 200))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
