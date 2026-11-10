#!/usr/bin/env node
// Checks how methods show in two languages (Susan's feedback 61ee72d3, a3408216, 6cffd929) in a browser with the standing QA account.
// The method data comes from a local MethodsBase checkout and is handed to the page in place of the database answer, so the live
// database stays unchanged and the check works before and after the live copy is refreshed.
//
// Usage: node layout_check/methods_language_check.mjs [base] [methodsbasePath] [outDir]
//   base defaults to http://localhost:5199/ (run `npx vite preview --port 5199` after `npm run build`).
//   methodsbasePath defaults to ../methodsbase.

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import yaml from 'js-yaml'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5199/'
const mbPath = path.resolve(process.argv[3] || path.join(ROOT, '..', 'methodsbase'))
const outDir = process.argv[4] || path.join(ROOT, 'layout_check', 'out', 'methods-language')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const records = yaml.load(readFileSync(path.join(mbPath, 'records', 'methods.yaml'), 'utf8')).methods
const plain = (v) => (v && typeof v === 'object' ? v.en ?? v.de ?? Object.values(v)[0] : v) ?? null
const snapshotRow = (r) => ({
  id: r.id, slug: r.slug ?? r.id, label: plain(r.label), method_class: r.methodClass ?? null, description: plain(r.description),
  when_to_use: plain(r.whenToUse), discipline: r.discipline ?? null, status: r.status ?? null,
  review_status: r.provenance?.review_status ?? null, data: r, synced_at: '2026-11-08T00:00:00Z',
})
const byId = new Map(records.map((r) => [r.id, r]))
const VOCAB = { 'Forschendes Lernen': 'OE-METHOD-inquiry-based-learning', 'Stationenlernen': 'OE-METHOD-station-based-learning', 'Kooperative Lernformen': 'OE-METHOD-cooperative-learning' }

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => json(route, { blocked_at: null, role: 'admin' }))
// The QA account is a contributor, which shows the locked student view. The answer for its own membership says owner, so the
// researcher pages open. Only the answer the page receives changes.
await page.route((u) => /\/rest\/v1\/project_members$/.test(u.pathname) && /select=role(%2C|,)joined_via/.test(u.search), (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'owner', joined_via: null }), headers: { 'access-control-allow-origin': '*' } }))
await page.route((u) => /\/rest\/v1\/method_vocabulary_links$/.test(u.pathname), (route) =>
  json(route, Object.entries(VOCAB).map(([k, id]) => ({ method_key: k, methodsbase_snapshot: snapshotRow(byId.get(id)) }))))
await page.route((u) => /\/rest\/v1\/methodsbase_snapshot$/.test(u.pathname), (route) => json(route, records.map(snapshotRow)))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
const go = async (hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(900) }

// ---- the Methods page of the German project ----
await go('/dashboard/evomentor-thuringia')
await go('/dashboard/evomentor-thuringia/methods')
const bodyText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ')
let text = await bodyText()
check('German project: page title is German', /Methoden/.test(text) && !/^Methods\b/.test(text.trim()), text.slice(0, 80))
check('no raw {"en": ...} text anywhere', !/\{\s*"en"/.test(text))
await page.getByRole('button', { name: /Forschendes Lernen/ }).first().click()
await page.waitForTimeout(500)
text = await bodyText()
check('card shows the German name first', /Forschendes Lernen\s*DE/.test(text), text.slice(text.indexOf('Forschendes'), text.indexOf('Forschendes') + 120))
check('card shows the English name with an EN tag', /Inquiry-Based Learning\s*EN/.test(text))
check('German description is shown with the draft tag', /Entwurf von Claude, noch nicht fachlich geprüft/.test(text))
check('shell text is German', /Wann einsetzen/.test(text) && /Lernziele, bei denen diese Methode passt/.test(text))
await page.screenshot({ path: path.join(outDir, 'methods-de.png') })
await page.getByRole('button', { name: 'Englisch' }).click()
await page.waitForTimeout(400)
text = await bodyText()
check('switch to English shows the English name first', /Inquiry-Based Learning\s*EN/.test(text))
check('switch to English hides the draft tag', !/Entwurf von Claude, noch nicht/.test(text))
await page.screenshot({ path: path.join(outDir, 'methods-de-switched-to-en.png') })

// ---- the Explorer ----
await go('/dashboard/admin/explore')
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(900)
const headers = await page.locator('thead th').allInnerTexts()
check('table has a German name column', headers.some((h) => /German name/i.test(h)), headers.join(' | '))
const tableText = (await page.locator('tbody').innerText()).replace(/\s+/g, ' ')
check('table shows no brackets-in-label mix like "ABC Method (ABC-Methode)"', !/ABC Method \(ABC-Methode\)/.test(tableText))
check('table shows English readings of approaches', /Cooperative \(kooperativ\)/.test(tableText))
await page.locator('tbody tr').filter({ hasText: 'ABC Method' }).first().click()
await page.waitForTimeout(600)
await page.getByText('Full record').first().click()
await page.waitForTimeout(400)
const card = (await page.locator('.card').filter({ has: page.locator('h3') }).last().innerText()).replace(/\s+/g, ' ')
check('Explorer card names both languages', /ABC Method\s*EN/.test(card) && /ABC-Methode\s*DE/.test(card), card.slice(0, 200))
check('Explorer card shows tags with English readings', /Introduction \(Einstieg\)/.test(card))
await page.screenshot({ path: path.join(outDir, 'explorer-card-en.png') })
await page.getByRole('group', { name: 'Language of the texts' }).getByRole('button', { name: 'German' }).click()
await page.waitForTimeout(400)
const cardDe = (await page.locator('.card').filter({ has: page.locator('h3') }).last().innerText()).replace(/\s+/g, ' ')
check('Explorer card in German shows the German description with the draft tag', /ABC-Methode/.test(cardDe) && /Claude draft, not yet reviewed/.test(cardDe), cardDe.slice(0, 260))
await page.screenshot({ path: path.join(outDir, 'explorer-card-de.png') })

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' / '))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
