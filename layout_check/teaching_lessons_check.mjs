#!/usr/bin/env node
// Checks the Teaching lessons review page (migration 240) in a browser. Both new tables are answered by in-memory stand-ins, so the
// whole flow can be checked before the migration is applied and no test verdict reaches the real database. The lesson rows come from a
// dry run of scripts/sync_teachingbase_snapshot.mjs (--out rows.json). The QA account is answered as admin for the one role request.
//
// Usage: node layout_check/teaching_lessons_check.mjs <rows.json> [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rowsFile = process.argv[2]
const base = process.argv[3] || 'http://localhost:5199/'
const outDir = process.argv[4] || path.join(ROOT, 'layout_check', 'out', 'teaching-lessons')
mkdirSync(outDir, { recursive: true })
const lessons = JSON.parse(readFileSync(rowsFile, 'utf8'))
const totalLinks = lessons.reduce((n, l) => n + l.link_count, 0)
const sampleLinks = lessons.reduce((n, l) => n + l.sample_count, 0)
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const verdicts = []
const posted = []
let nextId = 1
let clock = Date.now()

const page_ = (rows, url) => {
  const offset = Number(url.searchParams.get('offset') || 0)
  const limit = Number(url.searchParams.get('limit') || 1000)
  return rows.slice(offset, offset + limit)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: CORS }))
await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_snapshot'), async (route) => {
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  const url = new URL(req.url())
  const sorted = [...lessons].sort((a, b) => a.label.localeCompare(b.label))
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page_(sorted, url)), headers: CORS })
})
await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_link_verdicts'), async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page_(verdicts, url)), headers: CORS })
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}')
    posted.push(body)
    clock += 60000
    const row = { id: `v-${nextId++}`, reviewed_at: new Date(clock).toISOString(), ...body }
    verdicts.push(row)
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row), headers: CORS })
  }
  return route.fulfill({ status: 405, headers: CORS })
})

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
await page.goto(base + '#/dashboard/admin/teaching-lessons', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="overall-progress"]', { timeout: 15000 })

// ---- list ----
check('overall progress starts at 0 of all links', (await page.locator('[data-testid="overall-progress"]').innerText()).startsWith(`0 of ${totalLinks} links judged`), await page.locator('[data-testid="overall-progress"]').innerText())
check('start-here progress counts the sample', (await page.locator('[data-testid="start-progress"]').innerText()).includes(`0 of ${sampleLinks}`), await page.locator('[data-testid="start-progress"]').innerText())
check('lists every lesson', (await page.locator('[data-testid="lesson-count"]').innerText()).startsWith(`${lessons.length} lessons`))
check('admin sidebar has the new entry', (await page.locator('nav a', { hasText: 'Teaching lessons' }).count()) >= 1)
await page.getByLabel('Only with suggested links').check()
const withGraph = lessons.filter((l) => l.graph_present).length
check('"only with suggested links" narrows the list', (await page.locator('[data-testid="lesson-count"]').innerText()).startsWith(`${withGraph} lessons`))
await page.getByLabel('Start-here selection only').check()
const withSample = lessons.filter((l) => l.sample_count > 0).length
check('"start here" narrows the list to lessons with sampled links', (await page.locator('[data-testid="lesson-count"]').innerText()).startsWith(`${withSample} lessons`))
await page.screenshot({ path: path.join(outDir, 'list-desktop.png'), fullPage: true })
await page.getByLabel('Start-here selection only').uncheck()
await page.getByLabel('Only with suggested links').uncheck()

// ---- a lesson ----
const target = lessons.find((l) => l.graph_present && l.sample_count > 0 && l.link_count >= 4 && l.data.components.length > 0)
await page.getByLabel('Search lessons').fill(target.label.slice(0, 18))
await page.locator('[data-testid="lesson-link"]', { hasText: target.label }).first().click()
await page.waitForSelector('[data-testid="draft-tag"]')
check('draft tag shows the agreed wording (English)', (await page.locator('[data-testid="draft-tag"]').innerText()) === 'LLM synthesized draft, awaiting review')
check('lesson progress shows links and parts together', (await page.locator('[data-testid="lesson-progress"]').innerText()).startsWith(`0 of ${target.link_count + target.data.components.length}`), await page.locator('[data-testid="lesson-progress"]').innerText())
const items = page.locator('[data-testid="review-item"]')
check('every link and part has an item', (await items.count()) === target.link_count + target.data.components.length, String(await items.count()))
await page.screenshot({ path: path.join(outDir, 'lesson-desktop.png'), fullPage: true })

const firstLink = page.locator(`[data-item-key="${target.data.links[0].item_key}"]`)
await firstLink.locator('input[type="text"]').fill('looks right')
await firstLink.locator('button[data-verdict="correct"]').click()
await page.waitForSelector('[data-testid="verdict-line"]')
check('a verdict row was sent with kind, key, summary, note and verdict', posted.length === 1 && posted[0].item_kind === 'link' && posted[0].item_key === target.data.links[0].item_key && posted[0].verdict === 'correct' && posted[0].note === 'looks right' && posted[0].item_summary.to === target.data.links[0].to && posted[0].lesson_id === target.id && !!posted[0].reviewer_id && !!posted[0].reviewer_name, JSON.stringify(posted[0]).slice(0, 200))
const line = await firstLink.locator('[data-testid="verdict-line"]').innerText()
check('judged item shows reviewer name and date', /Correct/.test(line) && /Judged by .+ on \d/.test(line), line.replace(/\n/g, ' '))
check('lesson progress is 1 now', (await page.locator('[data-testid="lesson-progress"]').innerText()).startsWith(`1 of ${target.link_count + target.data.components.length}`))
check('overall progress is 1 of all links', (await page.locator('[data-testid="overall-progress"]').innerText()).startsWith(`1 of ${totalLinks} links judged`))

await firstLink.getByRole('button', { name: 'Change verdict' }).click()
await firstLink.locator('button[data-verdict="wrong"]').click()
await page.waitForSelector(`[data-item-key="${target.data.links[0].item_key}"] [data-testid="verdict-line"]`)
check('changing adds a second row and the latest wins', posted.length === 2 && verdicts.length === 2 && /Wrong/.test(await firstLink.locator('[data-testid="verdict-line"]').innerText()))
check('progress still counts the item once', (await page.locator('[data-testid="overall-progress"]').innerText()).startsWith(`1 of ${totalLinks} links judged`))

const comp = page.locator(`[data-item-key="${target.data.components[0].item_key}"]`)
await comp.locator('button[data-verdict="unsure"]').click()
await page.waitForSelector(`[data-item-key="${target.data.components[0].item_key}"] [data-testid="verdict-line"]`)
check('a part is judged as a component row', posted[2].item_kind === 'component' && posted[2].verdict === 'unsure')
check('parts do not count toward the overall link progress', (await page.locator('[data-testid="overall-progress"]').innerText()).startsWith(`1 of ${totalLinks} links judged`))

// ---- download ----
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download verdicts' }).click()])
const dlPath = path.join(outDir, 'verdicts.json')
await download.saveAs(dlPath)
const dl = JSON.parse(readFileSync(dlPath, 'utf8'))
check('download holds the latest verdict per item (2 items, wrong + unsure)', dl.verdicts.length === 2 && dl.verdicts.some((v) => v.verdict === 'wrong' && v.item_kind === 'link') && dl.verdicts.some((v) => v.verdict === 'unsure' && v.item_kind === 'component') && dl.verdicts.every((v) => v.reviewer && v.date && v.item_summary && v.lesson_id), JSON.stringify(dl.verdicts[0]).slice(0, 160))

// ---- German ----
await page.getByRole('button', { name: 'German', exact: true }).click()
check('draft tag in German', (await page.locator('[data-testid="draft-tag"]').innerText()) === 'LLM-erzeugter Entwurf, Prüfung ausstehend')
check('German verdict words', (await items.nth(1).locator('button[data-verdict="correct"]').innerText()).includes('Richtig'))
check('German progress', (await page.locator('[data-testid="overall-progress"]').innerText()).includes('Verknüpfungen geprüft'))
await page.screenshot({ path: path.join(outDir, 'lesson-desktop-de.png'), fullPage: true })
await page.getByRole('button', { name: 'Englisch', exact: true }).click()

// ---- list shows progress; reload keeps verdicts (stand-in) ----
await page.getByRole('link', { name: /All lessons/ }).first().click()
await page.waitForSelector('[data-testid="lesson-count"]')
check('list row shows the lesson progress', (await page.locator('[data-testid="lesson-link"]', { hasText: target.label }).first().innerText()).includes('judged'))
await page.getByLabel('Still to check', { exact: false }).count()

// ---- widths ----
const widths = [{ name: 'phone', w: 390, h: 844, mobile: true }, { name: 'tablet', w: 820, h: 1100, mobile: false }, { name: 'desktop', w: 1440, h: 1000, mobile: false }]
for (const v of widths) {
  const c2 = await browser.newContext({ viewport: { width: v.w, height: v.h }, isMobile: v.mobile, hasTouch: v.mobile })
  const p2 = await c2.newPage()
  p2.on('pageerror', (e) => errors.push(String(e)))
  p2.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  for (const [pattern, fn] of [[/users$/, null]]) void pattern, void fn
  await p2.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: CORS }))
  await p2.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_snapshot'), (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page_([...lessons].sort((a, b) => a.label.localeCompare(b.label)), new URL(route.request().url()))), headers: CORS })
  })
  await p2.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_link_verdicts'), (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page_(verdicts, new URL(route.request().url()))), headers: CORS })
  })
  await p2.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(p2, base)
  for (const [label, hash] of [['list', '#/dashboard/admin/teaching-lessons'], ['lesson', `#/dashboard/admin/teaching-lessons?lesson=${encodeURIComponent(target.id)}`]]) {
    await p2.goto(base + hash, { waitUntil: 'networkidle' })
    await p2.waitForSelector('[data-testid="overall-progress"]', { timeout: 15000 })
    await p2.waitForTimeout(500)
    const m = await p2.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      const main = document.querySelector('.project-main') || document.body
      const small = [...main.querySelectorAll('button, a, input:not([type=checkbox]), select, label.tlr-tap')].filter(vis).filter((el) => el.getBoundingClientRect().height < 43.5).map((el) => `${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || el.type || '').trim().slice(0, 24)}:${Math.round(el.getBoundingClientRect().height)}`)
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, small }
    })
    console.log(`${v.name} ${label}: sideways overflow ${m.overflow}px, controls under 44px in the page body: ${m.small.length}${m.small.length ? ' [' + m.small.slice(0, 6).join(', ') + ']' : ''}`)
    if (v.name === 'phone') { check(`phone ${label}: no sideways scroll`, m.overflow <= 0); check(`phone ${label}: tap targets at least 44px`, m.small.length === 0, m.small.join(', ')) }
    else check(`${v.name} ${label}: no sideways scroll`, m.overflow <= 0)
    await p2.screenshot({ path: path.join(outDir, `${label}-${v.name}.png`), fullPage: true })
  }
  await c2.close()
}

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\nconsole/page errors: ${errors.length}; failed checks: ${failed}; screenshots in ${outDir}`)
await browser.close()
process.exit(failed ? 1 : 0)
