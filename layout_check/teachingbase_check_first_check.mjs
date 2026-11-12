#!/usr/bin/env node
// Read-only check of the "check first" order on the TeachingBase tab. The lessons come from a dry run of scripts/sync_teachingbase_snapshot.mjs
// (--out rows.json, with the check-first files). The tables are answered by in-memory stand-ins and no verdict is ever sent: one of the
// signed-in person's own verdicts is placed in the stand-in up front, to see the reason appear for that link and stay hidden on the others.
//
// Usage: node layout_check/teachingbase_check_first_check.mjs <rows.json> [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rowsFile = process.argv[2]
const base = process.argv[3] || 'http://localhost:5199/'
const outDir = process.argv[4] || path.join(ROOT, 'layout_check', 'out', 'teachingbase-check-first')
mkdirSync(outDir, { recursive: true })
const lessons = JSON.parse(readFileSync(rowsFile, 'utf8'))
const holdout = new Set(JSON.parse(readFileSync(process.env.HOLDOUT_FILE || 'D:/dev_local/openevo_he_mining/swarm_full/holdout.json', 'utf8')).link_ids)
const allLinks = lessons.flatMap((l) => l.data.links.map((k) => ({ lesson: l, link: k })))
const flagged = allLinks.filter((x) => x.link.check_first)
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: CORS })
const sorted = [...lessons].sort((a, b) => a.label.localeCompare(b.label))
const page_ = (rows, url) => rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000))

// The lesson that should be on top: the one holding the most doubtful flagged link.
const topLink = flagged.reduce((a, b) => (b.link.check_rank < a.link.check_rank ? b : a))
const topLesson = topLink.lesson
// A lesson with a flagged link, a flagged link with a reason (for the own-verdict reveal), and a hold-out link.
const cardLesson = lessons.reduce((a, b) => (b.data.links.filter((l) => l.check_first && l.check_reason).length > a.data.links.filter((l) => l.check_first && l.check_reason).length ? b : a))
const withReason = cardLesson.data.links.filter((l) => l.check_first && l.check_reason)
const ownLink = withReason[0]
const otherFlagged = withReason[1]
const holdLink = allLinks.find((x) => holdout.has(`${x.lesson.id}|${x.link.item_key}`))

const browser = await chromium.launch()
const errors = []
let selfId = null
const posts = []

async function open(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${m.text()} @ ${m.location().url}`) })
  await page.route((u) => u.pathname.endsWith('/rest/v1/users'), (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    if (/blocked_at/.test(url.search) && /id=eq\./.test(url.search)) { selfId = url.searchParams.get('id').replace('eq.', ''); return json(route, { blocked_at: null, role: 'admin' }) }
    return json(route, { name: 'QA Tester', email: 'qa@example.org' })
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_snapshot'), (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return json(route, page_(sorted, new URL(route.request().url())))
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_reviewers'), (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return json(route, [])
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_link_verdicts'), (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (req.method() !== 'GET') { posts.push(req.method()); return route.fulfill({ status: 405, headers: CORS }) }
    // One verdict of the signed-in person's own, placed up front.
    const rows = ownLink ? [{ id: 'seed-1', lesson_id: cardLesson.id, item_kind: 'link', item_key: ownLink.item_key, item_summary: {}, verdict: 'correct', note: null, reviewer_id: selfId, reviewer_name: 'QA Tester', reviewed_at: new Date().toISOString() }] : []
    return json(route, page_(rows, new URL(req.url())))
  })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 })
  await mintQaSession(page, base)
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(base + '#/dashboard/admin/explore?tab=teachingbase', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 100, null, { timeout: 30000 }).catch(async (e) => { await page.screenshot({ path: path.join(outDir, 'debug.png') }); throw e })
  return { ctx, page }
}

{
  const { ctx, page } = await open({ width: 1440, height: 1000 })
  const firstLabel = await page.locator('tbody tr').first().locator('td').first().innerText()
  check('the lesson with the most doubtful link is on top of the list', firstLabel.trim() === topLesson.label.trim(), `${firstLabel.trim()} vs ${topLesson.label}`)
  const headers = await page.locator('thead th').allInnerTexts()
  check('the list has a "Check first" column', headers.some((h) => /check first/i.test(h)), headers.join(' | '))
  const lessonsWithFlag = lessons.filter((l) => l.data.links.some((k) => k.check_first)).length
  const order = await page.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll('td')[0].textContent))
  const rankByLabel = new Map(lessons.map((l) => [l.label, Math.min(...l.data.links.filter((k) => k.check_first).map((k) => k.check_rank), 99999)]))
  const ranks = order.map((t) => rankByLabel.get(t.trim()) ?? 99999)
  check(`all ${lessonsWithFlag} lessons with flagged links come before the rest, in order`, ranks.slice(0, lessonsWithFlag).every((r, i, a) => i === 0 || a[i - 1] <= r) && ranks.slice(0, lessonsWithFlag).every((r) => r < 99999) && ranks.slice(lessonsWithFlag).every((r) => r === 99999), `${lessonsWithFlag} lessons`)
  const body = await page.locator('body').innerText()
  check('no numbers shown for the order (no score, rank or percentage wording)', !/rank|score|percent|probab/i.test(body))

  await page.getByLabel('Search all fields').fill(cardLesson.label.slice(0, 24))
  await page.locator('tbody tr', { hasText: cardLesson.label }).first().click()
  await page.waitForSelector('[data-testid="teachingbase-card"]')
  const group = page.locator('[data-testid="check-first-group"]')
  check('the lesson card starts its link list with a "Check first" group', (await group.count()) === 1)
  const expectedFirst = cardLesson.data.links.filter((l) => l.check_first).sort((a, b) => a.check_rank - b.check_rank)
  const keys = await group.locator('[data-testid="review-item"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-item-key')))
  check('inside it the most doubtful link is first and the order follows', JSON.stringify(keys) === JSON.stringify(expectedFirst.map((l) => l.item_key)), `${keys.length} links`)
  const groupBeforeTypes = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="teachingbase-card"]')
    const g = card.querySelector('[data-testid="check-first-group"]')
    const h = [...card.querySelectorAll('h4')].map((x) => x.textContent)
    return { gi: h.findIndex((t) => t.startsWith('Check first')), li: h.findIndex((t) => t.startsWith('Suggested links')), has: !!g }
  })
  check('the "Check first" group sits above the other links', groupBeforeTypes.gi >= 0 && groupBeforeTypes.gi < groupBeforeTypes.li)
  const badges = await page.locator('[data-testid="check-first-badge"]').count()
  check('every flagged link has the small marker, and no other link does', badges === expectedFirst.length, `${badges} of ${expectedFirst.length}`)
  check('the marker says "Check first" and nothing else', (await page.locator('[data-testid="check-first-badge"]').first().innerText()) === 'Check first')
  // reasons: hidden unless this person judged the link
  const reasonsShown = await page.locator('[data-testid="check-reason"]').count()
  check('the reason shows for the one link the signed-in person has judged', reasonsShown === 1 && ownLink ? (await page.locator(`[data-item-key="${ownLink.item_key}"] [data-testid="check-reason"]`).count()) === 1 : false, `${reasonsShown} reasons visible`)
  if (otherFlagged) check('the reason of an unjudged flagged link stays hidden', (await page.locator(`[data-item-key="${otherFlagged.item_key}"] [data-testid="check-reason"]`).count()) === 0)
  const text = await page.locator('[data-testid="teachingbase-card"]').innerText()
  check('the reason text of an unjudged link is nowhere in the card', !otherFlagged?.check_reason || !text.includes(otherFlagged.check_reason))
  check('no model names, "swarm", "triage" or numbers-of-score wording on screen', !/swarm|triage|hold-?out|deepseek|qwen|gemma|\bAUC\b/i.test(await page.locator('body').innerText()))
  await page.screenshot({ path: path.join(outDir, 'card-desktop.png'), fullPage: true })

  // German
  await page.getByRole('button', { name: 'German', exact: true }).click()
  check('German marker', (await page.locator('[data-testid="check-first-badge"]').first().innerText()) === 'Zuerst prüfen')
  check('German group heading', (await group.locator('h4').innerText()).startsWith('Zuerst prüfen'))
  const reasonDe = await page.locator(`[data-item-key="${ownLink.item_key}"] [data-testid="check-reason"]`).innerText()
  check('German reason line for the judged link', /Warum diese Verknüpfung markiert wurde/.test(reasonDe), reasonDe.slice(0, 90))
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await ctx.close()
}

// A hold-out link carries nothing.
{
  check('a hold-out link has no flag and no reason in the data', !holdLink.link.check_first && !holdLink.link.check_reason)
  const { ctx, page } = await open({ width: 1440, height: 1000 })
  await page.getByLabel('Search all fields').fill(holdLink.lesson.label.slice(0, 24))
  await page.locator('tbody tr', { hasText: holdLink.lesson.label }).first().click()
  await page.waitForSelector('[data-testid="teachingbase-card"]')
  const item = page.locator(`[data-item-key="${holdLink.link.item_key}"]`)
  check('a hold-out link shows no marker and no reason', (await item.count()) === 1 && (await item.locator('[data-testid="check-first-badge"]').count()) === 0 && (await item.locator('[data-testid="check-reason"]').count()) === 0)
  const inGroup = await page.locator(`[data-testid="check-first-group"] [data-item-key="${holdLink.link.item_key}"]`).count()
  check('and it is not in the "Check first" group', inGroup === 0)
  await ctx.close()
}

// widths
for (const v of [{ name: 'phone', w: 390, h: 844, mobile: true }, { name: 'tablet', w: 820, h: 1100, mobile: false }, { name: 'desktop', w: 1440, h: 1000, mobile: false }]) {
  const { ctx, page } = await open({ width: v.w, height: v.h }, v.mobile)
  await page.getByLabel('Search all fields').fill(cardLesson.label.slice(0, 24))
  await page.locator('tbody tr', { hasText: cardLesson.label }).first().click()
  await page.waitForSelector('[data-testid="check-first-group"]')
  const m = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const root = document.querySelector('[data-testid="teachingbase-card"]')
    const small = [...root.querySelectorAll('button, a, input:not([type=checkbox])')].filter(vis).filter((el) => el.getBoundingClientRect().height < 43.5).length
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, small }
  })
  console.log(`${v.name}: sideways overflow ${m.overflow}px, card controls under 44px: ${m.small}`)
  check(`${v.name}: no sideways scroll`, m.overflow <= 0)
  if (v.name === 'phone') check('phone: card controls at least 44px', m.small === 0)
  await page.screenshot({ path: path.join(outDir, `card-${v.name}.png`), fullPage: true })
  await ctx.close()
}

check('no write was attempted', posts.length === 0)
check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\nfailed checks: ${failed}; screenshots in ${outDir}`)
await browser.close()
process.exit(failed ? 1 : 0)
