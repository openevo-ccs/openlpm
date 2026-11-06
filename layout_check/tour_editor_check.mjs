#!/usr/bin/env node
// Opens the tour editor as the QA account made to look like an owner, against a
// small in-memory stand-in for the guided_tours table (migration 227 may not be
// pushed yet), and walks through list, edit, add a step, save, delete.
//
// Usage: node layout_check/tour_editor_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5174/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'tour-editor')
mkdirSync(outDir, { recursive: true })

const sql = readFileSync(path.join(ROOT, 'supabase', 'migrations', '227_guided_tours.sql'), 'utf8')
const seedSteps = JSON.parse(sql.match(/\$steps\$([\s\S]*?)\$steps\$/)[1])

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const log = []
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(base, { waitUntil: 'networkidle' })
await mintQaSession(page, base)

const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const token = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).access_token)
const projectId = (await (await fetch(`${url}/rest/v1/projects?slug=eq.evomentor-thuringia&select=id`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })).json())[0].id

// The account is a contributor; make the page treat it as an owner.
await page.route('**/rest/v1/project_members?*select=role*joined_via*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'owner', joined_via: 'direct' }) }),
)

let store = [
  {
    id: '00000000-0000-4000-8000-000000000227',
    project_id: projectId,
    title: 'Tour durch die Lernziele und Basiskonzepte',
    description: 'Das Seitenmenü, die Suche nach Lernzielen und die Übersicht der Basiskonzepte.',
    language: 'de', view_id: null, template_id: 'jena-biologiedidaktik-de',
    steps: seedSteps, is_published: true, offer_on_first_visit: false, sort_order: 0,
    updated_at: new Date().toISOString(), spaces: [],
  },
]
await page.route('**/rest/v1/guided_tours*', async (route) => {
  const req = route.request()
  const method = req.method()
  if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store) })
  if (method === 'POST') {
    const body = req.postDataJSON()
    const row = { ...body, id: '00000000-0000-4000-8000-0000000000ff', spaces: [] }
    store.push(row)
    log.push({ POST: { title: row.title, steps: row.steps.length } })
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) })
  }
  if (method === 'PATCH') {
    const body = req.postDataJSON()
    const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '')
    store = store.map((t) => (t.id === id ? { ...t, ...body } : t))
    log.push({ PATCH: { title: body.title, steps: body.steps.length, first: body.steps[0], published: body.is_published } })
    return route.fulfill({ status: 204, body: '' })
  }
  if (method === 'DELETE') {
    const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '')
    store = store.filter((t) => t.id !== id)
    log.push({ DELETE: id })
    return route.fulfill({ status: 204, body: '' })
  }
  return route.continue()
})
await page.route('**/rest/v1/guided_tour_spaces*', (route) =>
  route.fulfill({ status: route.request().method() === 'GET' ? 200 : 204, contentType: 'application/json', body: route.request().method() === 'GET' ? '[]' : '' }),
)

await page.goto(base + '#/dashboard/evomentor-thuringia/tours', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Guided tours', { timeout: 30000 })
await page.waitForSelector('text=Tour durch die Lernziele und Basiskonzepte')
await page.screenshot({ path: path.join(outDir, '01-list.png') })

await page.getByRole('button', { name: 'Edit', exact: true }).click()
await page.waitForSelector('text=Edit tour')
await page.screenshot({ path: path.join(outDir, '02-edit-top.png') })

// Change the first step's title, add a step that points at the search box, save.
await page.locator('.tour-edit-step').first().locator('input').first().fill('Willkommen zur Tour (bearbeitet)')
await page.getByRole('button', { name: 'Add a step' }).click()
const n = await page.locator('.tour-edit-step').count()
const last = page.locator('.tour-edit-step').nth(n - 1)
await last.locator('input').first().fill('Neuer Schritt')
await last.locator('textarea').first().fill('Ein neuer Text.')
await last.locator('select').first().selectOption('lernziele.suche')
await last.scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(outDir, '03-new-step.png') })
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Saved.')
await page.screenshot({ path: path.join(outDir, '04-saved.png') })

// Validation: an empty title is refused.
await page.locator('.tour-edit-step').first().locator('input').first().fill('')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=needs a title and a text')
log.push({ validation: await page.locator('.notice').first().textContent() })

await page.getByRole('button', { name: 'Close editor' }).click()
page.once('dialog', (d) => d.accept())
await page.getByRole('button', { name: 'Delete tour' }).click()
await page.waitForSelector('text=This space has no tours yet.')
await page.screenshot({ path: path.join(outDir, '05-after-delete.png') })

console.log(JSON.stringify({ log, errors, remaining: store.length }, null, 1))
await browser.close()
