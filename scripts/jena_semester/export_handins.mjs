#!/usr/bin/env node
// Opens each synthetic student's "Meine Arbeit" page in a real browser, goes to
// the Abgabe tab and clicks the two download buttons, exactly as a student
// does for Moodle. The files land in cache/exports/. This is the only place
// the real export code runs for the synthetic cohort, so the files the
// analysis kit reads are the files real students will produce.
//
//   node scripts/jena_semester/export_handins.mjs --base http://localhost:4173/ [--only p01,p02]
//
// --base is where the app is served: a local `npx vite preview` of the build
// (default http://localhost:4173/) or the deployed site once this is merged.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { anonKey, flag, loadJson, PROJECT_REF, sessionFor, SANDBOX_SLUG, SELF, SUPABASE_URL, SYNTH_EMAIL } from './lib.mjs'

const base = (flag('base', 'http://localhost:4173/') + '').replace(/\/?$/, '/')
const only = flag('only', '')?.toString().split(',').filter(Boolean)
const personas = loadJson('cohort_personas.json').personas
const outDir = path.join(SELF, 'cache', 'exports')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
let failures = 0

for (const p of personas) {
  if (only.length && !only.includes(p.id)) continue
  const email = SYNTH_EMAIL(p.email_local)
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  // The export must not add its own page views to the timeline it is about to download.
  await page.route('**/rest/v1/student_activity_events**', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 201, body: '' }) : route.continue()
  )
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  try {
    const session = await sessionFor(email)
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ({ k, v }) => localStorage.setItem(k, JSON.stringify(v)),
      {
        k: `sb-${PROJECT_REF}-auth-token`,
        v: {
          access_token: session.access_token,
          token_type: 'bearer',
          expires_in: session.expires_in ?? 3600,
          expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
          refresh_token: session.refresh_token,
          user: session.user,
        },
      }
    )
    await page.reload({ waitUntil: 'networkidle' })
    await page.goto(`${base}#/dashboard/${SANDBOX_SLUG}/meine-arbeit`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /5 Abgabe/ }).click()
    await page.getByRole('button', { name: /Word-Datei herunterladen/ }).waitFor({ timeout: 20000 })

    const [docx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Word-Datei herunterladen/ }).click()])
    await docx.saveAs(path.join(outDir, `${p.id}_${docx.suggestedFilename()}`))
    const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Prozessdatei \(JSON\) herunterladen/ }).click()])
    await json.saveAs(path.join(outDir, `${p.id}_${json.suggestedFilename()}`))
    console.log('exported:', p.id, json.suggestedFilename(), pageErrors.length ? `(${pageErrors.length} page errors)` : '')
  } catch (e) {
    failures++
    console.error('FAILED', p.id, e.message)
    await page.screenshot({ path: path.join(outDir, `${p.id}_FAILED.png`) }).catch(() => {})
  }
  await context.close()
  await new Promise((r) => setTimeout(r, 8000)) // stay under the auth service's rate limit
}
await browser.close()
console.log(failures ? `${failures} failed` : 'all exported', '->', outDir)
process.exit(failures ? 1 : 0)
