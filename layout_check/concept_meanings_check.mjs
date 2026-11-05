#!/usr/bin/env node
// Opens the Concept meanings pages in a real browser as the standing QA account, at desktop and phone widths, and checks that each page
// shows what it should, has no sideways overflow and logs no page error.
//   node layout_check/concept_meanings_check.mjs [base] [outDir]
// base defaults to http://localhost:5173/ (npm run dev). Screenshots go to outDir (default layout_check/out/concept-meanings).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5173/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'concept-meanings')
mkdirSync(outDir, { recursive: true })

const pages = [
  { name: 'index', route: '#/dashboard/concept-meanings', expect: ['Concept meanings', 'Interdisciplinary', 'Bio-Core'] },
  { name: 'tags', route: '#/dashboard/concept-meanings?tab=tags', expect: ['AI sort, unchecked', 'Kin selection', 'Epidemiology'] },
  { name: 'ids', route: '#/dashboard/concept-meanings?tab=ids', expect: ['OE-CONCEPT-bio-core-natural-selection', 'OE-CONCEPT-000102', 'word for word'] },
  { name: 'natural-selection', route: '#/dashboard/concept-meanings/OE-CONCEPT-bio-core-natural-selection', expect: ['Natural Selection', 'Contested (kept visible on purpose)', 'drafts this concept again', 'Test cases'] },
  { name: 'cooperation', route: '#/dashboard/concept-meanings/OE-CONCEPT-oe-interdisciplinary-cooperation', expect: ['Cooperation', 'Strand guides that cite this entry', 'Sharing a word proves nothing yet'] },
  { name: 'pending-kin-selection', route: '#/dashboard/concept-meanings/OE-CONCEPT-000126', expect: ['Kin Selection', 'Drafted in an unmerged branch', 'inclusive fitness'] },
  { name: 'missing', route: '#/dashboard/concept-meanings/OE-CONCEPT-does-not-exist', expect: ['has no concept with the id'] },
]
const widths = [{ label: 'desktop', width: 1440, height: 1000 }, { label: 'phone', width: 390, height: 844 }]

const problems = []
const browser = await chromium.launch()
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w.width, height: w.height } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base)
  for (const p of pages) {
    await page.goto(`${base}${p.route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const text = await page.locator('main').innerText()
    for (const needle of p.expect) if (!text.includes(needle)) problems.push(`${w.label} ${p.name}: missing "${needle}"`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) problems.push(`${w.label} ${p.name}: sideways overflow of ${overflow}px`)
    await page.screenshot({ path: path.join(outDir, `${w.label}-${p.name}.png`), fullPage: true })
  }
  const real = errors.filter((e) => !/favicon|Failed to load resource.*(404|406)/.test(e))
  if (real.length) problems.push(`${w.label}: page errors: ${real.slice(0, 3).join(' | ')}`)
  await page.close()
}
await browser.close()
writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify({ base, checked: pages.length * widths.length, problems }, null, 2))
console.log(`Checked ${pages.length} pages at ${widths.length} widths. Problems: ${problems.length}`)
for (const p of problems) console.log(' -', p)
process.exit(problems.length ? 1 : 0)
