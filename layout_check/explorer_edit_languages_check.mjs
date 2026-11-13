#!/usr/bin/env node
// Checks that the Base Repo edit form works in both languages (Dustin, 2026-11-13: "edit all of the metadata for any given entry in
// either language"). The form follows the English/German switch, shows the other language in grey under each text, keeps what was typed
// in either language while switching, and saves one change per field and language. Covers a method (texts, discipline, tags), a competency
// (statement, indicators, grade bands), a lesson (title) and a repo that has English text only.
// The edit table is answered by an in-memory stand-in (as in explorer_edit_check.mjs), so no test row reaches the real database.
//
// Usage: node layout_check/explorer_edit_languages_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5272/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-edit-languages')
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

// Real records to work on: a method with an English description and discipline but no German description.
const anon = readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const supaUrl = readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const token = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('-auth-token')); return JSON.parse(localStorage.getItem(k)).access_token })
const rest = async (q) => (await fetch(`${supaUrl}/rest/v1/${q}`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })).json()
const methods = await rest('methodsbase_snapshot?select=id,data&limit=500')
const candidate = methods.find((m) => m.data?.description?.en && !m.data?.description?.de && typeof m.data?.discipline === 'string' && m.data?.label?.en)
check('there is a method with English text only to work on', !!candidate, candidate?.id)
const comp = (await rest('competencybase_snapshot?select=id,data&id=eq.OE-COMPETENCY-critical-ai-literacy-cail'))[0]
check('the Critical AI Literacy competency is there, with indicators and grade bands', !!comp?.data?.indicators && !!comp?.data?.developmentalProgression)

await page.goto(base + '#/dashboard/admin/explore', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const search = page.locator('input[aria-label="Search all fields"]')
const editor = page.locator('[data-testid="record-editor"]')
const labelsOf = async () => (await editor.locator('label').allInnerTexts()).map((t) => t.trim().toLowerCase())
const switchIn = (name) => editor.getByRole('group', { name: /Language of the texts/ }).getByRole('button', { name })
const openFullRecord = async () => { const d = page.locator('.card[style*="sticky"] details').first(); if (!(await d.evaluate((el) => el.open))) await d.locator('summary').first().click() }

// ---- a method ----
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(1200)
await search.fill(candidate.data.label.en)
await page.waitForTimeout(500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
check('the form opens', (await editor.count()) === 1)
let labels = await labelsOf()
check('English view: the English boxes are there and the German ones are not', labels.some((l) => l.startsWith('description (english)')) && labels.some((l) => l.startsWith('label (english)')) && labels.some((l) => l.startsWith('discipline (english)')) && !labels.some((l) => /\(german\)/.test(l)), labels.join(' | ').slice(0, 200))
check('the form has its own English/German switch, English is on', (await switchIn('English').getAttribute('class'))?.includes('active') === true)
const greyEn = await editor.locator('[data-testid="other-language-text"]').allInnerTexts()
check('under the English description the grey line says there is no German text yet', greyEn.some((t) => /German:\s*no German text yet/i.test(t)), greyEn.join(' || ').slice(0, 200))
const tagOptions = await editor.locator('#edit-learningApproaches option').allInnerTexts()
check('English view: tags are named in English', tagOptions.some((t) => /Cooperative|Problem-based|Digital|Self-regulated|Creative/.test(t)) && !tagOptions.some((t) => /kooperativ|problembasiert/.test(t)), tagOptions.join(', ').slice(0, 160))
// the language switch stays in view while the long form is scrolled
await page.locator('.card[style*="sticky"]').evaluate((el) => { el.scrollTop = 600 })
await page.waitForTimeout(200)
const stuck = await page.evaluate(() => { const c = document.querySelector('.card[style*="sticky"]').getBoundingClientRect(); const h = document.querySelector('[data-testid="editing-language"]').getBoundingClientRect(); return { dy: h.top - c.top, h: h.height } })
check('the language switch stays at the top of the card while the form is scrolled', stuck.dy >= -2 && stuck.dy <= 4, JSON.stringify(stuck))
await page.locator('.card[style*="sticky"]').evaluate((el) => { el.scrollTop = 0 })
await page.screenshot({ path: path.join(outDir, '1-method-english.png') })

await switchIn('German').click()
await page.waitForTimeout(500)
labels = await labelsOf()
check('German view: the German boxes are there and the English ones are not', labels.some((l) => l.startsWith('description (german)')) && labels.some((l) => l.startsWith('discipline (german)')) && !labels.some((l) => /\(english\)/.test(l)), labels.join(' | ').slice(0, 200))
check('the page itself switched to German with the form', (await page.getByRole('group', { name: 'Language of the texts' }).first().locator('button.active').first().innerText()) === 'German')
const tagOptionsDe = await editor.locator('#edit-learningApproaches option').allInnerTexts()
check('German view: tags are named in German', tagOptionsDe.some((t) => /kooperativ|problembasiert|digital|selbstreguliert|kreativ/.test(t)) && !tagOptionsDe.some((t) => /Cooperative|Problem-based/.test(t)), tagOptionsDe.join(', ').slice(0, 160))
const greyDe = await editor.locator('[data-testid="other-language-text"]').allInnerTexts()
check('under the German description the grey line shows the English text', greyDe.some((t) => t.includes('English:') && t.includes(candidate.data.description.en.slice(0, 30))), greyDe.join(' || ').slice(0, 200))
const deDesc = editor.locator('#edit-description\\.de')
check('the German description box is empty and says so', (await deDesc.inputValue()) === '' && /Not written in German yet/.test((await deDesc.getAttribute('placeholder')) ?? ''))
await deDesc.fill('Eine deutsche Beschreibung für den Test.')
await editor.locator('#edit-discipline\\.de').fill('Biologie (Test)')
await page.screenshot({ path: path.join(outDir, '2-method-german.png') })

await switchIn('English').click()
await page.waitForTimeout(400)
const greyBack = await editor.locator('[data-testid="other-language-text"]').allInnerTexts()
check('back in English, the grey line shows what was just typed in German', greyBack.some((t) => t.includes('Eine deutsche Beschreibung')), greyBack.join(' || ').slice(0, 200))
check('and the form says two changes wait in German', /2 of the changes are in German/.test(await editor.locator('[data-testid="hidden-language-changes"]').innerText()))
check('the English box still holds the English text', (await editor.locator('#edit-description\\.en').inputValue()).startsWith(candidate.data.description.en.slice(0, 30)))
await page.getByRole('button', { name: /Save 2 changes/ }).click()
await page.waitForTimeout(1000)
const paths = posted.map((r) => r.field_path).sort().join()
check('two changes are saved, one per German field, nothing in English', paths === 'description.de,discipline.de', paths)
const dEdit = posted.find((r) => r.field_path === 'discipline.de')
check('the discipline edit holds the German line and the empty text it replaced', dEdit.after_value === 'Biologie (Test)' && (dEdit.before_value === '' || dEdit.before_value === null), JSON.stringify([dEdit.before_value, dEdit.after_value]))

// the card shows the German text in German and keeps the English in English
await page.getByRole('group', { name: 'Language of the texts' }).first().getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(500)
await openFullRecord()
let card = await page.locator('.card[style*="sticky"]').innerText()
check('German card shows the German description and discipline', card.includes('Eine deutsche Beschreibung') && card.includes('Biologie (Test)'), card.slice(0, 300).replace(/\s+/g, ' '))
await page.getByRole('group', { name: 'Language of the texts' }).first().getByRole('button', { name: 'English' }).click()
await page.waitForTimeout(500)
card = await page.locator('.card[style*="sticky"]').innerText()
check('English card still shows the English discipline and no German text', card.includes(candidate.data.discipline) && !card.includes('Biologie (Test)') && !card.includes('Eine deutsche Beschreibung'))

// ---- a competency ----
await page.getByRole('button', { name: /^CompetencyBase/ }).click()
await page.waitForTimeout(1500)
await search.fill('critical ai literacy')
await page.waitForTimeout(600)
// the top competency of that word list: its code is exactly CAIL. The sub-competencies have longer codes.
await page.locator('tbody tr', { has: page.locator('td', { hasText: /^CAIL$/ }) }).first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
labels = await labelsOf()
check('competency, English: statement, indicators and the grade bands', labels.some((l) => l.startsWith('statement (english)')) && labels.some((l) => l.startsWith('indicators (english)')) && labels.some((l) => l.startsWith('developmental progression, grades k-2 (english)')) && labels.some((l) => l.startsWith('developmental progression, grades 13-16 (english)')), labels.join(' | ').slice(0, 260))
check('fields that do not depend on a language are folded away', (await editor.locator('[data-testid="other-fields"]').count()) === 1 && !(await editor.locator('[data-testid="other-fields"]').evaluate((el) => el.open)))
await switchIn('German').click()
await page.waitForTimeout(400)
await editor.locator('#edit-indicators\\.de').fill('Nennt ein bestimmtes KI-System\nPrüft eine KI-Aussage an einer unabhängigen Quelle')
await editor.locator('#edit-statement\\.de').fill('Kritische KI-Kompetenz (Test)')
await page.screenshot({ path: path.join(outDir, '3-competency-german.png') })
await page.getByRole('button', { name: /Save 2 changes/ }).click()
await page.waitForTimeout(900)
const compPaths = posted.slice(2).map((r) => r.field_path).sort().join()
check('competency: the statement and the indicators are saved as German texts', compPaths === 'indicators.de,statement.de', compPaths)
const ind = posted.find((r) => r.field_path === 'indicators.de')
check('the indicators are stored as a list of two', Array.isArray(ind.after_value) && ind.after_value.length === 2, JSON.stringify(ind.after_value))
await openFullRecord()
card = await page.locator('.card[style*="sticky"]').innerText()
check('German card lists the German indicators', card.includes('Nennt ein bestimmtes KI-System') && !card.includes('Names a specific AI system'), card.slice(0, 200).replace(/\s+/g, ' '))
await page.getByRole('group', { name: 'Language of the texts' }).first().getByRole('button', { name: 'English' }).click()
await page.waitForTimeout(500)
card = await page.locator('.card[style*="sticky"]').innerText()
check('English card keeps the English indicators', card.includes('Names a specific AI system') && !card.includes('Nennt ein bestimmtes KI-System'))
check('the table shows the German statement in the German view', await (async () => {
  await page.getByRole('group', { name: 'Language of the texts' }).first().getByRole('button', { name: 'German' }).click()
  await page.waitForTimeout(500)
  return (await page.locator('tbody tr', { has: page.locator('td', { hasText: /^CAIL$/ }) }).first().innerText()).includes('Kritische KI-Kompetenz (Test)')
})())

// ---- a lesson ----
await search.fill('')
await page.getByRole('button', { name: /^TeachingBase/ }).click()
await page.waitForTimeout(1500)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(600)
check('a lesson has an Edit button now', (await page.getByRole('button', { name: 'Edit', exact: true }).count()) === 1)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
labels = await labelsOf()
check('lesson, German view: title and description in German', labels.some((l) => l.startsWith('title (german)')) && labels.some((l) => l.startsWith('description (german)')) && !labels.some((l) => /\(english\)/.test(l)), labels.join(' | ').slice(0, 200))
await editor.locator('#edit-title\\.de').fill('Titel für den Test')
await page.getByRole('button', { name: /Save 1 change/ }).click()
await page.waitForTimeout(900)
check('lesson: the German title is saved under title.de', posted[posted.length - 1].field_path === 'title.de' && posted[posted.length - 1].base_repo === 'teachingbase')
check('the lesson card heading shows the new German title', (await page.locator('.card[style*="sticky"] h3').first().innerText()).includes('Titel für den Test'))
await page.locator('[data-testid="edit-history"] summary').click()
check('the history names the field as "Title (German)"', (await page.locator('[data-testid="edit-history"]').innerText()).includes('Title (German)'))

// ---- a repo with English text only ----
await page.getByRole('button', { name: /^QuestionBase/ }).click()
await page.waitForTimeout(1200)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Edit', exact: true }).click()
check('QuestionBase: says it holds English only and has no language switch', (await editor.locator('[data-testid="english-only-note"]').count()) === 1 && (await editor.getByRole('group', { name: /Language of the texts/ }).count()) === 0)

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed ? `${failed} check(s) failed.` : 'All checks passed.')
process.exit(failed ? 1 : 0)
