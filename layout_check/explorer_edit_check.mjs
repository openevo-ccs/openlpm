#!/usr/bin/env node
// Checks in-app editing of Base Repo records (feedback 0afc62a5, Susan Hanisch 2026-11-08; migration 237) in a browser.
// The edit table is answered by an in-memory stand-in for the one URL /rest/v1/base_repo_record_edits, so the whole flow can be
// checked before the migration is applied, and so no test row ever reaches the real database. Everything else (the snapshot records)
// is read from the real project. The QA account is answered as admin for the one role request, as in the other checks.
//
// Usage: node layout_check/explorer_edit_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5199/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-edit')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

// ---- stand-in for the edit table ----
const table = []
const posted = []
let nextId = 1
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: CORS }))
await page.route((u) => u.pathname.endsWith('/rest/v1/base_repo_record_edits'), async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  if (req.method() === 'GET') {
    const repo = (url.searchParams.get('base_repo') || '').replace('eq.', '')
    const rows = table.filter((r) => r.base_repo === repo).map((r) => ({ ...r, editor: { name: 'Test Admin', email: 'admin@example.org' } }))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows), headers: { ...CORS, 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } })
  }
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '[]')
    for (const r of Array.isArray(body) ? body : [body]) {
      posted.push(r)
      table.push({ id: `edit-${nextId++}`, edited_at: new Date(Date.now() + nextId * 1000).toISOString(), exported_at: null, export_batch: null, note: null, ...r })
    }
    return route.fulfill({ status: 201, headers: CORS })
  }
  if (req.method() === 'PATCH') {
    const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',')
    const patch = JSON.parse(req.postData() || '{}')
    for (const r of table) if (ids.includes(r.id)) Object.assign(r, patch)
    return route.fulfill({ status: 204, headers: CORS })
  }
  return route.fulfill({ status: 405, headers: CORS })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const search = page.locator('input[aria-label="Search all fields"]')

// ---- a method: add a learning approach tag and reword the description ----
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1200)
await search.fill('stationenlernen')
await page.waitForTimeout(500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
const editor = page.locator('[data-testid="record-editor"]')
check('edit form opens inside the card', (await editor.count()) === 1)
const labels = (await editor.locator('label').allInnerTexts()).map((t) => t.trim().toLowerCase())
check('form offers Method-class and Learning approaches even though this method has no tag', labels.some((l) => l.startsWith('method-class')) && labels.some((l) => l.startsWith('learning approaches')), labels.join(' | '))
check('form offers the description in the record\'s own language', labels.some((l) => l.startsWith('description (english)')))
check('Save is off until something changes', await page.getByRole('button', { name: /Save \(no changes yet\)/ }).isDisabled())
await page.screenshot({ path: path.join(outDir, 'editor-open.png') })

const tags = editor.locator('#edit-learningApproaches')
// the tags are picked from a menu, named in the language of the form (English here), and stored once
await tags.selectOption({ label: 'Creative' })
const desc = editor.locator('#edit-description\\.en')
const oldDesc = await desc.inputValue()
await desc.fill(oldDesc + ' Students choose their own order.')
await editor.locator('#edit-note').fill('Susan 8 Nov: more practical')
await page.getByRole('button', { name: /Save 2 changes/ }).click()
await page.waitForTimeout(1000)
check('two edits sent, one per changed field', posted.length === 2 && posted.map((r) => r.field_path).sort().join() === 'description.en,learningApproaches', posted.map((r) => r.field_path).join())
const tagEdit = posted.find((r) => r.field_path === 'learningApproaches')
check('tag edit stores before and after as lists, with the tag as stored (German)', Array.isArray(tagEdit.before_value) && JSON.stringify(tagEdit.after_value) === JSON.stringify([...tagEdit.before_value, 'kreativ']), JSON.stringify([tagEdit.before_value, tagEdit.after_value]))
check('note, record and repo are stored', tagEdit.note === 'Susan 8 Nov: more practical' && tagEdit.base_repo === 'methodsbase' && tagEdit.record_id === 'OE-METHOD-station-based-learning' && !!tagEdit.edited_by && tagEdit.is_reset === false, `${tagEdit.record_id} by ${tagEdit.edited_by}`)

check('table shows the new tag right away', (await page.locator('tbody tr').first().innerText()).includes('Creative'))
const cardText = await page.locator('.card[style*="sticky"]').innerText()
check('card says it was edited and is waiting to be sent back', cardText.includes('edited in OpenLPM') && cardText.includes('2 waiting to be sent back'))
check('the Review button shows a count of what waits', /Review \(\d+\)/.test(await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).innerText()))
await page.locator('[data-testid="edit-history"] summary').click()
const hist = await page.locator('[data-testid="edit-history"]').innerText()
check('history shows who, what, before and now', hist.includes('Test Admin') && hist.includes('Learning approaches') && hist.includes('Before:') && hist.includes('kreativ'))
await page.screenshot({ path: path.join(outDir, 'after-save.png') })

// ---- only edited ----
await search.fill('')
await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).click()
await page.getByRole('tab', { name: /Edits to send back/ }).click()
check('the Review space counts 2 edits to send back', (await page.getByRole('tab', { name: /Edits to send back \(2\)/ }).count()) === 1)
await page.getByRole('button', { name: 'Show the edited records in the table' }).click()
await page.waitForTimeout(400)
check('"Edited only" lists just the edited record', (await page.locator('tbody tr').count()) === 1)
await page.getByRole('button', { name: 'Edited only ×' }).click()

// ---- put one field back ----
await page.locator('[data-testid="edit-history"] summary').click()
const undoButtons = page.getByRole('button', { name: /Put back to the repo copy/ })
await undoButtons.first().click()
await page.waitForTimeout(900)
const reset = posted[posted.length - 1]
check('undo adds a reset row, nothing is deleted', reset.is_reset === true && table.length === 3, `${table.length} rows, reset of ${reset.field_path}`)
await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).click()
check('the Review space now counts 1 edit to send back', (await page.getByRole('tab', { name: /Edits to send back \(1\)/ }).count()) === 1)
await page.getByRole('button', { name: /^Back to/ }).click()

// ---- a literature record: title edit changes the table and the citation ----
await page.getByRole('button', { name: /^LiteratureBase/ }).click()
await page.waitForTimeout(1500)
await search.fill('gentner structure-mapping')
await page.waitForTimeout(500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
await page.locator('#edit-citation\\.year').fill('1984')
await page.getByRole('button', { name: /Save 1 change/ }).click()
await page.waitForTimeout(900)
check('literature edit stored under the citation path', posted[posted.length - 1].field_path === 'citation.year' && posted[posted.length - 1].after_value === '1984')
check('citation box shows the edited year', (await page.locator('[data-testid="apa-citation"]').innerText()).includes('Gentner, D. (1984).'))
check('table year column shows the edited year', (await page.locator('tbody tr').first().innerText()).includes('1984'))

// ---- send back ----
await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).click()
await page.getByRole('tab', { name: /Edits to send back \(2\)/ }).click()
const panel = page.locator('[data-testid="edits-export"]')
check('panel lists the two waiting edits (the undone description is not on it)', (await panel.innerText()).includes('learningApproaches') && !(await panel.innerText()).includes('description.en') && (await panel.innerText()).includes('citation.year'))
const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download file' }).click()])
const fs = await import('node:fs')
const file = path.join(outDir, 'downloaded.json')
await download.saveAs(file)
const json = JSON.parse(fs.readFileSync(file, 'utf8'))
check('downloaded file has the batch, both edits and their labels', json.kind === 'openlpm-base-repo-edits' && json.edits.length === 2 && json.edits.every((e) => e.record_label && e.field_path), `${json.edits.length} edits`)
await panel.getByRole('button', { name: 'Mark as sent back' }).click()
await page.waitForTimeout(900)
check('marking sends the batch name and a time', table.filter((r) => r.exported_at).length >= 2 && table.some((r) => r.export_batch === json.batch))
check('the section counts 0 afterwards', (await page.getByRole('tab', { name: /Edits to send back \(0\)/ }).count()) === 1)
await page.getByRole('button', { name: /^Back to/ }).click()
await page.waitForTimeout(500)
check('back in the repo view the edits stay visible', (await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).count()) === 1 && (await page.locator('tbody tr').first().innerText()).includes('1984'))
await page.screenshot({ path: path.join(outDir, 'after-send-back.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
