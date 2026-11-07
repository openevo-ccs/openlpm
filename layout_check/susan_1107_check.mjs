#!/usr/bin/env node
// Checks Susan's feedback of 2026-11-07 in a real browser as the standing QA account, against the real data:
//   Netz page (Beschreibung box, cards removed or renamed, matrix, grade stripes, diamonds), the address .../aufgabe1,
//   the "mindestens eines / alle gewählten" choice in the Lernziele filter, the word "echt", and the count of accepted goals.
//
// Usage: node layout_check/susan_1107_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const base = args[0] || 'http://localhost:5199/'
const outDir = args[1] || path.join(ROOT, 'layout_check', 'out', 'susan-1107')
mkdirSync(outDir, { recursive: true })

const check = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
const space = base + '#/dashboard/evomentor-thuringia'

// ---- Netz ----
await page.goto(space + '/basiskonzepte/netz', { waitUntil: 'networkidle' })
await page.waitForSelector('.netz-controls')
await page.waitForSelector('h3:has-text("Gemeinsame Lernziele je zwei Basiskonzepte")', { timeout: 30000 })
await page.waitForTimeout(1500)
const netzText = await page.locator('body').innerText()
check('Beschreibung box exists, closed at first', (await page.locator('details.netz-description').count()) === 1 && !(await page.locator('details.netz-description').evaluate((d) => d.open)))
await page.locator('details.netz-description summary').click()
const descText = await page.locator('details.netz-description').innerText()
check('Beschreibung uses "Antippen/-klicken"', descText.includes('Antippen/-klicken eines Basiskonzepts'))
check('Beschreibung mentions diamonds and grey stripes', descText.includes('Rauten') && descText.includes('Graue Streifen'))
check('no "Wachstum über die Zeit" card', !netzText.includes('Wachstum über die Zeit'))
check('no "Verwandte Basiskonzepte" card', !netzText.includes('Verwandte Basiskonzepte'))
check('card renamed to "Basiskonzept-verknüpfende Lernziele"', netzText.includes('Basiskonzept-verknüpfende Lernziele') && !netzText.includes('Fächerübergreifende'))
const matrixRows = await page.locator('h3:has-text("Gemeinsame Lernziele je zwei Basiskonzepte") ~ div table tbody tr').count()
check('matrix has 6 rows', matrixRows === 6, `rows=${matrixRows}`)
const matrixNums = await page.locator('h3:has-text("Gemeinsame Lernziele je zwei Basiskonzepte") ~ div table tbody td').allInnerTexts()
console.log('   matrix cells:', matrixNums.join(' '))
const echt = netzText.match(/\bechte?[nrms]?\b/gi)
check('no "echt" on the Netz page', !echt, echt ? echt.join(',') : '')
await page.screenshot({ path: path.join(outDir, 'netz-top.png'), fullPage: false })
await page.locator('canvas').first().scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(outDir, 'netz-full.png'), fullPage: true })

// Stripes and diamonds: read the canvas pixels in the grey stripe zone is fragile, so look at the picture. Also test the relevance order has no stripes.
await page.locator('button.chip-btn', { hasText: /^Relevanz$/ }).first().click()
await page.waitForTimeout(800)
const descRel = await page.locator('details.netz-description').innerText()
check('with order by relevance, the text no longer mentions stripes', !descRel.includes('Graue Streifen'))
await page.screenshot({ path: path.join(outDir, 'netz-relevance-order.png'), fullPage: true })
await page.locator('button.chip-btn', { hasText: /^Klassenstufe$/ }).first().click()

// ---- Address ----
await page.goto(space + '/meine-arbeit', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check('old address redirects to aufgabe1', page.url().endsWith('/dashboard/evomentor-thuringia/aufgabe1'), page.url())
check('Aufgabe 1 page shows its title', (await page.locator('body').innerText()).includes('Aufgabe 1: Basiskonzepte'))
const navHref = await page.locator('a[title="Aufgabe 1: Basiskonzepte"]').first().getAttribute('href')
check('side menu links to aufgabe1', (navHref ?? '').endsWith('/aufgabe1'), navHref ?? '')

// ---- Lernziele filter: any / all ----
await page.goto(space, { waitUntil: 'networkidle' })
await page.waitForSelector('.student-concept-filter')
const counter = async () => {
  const t = await page.locator('text=/\\d+ von \\d+ Lernzielen/').first().innerText()
  return Number(t.match(/(\d+) von/)[1])
}
const total = await counter()
check('Lernziele page shows 352 goals', total === 352, `total=${total}`)
check('no any/all choice with nothing ticked', (await page.locator('button:has-text("alle gewählten")').count()) === 0)
const groups = page.locator('.student-concept-filter > div')
const tick = (i) => groups.nth(i).locator('label').first().locator('input').check()
await tick(0) // Evolutive Entwicklung
// Only the highest relevance (3 of 3), otherwise nearly every goal passes every concept.
const onlyHigh = async (i) => { const chips = groups.nth(i).locator('button.chip-btn'); await chips.nth(0).click(); await chips.nth(1).click() }
await onlyHigh(0)
const one = await counter()
check('no any/all choice with one concept', (await page.locator('button:has-text("alle gewählten")').count()) === 0)
await tick(2) // Struktur und Funktion
await onlyHigh(2)
const any2 = await counter()
check('choice appears with two concepts', (await page.locator('button:has-text("alle gewählten")').count()) === 1)
await page.locator('button:has-text("alle gewählten")').click()
await page.waitForTimeout(300)
const all2 = await counter()
check('"alle gewählten" gives fewer goals than "mindestens eines"', all2 < any2 && all2 > 0, `one=${one} any=${any2} all=${all2}`)
await page.locator('button:has-text("mindestens eines")').click()
await page.waitForTimeout(300)
check('back to "mindestens eines" restores the count', (await counter()) === any2)
await page.screenshot({ path: path.join(outDir, 'lernziele-filter.png') })

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
