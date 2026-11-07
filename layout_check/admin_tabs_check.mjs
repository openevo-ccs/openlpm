#!/usr/bin/env node
// Checks the Admin area (feedback cc19c44c, 2026-11-07) in a real browser with the standing QA account.
// Part 1: the QA account answered as a plain member: no Admin or Concept meanings button, and the admin addresses show the "not available" note.
// Part 2: the same account answered as an admin for the one request that asks for the role (the account and database stay unchanged):
//   one Admin button, six tabs, each tab opens, Concept meanings lives inside Base repos, old addresses redirect.
//
// Usage: node layout_check/admin_tabs_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5198/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'admin-tabs')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
async function newSession(asAdmin) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.__errors = []
  page.on('pageerror', (e) => page.__errors.push(String(e)))
  // The standing QA account carries the admin role in the database, so both parts answer the role request themselves. The route is set first
  // and the page reloaded after sign-in, because the role is read once when the page starts.
  await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: asAdmin ? 'admin' : 'member' }), headers: { 'access-control-allow-origin': '*' } }))
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base)
  await page.reload({ waitUntil: 'networkidle' })
  return page
}
const go = async (page, hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(600) }

// ---- Part 1: not an admin ----
{
  const page = await newSession(false)
  await go(page, '/dashboard')
  const header = await page.locator('header.topbar').innerText()
  check('non-admin: no Admin button', !/\bAdmin\b/.test(header))
  check('non-admin: no Concept meanings, Explore or Edit Data button', !/Concept meanings|Explore|Edit Data/.test(header))
  await go(page, '/dashboard/admin/users')
  check('non-admin: admin address shows the note', (await page.locator('body').innerText()).includes("isn't available to your account"))
  await go(page, '/dashboard/concept-meanings')
  check('non-admin: old Concept meanings address ends at the note', (await page.locator('body').innerText()).includes("isn't available to your account"), page.url())
  check('non-admin: no page errors', page.__errors.length === 0, page.__errors.join(' | ').slice(0, 200))
  await page.context().close()
}

// ---- Part 2: answered as admin ----
{
  const page = await newSession(true)
  await go(page, '/dashboard')
  const header = await page.locator('header.topbar').innerText()
  check('admin: header has one Admin button', /\bAdmin\b/.test(header) && !/Concept meanings|Explore|Edit Data/.test(header), header.replace(/\n/g, ' | '))
  await page.locator('header.topbar a:has-text("Admin")').click()
  await page.waitForTimeout(800)
  check('admin: Admin button opens the Accounts tab', page.url().endsWith('/dashboard/admin/users'), page.url())
  const tabs = await page.locator('aside[aria-label="Admin sections"] nav a').allInnerTexts()
  check('admin: six tabs in the sidebar', tabs.length === 6, tabs.join(' | '))
  await page.screenshot({ path: path.join(outDir, 'accounts.png') })

  const expect = [
    ['/dashboard/admin/users', 'Accounts', 'Accounts'],
    ['/dashboard/admin/projects', 'Projects', 'Projects'],
    ['/dashboard/admin/join-rules', 'Join rules', 'Join rules'],
    ['/dashboard/admin/feedback', 'Feedback', 'Every submission from the Feedback button'],
    ['/dashboard/admin/explore', 'Base repos', 'Base Repo Explorer'],
    ['/dashboard/admin/content', 'Edit data', null],
  ]
  for (const [route, tab, text] of expect) {
    await go(page, route)
    const active = await page.locator('aside[aria-label="Admin sections"] nav a.active').allInnerTexts()
    const body = await page.locator('main').innerText()
    check(`admin: ${route} marks "${tab}" and shows its page`, active.length === 1 && active[0].trim() === tab && (text === null || body.includes(text)), `active=${active.join(',')}`)
    await page.screenshot({ path: path.join(outDir, route.split('/').pop() + '.png') })
  }
  await go(page, '/dashboard/admin/feedback')
  await page.waitForSelector('text=Last 6 months', { timeout: 20000 }).catch(() => {})
  check('admin: Feedback tab has the weekly chart and the list', (await page.locator('main').innerText()).includes('Last 6 months') && (await page.locator('main button:has-text("Open")').count()) > 0)

  // ConceptBase inside Base repos
  await go(page, '/dashboard/admin/explore')
  await page.locator('main a:has-text("ConceptBase")').click()
  await page.waitForTimeout(1500)
  check('admin: ConceptBase tab opens Concept meanings', page.url().endsWith('/dashboard/admin/concept-meanings') && (await page.locator('main h1').first().innerText()).includes('Concept meanings'), page.url())
  const active = await page.locator('aside[aria-label="Admin sections"] nav a.active').allInnerTexts()
  check('admin: sidebar keeps "Base repos" marked on the Concept meanings page', active.length === 1 && active[0].trim() === 'Base repos', active.join(','))
  check('admin: repo tabs shown above Concept meanings with ConceptBase marked', (await page.locator('main [aria-current="page"]:has-text("ConceptBase")').count()) === 1)
  await page.screenshot({ path: path.join(outDir, 'conceptbase.png') })
  await page.locator('main a:has-text("TheoryBase")').first().click()
  await page.waitForTimeout(1200)
  check('admin: a repo tab on that page goes back to the Explorer with that repo', page.url().includes('/dashboard/admin/explore?tab='), page.url())
  const primary = await page.locator('main .btn-primary').first().innerText()
  check('admin: the Explorer opens on the repo asked for', /TheoryBase/.test(primary), primary)

  // old addresses
  await go(page, '/dashboard/concept-meanings')
  check('admin: old Concept meanings address redirects', page.url().endsWith('/dashboard/admin/concept-meanings'), page.url())
  await go(page, '/dashboard/admin')
  check('admin: /dashboard/admin opens Accounts', page.url().endsWith('/dashboard/admin/users'), page.url())
  check('admin: no page errors', page.__errors.length === 0, page.__errors.join(' | ').slice(0, 300))
  await page.context().close()
}

await browser.close()
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
