#!/usr/bin/env node
// Checks that the KI-Prompt-Generator of EvoMentor Thüringen prints the ten lesson phases (feedback 9e9f8a30, Susan Hanisch 2026-11-14; Dustin chose on
// 2026-11-17 that the generator uses the ten-phase list while the methodsbase repo keeps six). Read-only. The migration 249 is not applied to the live
// database from here, so the page is served a copy of the library row with the phases added, exactly as the migration would store them. A second run
// serves the library as it is today and checks that no phase block appears.
//
// Usage: node layout_check/prompt_generator_lesson_phases_check.mjs [base] [outDir]

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mintQaSession } from '../scripts/mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = process.argv[2] || 'http://localhost:5275/'
const outDir = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'prompt-generator-lesson-phases')
mkdirSync(outDir, { recursive: true })
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`) }

// The phases and the label, read from the migration itself so the check and the migration cannot drift apart.
const sql = readFileSync(path.join(ROOT, 'supabase', 'migrations', '249_prompt_generator_lesson_phases.sql'), 'utf8')
const phases = [...sql.slice(sql.indexOf('jsonb_build_array'), sql.indexOf('section_labels')).matchAll(/'([^']+)'/g)].map((m) => m[1])
const label = /'lesson_phases_section',\s*'([^']+)'/.exec(sql)?.[1]
check('the migration lists ten phases and a heading', phases.length === 10 && !!label, `${phases.length} phases`)

const run = async (withPhases) => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } })
  const page = await ctx.newPage()
  const errors = []
  const writes = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('request', (r) => { // student_activity_events is the app's own page-visit log, written on every visit by any account; it is not part of this change.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && /supabase\.co\/rest/.test(r.url()) && !/student_activity_events/.test(r.url())) writes.push(r.method() + ' ' + r.url()) })
  await page.route((u) => /\/rest\/v1\/users$/.test(u.pathname) && /blocked_at/.test(u.search) && /id=eq\./.test(u.search), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blocked_at: null, role: 'admin' }), headers: { 'access-control-allow-origin': '*' } }))
  if (withPhases) {
    await page.route((u) => /\/rest\/v1\/prompt_template_libraries$/.test(u.pathname), async (route) => {
      const res = await route.fetch()
      const json = await res.json()
      const patch = (r) => ({ ...r, option_lists: { ...r.option_lists, lesson_phases: phases }, section_labels: { ...r.section_labels, lesson_phases_section: label } })
      await route.fulfill({ status: 200, contentType: res.headers()['content-type'] ?? 'application/json', body: JSON.stringify(Array.isArray(json) ? json.map(patch) : patch(json)), headers: { 'access-control-allow-origin': '*' } })
    })
  }
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base)
  await page.goto(base + '#/dashboard/evomentor-thuringia/planen', { waitUntil: 'networkidle' })
  await page.locator('h1', { hasText: 'KI-Prompt-Generator' }).waitFor({ timeout: 60000 })
  await page.locator('select').first().selectOption('alle')
  await page.waitForFunction(() => (document.querySelector('pre')?.textContent ?? '').length > 500, null, { timeout: 90000 })
  await page.waitForTimeout(1500)
  const pre = (await page.locator('pre').first().textContent()) ?? ''
  await page.screenshot({ path: path.join(outDir, withPhases ? '1-with-phases.png' : '2-as-today.png'), fullPage: true })
  await browser.close()
  return { pre, errors, writes }
}

const a = await run(true)
const at = (s) => a.pre.indexOf(s)
check('the generated prompt is not empty', a.pre.length > 500, `${a.pre.length} characters`)
check('the heading of the phase block is printed', !!label && at(label) > 0)
let last = -1
let inOrder = true
for (const p of phases) { const i = at(`- ${p}`); if (i <= last) inOrder = false; last = i }
check('all ten phases are printed, in the given order', inOrder && last > 0)
check('the phase block comes right before the output section, near the end', at(label) > 0 && a.pre.length - at(label) < 1500, `${a.pre.length - at(label)} characters from the end`)
check('Ausblick (A) and Transfer/Vernetzung (T) are both there', a.pre.includes('- Ausblick (A)') && a.pre.includes('- Transfer/Vernetzung (T)'))
check('no page error', a.errors.length === 0, a.errors.join(' | ').slice(0, 200))
check('nothing is written to the database', a.writes.length === 0, a.writes.join(' | ').slice(0, 200))

const b = await run(false)
check('the library as it is today prints no phase block', !b.pre.includes('UNTERRICHTSPHASEN') && !b.pre.includes('- Ausblick (A)'), `${b.pre.length} characters`)
const stripped = a.pre.replace(`\n${label}\n${phases.map((p) => '- ' + p).join('\n')}\n`, '')
let firstDiff = 0
while (firstDiff < stripped.length && stripped[firstDiff] === b.pre[firstDiff]) firstDiff++
check('the prompt text outside the phase block is unchanged', stripped === b.pre, `lengths ${stripped.length} / ${b.pre.length}, first difference at ${firstDiff}: ${JSON.stringify(stripped.slice(Math.max(0, firstDiff - 30), firstDiff + 60))} vs ${JSON.stringify(b.pre.slice(Math.max(0, firstDiff - 30), firstDiff + 60))}`)

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
