#!/usr/bin/env node
// Checks the "New here? Start here" card on the project list (feedback 15385d44, Dustin 2026-11-07), signed in as the standing QA account.
// Rules: it starts collapsed; someone who expands it keeps it open; it disappears for a member who has opened two or more spaces;
// an admin always sees it. The QA account holds the admin role in the database, so each part answers the role request itself.
// The card reads the list of opened spaces when the project list opens, so each stored list is followed by a page reload, like a new visit.
//
// Usage: node layout_check/start_here_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5197/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'start-here')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()

async function newSession(role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.__errors = []
  page.on('pageerror', (e) => page.__errors.push(String(e)))
  await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role }), headers: { 'access-control-allow-origin': '*' } }))
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base)
  await page.evaluate(() => { try { localStorage.removeItem('openlpm.startHere.collapsed'); localStorage.removeItem('openlpm.visitedSpaces') } catch {} })
  await page.reload({ waitUntil: 'networkidle' })
  return page
}
const go = async (page, hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200) }
const card = (page) => page.locator('section.start-here')
const expanded = async (page) => (await page.locator('section.start-here .start-here-head').getAttribute('aria-expanded')) === 'true'
const visited = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('openlpm.visitedSpaces') || '[]') } catch { return null } })

// ---- Admin ----
{
  const page = await newSession('admin')
  await go(page, '/dashboard')
  check('admin: card is shown on the project list', (await card(page).count()) === 1)
  check('admin: card starts collapsed', (await card(page).count()) === 1 && !(await expanded(page)))
  check('admin: body text hidden while collapsed', (await page.locator('#start-here-body').count()) === 0)
  await page.screenshot({ path: path.join(outDir, 'admin-collapsed.png') })
  await page.locator('section.start-here .start-here-head').click()
  check('admin: clicking opens it', await expanded(page))
  await page.screenshot({ path: path.join(outDir, 'admin-expanded.png') })
  await go(page, '/dashboard')
  check('admin: a card opened on purpose stays open after reload', await expanded(page))
  await page.locator('section.start-here .start-here-head').click()
  await go(page, '/dashboard')
  check('admin: a card closed again stays closed after reload', !(await expanded(page)))

  // Opening spaces is recorded, and the admin still sees the card afterwards.
  await go(page, '/dashboard/evomentor-thuringia')
  const one = await visited(page)
  check('admin: opening one space records its address', Array.isArray(one) && one.includes('evomentor-thuringia'), JSON.stringify(one))
  await go(page, '/dashboard/evomentor-thuringia')
  check('admin: opening the same space again does not add a second entry', (await visited(page)).length === 1)
  await go(page, '/dashboard/evomentor-thuringia-sandbox')
  const two = await visited(page)
  check('admin: a second space is recorded', Array.isArray(two) && two.length === 2, JSON.stringify(two))
  await go(page, '/dashboard/no-such-space-1107')
  check('admin: an address that does not open a space is not recorded', (await visited(page)).length === 2, JSON.stringify(await visited(page)))
  await go(page, '/dashboard')
  check('admin: card still shown after two spaces', (await card(page).count()) === 1)
  check('admin: no page errors', page.__errors.length === 0, page.__errors.join(' | ').slice(0, 200))
  await page.context().close()
}

// ---- Member (the QA account belongs to several spaces, so the project list opens) ----
{
  const page = await newSession('member')
  await go(page, '/dashboard')
  check('member: the project list opens', (await page.locator('body').innerText()).includes('Your project spaces'), page.url())
  check('member: before opening spaces the card is shown, collapsed', (await card(page).count()) === 1 && !(await expanded(page)))
  await page.screenshot({ path: path.join(outDir, 'member-new.png') })
  await page.evaluate(() => localStorage.setItem('openlpm.visitedSpaces', JSON.stringify(['evomentor-thuringia'])))
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  check('member: after one space the card is still shown', (await card(page).count()) === 1)
  await page.evaluate(() => localStorage.setItem('openlpm.visitedSpaces', JSON.stringify(['evomentor-thuringia', 'bee-lpm-de'])))
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  check('member: after two spaces the card is gone', (await card(page).count()) === 0)
  check('member: the project list itself is still there', (await page.locator('body').innerText()).includes('EvoMentor Thüringen'))
  await page.screenshot({ path: path.join(outDir, 'member-two-spaces.png') })
  await page.evaluate(() => localStorage.setItem('openlpm.visitedSpaces', 'not json'))
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  check('member: unreadable stored list does not break the page (card shown)', (await card(page).count()) === 1 && page.__errors.length === 0, page.__errors.join(' | ').slice(0, 200))
  await page.context().close()
}

await browser.close()
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
