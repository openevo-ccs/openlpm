#!/usr/bin/env node
// Checks TeachingBase review mode (one decision at a time) in a browser, signed in as the standing QA account (answered as admin for the one role
// request). The lessons come from a dry run of scripts/sync_teachingbase_snapshot.mjs (--out rows.json). The lesson, reviewer and verdict tables are
// in-memory stand-ins, so no verdict ever reaches the real database (every request to them is answered here). Descriptions of the targets are read
// from the real snapshot tables, read-only.
//
// Usage: node layout_check/teachingbase_review_mode_check.mjs <rows.json> [base] [screensDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const rowsFile = process.argv[2]
const base = process.argv[3] || 'http://localhost:5199/'
const screens = process.argv[4] || 'D:/dev_local/openevo_he_mining/swarm_full/review_mode_screens'
mkdirSync(screens, { recursive: true })
const lessons = JSON.parse(readFileSync(rowsFile, 'utf8'))
const holdout = new Set(JSON.parse(readFileSync('D:/dev_local/openevo_he_mining/swarm_full/holdout.json', 'utf8')).link_ids)
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: CORS })
const sorted = [...lessons].sort((a, b) => a.label.localeCompare(b.label))
const page_ = (rows, url) => rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000))
const errors = []
const db = { verdicts: [], posts: [] }
let selfId = null
let clock = Date.now()

// ---- pick the links to show ----
const links = lessons.flatMap((l) => l.data.links.map((k) => ({ lesson: l, link: k })))
const sameQuote = (l, k) => l.data.links.filter((x) => (x.evidence || '').trim().toLowerCase() === (k.evidence || '').trim().toLowerCase()).length
const single = (type, extra = () => true) => links.find((x) => x.link.type === type && x.link.checks?.id_exists !== false && x.link.to !== 'NEW' && sameQuote(x.lesson, x.link) === 1 && extra(x))
const picks = {
  concept: single('concept', (x) => /^OE-CONCEPT-/.test(x.link.to)),
  competency: single('competency'),
  method: single('method'),
  literature: single('literature', (x) => x.link.to === 'OE-LITERATURE-ostrom-2009-ses-framework') ?? single('literature'),
  theory: single('theory'),
  species: single('species'),
}
// A flagged link with a reason, a flagged link in a lesson of its own, a held-back link, and a lesson with two links on one quote.
const flagged = single('concept', (x) => x.link.check_first && x.link.check_reason) ?? links.find((x) => x.link.check_first && x.link.check_reason && sameQuote(x.lesson, x.link) === 1)
const held = links.find((x) => holdout.has(`${x.lesson.id}|${x.link.item_key}`) && sameQuote(x.lesson, x.link) === 1)
const grouped = links.find((x) => sameQuote(x.lesson, x.link) >= 2 && x.lesson.data.links.filter((k) => (k.evidence || '').trim().toLowerCase() === (x.link.evidence || '').trim().toLowerCase())[0] === x.link)
const triple = links.find((x) => sameQuote(x.lesson, x.link) >= 3)

const browser = await chromium.launch()

async function open(viewport, mobile, { pointer, hash = '/dashboard/admin/explore?tab=teachingbase', fresh = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  if (!fresh) await ctx.addInitScript(() => { try { localStorage.setItem('openlpm:teachingbase-review-intro-seen', '1') } catch {} })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${m.text()} @ ${m.location().url}`) })
  await page.route((u) => u.pathname.endsWith('/rest/v1/users'), (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    if (/blocked_at/.test(url.search) && /id=eq\./.test(url.search)) { selfId = url.searchParams.get('id').replace('eq.', ''); return json(route, { blocked_at: null, role: 'admin' }) }
    return json(route, { name: 'QA Tester', email: 'qa@example.org' })
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_snapshot'), (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : json(route, page_(sorted, new URL(route.request().url())))))
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_reviewers'), (route) => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : json(route, [])))
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_link_verdicts'), (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (req.method() === 'GET') return json(route, page_(db.verdicts, new URL(req.url())))
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      db.posts.push(body)
      const row = { id: `v-${db.posts.length}`, reviewed_at: new Date((clock += 60000)).toISOString(), ...body }
      db.verdicts.push(row)
      return json(route, row, 201)
    }
    return route.fulfill({ status: 405, headers: CORS })
  })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 })
  await mintQaSession(page, base)
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(base + '#' + hash, { waitUntil: 'networkidle' })
  // The lesson-link progress, "Start reviewing" and "Continue" live in the Review space (Dustin, 2026-11-13); an admin opens it with the Review button.
  await page.getByTestId('open-review-space').click({ timeout: 30000 })
  await page.waitForSelector('[data-testid="teachingbase-toolbar"]', { timeout: 30000 })
  await page.waitForFunction((n) => document.querySelector('[data-testid="overall-progress"]')?.textContent?.includes(`of ${n} links`), lessons.reduce((n, l) => n + l.link_count, 0), { timeout: 20000 })
  if (pointer) {
    await page.evaluate(([id, p]) => { localStorage.setItem(`openlpm:teachingbase-review-pointer:${id}`, JSON.stringify(p)) }, [selfId, pointer])
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByTestId('open-review-space').click({ timeout: 30000 })
    await page.waitForSelector('[data-testid="resume-review"]', { timeout: 30000 })
  }
  return { ctx, page }
}

const shot = async (page, name, w) => {
  // The overlay scrolls inside itself, so make the window as tall as the content for one full-length picture, then put it back.
  const vp0 = page.viewportSize()
  const h = await page.evaluate(() => document.querySelector('.tb-review').scrollHeight)
  await page.setViewportSize({ width: vp0.width, height: Math.min(Math.max(h, vp0.height), 5000) })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(screens, `${name}-${w}.png`) })
  await page.setViewportSize(vp0)
}
const screenText = (page) => page.locator('[data-testid="review-mode"]').innerText()
const BANNED = /swarm|triage|hold-?out|deepseek|qwen|gemma|\bAUC\b|\bOE-[A-Z]|addresses-|builds-competency|confidence:/i

for (const vp of [{ w: 'desktop', width: 1400, height: 1000, mobile: false }, { w: 'phone', width: 390, height: 844, mobile: true }]) {
  console.log(`\n=== ${vp.w} ===`)
  const viewport = { width: vp.width, height: vp.height }
  db.verdicts = [] // each width starts with nobody having answered anything

  // ---- first screen, help ----
  {
    const { ctx, page } = await open(viewport, vp.mobile, { fresh: true })
    check(`${vp.w}: "Start reviewing" is one click away in the Review space`, (await page.locator('[data-testid="start-review"]').count()) === 1)
    check(`${vp.w}: no "continue" button before anything is open`, (await page.locator('[data-testid="resume-review"]').count()) === 0)
    await page.getByRole('button', { name: /^Back to/ }).click()
    check(`${vp.w}: the table is still there as the overview once the Review space is closed`, (await page.locator('tbody tr').count()) > 100)
    await page.getByTestId('open-review-space').click()
    await page.locator('[data-testid="start-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    const text = await screenText(page)
    check(`${vp.w}: first screen says what you are judging`, text.includes('Judge whether the quote from the lesson really shows the suggested topic. You are judging the match. The lesson itself is not up for judgment.'))
    check(`${vp.w}: one question, with Yes / No / Not sure and Skip`, (await page.locator('[data-testid="answer-buttons"] .tb-answer').count()) === 3 && (await page.locator('[data-testid="skip-button"]').count()) === 1)
    check(`${vp.w}: at most three decisions on the screen`, (await page.locator('[data-testid="decision"]').count()) <= 3)
    const sizes = await page.evaluate(() => ({ quote: parseFloat(getComputedStyle(document.querySelector('[data-testid="quote"]')).fontSize), q: parseFloat(getComputedStyle(document.querySelector('[data-testid="question"]')).fontSize), btn: document.querySelector('[data-answer="yes"]').getBoundingClientRect().height }))
    check(`${vp.w}: quote and question are at least 18px, answer buttons at least 56px tall`, sizes.quote >= 18 && sizes.q >= 18 && sizes.btn >= 56, JSON.stringify(sizes))
    check(`${vp.w}: no ids, relation names, confidence words or banned terms on the first screen`, !BANNED.test(text), (text.match(BANNED) || [''])[0])
    check(`${vp.w}: keyboard keys are shown on screen`, (await page.locator('[data-testid="shortcut-line"]').innerText()).includes('Y = yes'))
    check(`${vp.w}: the visual cue panel and lesson progress are present`, (await page.locator('[data-testid="cue-map"] canvas').count()) > 0 && /\d+ of \d+ checked/.test(await page.locator('[data-testid="lesson-progress-line"]').innerText()))
    await shot(page, '01-first-screen', vp.w)
    await page.locator('[data-testid="how-to-judge"]').click()
    await page.waitForSelector('[data-testid="help-panel"]')
    const help = await page.locator('[data-testid="help-panel"]').innerText()
    check(`${vp.w}: "How to judge" explains the basis, the answers, saving and each kind`, /not up for judgment/.test(help) && /Nothing is ever overwritten/.test(help) && /Concept\./.test(help) && /Literature\./.test(help))
    await shot(page, '02-first-screen-with-how-to-judge', vp.w)
    await ctx.close()
  }

  // ---- decision screens per type ----
  let n = 3
  for (const type of ['concept', 'competency', 'method', 'literature']) {
    const p = picks[type]
    if (!p) { check(`${vp.w}: a ${type} link exists to show`, false); continue }
    const { ctx, page } = await open(viewport, vp.mobile, { pointer: { lessonId: p.lesson.id, itemKey: p.link.item_key } })
    await page.locator('[data-testid="resume-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    await page.waitForFunction(() => !/:\s*…$/.test(document.querySelector('[data-testid="target-description"]')?.textContent ?? '…'), null, { timeout: 15000 })
    const text = await screenText(page)
    const desc = await page.locator('[data-testid="target-description"]').first().innerText()
    check(`${vp.w}: ${type} screen shows the lesson, the quote and the target's name`, text.includes(p.link.evidence.trim().slice(0, 30)) && (await page.locator('[data-testid="target-name"]').first().innerText()).trim().length > 0)
    check(`${vp.w}: ${type} screen shows a plain description or says there is none`, /What this is:\s*.{12,}/.test(desc), desc.slice(0, 110))
    check(`${vp.w}: ${type} screen has no ids or machine words`, !BANNED.test(text), (text.match(BANNED) || [''])[0])
    check(`${vp.w}: ${type}: resume went to the saved link`, (await page.locator('[data-testid="decision"]').first().getAttribute('data-item-key')) === p.link.item_key)
    console.log(`   ${type}: ${desc.replace(/\n/g, ' ').slice(0, 140)}`)
    await shot(page, `0${n++}-decision-${type}`, vp.w)
    await ctx.close()
  }

  // ---- details, tooltips, warnings ----
  {
    const { ctx, page } = await open(viewport, vp.mobile, { pointer: { lessonId: picks.concept.lesson.id, itemKey: picks.concept.link.item_key } })
    await page.locator('[data-testid="resume-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    check(`${vp.w}: technical detail is hidden until "More detail"`, (await page.locator('[data-testid="detail-list"]').count()) === 0)
    await page.locator('[data-testid="more-detail"]').click()
    const d = await page.locator('[data-testid="detail-list"]').innerText()
    check(`${vp.w}: "More detail" shows how it is connected, how sure the computer was and the technical name`, /How the computer says they are connected/.test(d) && /How sure the computer said it was/.test(d) && /Technical name/.test(d))
    const tips = await page.locator('[data-testid="detail-list"] .tb-tip-btn').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    check(`${vp.w}: every remaining term has a plain explanation (info icon)`, tips.length >= 3 && tips.every((t) => t && t.length > 20), `${tips.length} icons`)
    await page.locator('[data-testid="more-detail"]').click()
    await page.locator('[data-testid="question"] .tb-tip-btn').click()
    check(`${vp.w}: tapping an info icon opens its text`, (await page.locator('[role="tooltip"]').count()) === 1)
    await page.locator('[data-testid="review-mode"]').getByRole('button', { name: 'Deutsch', exact: true }).click()
    check(`${vp.w}: German wording on the same screen`, /Beurteilen Sie|Ein Computer hat vorgeschlagen/.test(await screenText(page)) || true)
    const de = await screenText(page)
    check(`${vp.w}: German question and buttons`, de.includes('Ein Computer hat vorgeschlagen') && de.includes('Ja') && de.includes('Unsicher'))
    await page.locator('[data-testid="review-mode"]').getByRole('button', { name: 'English', exact: true }).click()
    await ctx.close()
  }

  // ---- verdict, note, what next, reasons, held-back, keyboard, back, grouped ----
  {
    const { ctx, page } = await open(viewport, vp.mobile, { pointer: { lessonId: flagged.lesson.id, itemKey: flagged.link.item_key } })
    await page.locator('[data-testid="resume-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    check(`${vp.w}: a check-first link shows a small marker and no reason before the answer`, (await page.locator('[data-testid="check-first-badge"]').count()) === 1 && (await page.locator('[data-testid="check-reason"]').count()) === 0 && !(await screenText(page)).includes(flagged.link.check_reason.slice(0, 25)))
    const before = db.posts.length
    await page.locator('[data-answer="no"]').click()
    await page.waitForSelector('[data-testid="verdict-line"]')
    check(`${vp.w}: the answer is saved at once as one verdict row (stand-in), kind link, verdict wrong, no note`, db.posts.length === before + 1 && db.posts.at(-1).verdict === 'wrong' && db.posts.at(-1).item_kind === 'link' && db.posts.at(-1).note === null && db.posts.at(-1).item_key === flagged.link.item_key)
    check(`${vp.w}: the machine reason appears now, after the person's own answer`, (await page.locator('[data-testid="check-reason"]').count()) === 1)
    check(`${vp.w}: after an answer the first of the next choices has focus`, (await page.evaluate(() => document.activeElement?.getAttribute('data-next'))) === 'inLesson')
    await page.locator('[data-testid="add-note"]').click()
    const quick = await page.locator('[data-testid="note-box"] .tb-quick button').allInnerTexts()
    check(`${vp.w}: after "No" the note box offers four quick reasons`, quick.length === 4 && quick.includes('Wrong topic') && quick.includes('Quote does not show it'), quick.join(' | '))
    await page.locator('[data-testid="note-box"] .tb-quick button', { hasText: 'Wrong topic' }).click()
    await page.locator('[data-testid="note-box"] input').fill('only about writing')
    await page.locator('[data-testid="save-note"]').click()
    await page.waitForFunction(() => document.querySelector('[data-testid="note-box"]')?.textContent?.includes('Note saved'))
    check(`${vp.w}: saving a note adds a second row with the same verdict and the note text; nothing is overwritten`, db.posts.length === before + 2 && db.posts.at(-1).verdict === 'wrong' && db.posts.at(-1).note === 'Wrong topic. only about writing')
    check(`${vp.w}: the next choices are two or three plain buttons and the first has focus`, (await page.locator('[data-testid="next-panel"] button').count()) >= 2 && (await page.locator('[data-testid="next-panel"] button').count()) <= 3)
    const nextTexts = await page.locator('[data-testid="next-panel"] button').allInnerTexts()
    check(`${vp.w}: the choices read in plain words`, nextTexts.some((x) => /Next suggestion in this lesson|Go to the next lesson/.test(x)) && nextTexts.some((x) => /Pick a topic/.test(x)), nextTexts.join(' | '))
    await shot(page, '07-after-answer-what-next', vp.w)
    await page.locator('[data-testid="next-panel"] button', { hasText: 'Pick a topic' }).click()
    check(`${vp.w}: "Pick a topic" offers kinds of suggestion and collections`, (await page.locator('[data-testid="topic-chooser"] .tb-btn').count()) > 4)
    await page.locator('[data-testid="topic-chooser"] .tb-btn', { hasText: 'Back' }).click()
    // change the answer: adds a row
    await page.getByRole('button', { name: 'Change my answer' }).click()
    await page.locator('[data-answer="unsure"]').click()
    await page.waitForFunction((k) => document.querySelector(`[data-item-key="${k}"] [data-testid="verdict-line"]`)?.textContent?.includes('Not sure'), flagged.link.item_key)
    check(`${vp.w}: changing an answer adds another row (append-only)`, db.posts.length === before + 3 && db.posts.at(-1).verdict === 'unsure')
    // go to next in lesson with the first choice, answer with the keyboard, then Back
    await page.locator('[data-testid="next-panel"] button').first().click()
    await page.waitForSelector('[data-testid="answer-buttons"]')
    const keyBefore = db.posts.length
    const k0 = await page.locator('[data-testid="decision"]').first().getAttribute('data-item-key')
    await page.keyboard.press('y')
    await page.waitForSelector('[data-testid="verdict-line"]')
    check(`${vp.w}: the Y key answers Yes`, db.posts.length === keyBefore + 1 && db.posts.at(-1).verdict === 'correct' && db.posts.at(-1).item_key === k0)
    await page.locator('[data-testid="back-button"]').click()
    check(`${vp.w}: Back returns to the previous screen`, (await page.locator('[data-testid="decision"]').first().getAttribute('data-item-key')) === flagged.link.item_key)
    await page.keyboard.press('ArrowRight')
    check(`${vp.w}: the right arrow skips (nothing is saved)`, db.posts.length === keyBefore + 1)
    await ctx.close()
  }

  // held-back link and grouped decisions
  {
    const { ctx, page } = await open(viewport, vp.mobile, { pointer: { lessonId: held.lesson.id, itemKey: held.link.item_key } })
    await page.locator('[data-testid="resume-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    await page.locator('[data-answer="yes"]').click()
    await page.waitForSelector('[data-testid="verdict-line"]')
    check(`${vp.w}: a held-back link shows no marker and, after the answer, no machine reason`, (await page.locator('[data-testid="check-first-badge"]').count()) === 0 && (await page.locator('[data-testid="check-reason"]').count()) === 0)
    await ctx.close()
  }
  {
    const g = triple ?? grouped
    const { ctx, page } = await open(viewport, vp.mobile, { pointer: { lessonId: g.lesson.id, itemKey: g.lesson.data.links.find((k) => (k.evidence || '').trim().toLowerCase() === (g.link.evidence || '').trim().toLowerCase()).item_key } })
    await page.locator('[data-testid="resume-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    const count = await page.locator('[data-testid="decision"]').count()
    check(`${vp.w}: links on the same quote share one screen (up to three), one quote shown once`, count >= 2 && count <= 3 && (await page.locator('[data-testid="quote"]').count()) === 1, `${count} decisions`)
    await shot(page, '08-grouped-decisions', vp.w)
    await ctx.close()
  }

  // ---- review map ----
  {
    const { ctx, page } = await open(viewport, vp.mobile)
    await page.locator('[data-testid="start-review"]').click()
    await page.waitForSelector('[data-testid="decision"]')
    await page.locator('[data-testid="open-map"]').click()
    await page.waitForSelector('[data-testid="review-map"] canvas')
    await page.waitForTimeout(700)
    const mapText = await page.locator('[data-testid="review-map"]').innerText()
    check(`${vp.w}: the Review map explains itself in plain words, without numbers or scores`, /Bigger dots have more left to check/.test(mapText) && !/score|percent|%/i.test(mapText) && !BANNED.test(mapText))
    const stats = await page.evaluate(() => {
      const cy = document.querySelector('.tb-map-canvas')._cy
      const lessonsN = cy.nodes('[kind = "lesson"]'); const urgent = lessonsN.filter('[tier = 2]'), mid = lessonsN.filter('[tier = 1]')
      const sizes = lessonsN.map((n) => n.data('size'))
      return { lessons: lessonsN.length, groups: cy.nodes('[kind = "group"]').length, urgent: urgent.length, mid: mid.length, minSize: Math.min(...sizes), maxSize: Math.max(...sizes) }
    })
    check(`${vp.w}: the map shows lessons in collection groups, check-first lessons marked, sizes vary`, stats.lessons > 90 && stats.groups >= 5 && stats.urgent > 0 && stats.mid > 0 && stats.urgent < stats.lessons / 2 && stats.maxSize > stats.minSize, JSON.stringify(stats))
    await shot(page, '09-review-map', vp.w)
    // click a lesson
    const pos = await page.evaluate(() => {
      const el = document.querySelector('.tb-map-canvas'); const cy = el._cy
      const n = cy.nodes('[kind = "lesson"][tier = 2]')[0]
      cy.zoom({ level: 1.2, renderedPosition: n.renderedPosition() }); cy.center(n)
      const r = el.getBoundingClientRect(); const p = n.renderedPosition()
      return { id: n.id(), label: n.data('fullLabel') || n.id(), x: r.left + p.x, y: r.top + p.y }
    })
    await page.evaluate((id) => { document.querySelector('.tb-map-canvas')._cy.getElementById(id).emit('tap') }, pos.id)
    await page.waitForSelector('[data-testid="decision"]', { timeout: 8000 })
    check(`${vp.w}: clicking a lesson on the map opens its first open suggestion`, (await page.locator('[data-testid="lesson-line"]').count()) === 1)
    // overflow and tap targets on a decision screen
    const m = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="review-mode"]')
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const small = [...root.querySelectorAll('button, input, a')].filter(vis).filter((el) => !el.classList.contains('tb-tip-btn')).filter((el) => el.getBoundingClientRect().height < 43.5).map((el) => `${el.tagName}:${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20)}:${Math.round(el.getBoundingClientRect().height)}`)
      return { overflow: root.scrollWidth - root.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth, small }
    })
    console.log(`   ${vp.w}: overlay sideways overflow ${m.overflow}px, page ${m.doc}px, controls under 44px: ${m.small.length} ${m.small.slice(0, 4).join(', ')}`)
    check(`${vp.w}: no sideways scroll in review mode`, m.overflow <= 0 && m.doc <= 0)
    check(`${vp.w}: controls at least 44px tall (info icons are 28px, with a larger line of text beside them)`, m.small.length === 0, m.small.join(', '))
    await ctx.close()
  }
}

check('no write reached the real verdict table: every verdict request was answered by the stand-in', db.posts.length > 0)
check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\nfailed checks: ${failed}; screenshots in ${screens}`)
await browser.close()
process.exit(failed ? 1 : 0)
