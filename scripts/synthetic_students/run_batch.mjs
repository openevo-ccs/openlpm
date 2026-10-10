#!/usr/bin/env node
// Drives each synthetic persona through the REAL, live 3-step
// evomentor-thuringia student flow (Explore -> Notebook -> Prompt
// Generator) via Playwright, exactly as a real student's browser would.
// Two phases, because the real task has a genuine human-in-the-loop step
// in the middle (testing the generated prompt on an LLM, outside the app):
//
//   node run_batch.mjs select    -- creates each persona's notebook, adds
//                                   their real chosen items, fills the
//                                   Prompt Generator form, saves (creates a
//                                   real prompt_experiments row), and
//                                   writes each persona's real generated
//                                   prompt_text to cache/phase1-results.json
//   [ Claude fills in llm_name/llm_output/evaluation_notes per persona,
//     generating a real LLM response to the real generated prompt_text
//     and a persona-consistent evaluation of it -- not this script's job ]
//   node run_batch.mjs evaluate  -- reopens each saved experiment and
//                                   writes those three fields back in,
//                                   completing the real flow
//   node run_batch.mjs qa        -- prints the accumulated page-error/
//                                   console-error log from both phases
//
// Needs scripts/synthetic_students's join rules already in place
// (manage_join_rules.mjs add) -- a synthetic account that isn't a real
// project member can't get past project-switcher-page.tsx's "you aren't a
// member of any project yet" state, same as any real brand-new user.

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mintQaSession } from '../mint_qa_session.mjs'

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const SELF = path.join(ROOT, 'scripts', 'synthetic_students')
const BASE = 'https://openevo-ccs.github.io/openlpm/'
const SLUG = 'evomentor-thuringia'
const RESULTS_PATH = path.join(SELF, 'cache', 'phase1-results.json')
const SHOT_DIR = path.join(SELF, 'cache', 'screenshots')

const PRIOR_KNOWLEDGE_LABEL = { keins: 'Kein Vorwissen', grundlagen: 'Grundbegriffe bekannt', solide: 'Solides Grundwissen' }
const LENGTH_LABEL = { kurz: 'Kurz', ausführlich: 'Ausführlich' }
const TONE_LABEL = { professionell: 'Professionell', locker: 'Locker', wissenschaftlich: 'Wissenschaftlich' }

function loadPersonas() {
  return JSON.parse(readFileSync(path.join(SELF, 'personas.json'), 'utf8')).personas
}

async function shot(page, name) {
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }).catch(() => {})
}

async function checkAll(page, labels) {
  for (const label of labels ?? []) {
    const box = page.getByRole('checkbox', { name: label })
    if (await box.count()) await box.first().check()
  }
}

async function fillFieldByLabel(page, labelText, value, tag = 'textarea') {
  if (!value) return
  const field = page.locator('.field', { has: page.locator(`label:text-is("${labelText}")`) }).locator(tag).first()
  if (await field.count()) await field.fill(value)
}

async function selectByLabel(page, labelText, optionLabel) {
  const select = page.locator('.field', { has: page.locator(`label:text-is("${labelText}")`) }).locator('select').first()
  if (await select.count()) await select.selectOption({ label: optionLabel }).catch(() => {})
}

async function addReferenceItem(page, title, qaLog, personaId) {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Reference project content' }).click()
  await page.getByPlaceholder('Start typing…').fill(title.slice(0, 50))
  await page.waitForTimeout(500)
  const option = page.locator('.menu button', { hasText: title }).first()
  if (await option.count()) {
    await option.click()
    await page.waitForTimeout(400)
  } else {
    qaLog.push({ persona: personaId, type: 'item-not-found', detail: title })
  }
}

async function selectPhase() {
  const personas = loadPersonas()
  const browser = await chromium.launch()
  const results = []
  const qaLog = []

  for (const persona of personas) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('pageerror', (e) => qaLog.push({ persona: persona.persona_id, type: 'pageerror', detail: e.message }))
    page.on('console', (m) => { if (m.type() === 'error') qaLog.push({ persona: persona.persona_id, type: 'consoleerror', detail: m.text() }) })

    try {
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await mintQaSession(page, BASE, persona.email)

      await page.goto(`${BASE}#/dashboard/${SLUG}/notebooks`, { waitUntil: 'networkidle' })
      await page.fill('input[name="name"]', persona.notebook_label)
      await page.getByRole('button', { name: 'Create notebook' }).click()
      await page.waitForTimeout(900)
      await page.getByText(persona.notebook_label, { exact: true }).first().click()
      await page.waitForURL(/\/notebooks\/[0-9a-fA-F-]+$/, { timeout: 10000 })
      const portfolioId = page.url().match(/notebooks\/([0-9a-fA-F-]+)/)[1]

      for (const title of persona.item_titles) {
        await addReferenceItem(page, title, qaLog, persona.persona_id)
      }

      await page.goto(`${BASE}#/dashboard/${SLUG}/notebooks/${portfolioId}/prompt`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(800)

      const cfg = persona.config
      const hours = page.locator('input[type="number"]').first()
      if (await hours.count()) await hours.fill(String(cfg.stunden))
      const format = page.locator('.field', { has: page.locator('label:text-is("Format (min)")') }).locator('input').first()
      if (await format.count()) await format.fill(cfg.stundenformat)
      const pctBtn = page.getByRole('button', { name: `${cfg.anteilEvolutionsbezug}%`, exact: true })
      if (await pctBtn.count()) await pctBtn.click()

      for (const [label, level] of Object.entries(cfg.prior_knowledge ?? {})) {
        await selectByLabel(page, label, PRIOR_KNOWLEDGE_LABEL[level])
      }
      await fillFieldByLabel(page, 'Additional subject-matter focus', cfg.fachNotizen)
      await checkAll(page, cfg.methoden)
      await checkAll(page, cfg.differenzierung)
      await fillFieldByLabel(page, 'Teaching notes', cfg.didNotizen)
      await checkAll(page, cfg.bewertung)
      await fillFieldByLabel(page, 'Assessment notes', cfg.evalNotizen)
      await checkAll(page, cfg.kontext)
      await fillFieldByLabel(page, 'Further notes', cfg.kontextNotizen)
      if (cfg.ton) await selectByLabel(page, 'Tone', TONE_LABEL[cfg.ton])
      if (cfg.laenge) await selectByLabel(page, 'Length', LENGTH_LABEL[cfg.laenge])
      await checkAll(page, cfg.ausgabeTyp)
      await fillFieldByLabel(page, 'Other notes', cfg.sonstigeNotizen)

      await shot(page, `${persona.persona_id}-before-save`)
      await page.getByRole('button', { name: /Save this prompt/ }).click()
      await page.waitForTimeout(1200)

      const promptText = await page.locator('pre').first().textContent()
      await shot(page, `${persona.persona_id}-after-save`)

      results.push({
        persona_id: persona.persona_id, email: persona.email, label: persona.label,
        grounding: persona.grounding, portfolio_id: portfolioId,
        prompt_text: promptText ?? null, status: promptText ? 'ok' : 'no-prompt-text-captured',
      })
      console.log(`[${persona.persona_id}] ok -- ${persona.label}`)
    } catch (e) {
      qaLog.push({ persona: persona.persona_id, type: 'exception', detail: String(e) })
      await shot(page, `${persona.persona_id}-ERROR`)
      results.push({ persona_id: persona.persona_id, email: persona.email, label: persona.label, status: 'FAILED', error: String(e) })
      console.error(`[${persona.persona_id}] FAILED:`, e.message)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  mkdirSync(path.dirname(RESULTS_PATH), { recursive: true })
  writeFileSync(RESULTS_PATH, JSON.stringify({ phase: 'select', generated_at: new Date().toISOString(), results, qa_log: qaLog }, null, 2))
  console.log(`\nWrote ${RESULTS_PATH} (${results.filter((r) => r.status === 'ok').length}/${results.length} ok, ${qaLog.length} qa-log entries)`)
}

async function evaluatePhase() {
  const data = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'))
  const browser = await chromium.launch()
  const qaLog = data.qa_log ?? []

  for (const r of data.results) {
    if (r.status !== 'ok' || !r.llm_name) {
      console.log(`[${r.persona_id}] skipped (status=${r.status}, has_eval=${!!r.llm_name})`)
      continue
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('pageerror', (e) => qaLog.push({ persona: r.persona_id, type: 'pageerror', detail: e.message, phase: 'evaluate' }))
    try {
      await page.goto(BASE, { waitUntil: 'networkidle' })
      await mintQaSession(page, BASE, r.email)
      await page.goto(`${BASE}#/dashboard/${SLUG}/notebooks/${r.portfolio_id}/prompt`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(800)

      const card = page.locator('.card', { has: page.locator('label:text-is("Which LLM did you test this on?")') }).first()
      await card.locator('input').first().fill(r.llm_name)
      await card.locator('textarea').nth(0).fill(r.llm_output ?? '')
      await card.locator('textarea').nth(1).fill(r.evaluation_notes ?? '')
      await card.getByRole('button', { name: 'Save evaluation' }).click()
      await page.waitForTimeout(1000)
      await shot(page, `${r.persona_id}-evaluation-saved`)
      console.log(`[${r.persona_id}] evaluation saved`)
    } catch (e) {
      qaLog.push({ persona: r.persona_id, type: 'exception', detail: String(e), phase: 'evaluate' })
      await shot(page, `${r.persona_id}-evaluation-ERROR`)
      console.error(`[${r.persona_id}] evaluation FAILED:`, e.message)
    } finally {
      await page.close()
    }
  }
  await browser.close()
  data.qa_log = qaLog
  data.evaluated_at = new Date().toISOString()
  writeFileSync(RESULTS_PATH, JSON.stringify(data, null, 2))
  console.log(`\nUpdated ${RESULTS_PATH}`)
}

function qa() {
  const data = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'))
  console.log(JSON.stringify(data.qa_log ?? [], null, 2))
  console.log(`\n${(data.qa_log ?? []).length} qa-log entries total.`)
}

const cmd = process.argv[2]
const fn = { select: selectPhase, evaluate: evaluatePhase, qa }[cmd]
if (!fn) { console.error('Usage: node run_batch.mjs <select|evaluate|qa>'); process.exit(1) }
Promise.resolve(fn()).catch((e) => { console.error(e); process.exit(1) })
