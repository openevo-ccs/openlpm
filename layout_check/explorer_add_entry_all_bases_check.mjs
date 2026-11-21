#!/usr/bin/env node
// Checks "Add entry" on every tab of the Base Repo Explorer (feedback 5016dccd, Susan Hanisch, 2026-11-21: "each base could have that option, with
// the only restriction regarding fields maybe being the name/label"). For each base: the button is there, only a name is asked for, the id follows
// the rule of that base, the saved rows are the marker plus the name at the path of that base, and the edit form opens on the new entry.
// Nothing is written: the one write (the edit log) is caught in the browser and answered as saved, and a stand-in list is served back on the next read.
//
// Usage: node layout_check/explorer_add_entry_all_bases_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5277/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-add-entry-all')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CASES = [
  { tab: /^MethodsBase/, noun: 'method', name: 'Zz test method for the check', id: 'OE-METHOD-zz-test-method-for-the-check', repo: 'methodsbase', path: 'label.en' },
  { tab: /^TheoryBase/, noun: 'theory', name: 'Zz test theory for the check', id: 'OE-THEORY-zz-test-theory-for-the-check', repo: 'theorybase', path: 'label' },
  { tab: /^LiteratureBase/, noun: 'reference', name: 'Zz test work for the check', id: 'OE-LITERATURE-zz-test-work-for-the-check', repo: 'literaturebase', path: 'citation.title' },
  { tab: /^QuestionBase/, noun: 'question', name: 'Zz test question for the check', id: 'OE-QUESTION-zz-test-question-for-the-check', repo: 'questionbase', path: 'label' },
  { tab: /^QuoteBase/, noun: 'quote', name: 'Zz test quote for the check and then some more words', id: 'OE-QUOTE-zz-test-quote-for-the-check-and-then', repo: 'quotebase', path: 'text' },
  { tab: /^CompetencyBase/, noun: 'competency', name: 'Zz test competency for the check and more words', id: 'OE-COMPETENCY-zz-test-competency-for-the-check-and-more', repo: 'competencybase', path: 'statement.en' },
  { tab: /^ProjectBase/, noun: 'project', name: 'Zz test project for the check', id: 'project:zz-test-project-for-the-check', repo: 'projectbase', path: 'label' },
  { tab: /^TeachingBase/, noun: 'lesson page', name: 'Zz test lesson for the check', id: 'zz-test-lesson-for-the-check', repo: 'teachingbase', path: 'title.en' },
]

const table = []
let posted = []
let nextId = 1
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e?.stack ?? String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: CORS }))
await page.route((u) => u.pathname.endsWith('/rest/v1/base_repo_record_edits'), async (route) => {
  const req = route.request(); const url = new URL(req.url())
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  if (req.method() === 'GET') {
    const repo = (url.searchParams.get('base_repo') || '').replace('eq.', '')
    const rows = table.filter((r) => r.base_repo === repo).map((r) => ({ ...r, editor: { name: 'Test Admin', email: 'admin@example.org' } }))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows), headers: { ...CORS, 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } })
  }
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '[]')
    for (const r of Array.isArray(body) ? body : [body]) { posted.push(r); table.push({ id: `edit-${nextId++}`, edited_at: new Date(Date.now() + nextId * 1000).toISOString(), exported_at: null, export_batch: null, note: null, ...r }) }
    return route.fulfill({ status: 201, headers: CORS })
  }
  return route.fulfill({ status: 204, headers: CORS })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

for (const c of CASES) {
  console.log(`\n-- ${c.repo}`)
  posted = []
  await page.getByRole('button', { name: c.tab }).click()
  await page.waitForTimeout(500)
  await page.getByText('Loading…').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {})
  const open = page.locator('[data-testid="open-new-entry"]')
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="open-new-entry"]'); return !!b && !b.disabled }, null, { timeout: 60000 }).catch(() => {})
  check(`${c.repo}: Add entry button is there`, (await open.count()) === 1)
  if ((await open.count()) !== 1) continue
  check(`${c.repo}: its hover text names the noun "${c.noun}"`, ((await open.getAttribute('title')) || '').includes(c.noun), (await open.getAttribute('title')) || '')
  await open.click()
  const panel = page.locator('[data-testid="new-entry-panel"]')
  check(`${c.repo}: the panel asks for a name only`, (await panel.count()) === 1 && (await panel.locator('input').count()) === 1, await panel.locator('h3').innerText().catch(() => ''))
  await panel.locator('#new-entry-title').fill(c.name)
  await page.waitForTimeout(200)
  const text = await panel.innerText()
  check(`${c.repo}: the proposed id follows the rule of that base`, text.includes(c.id), c.id)
  await page.getByTestId('create-entry').click()
  await page.waitForTimeout(1500)
  check(`${c.repo}: the marker row and the name row were saved, at the right path`, posted.length === 2 && posted[0].field_path === '$new' && posted[1].field_path === c.path && posted.every((r) => r.base_repo === c.repo && r.record_id === c.id), posted.map((r) => r.field_path).join(','))
  check(`${c.repo}: the name is stored as typed`, posted[1]?.after_value === c.name)
  check(`${c.repo}: the edit form opens on the new entry`, (await page.locator('[data-testid="record-editor"]').count()) === 1)
  check(`${c.repo}: the card says it is a new entry only in OpenLPM`, (await page.getByTestId('new-entry-chip').count()) === 1)
  await page.screenshot({ path: path.join(outDir, `${c.repo}.png`) })
  const cancel = page.getByRole('button', { name: /^Cancel$/ })
  if (await cancel.count()) await cancel.first().click().catch(() => {})
}

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 900))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
