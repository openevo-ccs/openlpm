#!/usr/bin/env node
// Plays the Jena guided tour end to end in a real browser as the standing QA
// account, against the real Lernziele and Basiskonzepte data, and reports for
// every step whether its target was found and where the card sits.
//
// The guided_tours table (migration 227) may not be pushed yet, so the tour
// list request is answered from the migration file itself: the steps below are
// parsed out of supabase/migrations/227_guided_tours.sql, so what is tested is
// what will be stored.
//
// Usage: [TOUR_VIEWPORT=390x844] node layout_check/tour_check.mjs [base] [outDir] [--no-try]
//   base   default http://localhost:5174/
//   --live    use the real guided_tours table instead of the stand-in (migration 227 pushed 2026-11-04)
//   --no-try  only press Weiter, never perform the "Probiere es aus" actions

import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const base = args[0] || 'http://localhost:5174/'
const outDir = args[1] || path.join(ROOT, 'layout_check', 'out', 'tour')
const doTry = !process.argv.includes('--no-try')
mkdirSync(outDir, { recursive: true })

const sql = readFileSync(path.join(ROOT, 'supabase', 'migrations', '227_guided_tours.sql'), 'utf8')
const steps = JSON.parse(sql.match(/\$steps\$([\s\S]*?)\$steps\$/)[1])

const browser = await chromium.launch()
const [vpW, vpH] = (process.env.TOUR_VIEWPORT || '1440x900').split('x').map(Number)
const page = await browser.newPage({ viewport: { width: vpW, height: vpH } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)

// Real project id, read with the QA user's own token.
const projectId = await page.evaluate(async () => {
  const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
  const token = JSON.parse(localStorage.getItem(key)).access_token
  const anon = document.documentElement.dataset.anon
  void anon
  return token
}).then(async (token) => {
  const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
  const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
  const r = await fetch(`${url}/rest/v1/projects?slug=eq.evomentor-thuringia&select=id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  })
  return (await r.json())[0].id
})

if (!process.argv.includes('--live')) await page.route('**/rest/v1/guided_tours*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        id: '00000000-0000-4000-8000-000000000227',
        project_id: projectId,
        title: 'Tour durch die Lernziele und Basiskonzepte',
        description: 'Das Seitenmenü, die Suche nach Lernzielen und die Übersicht der Basiskonzepte.',
        language: 'de',
        view_id: null,
        template_id: 'jena-biologiedidaktik-de',
        steps,
        is_published: true,
        offer_on_first_visit: false,
        sort_order: 0,
        updated_at: new Date().toISOString(),
        spaces: [],
      },
    ]),
  }),
)

await page.goto(base + '#/dashboard/evomentor-thuringia', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-tour="lernziele.kopf"]', { timeout: 30000 })
await page.screenshot({ path: path.join(outDir, '00-start.png') })

await page.getByRole('button', { name: 'Hilfe' }).click()
await page.waitForSelector('text=Geführte Touren')
await page.screenshot({ path: path.join(outDir, '01-help-menu.png') })
await page.getByText('Tour durch die Lernziele und Basiskonzepte').click()

const report = []
const tryActions = {
  3: async () => page.locator('[data-tour="lernziele.suche"] input').fill('Pflanze'),
  4: async () => page.locator('[data-tour="lernziele.klassenstufe"] button', { hasText: '5/6' }).first().click(),
  5: async () => page.locator('[data-tour="lernziele.thema"] select').selectOption({ label: '2.2.7 Samenpflanzen' }),
  6: async () => page.locator('[data-tour="lernziele.unterthema"] select').selectOption({ label: 'Ernährung der Samenpflanzen' }),
  7: async () => {
    const box = page.locator('[data-tour="lernziele.basiskonzepte"] label', { hasText: 'Struktur und Funktion' }).first()
    await box.locator('input[type=checkbox]').check()
    const chips = page.locator('[data-tour="lernziele.basiskonzepte"] .chip-btn[title="niedrig"], [data-tour="lernziele.basiskonzepte"] .chip-btn[title="mittel"]')
    // Only the chips under the Struktur und Funktion row.
    const row = box.locator('xpath=..')
    await row.locator('.chip-btn[title="niedrig"]').click()
    await row.locator('.chip-btn[title="mittel"]').click()
    void chips
  },
  8: async () => page.locator('[data-tour="lernziele.karte"]').first().click(),
  10: async () => page.locator('[data-tour="lernziele.bezuege"]').first().click(),
  11: async () => page.locator('[data-tour="lernziele.strategien"]').first().click(),
}

for (let i = 0; i < steps.length; i++) {
  await page.waitForTimeout(1900) // lets the step settle: navigation, scroll, hint timer
  const info = await page.evaluate(() => {
    const card = document.querySelector('.tour-card')
    const spot = document.querySelector('.tour-spot')
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }
    return {
      title: card?.querySelector('.tour-title')?.textContent,
      count: card?.querySelector('.tour-count')?.textContent,
      spot: r(spot),
      card: r(card),
      missing: card?.querySelector('.tour-missing')?.textContent ?? null,
      cardVisible: card ? getComputedStyle(card).visibility === 'visible' : false,
      vw: innerWidth,
      vh: innerHeight,
    }
  })
  info.index = i
  info.hash = await page.evaluate(() => location.hash)
  if (info.spot && info.card) {
    const s = info.spot
    const c = info.card
    info.cardOverlapsSpot = !(c.x + c.w <= s.x || c.x >= s.x + s.w || c.y + c.h <= s.y || c.y >= s.y + s.h)
    info.cardInViewport = c.x >= 0 && c.y >= 0 && c.x + c.w <= info.vw && c.y + c.h <= info.vh
  }
  report.push(info)
  await page.screenshot({ path: path.join(outDir, `step-${String(i).padStart(2, '0')}.png`) })

  if (doTry && tryActions[i]) {
    try {
      await tryActions[i]()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(outDir, `step-${String(i).padStart(2, '0')}-after-try.png`) })
    } catch (e) {
      info.tryError = String(e).split('\n')[0]
    }
  }
  const nextBtn = page.locator('.tour-actions .btn-primary')
  await nextBtn.click()
}

await page.waitForTimeout(500)
report.push({ finished: (await page.locator('.tour-card').count()) === 0, errors })
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.map((r) => (r.finished !== undefined ? r : { i: r.index, title: r.title, count: r.count, hash: r.hash, found: !!r.spot, missing: r.missing, overlap: r.cardOverlapsSpot, inView: r.cardInViewport, tryError: r.tryError })), null, 1))
await browser.close()
