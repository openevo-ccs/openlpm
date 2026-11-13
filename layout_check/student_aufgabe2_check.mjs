#!/usr/bin/env node
// Checks Susan's 2026-11-12 feedback row 1acd80a7: the page "Aufgabe 2: Didaktische Methoden" exists under Meine Arbeit
// but stays invisible for students for now.
//   - A plain member in the Jena view sees no "Aufgabe 2" menu entry, and typing the address sends them to the start page.
//   - A space owner can open the page by address. The QA account is only a contributor, so for this case the one membership
//     answer is fetched for real and the browser is shown "owner" in place of "contributor".
// Nothing is written to any account.
//
// Usage: node layout_check/student_aufgabe2_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5263/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'student-aufgabe2')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
let roleSeen = 'member'
let projectRole = null
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: roleSeen }), headers: { 'access-control-allow-origin': '*' } })
})
await page.route((u) => /\/rest\/v1\/project_members$/.test(u.pathname) && /select=role(%2C|,)joined_via/.test(u.search), async (route) => {
  const response = await route.fetch()
  if (!projectRole || !response.ok()) return route.fulfill({ response })
  const body = await response.json()
  for (const row of Array.isArray(body) ? body : [body]) if (row && typeof row === 'object') row.role = projectRole
  return route.fulfill({ response, json: body })
})
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
const open = async (hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500) }

// A plain member in the Jena view
await open('/dashboard/evomentor-thuringia')
const nav = await page.locator('.student-nav').innerText().catch(() => '')
check('member: the Jena menu is shown', /MEINE ARBEIT/.test(nav) && /Aufgabe 1: Basiskonzepte/.test(nav), nav.replace(/\n/g, ' | ').slice(0, 160))
check('member: no "Aufgabe 2" entry in the menu', !/Aufgabe 2/.test(nav))
await open('/dashboard/evomentor-thuringia/aufgabe2')
const body = await page.locator('main, .page, body').first().innerText()
check('member: typing the address does not show the page', !/Didaktische Methoden/.test(body))
check('member: they end up on the start page', /#\/dashboard\/evomentor-thuringia\/?$/.test(page.url()), page.url())
await page.screenshot({ path: path.join(outDir, '1-member-redirected.png') })

// A space owner
roleSeen = 'member'
projectRole = 'owner'
await open('/dashboard/evomentor-thuringia/aufgabe2')
const ownerBody = await page.locator('.student-page').innerText().catch(() => '')
check('owner: the page opens by address', /Aufgabe 2: Didaktische Methoden/.test(ownerBody) && /Diese Aufgabe wird noch vorbereitet/.test(ownerBody), ownerBody.replace(/\n/g, ' / ').slice(0, 140))
await page.screenshot({ path: path.join(outDir, '2-owner-page.png') })
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
