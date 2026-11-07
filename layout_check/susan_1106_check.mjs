#!/usr/bin/env node
// Checks Susan's feedback of 2026-11-06 in a real browser as the standing QA account, against the real data:
//   sort menu (no "Standard", Lehrplan order is the default), Basiskonzepte tab name, side menu (no Wochenplan),
//   the Aufgabe 1 instruction and two criteria questions, the hand-in with the student's name (and the Word file),
//   and the tour steps "Details zu den Basiskonzepten", "Meine Arbeit" and "Gruppen".
//
// The guided_tours answer is the live one with the three steps changed exactly as migration 231 changes them,
// because 231 is not pushed when this runs. Pass --live once it is pushed, to test the stored tour itself.
//
// Usage: node layout_check/susan_1106_check.mjs [base] [outDir] [--live]

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const base = args[0] || 'http://localhost:5199/'
const outDir = args[1] || path.join(ROOT, 'layout_check', 'out', 'susan-1106')
const live = process.argv.includes('--live')
mkdirSync(outDir, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)

// Tour answer: live rows, with migration 231's three changes applied when 231 is not pushed yet.
await page.route('**/rest/v1/guided_tours*', async (route) => {
  const res = await route.fetch()
  const rows = await res.json()
  if (!live && Array.isArray(rows)) {
    for (const row of rows) {
      row.steps = (row.steps ?? []).map((s) => {
        if (s.title === 'Details zu den Basiskonzepten' && s.page === 'basiskonzepte' && !s.anchor) return { ...s, page: 'basiskonzepte/detail' }
        if (s.title === 'Meine Arbeit' && s.anchor === 'sidebar' && s.page === undefined) return { ...s, anchor: 'sidebar.meine-arbeit' }
        if (s.title === 'Gruppen' && s.anchor === 'sidebar' && s.page === undefined) return { ...s, anchor: 'gruppen.liste', page: 'groups' }
        return s
      })
    }
  }
  await route.fulfill({ response: res, json: rows })
})

const space = base + '#/dashboard/evomentor-thuringia'

// ---- 1. Lernziele: sort menu and side menu
await page.goto(space, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-tour="lernziele.kopf"]', { timeout: 30000 })
await page.waitForSelector('[data-tour="lernziele.karte"]', { timeout: 30000 })
const sortSel = page.locator('.student-toolbar select').first()
const options = await sortSel.locator('option').allTextContents()
const selected = await sortSel.evaluate((el) => el.options[el.selectedIndex].textContent)
check('sort menu has no "Standard"', !options.includes('Standard'), options.join(' | '))
check('sort menu starts on "Reihenfolge im Lehrplan"', selected === 'Reihenfolge im Lehrplan', selected)
const firstTitles = await page.locator('[data-tour="lernziele.karte"]').first().evaluate((el) => el.textContent.slice(0, 120))
console.log('   first card:', firstTitles.replace(/\s+/g, ' '))
const navText = await page.locator('.student-nav').innerText()
check('side menu has no Wochenplan', !/Wochenplan/.test(navText), navText.replace(/\n+/g, ' / '))
check('side menu section marks exist', (await page.locator('[data-tour="sidebar.meine-arbeit"]').count()) === 1 && (await page.locator('[data-tour="sidebar.gruppen"]').count()) === 1)
await page.screenshot({ path: path.join(outDir, '01-lernziele.png') })

// Wochenplan by address leads back to the start page
await page.goto(space + '/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const hashAfterCalendar = await page.evaluate(() => location.hash)
check('/calendar no longer opens the Wochenplan', hashAfterCalendar === '#/dashboard/evomentor-thuringia', hashAfterCalendar)

// ---- 2. Basiskonzepte tab name
await page.goto(space + '/basiskonzepte/detail', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-tour="basiskonzepte.kopf"]')
const tabs = await page.locator('[data-tour="basiskonzepte.kopf"] button').allTextContents()
check('Basiskonzepte tabs: Details zu den Basiskonzepten', tabs.includes('Details zu den Basiskonzepten') && !tabs.includes('Detail'), tabs.join(' | '))
await page.screenshot({ path: path.join(outDir, '02-basiskonzepte-details.png') })

// ---- 3. Aufgabe 1: wording
await page.goto(space + '/meine-arbeit', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const body = await page.locator('main, .project-main, body').first().innerText()
let starred = false
const hasGoals = /Verknüpfung|Beurteil/.test(body) && (await page.getByText('Fachliche Korrektheit').count()) > 0
if (!hasGoals) {
  console.log('   (the QA account has no starred goal: starring one for this check, and unstarring it at the end)')
  await page.goto(space, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-tour="lernziele.favorit"]')
  starred = true
  // a goal that has link suggestions, so the four questions can be seen
  await page.locator('[data-tour="lernziele.suche"] input').fill('Fotosynthese: Wort')
  await page.waitForTimeout(600)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('user_favorite_learning_goals') && r.request().method() === 'POST'),
    page.locator('[data-tour="lernziele.favorit"]').first().click(),
  ])
  await page.waitForTimeout(500)
  await page.goto(space + '/meine-arbeit', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
}
await page.waitForSelector('text=Vorschlag: Relevanz', { timeout: 20000 })
// The four questions show once a link card is opened ("beurteilen").
const openBtn = page.getByRole('button', { name: /^(weiter )?beurteilen$/ }).first()
if (await openBtn.count()) await openBtn.click()
await page.waitForTimeout(500)
const work = await page.locator('body').innerText()
check('instruction no longer says "Du musst nicht alle beurteilen"', !/Du musst nicht alle/.test(work))
check('instruction asks for every starred goal', /Beurteile für jedes deiner gemerkten Lernziele\s+die vorgeschlagenen Verknüpfungen nach vier Kriterien\./.test(work))
check('question 2 is Susan\'s wording', work.includes('Hat die Basiskonzeptverknüpfung mein eigenes biologisches Fachwissen erweitert oder vertieft?'))
check('question 4 is Susan\'s wording', work.includes('Hilft die Verknüpfung, einen an Basiskonzepten orientierten Unterricht zu planen?'))
await page.screenshot({ path: path.join(outDir, '03-aufgabe1.png') })

// ---- 4. Abgabe: name instead of code
await page.getByRole('button', { name: 'Abgabe' }).click()
await page.waitForSelector('text=Das steht in deiner Datei')
await page.waitForTimeout(800)
const abgabe = await page.locator('body').innerText()
check('Abgabe shows no Teilnahme-Code', !/Teilnahme-Code/.test(abgabe) && !/JBD-[A-Z0-9]{4}-/.test(abgabe))
const prefilled = await page.locator('#handin-name').inputValue()
check('profile name that is just an address is never pre-filled', !prefilled.includes('@'), JSON.stringify(prefilled))
await page.locator('#handin-name').fill('')
check('download is off while the name is empty', await page.getByRole('button', { name: /Word-Datei herunterladen/ }).isDisabled())
await page.screenshot({ path: path.join(outDir, '04-abgabe-empty.png') })
const testName = 'Erika Mustermann-Müller (QA)'
await page.locator('#handin-name').fill(testName)
await page.locator('#handin-name').blur()
await page.waitForTimeout(1200)
const nameRow = await page.locator('tr', { hasText: 'Dein Name' }).innerText()
check('summary table shows the typed name', nameRow.includes(testName), nameRow.replace(/\s+/g, ' '))
await page.screenshot({ path: path.join(outDir, '04-abgabe.png') })
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Word-Datei herunterladen/ }).click()])
const docxPath = path.join(outDir, dl.suggestedFilename())
await dl.saveAs(docxPath)
console.log('   downloaded:', dl.suggestedFilename())
check('Word file name carries the name and no code', /^EvoMentor_Abgabe_Erika_Mustermann_Mueller_QA_\d{4}-\d{2}-\d{2}\.docx$/.test(dl.suggestedFilename()), dl.suggestedFilename())
const xml = execFileSync('python', ['-I', '-c', 'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("word/document.xml"))', docxPath], { maxBuffer: 50 * 1024 * 1024 }).toString('utf-8')
check('Word file says "Name: ..." and has no Teilnahme-Code', xml.includes('Name: ' + testName) && !xml.includes('Teilnahme-Code'))
check('Word file holds no email address', !/[\w.+-]+@[\w-]+\.[\w.]+/.test(xml.replace(/<[^>]+>/g, ' ')))

// ---- 5. Tour steps 16 to 19
await page.goto(space, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-tour="lernziele.kopf"]')
await page.getByRole('button', { name: 'Hilfe' }).click()
await page.waitForSelector('text=Geführte Touren')
await page.getByRole('button', { name: 'Tour durch die EvoMentor App' }).click()
const tourReport = []
for (let i = 0; i < 19; i++) {
  await page.waitForTimeout(i >= 14 ? 2200 : 700)
  if (i >= 15) {
    const info = await page.evaluate(() => {
      const card = document.querySelector('.tour-card')
      const spot = document.querySelector('.tour-spot')
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }
      return { title: card?.querySelector('.tour-title')?.textContent, count: card?.querySelector('.tour-count')?.textContent, spot: r(spot), missing: card?.querySelector('.tour-missing')?.textContent ?? null, hash: location.hash }
    })
    tourReport.push({ step: i + 1, ...info })
    await page.screenshot({ path: path.join(outDir, `tour-${String(i + 1).padStart(2, '0')}.png`) })
  }
  const nextBtn = page.locator('.tour-actions .btn-primary')
  if ((await nextBtn.count()) === 0) break
  await nextBtn.click()
}
console.log(JSON.stringify(tourReport, null, 1))
const t = (n) => tourReport.find((r) => r.step === n)
check('tour step 16 (Netz) is on the Netz page', t(16)?.hash.endsWith('/basiskonzepte/netz'), t(16)?.hash)
check('tour step 17 (Details zu den Basiskonzepten) is on the Details page', t(17)?.hash.endsWith('/basiskonzepte/detail'), t(17)?.hash)
check('tour step 18 (Meine Arbeit) highlights the menu section only', !!t(18)?.spot && t(18).spot.h < 250 && !t(18).missing, JSON.stringify(t(18)?.spot))
check('tour step 19 (Gruppen) opens the Gruppen page and highlights its list', t(19)?.hash.endsWith('/groups') && !!t(19)?.spot && !t(19).missing, `${t(19)?.hash} ${JSON.stringify(t(19)?.spot)}`)

if (starred) {
  // leave the QA account as it was found
  await page.goto(space, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-tour="lernziele.favorit"]')
  await page.locator('[data-tour="lernziele.suche"] input').fill('Fotosynthese: Wort')
  await page.waitForTimeout(600)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('user_favorite_learning_goals') && r.request().method() === 'DELETE'),
    page.locator('[data-tour="lernziele.favorit"]').first().click(),
  ])
  console.log('   (unstarred the goal again)')
}
check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 300))
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ results, tourReport }, null, 2))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
