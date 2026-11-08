#!/usr/bin/env node
// Feedback 9367533c (Dustin, 2026-11-07): the Beschreibung box on the Basiskonzepte Netz page sits just above the network window,
// below the filter buttons and the graph control panel. Standing QA account, local dev server.
// Usage: node layout_check/netz_description_position_check.mjs [base] [outDir]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5199/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'netz-description')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)
await page.goto(base + '#/dashboard/evomentor-thuringia/basiskonzepte/netz', { waitUntil: 'networkidle' })
await page.waitForSelector('details.netz-description', { timeout: 30000 })
await page.waitForTimeout(1500)
const box = (sel) => page.locator(sel).first().boundingBox()
const desc = await box('details.netz-description')
const controls = await box('.netz-controls')
const graph = await box('details.netz-description + .card')
check('Beschreibung box comes after the filter buttons', desc.y > controls.y + controls.height - 1, `controls bottom ${Math.round(controls.y + controls.height)}, box top ${Math.round(desc.y)}`)
check('graph window starts directly after the box', graph && graph.y >= desc.y + desc.height - 1 && graph.y - (desc.y + desc.height) < 40, `gap ${graph ? Math.round(graph.y - (desc.y + desc.height)) : 'none'}px`)
await page.locator('details.netz-description summary').click()
await page.waitForTimeout(300)
check('box still opens and shows its text', (await page.locator('details.netz-description').innerText()).includes('Antippen/-klicken'))
await page.screenshot({ path: path.join(outDir, 'netz.png') })
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 200))
await browser.close()
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
