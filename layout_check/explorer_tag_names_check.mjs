#!/usr/bin/env node
// Checks the names of method tags in both languages (Dustin, 2026-11-13): the Tag names panel, adding a tag with one name from the panel
// and from the edit form, the "needs a ... name" marker, and the way the names are saved (one edit per name, record id "vocab:<field>").
// The edit table is an in-memory stand-in (as in explorer_edit_check.mjs), so no test row reaches the database.
//
// Usage: node layout_check/explorer_tag_names_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5272/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-tag-names')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const table = []
const posted = []
let nextId = 1
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
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
  return route.fulfill({ status: 405, headers: CORS })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const search = page.locator('input[aria-label="Search all fields"]')
const editor = page.locator('[data-testid="record-editor"]')
const lang = (name) => page.getByRole('group', { name: 'Language of the texts' }).first().getByRole('button', { name })

await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1200)
check('there is a Tag names button on the MethodsBase tab', (await page.getByTestId('open-tag-names').count()) === 1)
await page.getByTestId('open-tag-names').click()
const panel = page.getByTestId('tag-names-panel')
check('the panel shows a tag in both languages', (await panel.getByTestId('tag-name-learningApproaches-kooperativ-en').inputValue()) === 'Cooperative/social' && (await panel.getByTestId('tag-name-learningApproaches-kooperativ-de').inputValue()) === 'kooperativ/sozial')
check('Save is off until something changes', await page.getByTestId('save-tag-names').isDisabled())

// a new tag with an English name only
await panel.getByTestId('add-tag-en').fill('Open play')
await page.getByTestId('save-tag-names').click()
await page.waitForTimeout(900)
check('one name saved: the English name of the new tag, as a vocabulary edit', posted.length === 1 && posted[0].base_repo === 'methodsbase' && posted[0].record_id === 'vocab:learningApproaches' && posted[0].field_path === 'en|Open play' && posted[0].after_value === 'Open play', JSON.stringify(posted.map((p) => [p.record_id, p.field_path, p.after_value])))
check('the panel now shows the new tag with an empty German box', (await panel.getByTestId('tag-name-learningApproaches-Open play-en').inputValue()) === 'Open play' && (await panel.getByTestId('tag-name-learningApproaches-Open play-de').inputValue()) === '' && /needs a German name/.test((await panel.getByTestId('tag-name-learningApproaches-Open play-de').getAttribute('placeholder')) ?? ''))
await page.screenshot({ path: path.join(outDir, '1-tag-names-panel.png') })

// the edit form offers it, in English and in German
await search.fill('stationenlernen')
await page.waitForTimeout(500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
const optsEn = await editor.locator('#edit-learningApproaches option').allInnerTexts()
check('English form: the new tag is a choice, named Open play', optsEn.includes('Open play'), optsEn.join(', ').slice(-80))
await editor.getByRole('group', { name: /Language of the texts/ }).getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(300)
const optsDe = await editor.locator('#edit-learningApproaches option').allInnerTexts()
check('German form: the same tag is marked as needing a German name', optsDe.some((t) => t === 'Open play (needs a German name)'), optsDe.join(', ').slice(-100))

// a tag typed in the German form: new, named in German
await editor.getByTestId('new-tag-learningApproaches').fill('Freies Spiel')
await editor.getByRole('button', { name: 'Add tag' }).first().click()
check('the new tag shows as a chip and the form says its name is saved with the record', (await editor.getByRole('button', { name: /Freies Spiel/ }).count()) >= 1 && /1 tag name will be saved/.test(await editor.getByTestId('new-tag-note').innerText()))
await page.getByRole('button', { name: /Save 2 changes/ }).click()
await page.waitForTimeout(1000)
const sent = posted.slice(1).map((p) => `${p.record_id}:${p.field_path}`)
check('the name is saved first, then the record, which holds the tag as stored', sent.length === 2 && sent[0] === 'vocab:learningApproaches:de|Freies Spiel' && sent[1] === 'OE-METHOD-station-based-learning:learningApproaches' && posted[2].after_value.includes('Freies Spiel'), sent.join(' | '))
check('the table shows the new tag right away (German view)', (await page.locator('tbody tr').first().innerText()).includes('Freies Spiel'))
await lang('English').click()
await page.waitForTimeout(500)
check('English view shows the same tag by the only name it has', (await page.locator('tbody tr').first().innerText()).includes('Freies Spiel'))

// rename in the panel (it is still open above the table)
await panel.getByTestId('tag-name-learningApproaches-Open play-de').fill('Offenes Spiel')
await panel.getByTestId('tag-name-learningApproaches-kooperativ-en').fill('Collaborative')
await page.getByTestId('save-tag-names').click()
await page.waitForTimeout(900)
const renamed = posted.slice(3).map((p) => `${p.field_path}=${p.after_value}`).sort().join(' | ')
check('renaming saves one edit per changed name', renamed === 'de|Open play=Offenes Spiel | en|kooperativ=Collaborative', renamed)
const coop = posted.find((p) => p.field_path === 'en|kooperativ')
check('the old English name is kept in the log', coop.before_value === 'Cooperative/social')
await search.fill('kooperativ')
await page.waitForTimeout(500)
check('the English table now reads the new name of the taxonomy tag', (await page.locator('tbody').innerText()).includes('Collaborative'))
await page.getByRole('button', { name: /^Review( \(\d+\))?$/ }).click()
await page.getByRole('tab', { name: /Edits to send back/ }).click()
check('the edits to send back list the tag names by what they are', (await page.locator('main, .page').first().innerText()).includes('Tag names: learning approaches'))

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed ? `${failed} check(s) failed.` : 'All checks passed.')
process.exit(failed ? 1 : 0)
