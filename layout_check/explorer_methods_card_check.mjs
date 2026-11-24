#!/usr/bin/env node
// Checks the method card in the Base Repo Explorer (feedback cc545181, 2f29c925 and 02a5a3fc, Susan Hanisch, 2026-11-24):
//   - the "Claude draft" tag is gone on a description a person has edited and stays on one nobody has touched,
//   - every classroom method has a Materials row above the protocol steps ("Not set yet" while empty), a research method has none,
//   - the AI prompt template has a Copy button that puts the prompt on the clipboard, and Other info no longer repeats these fields,
//   - the edit form offers Materials in both languages for a classroom method.
// Read-only: the QA account is answered as admin for the one role request, nothing is saved. The examples are picked from the live data.
//
// Usage: node layout_check/explorer_methods_card_check.mjs [base] [outDir]    (default base http://localhost:5276/)

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5276/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-methods-card')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

// ---- Pick the examples from the live data (service key, read only) ----
const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? readFileSync(path.join(ROOT, '.supabase-secrets', 'service-role-key.txt'), 'utf8')).trim()
const H = { apikey: key, Authorization: `Bearer ${key}` }
const getAll = async (table, select, extra = '') => {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const page = await (await fetch(`${url}/rest/v1/${table}?select=${select}${extra}&offset=${from}&limit=1000`, { headers: H })).json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}
const snapshot = await getAll('methodsbase_snapshot', 'id,data')
const log = await getAll('base_repo_record_edits', 'record_id,field_path,is_reset,edited_at', '&base_repo=eq.methodsbase&order=edited_at.asc')
const edited = new Map() // record id -> Set of paths whose latest row is not a reset
for (const e of log) {
  const s = edited.get(e.record_id) ?? new Set()
  if (e.is_reset) s.delete(e.field_path); else s.add(e.field_path)
  edited.set(e.record_id, s)
}
const classes = (d) => (Array.isArray(d.methodClass) ? d.methodClass : [d.methodClass])
const germanDraft = (r) => r.data.textStatus?.de?.state === 'claude-draft-unreviewed' && !(r.data.textStatus?.de?.reviewedFields ?? []).includes('description') && r.data.description?.de
const withDe = (r) => typeof r.data.label?.de === 'string'
const draftEdited = snapshot.find((r) => withDe(r) && germanDraft(r) && edited.get(r.id)?.has('description.de'))
const draftPlain = snapshot.find((r) => withDe(r) && germanDraft(r) && classes(r.data).includes('pedagogical-practice') && !r.data.materials && r.data.protocolSteps?.de && ![...(edited.get(r.id) ?? [])].some((p) => p.startsWith('description')))
const withPrompt = snapshot.find((r) => withDe(r) && r.data.aiPromptTemplate?.de && r.data.materials?.de)
const research = snapshot.find((r) => withDe(r) && classes(r.data).length === 1 && classes(r.data)[0] === 'research-method' && !r.data.materials)
check('the live data has the four kinds of example this check needs', !!(draftEdited && draftPlain && withPrompt && research), [draftEdited?.id, draftPlain?.id, withPrompt?.id, research?.id].join(' | '))
if (!(draftEdited && draftPlain && withPrompt && research)) process.exit(1)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errors = []
const writes = []
page.on('pageerror', (e) => errors.push(e?.message ?? JSON.stringify(e)))
page.on('request', (r) => { if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS' && /rest\/v1\//.test(r.url())) writes.push(r.method() + ' ' + r.url()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
const go = async (u) => { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}) }
await go(base)
await mintQaSession(page, base)

const openMethods = async (lang) => {
  await page.evaluate((l) => localStorage.setItem('base-repo-explorer-language', l), lang)
  await go(base + '#/dashboard/admin/explore')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.locator('button', { hasText: /^All/ }).first().waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: /^MethodsBase/ }).click()
  await page.locator('thead th').first().waitFor({ timeout: 40000 })
  await page.waitForTimeout(1200)
}
const rowOf = (pg, name) => pg.locator('tbody tr', { has: pg.locator('td:first-child', { hasText: name }) }).first()
const openCard = async (name) => {
  await page.locator('input[aria-label="Search all fields"]').fill(name)
  await page.waitForTimeout(600)
  await rowOf(page, name).click()
  await page.waitForTimeout(600)
  if ((await page.locator('details[open] > summary', { hasText: 'Full record' }).count()) === 0) await page.locator('summary', { hasText: 'Full record' }).click()
  await page.waitForTimeout(300)
  const card = page.locator('.card[style*="sticky"]')
  return { card, text: (await card.innerText()).replace(/\s+/g, ' ') }
}
const order = (text, labels) => { const at = labels.map((l) => text.indexOf(l)); return at.every((x) => x >= 0) && at.every((x, i) => i === 0 || x > at[i - 1]) }
const chip = 'Claude draft, not yet reviewed by an expert'

await openMethods('de')

// 1. draft tag, per text a person has edited
let r = await openCard(draftEdited.data.label.de)
check(`no draft tag on the German description of "${draftEdited.data.label.de}", a text a person has edited`, !r.text.includes(chip), r.text.slice(0, 160))
await page.screenshot({ path: path.join(outDir, '1-edited-description-no-tag.png') })
r = await openCard(draftPlain.data.label.de)
check(`the draft tag stays on "${draftPlain.data.label.de}", whose description nobody has edited`, r.text.includes(chip))

// 2. Materials above the protocol steps, empty
check('a classroom method without materials shows the Materials row, empty, above the protocol steps', r.text.includes('MATERIALS Not set yet. Press Edit to add one.') && order(r.text, ['DESCRIPTION', 'MATERIALS', 'PROTOCOL STEPS']), r.text.slice(0, 400))
await page.screenshot({ path: path.join(outDir, '2-materials-empty.png') })
await r.card.getByRole('button', { name: 'Edit', exact: true }).click()
const editor = page.locator('[data-testid="record-editor"]')
await editor.waitFor({ timeout: 10000 })
const labels = (await editor.locator('label').allInnerTexts()).map((t) => t.trim().toLowerCase())
// The form shows the boxes of the language the page is set to (German here). The English box is covered by scripts/test_base_repo_edit_fields.mjs.
check('the edit form offers a Materials box between the description and the protocol steps', labels.some((l) => l.startsWith('materials (german)')) && labels.findIndex((l) => l.startsWith('description (german)')) < labels.findIndex((l) => l.startsWith('materials (german)')) && labels.findIndex((l) => l.startsWith('materials (german)')) < labels.findIndex((l) => l.startsWith('protocol steps (german)')), labels.filter((l) => /description|materials|protocol/.test(l)).join(' | '))
await page.screenshot({ path: path.join(outDir, '3-edit-form-materials.png') })
await page.getByRole('button', { name: /Cancel|Close/ }).first().click().catch(() => {})

// 3. a research method has no Materials row and no Materials box
r = await openCard(research.data.label.de)
check(`"${research.data.label.de}", a research method, shows no Materials row`, !/MATERIALS/.test(r.text))

// 4. materials, tips and the AI prompt in the card, with a Copy button
r = await openCard(withPrompt.data.label.de)
const wanted = ['DESCRIPTION', 'MATERIALS', 'PROTOCOL STEPS', ...(withPrompt.data.teacherTips ? ['TEACHER TIPS'] : []), 'AI PROMPT TEMPLATE']
check(`${wanted.slice(1).join(', ')} follow the description in that order`, order(r.text, wanted), wanted.map((l) => `${l}@${r.text.indexOf(l)}`).join(' '))
const copy = r.card.locator('[data-testid="copy-prompt"]')
check('the AI prompt template has a Copy button', (await copy.count()) === 1)
await page.screenshot({ path: path.join(outDir, '4-prompt-copy-button.png') })
const promptText = (await r.card.locator('[data-testid="ai-prompt-text"]').innerText()).trim()
await copy.click()
await page.waitForTimeout(400)
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('clicking Copy puts the prompt on the clipboard', clip.trim() === promptText && promptText.length > 40, `${clip.length} characters copied`)
check('the button says Copied afterwards', (await copy.innerText()).trim() === 'Copied')
const otherInfo = r.card.locator('details', { has: page.locator('summary', { hasText: 'Other info' }) }).last()
await otherInfo.locator('summary', { hasText: 'Other info' }).click()
const other = (await otherInfo.innerText()).replace(/\s+/g, ' ')
check('Other info no longer repeats Materials, Teacher tips or the AI prompt template', !/MATERIALS|TEACHER TIPS|AI PROMPT TEMPLATE|WORKED EXAMPLE/i.test(other), other.slice(0, 200))

check('no page error', errors.length === 0, errors.join(' | ').slice(0, 200))
check('nothing is written to the database', writes.length === 0, writes.join(' | ').slice(0, 200))
await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
