#!/usr/bin/env node
// Browser check of the new student pages against the sandbox space, as a
// synthetic student. Writes screenshots to cache/screenshots and prints a
// pass/fail line per check.
//
//   node scripts/jena_semester/ui_check.mjs --base http://localhost:4173/ [--persona p01]

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { flag, loadJson, PROJECT_REF, SANDBOX_SLUG, sessionFor, SELF, SYNTH_EMAIL } from './lib.mjs'

const base = (flag('base', 'http://localhost:4173/') + '').replace(/\/?$/, '/')
const personaId = flag('persona', 'p01') + ''
const persona = loadJson('cohort_personas.json').personas.find((p) => p.id === personaId)
const shots = path.join(SELF, 'cache', 'screenshots')
mkdirSync(shots, { recursive: true })

let failed = 0
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', name, extra) }

const browser = await chromium.launch()

async function signedInPage(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()) })
  const session = await sessionFor(SYNTH_EMAIL(persona.email_local))
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify(v)), {
    k: `sb-${PROJECT_REF}-auth-token`,
    v: { access_token: session.access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: session.refresh_token, user: session.user },
  })
  // The app reads the stored session when it starts, so reload once with it in place.
  await page.reload({ waitUntil: 'networkidle' })
  return { page, errors }
}

// ---- Student, desktop
{
  const { page, errors } = await signedInPage({ width: 1360, height: 900 })
  await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  check('single-space student lands inside the sandbox space', page.url().includes(`/dashboard/${SANDBOX_SLUG}`), page.url())
  check('Sandbox banner visible', (await page.getByText('SANDBOX.').count()) > 0)
  check('nav has "Meine Arbeit und Abgabe"', (await page.getByRole('link', { name: /Meine Arbeit und Abgabe/ }).count()) > 0)
  await page.screenshot({ path: path.join(shots, 'student-start.png') })

  // Route lock: researcher pages typed by hand go back to the start page
  for (const bad of ['settings', 'analytics', 'notebooks', 'learning-goals', 'discussions']) {
    await page.goto(`${base}#/dashboard/${SANDBOX_SLUG}/${bad}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    check(`route lock: /${bad} is not reachable`, !page.url().endsWith(`/${bad}`), page.url().split('#')[1])
  }

  // Meine Arbeit
  await page.goto(`${base}#/dashboard/${SANDBOX_SLUG}/meine-arbeit`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check('Meine Arbeit: Thema tab shows saved topic', (await page.locator('input[type="text"]').first().inputValue()).length > 0)
  await page.screenshot({ path: path.join(shots, 'work-thema.png'), fullPage: true })
  await page.getByRole('button', { name: /2 Verknüpfungen beurteilen/ }).click()
  await page.waitForTimeout(800)
  check('Beurteilen tab lists starred Lernziele', (await page.getByText(/von \d+ beurteilt/).count()) >= 1)
  await page.getByRole('button', { name: /^(weiter beurteilen|beurteilt|beurteilen)/ }).first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(shots, 'work-beurteilen.png'), fullPage: true })
  // rate with a click and watch it save
  await page.getByRole('radio', { name: /4 trifft voll zu/ }).first().click()
  await page.waitForTimeout(1200)
  check('rating click saves ("Gespeichert")', (await page.getByText('Gespeichert').count()) > 0)
  await page.getByRole('button', { name: /3 Basiskonzepte und Querschnitt/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(shots, 'work-basiskonzepte.png'), fullPage: true })
  await page.getByRole('button', { name: /4 Reflexion/ }).click()
  await page.getByRole('button', { name: /5 Abgabe/ }).click()
  await page.getByRole('button', { name: /Word-Datei herunterladen/ }).waitFor({ timeout: 20000 })
  check('Abgabe tab shows participant code', (await page.getByText(/JBD-[A-Z0-9]{4}-[A-Z0-9]{4}/).count()) > 0)
  check('Abgabe tab shows sandbox notice', (await page.getByText(/Sandbox: Dies ist ein Testkonto/).count()) > 0)
  await page.screenshot({ path: path.join(shots, 'work-abgabe.png'), fullPage: true })

  // Group page: no emails for students, combined table for sharers
  await page.goto(`${base}#/dashboard/${SANDBOX_SLUG}/groups`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByRole('link', { name: 'Öffnen' }).first().click()
  await page.waitForTimeout(1200)
  const body = await page.locator('.project-main').innerText()
  check('group page shows no email addresses', !/@globalesd\.org/.test(body))
  await page.getByRole('button', { name: /Gruppenübersicht/ }).click().catch(() => {})
  await page.waitForTimeout(1500)
  const synth = await page.locator('body').innerText()
  check('group synthesis shows the judgments table', /Beurteilte Verknüpfungen/.test(synth))
  await page.screenshot({ path: path.join(shots, 'group-synthesis.png'), fullPage: true })
  check('no page errors (desktop student)', errors.length === 0, errors.slice(0, 3).join(' | '))
}

// ---- Student, phone width
{
  const { page, errors } = await signedInPage({ width: 390, height: 844 })
  await page.goto(`${base}#/dashboard/${SANDBOX_SLUG}/meine-arbeit`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('phone: no horizontal page scroll on Meine Arbeit', overflow <= 2, `overflow ${overflow}px`)
  await page.screenshot({ path: path.join(shots, 'work-phone.png'), fullPage: true })
  check('no page errors (phone student)', errors.length === 0, errors.slice(0, 3).join(' | '))
}

// ---- Welcome page, logged out
for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}#/willkommen/${SANDBOX_SLUG}`, { waitUntil: 'networkidle' })
  check(`welcome (${label}): heading shown`, (await page.getByRole('heading', { name: /EvoMentor Sandbox/ }).count()) > 0)
  await page.getByLabel(/Dein Name/).fill('Test Person')
  await page.getByLabel(/E-Mail-Adresse der Universität/).fill('someone@gmail.com')
  await page.getByLabel(/Passwort/).fill('abcdefgh')
  await page.getByRole('button', { name: /^Konto anlegen$/ }).click()
  await page.waitForTimeout(500)
  check(`welcome (${label}): wrong domain is refused with a clear message`, (await page.getByText(/Bitte nutze deine Adresse der Universität/).count()) > 0)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`welcome (${label}): no horizontal page scroll`, overflow <= 2, `overflow ${overflow}px`)
  await page.screenshot({ path: path.join(shots, `welcome-${label}.png`), fullPage: true })
  check(`no page errors (welcome ${label})`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

await browser.close()
console.log(failed ? `${failed} check(s) failed` : 'all checks passed', '- screenshots in', shots)
process.exit(failed ? 1 : 0)
