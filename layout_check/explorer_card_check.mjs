#!/usr/bin/env node
// Checks the Base Repo Explorer fixes of 2026-11-08 (Susan's feedback rows ca05a77a, 6ad9269a, b8454f68, 70b8d0b0 and Dustin's cea80aaa) in a
// browser with the standing QA account, answered as admin for the one role request (the account and database stay unchanged).
//
// Usage: node layout_check/explorer_card_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5199/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'explorer-card')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.reload({ waitUntil: 'networkidle' })
const go = async (hash) => { await page.goto(base + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(800) }

// ---- wording ----
await go('/dashboard/admin/explore')
const intro = await page.locator('main p.muted').first().innerText()
check('page description has no "real"', !/\breal\b/i.test(intro), intro.replace(/\s+/g, ' ').slice(0, 120))

// ---- MethodsBase table next to the card: nothing sits under the card ----
await page.getByRole('button', { name: /^MethodsBase/ }).click()
await page.waitForTimeout(800)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(600)
const geo = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.card')].find((c) => c.querySelector('h3') && c.style.position === 'sticky')
  const table = document.querySelector('table')
  const wrap = table?.parentElement
  const cardLeft = card ? card.getBoundingClientRect().left : null
  const wrapRight = wrap ? wrap.getBoundingClientRect().right : null
  return { cardLeft, wrapRight, tableRight: table?.getBoundingClientRect().right, wrapScrolls: wrap ? wrap.scrollWidth > wrap.clientWidth : null }
})
check('table area ends before the card starts', geo.cardLeft !== null && geo.wrapRight <= geo.cardLeft + 1, JSON.stringify(geo))
await page.screenshot({ path: path.join(outDir, 'methods-table-and-card.png') })
// A narrower window is where the table used to run under the card.
await page.setViewportSize({ width: 1180, height: 900 })
await page.waitForTimeout(500)
const narrowGeo = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.card')].find((c) => c.querySelector('h3') && c.style.position === 'sticky')
  const table = document.querySelector('table'); const wrap = table.parentElement
  return { cardLeft: card.getBoundingClientRect().left, wrapRight: wrap.getBoundingClientRect().right, tableWidth: table.scrollWidth, wrapWidth: wrap.clientWidth }
})
check('narrow window: table area still ends before the card, extra width scrolls inside it', narrowGeo.wrapRight <= narrowGeo.cardLeft + 1, JSON.stringify(narrowGeo))
await page.screenshot({ path: path.join(outDir, 'methods-table-and-card-narrow.png') })
await page.setViewportSize({ width: 1600, height: 900 })
await page.waitForTimeout(300)

// ---- LiteratureBase: citation under the title, copy button, DOI link in a new tab ----
await page.getByRole('button', { name: /^LiteratureBase/ }).click()
await page.waitForTimeout(1500)
await page.locator('input[aria-label="Search all fields"]').fill('gentner structure-mapping')
await page.waitForTimeout(600)
await page.locator('tbody tr').first().click()
await page.waitForTimeout(800)
const cite = page.locator('[data-testid="apa-citation"]')
check('citation box is shown', (await cite.count()) === 1)
const citeText = (await cite.innerText()).replace(/\s+/g, ' ')
console.log('      ' + citeText)
check('citation is APA (initials, year in brackets, italic journal, https DOI)', /Gentner, D\. \(1983\)\./.test(citeText) && /Cognitive Science, 7\(2\), 155–170\./.test(citeText) && /https:\/\/doi\.org\/10\.1207\/s15516709cog0702_3/.test(citeText))
check('journal name is in italics', (await cite.locator('i').allInnerTexts()).some((t) => /Cognitive Science/.test(t)))
// the box comes right after the title and before the id line
const order = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.card')].find((c) => c.style.position === 'sticky')
  const kids = [...card.children].map((c) => (c.getAttribute('data-testid') ? 'citation' : c.tagName === 'DIV' && c.querySelector('h3') ? 'title' : c.tagName === 'P' ? 'p' : c.tagName.toLowerCase()))
  return kids.slice(0, 3)
})
check('citation sits right below the title', order[0] === 'title' && order[1] === 'citation', order.join(','))
await cite.getByRole('button', { name: /Copy citation/ }).click()
await page.waitForTimeout(400)
const clip = await page.evaluate(() => navigator.clipboard.readText())
check('copy button puts the plain citation on the clipboard', /^Gentner, D\. \(1983\)\. Structure-Mapping/.test(clip) && !/</.test(clip), clip.slice(0, 80))
check('button says Copied', (await cite.innerText()).includes('Copied'))

await page.getByText('Full record').click()
const doiLink = page.locator('a[href^="https://doi.org/10.1207"]').filter({ hasText: 'doi.org/10.1207' })
check('DOI / URL row is a link', (await doiLink.count()) >= 1)
check('link opens in a new tab', (await doiLink.first().getAttribute('target')) === '_blank' && /noopener/.test((await doiLink.first().getAttribute('rel')) ?? ''))
await page.screenshot({ path: path.join(outDir, 'literature-card.png') })

// ---- a taller-than-window card scrolls in itself ----
await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(300)
const cardBox = await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((x) => x.style.position === 'sticky'); const r = c.getBoundingClientRect(); return { bottom: r.bottom, vh: window.innerHeight } })
check('after scrolling, the card fits inside the window height', cardBox.bottom <= cardBox.vh + 1, JSON.stringify(cardBox))

// ---- Admin menu collapses and the choice is remembered ----
const side = page.locator('aside[aria-label="Admin sections"]')
const wide = (await side.boundingBox()).width
await side.getByRole('button', { name: 'Collapse sidebar' }).click()
await page.waitForTimeout(400)
const narrow = (await side.boundingBox()).width
check('sidebar narrows when collapsed', narrow < wide - 100, `${wide} -> ${narrow}`)
check('tab labels hidden, tabs still reachable by icon', (await side.locator('nav a .nav-label:visible').count()) === 0 && (await side.locator('nav a:visible').count()) === 6)
await page.screenshot({ path: path.join(outDir, 'sidebar-collapsed.png') })
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800)
check('collapsed state survives a reload', (await page.locator('aside[aria-label="Admin sections"]').boundingBox()).width < 100)
await page.locator('aside[aria-label="Admin sections"]').getByRole('button', { name: 'Expand sidebar' }).click()
await page.waitForTimeout(300)
check('expands again', (await page.locator('aside[aria-label="Admin sections"]').boundingBox()).width > 150)

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
