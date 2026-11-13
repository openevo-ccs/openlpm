#!/usr/bin/env node
// Checks the TeachingBase tab of the Base Repo Explorer (migrations 240 and 241) in a browser. The three TeachingBase tables and the
// reviewer lookups are answered by in-memory stand-ins, so the flow can be checked before migration 241 is applied and no test verdict or
// reviewer reaches the real database. The lesson rows come from a dry run of scripts/sync_teachingbase_snapshot.mjs (--out rows.json).
// The standing QA account is answered as an admin, as a named reviewer who is not an admin, or as a person who is neither.
//
// Usage: node layout_check/teachingbase_check.mjs <rows.json> [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rowsFile = process.argv[2]
const base = process.argv[3] || 'http://localhost:5199/'
const outDir = process.argv[4] || path.join(ROOT, 'layout_check', 'out', 'teachingbase')
mkdirSync(outDir, { recursive: true })
const lessons = JSON.parse(readFileSync(rowsFile, 'utf8'))
const totalLinks = lessons.reduce((n, l) => n + l.link_count, 0)
const sampleLinks = lessons.reduce((n, l) => n + l.sample_count, 0)
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const people = [
  { id: 'u-ann', name: 'Ann Example', email: 'ann@example.org' },
  { id: 'u-bo', name: 'Bo Sample', email: 'bo@example.org' },
]
// Shared across scenarios, like the database would be.
const db = { verdicts: [], reviewers: [], posted: [], reviewerPosts: [], reviewerDeletes: [] }
let nextId = 1
let clock = Date.now()
const errors = []
const sorted = [...lessons].sort((a, b) => a.label.localeCompare(b.label))
const page_ = (rows, url) => rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000))
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: CORS })

const browser = await chromium.launch()

/** A page signed in as the QA account, answered with the given role and reviewer status. */
async function open(role, isReviewer, viewport, { mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, acceptDownloads: true })
  const page = await ctx.newPage()
  const seen = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('request', (r) => seen.push(new URL(r.url()).pathname))
  let selfId = null
  await page.route((u) => u.pathname.endsWith('/rest/v1/users'), (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    if (/blocked_at/.test(url.search) && /id=eq\./.test(url.search)) { selfId = url.searchParams.get('id').replace('eq.', ''); return json(route, { blocked_at: null, role }) }
    if (url.searchParams.get('or')) {
      const q = (url.searchParams.get('or').match(/ilike\.%([^%]*)%/) || [])[1]?.toLowerCase() ?? ''
      return json(route, people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q)))
    }
    if (url.searchParams.get('id')?.startsWith('in.')) {
      const ids = url.searchParams.get('id').slice(4, -1).split(',')
      return json(route, people.filter((p) => ids.includes(p.id)))
    }
    return json(route, { name: 'QA Tester', email: 'qa@example.org' })
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_snapshot'), (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return json(route, page_(sorted, new URL(route.request().url())))
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_reviewers'), async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (req.method() === 'GET') {
      if (url.searchParams.get('user_id')) {
        // The own-row lookup: only a named reviewer finds a row.
        return json(route, isReviewer ? [{ user_id: selfId }] : [])
      }
      if (role !== 'admin') return json(route, [])
      return json(route, db.reviewers)
    }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      db.reviewerPosts.push(body)
      db.reviewers.push({ ...body, added_at: new Date(clock += 60000).toISOString() })
      return route.fulfill({ status: 201, headers: CORS })
    }
    if (req.method() === 'DELETE') {
      const id = url.searchParams.get('user_id').replace('eq.', '')
      db.reviewerDeletes.push(id)
      db.reviewers = db.reviewers.filter((r) => r.user_id !== id)
      return route.fulfill({ status: 204, headers: CORS })
    }
    return route.fulfill({ status: 405, headers: CORS })
  })
  await page.route((u) => u.pathname.endsWith('/rest/v1/teachingbase_link_verdicts'), async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (req.method() === 'GET') return json(route, page_(db.verdicts, url))
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      db.posted.push(body)
      const row = { id: `v-${nextId++}`, reviewed_at: new Date(clock += 60000).toISOString(), ...body }
      db.verdicts.push(row)
      return json(route, row, 201)
    }
    return route.fulfill({ status: 405, headers: CORS })
  })
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base)
  await page.reload({ waitUntil: 'networkidle' })
  return { ctx, page, seen }
}
const go = async (page, hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(600) }

const target = lessons.find((l) => l.graph_present && l.sample_count > 0 && l.link_count >= 4 && l.data.components.length > 0)
const tbRow = (page, label) => page.locator('tbody tr', { hasText: label }).first()
const openLesson = async (page) => {
  await page.getByLabel('Search all fields').fill(target.label.slice(0, 20))
  await tbRow(page, target.label).click()
  await page.waitForSelector('[data-testid="teachingbase-card"]')
}

// =====================================================================================================================
// 1. Admin: the TeachingBase tab, the lesson card, the Reviewers section
// =====================================================================================================================
{
  const { ctx, page } = await open('admin', false, { width: 1440, height: 1000 })
  await go(page, '/dashboard/admin/explore')
  check('Explorer tab row lists TeachingBase next to the other bases', (await page.getByRole('button', { name: /^TeachingBase/ }).count()) === 1)
  check('no separate "Teaching lessons" tab or menu item', (await page.getByText('Teaching lessons', { exact: true }).count()) === 0)
  await page.getByRole('button', { name: /^TheoryBase/ }).click()
  await page.waitForSelector('tbody tr', { timeout: 20000 })
  const theoryRows = await page.locator('tbody tr').count()
  check('another tab (TheoryBase) still lists its records', theoryRows > 0, `${theoryRows} rows`)
  check('no TeachingBase toolbar on another tab', (await page.locator('[data-testid="teachingbase-toolbar"]').count()) === 0)

  // Reviewing sits behind one Review button (Dustin, 2026-11-13). On the TeachingBase tab it opens on the lesson links.
  const openSpace = async (pg) => { await pg.getByTestId('open-review-space').click(); await pg.waitForSelector('[data-testid="overall-progress"]', { timeout: 15000 }) }
  const closeSpace = async (pg) => { await pg.getByRole('button', { name: /^Back to/ }).click(); await pg.waitForTimeout(300) }
  const progressText = async (pg) => { await openSpace(pg); const t = await pg.locator('[data-testid="overall-progress"]').innerText(); await closeSpace(pg); return t }
  await page.getByRole('button', { name: /^TeachingBase/ }).click()
  await page.waitForSelector('tbody tr', { timeout: 15000 })
  check('the TeachingBase tab no longer shows the review cards above the table', (await page.locator('[data-testid="teachingbase-toolbar"]').count()) === 0 && (await page.locator('[data-testid="start-review"]').count()) === 1)
  const tabTop = await page.locator('tbody tr').first().evaluate((el) => el.getBoundingClientRect().top)
  check('the first lesson sits near the top of the page', tabTop < 420, `${Math.round(tabTop)}px from the top`)
  await openSpace(page)
  await page.waitForFunction((n) => document.querySelector('[data-testid="overall-progress"]')?.textContent?.includes(`of ${n} links`), totalLinks, { timeout: 15000 })
  const progress = await page.locator('[data-testid="overall-progress"]').innerText()
  check(`progress starts at 0 of ${totalLinks} links judged`, progress.startsWith(`0 of ${totalLinks} links judged`), progress)
  check('start-here progress counts the sample', (await page.locator('[data-testid="start-progress"]').innerText()).includes(`0 of ${sampleLinks}`))
  check('draft tag in the Review space says LLM synthesized draft', (await page.locator('[data-testid="teachingbase-toolbar"] .chip-draft').first().innerText()) === 'LLM synthesized draft, awaiting review')
  check('Reviewers section is in the Review space for admins', (await page.locator('[data-testid="reviewers-panel"]').count()) === 1)
  await page.screenshot({ path: path.join(outDir, 'review-space-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Start-here selection only' }).click()
  await closeSpace(page)
  const withSample = lessons.filter((l) => l.sample_count > 0).length
  check('start-here filter narrows to lessons with sampled links', (await page.locator('tbody tr').count()) === withSample, `${await page.locator('tbody tr').count()} vs ${withSample}`)
  await page.getByRole('button', { name: 'Start-here selection only ×' }).click()
  check('table lists every lesson', (await page.locator('tbody tr').count()) === lessons.length, `${await page.locator('tbody tr').count()} of ${lessons.length}`)
  await page.screenshot({ path: path.join(outDir, 'tab-desktop.png'), fullPage: true })

  await openLesson(page)
  check('card shows the draft tag', (await page.locator('[data-testid="teachingbase-card"] [data-testid="draft-tag"]').innerText()) === 'LLM synthesized draft, awaiting review')
  const total = target.link_count + target.data.components.length
  check('card progress counts links and parts', (await page.locator('[data-testid="lesson-progress"]').innerText()).startsWith(`0 of ${total}`))
  check('every link and part has an item', (await page.locator('[data-testid="review-item"]').count()) === total)
  const first = page.locator(`[data-item-key="${target.data.links[0].item_key}"]`)
  await first.locator('input[type="text"]').fill('looks right')
  await first.locator('button[data-verdict="correct"]').click()
  await page.waitForSelector(`[data-item-key="${target.data.links[0].item_key}"] [data-testid="verdict-line"]`)
  const p0 = db.posted[0]
  check('a verdict row was sent with kind, key, summary, note and verdict', db.posted.length === 1 && p0.item_kind === 'link' && p0.item_key === target.data.links[0].item_key && p0.verdict === 'correct' && p0.note === 'looks right' && p0.lesson_id === target.id && !!p0.reviewer_id && !!p0.reviewer_name)
  check('judged item shows reviewer name and date', /Judged by .+ on \d/.test(await first.locator('[data-testid="verdict-line"]').innerText()))
  check('overall progress is 1 of all links', (await progressText(page)).startsWith(`1 of ${totalLinks} links judged`))
  await first.getByRole('button', { name: 'Change verdict' }).click()
  await first.locator('button[data-verdict="wrong"]').click()
  await page.waitForSelector(`[data-item-key="${target.data.links[0].item_key}"] [data-testid="verdict-line"]`)
  check('changing adds a second row and the newest counts once', db.posted.length === 2 && (await progressText(page)).startsWith(`1 of ${totalLinks} links judged`))
  await openSpace(page)
  await page.getByRole('button', { name: 'Still to check' }).click()
  await closeSpace(page)
  check('"Still to check" keeps a partly judged lesson', (await tbRow(page, target.label).count()) === 1)
  await page.getByRole('button', { name: 'Still to check ×' }).click()

  await openSpace(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download verdicts' }).click()])
  const dlPath = path.join(outDir, 'verdicts.json')
  await download.saveAs(dlPath)
  const dl = JSON.parse(readFileSync(dlPath, 'utf8'))
  check('download holds the newest verdict per item', dl.verdicts.length === 1 && dl.verdicts[0].verdict === 'wrong' && !!dl.verdicts[0].reviewer && !!dl.verdicts[0].date)
  await closeSpace(page)

  // German
  await page.getByRole('button', { name: 'German', exact: true }).click()
  check('draft tag in German', (await page.locator('[data-testid="teachingbase-card"] [data-testid="draft-tag"]').innerText()) === 'LLM-erzeugter Entwurf, Prüfung ausstehend')
  await openSpace(page)
  check('German progress and reviewers wording', (await page.locator('[data-testid="overall-progress"]').innerText()).includes('Verknüpfungen geprüft') && (await page.locator('[data-testid="reviewers-panel"] h3').innerText()) === 'Prüfende')
  await page.screenshot({ path: path.join(outDir, 'card-desktop-de.png'), fullPage: true })
  await page.getByRole('button', { name: 'English', exact: true }).click()

  // Reviewers section
  const panel = page.locator('[data-testid="reviewers-panel"]')
  check('reviewers list starts empty', (await panel.innerText()).includes('Nobody added yet.'))
  await panel.getByLabel('Find a person (name or email)').fill('ann@')
  await panel.getByRole('button', { name: 'Search' }).click()
  await page.waitForSelector('[data-testid="reviewer-hits"]')
  await panel.getByRole('button', { name: /^Add: Ann Example/ }).click()
  await page.waitForSelector('[data-testid="reviewer-row"]')
  const row = await panel.locator('[data-testid="reviewer-row"]').first().innerText()
  check('admin adds a reviewer found by email: row shows name, email and date', db.reviewerPosts.length === 1 && db.reviewerPosts[0].user_id === 'u-ann' && !!db.reviewerPosts[0].added_by && /Ann Example/.test(row) && /ann@example.org/.test(row) && /added on \d/.test(row), row.replace(/\n/g, ' | '))
  await panel.getByLabel('Find a person (name or email)').fill('sample')
  await panel.getByRole('button', { name: 'Search' }).click()
  await panel.getByRole('button', { name: /^Add: Bo Sample/ }).waitFor({ timeout: 5000 }).catch(() => {})
  check('search by name finds an account', (await panel.getByRole('button', { name: /^Add: Bo Sample/ }).count()) === 1)
  await panel.getByLabel('Find a person (name or email)').fill('ann')
  await panel.getByRole('button', { name: 'Search' }).click()
  await page.waitForTimeout(500)
  check('someone already listed is not offered again', (await panel.locator('[data-testid="reviewer-no-hits"]').count()) === 1)
  await panel.getByLabel('Find a person (name or email)').fill('nobody-here')
  await panel.getByRole('button', { name: 'Search' }).click()
  check('no match says so in plain words', (await panel.locator('[data-testid="reviewer-no-hits"]').innerText()).startsWith('Nobody found'))
  await panel.getByRole('button', { name: /^Remove: Ann Example/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="reviewer-row"]').length === 0)
  check('remove button takes the reviewer off', db.reviewerDeletes.join() === 'u-ann')
  // keep one reviewer in place for the later scenarios
  db.reviewers = []
  await ctx.close()
}

// =====================================================================================================================
// 2. The old address still works (admin) and the reviewer address refuses an admin-less non-reviewer
// =====================================================================================================================
{
  const { ctx, page } = await open('admin', false, { width: 1440, height: 1000 })
  await go(page, '/dashboard/admin/teaching-lessons')
  await page.waitForSelector('[data-testid="start-review"]', { timeout: 15000 })
  check('the first address (/dashboard/admin/teaching-lessons) redirects to the TeachingBase tab', page.url().includes('/dashboard/admin/explore?tab=teachingbase'), page.url())
  await ctx.close()
}

// =====================================================================================================================
// 3. A named reviewer who is not an admin
// =====================================================================================================================
{
  const { ctx, page, seen } = await open('student', true, { width: 1440, height: 1000 })
  await go(page, '/dashboard')
  check('reviewer sees a TeachingBase link in the header, and no Admin button', (await page.locator('[data-testid="reviewer-link"]').count()) === 1 && (await page.getByRole('link', { name: 'Admin', exact: true }).count()) === 0)
  await page.locator('[data-testid="reviewer-link"]').click()
  await page.waitForSelector('[data-testid="overall-progress"]', { timeout: 15000 })
  check('reviewer reaches the TeachingBase tab', page.url().includes('/dashboard/teaching-base'))
  check('no tab row, no ConceptBase link, no edit or queue buttons', (await page.getByRole('button', { name: /^TheoryBase/ }).count()) === 0 && (await page.getByRole('button', { name: /^Review queue/ }).count()) === 0 && (await page.getByRole('button', { name: /^Edited only/ }).count()) === 0 && (await page.getByRole('link', { name: 'ConceptBase' }).count()) === 0)
  check('no Reviewers section for a reviewer', (await page.locator('[data-testid="reviewers-panel"]').count()) === 0)
  await openLesson(page)
  check('card has no Edit, Submit for review or Discuss', (await page.getByRole('button', { name: /^Edit$/ }).count()) === 0 && (await page.getByRole('button', { name: /Submit for review/ }).count()) === 0 && (await page.getByText('Discuss', { exact: true }).count()) === 0)
  const before = db.posted.length
  const key = target.data.links[1].item_key
  const item = page.locator(`[data-item-key="${key}"]`)
  await item.locator('button[data-verdict="unsure"]').click()
  await page.waitForSelector(`[data-item-key="${key}"] [data-testid="verdict-line"]`)
  check('a reviewer who is not an admin records a verdict', db.posted.length === before + 1 && db.posted.at(-1).verdict === 'unsure' && db.posted.at(-1).item_key === key)
  const touched = seen.filter((p) => p.startsWith('/rest/v1/')).filter((p) => /_snapshot$/.test(p) && !p.endsWith('teachingbase_snapshot') || /base_repo_record_edits|review_assignments|discussion|base_repo_review_targets/.test(p))
  check('reviewer page asks for no other base, edits, queue or discussion data', touched.length === 0, [...new Set(touched)].join(', '))
  await page.screenshot({ path: path.join(outDir, 'reviewer-desktop.png'), fullPage: true })
  for (const hash of ['/dashboard/admin/explore', '/dashboard/admin/users', '/dashboard/admin/feedback', '/dashboard/admin/content', '/dashboard/admin/concept-meanings', '/dashboard/admin/teaching-lessons']) {
    await go(page, hash)
    const body = await page.locator('body').innerText()
    check(`reviewer is refused on ${hash}`, /isn.t available to your account/.test(body) && (await page.locator('[data-testid="overall-progress"]').count()) === 0)
  }
  await ctx.close()
}

// =====================================================================================================================
// 4. Neither admin nor reviewer
// =====================================================================================================================
{
  const { ctx, page, seen } = await open('student', false, { width: 1440, height: 1000 })
  await go(page, '/dashboard/teaching-base')
  await page.waitForSelector('[data-testid="no-access"]')
  check('a person who is neither is refused', /isn.t available to your account/.test(await page.locator('[data-testid="no-access"]').innerText()) && (await page.locator('[data-testid="overall-progress"]').count()) === 0)
  check('refused page loads no lessons', !seen.some((p) => p.endsWith('teachingbase_snapshot')))
  await go(page, '/dashboard')
  check('no TeachingBase link in the header for them', (await page.locator('[data-testid="reviewer-link"]').count()) === 0)
  await ctx.close()
}

// =====================================================================================================================
// 5. Widths
// =====================================================================================================================
db.reviewers = [{ user_id: 'u-ann', added_by: 'x', added_at: new Date().toISOString() }]
const widths = [{ name: 'phone', w: 390, h: 844, mobile: true }, { name: 'tablet', w: 820, h: 1100, mobile: false }, { name: 'desktop', w: 1440, h: 1000, mobile: false }]
for (const v of widths) {
  for (const who of ['admin', 'reviewer']) {
    const { ctx, page } = await open(who === 'admin' ? 'admin' : 'student', who === 'reviewer', { width: v.w, height: v.h }, { mobile: v.mobile })
    await go(page, who === 'admin' ? '/dashboard/admin/explore?tab=teachingbase' : '/dashboard/teaching-base')
    if (who === 'admin') { await page.getByTestId('open-review-space').click() }
    await page.waitForSelector('[data-testid="overall-progress"]', { timeout: 15000 })
    const measure = () => page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      const scope = [...document.querySelectorAll('[data-testid="teachingbase-toolbar"], [data-testid="teachingbase-card"], [data-testid="reviewers-panel"]')]
      const small = scope.flatMap((root) => [...root.querySelectorAll('button, a, input:not([type=checkbox]), select')]).filter(vis).filter((el) => el.getBoundingClientRect().height < 43.5)
        .map((el) => `${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || el.type || '').trim().slice(0, 24)}:${Math.round(el.getBoundingClientRect().height)}`)
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, small }
    })
    for (const [label, open_] of [['list', false], ['card', true]]) {
      if (open_) { if (who === 'admin') await page.getByRole('button', { name: /^Back to/ }).click(); await openLesson(page) }
      await page.waitForTimeout(400)
      const m = await measure()
      console.log(`${v.name} ${who} ${label}: sideways overflow ${m.overflow}px, TeachingBase controls under 44px: ${m.small.length}${m.small.length ? ' [' + m.small.slice(0, 6).join(', ') + ']' : ''}`)
      check(`${v.name} ${who} ${label}: no sideways scroll`, m.overflow <= 0)
      if (v.name === 'phone') check(`phone ${who} ${label}: TeachingBase controls at least 44px`, m.small.length === 0, m.small.join(', '))
      await page.screenshot({ path: path.join(outDir, `${who}-${label}-${v.name}.png`), fullPage: true })
    }
    await ctx.close()
  }
}

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\nconsole/page errors: ${errors.length}; failed checks: ${failed}; screenshots in ${outDir}`)
await browser.close()
process.exit(failed ? 1 : 0)
