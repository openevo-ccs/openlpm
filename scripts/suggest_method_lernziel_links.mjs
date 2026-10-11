#!/usr/bin/env node
// Proposes method<->Lernziel links for methods that have few or no
// confirmed links yet (method_lernziel_links, migration 123) -- the real
// ask behind Dustin's 2026-10-10 request: use each method's now-real,
// citable MethodsBase description to let an LLM synthesize good links to
// Lernziele, instead of a method sitting in the vocabulary with nothing
// connecting it to the curriculum it's meant to apply to.
//
// Deliberately conservative about what it writes: every row lands with
// status='suggested', source='llm_suggested' -- never 'confirmed'. A
// suggestion is not shown to students and isn't treated as a real
// curriculum link anywhere in the app until a project member reviews it
// in Learning Goals -> Methods (learning-goals-page.tsx's MethodsTab) and
// confirms it there. This is the same "deliberately not guessed at,
// that's Susan's own subject-matter judgment" principle migrations
// 078/079/089 already established -- an LLM proposing a link is not a
// substitute for that judgment, it's a time-saving first pass for it to
// react to.
//
// Writes through the ordinary REST API as the standing QA account (same
// magic-link-OTP pattern as scripts/mint_qa_session.mjs, minus the
// Playwright/browser parts this script doesn't need) -- NOT a
// service_role bypass. The QA account must already be a real member of
// the target project (it already is, for evomentor-thuringia -- see
// migration 046).
//
// Calls GWDG SAIA directly (chat-ai.academiccloud.de's OpenAI-compatible
// REST API) -- one call per Lernziel that's missing a confirmed link for
// at least one under-covered method, listing ALL under-covered methods'
// real descriptions in that single call rather than one call per
// method-x-Lernziel pair (a 15-method x 300-Lernziel cross product would
// be ~4500 calls; this is at most ~300). Every real GWDG call this script
// makes is triggered by a human actually running this script -- never
// scheduled, per this lab's standing rule.
//
// Defaults to a dry run (prints what it would ask and, for up to --sample
// Lernziele, what the model actually answers) -- pass --yes to write
// suggested rows for real. --limit caps how many Lernziele are processed
// in one run (a full evomentor-thuringia pass is a few hundred GWDG
// calls and real quota -- worth running in bounded batches, not one
// unbounded sweep the first time).
//
// Usage:
//   node scripts/suggest_method_lernziel_links.mjs [--project evomentor-thuringia]
//     [--min-confirmed 1] [--limit 20] [--yes]

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const GWDG_BASE_URL = process.env.GWDG_LLM_URL || 'https://chat-ai.academiccloud.de/v1'
const QA_EMAIL = 'dustin+openlpmtest2@globalesd.org'

function parseArgs(argv) {
  const out = { project: 'evomentor-thuringia', minConfirmed: 1, limit: Infinity, yes: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') out.project = argv[++i]
    else if (argv[i] === '--min-confirmed') out.minConfirmed = Number(argv[++i])
    else if (argv[i] === '--limit') out.limit = Number(argv[++i])
    else if (argv[i] === '--yes') out.yes = true
  }
  return out
}

function loadAnonKey() {
  const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  return env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
}

function loadServiceRoleKey() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (fromEnv) return fromEnv.trim()
  const p = path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')
  if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  throw new Error('No service_role key found (needed only to mint the QA session via admin/generate_link).')
}

function loadGwdgKey() {
  const fromEnv = process.env.GWDG_LLM_KEY
  if (fromEnv) return fromEnv.trim()
  throw new Error('GWDG_LLM_KEY is not set. See curriculum-agents/tools/gwdg-dataset-forge/.env for a personal SAIA key.')
}

// Mints a session for the standing QA account via magic-link OTP, same
// two-call sequence mint_qa_session.mjs uses for its Playwright page --
// here we just want the bearer token, not a browser.
async function getQaAccessToken() {
  const serviceKey = loadServiceRoleKey()
  const anonKey = loadAnonKey()
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: QA_EMAIL }),
  })
  if (!genRes.ok) throw new Error(`generate_link failed: ${genRes.status} ${await genRes.text()}`)
  const emailOtp = (await genRes.json()).email_otp
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token: emailOtp, email: QA_EMAIL }),
  })
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`)
  const session = await verifyRes.json()
  if (!session.access_token) throw new Error('No access_token in verify response')
  return { accessToken: session.access_token, anonKey }
}

async function restGet(path, { accessToken, anonKey }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function restInsert(table, rows, { accessToken, anonKey }) {
  if (rows.length === 0) return
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`Insert into ${table} failed: ${res.status} ${await res.text()}`)
}

// Picking a model for this task is NOT the same problem as
// gwdg_client.py's select_model('reason') heuristic ("biggest
// reasoning-tagged model") -- live-tested 2026-10-10 against this exact
// prompt shape (one short classification question, structured JSON
// answer): qwen3.5-397b-a17b (roster-tagged output: ['text','thought'])
// spent its ENTIRE token budget on an unstructured "Thinking Process:"
// preamble and never reached a final answer even at max_tokens=1200.
// qwen3.6-35b-a3b -- NOT tagged 'thought' in /models at all -- did the
// exact same thing via a separate, undocumented `reasoning` message
// field, confirming the roster's own output tag is not a reliable signal
// for which models reason by default (contra gwdg_client.py's 2026-08-23
// note that it was). Worth flagging back to that client's own
// maintainers -- this script works around it locally rather than fix it
// there. meta-llama-3.1-8b-instruct and gemma-4-31b-it, tested the same
// way, both answered directly and correctly on the first try with
// finish_reason: 'stop'. For a short yes/no classification prompt like
// this one, a smaller plain-instruct model is not just cheaper -- it's
// actually the more RELIABLE choice right now, not a quality compromise.
const PREFERRED_MODELS = ['meta-llama-3.1-8b-instruct', 'gemma-4-31b-it', 'qwen3-30b-a3b-instruct-2507', 'mistral-medium-3.5-128b']

let gwdgModelListCache = null
async function selectSynthesisModel(gwdgKey) {
  if (!gwdgModelListCache) {
    const res = await fetch(`${GWDG_BASE_URL}/models`, { headers: { Authorization: `Bearer ${gwdgKey}` } })
    if (!res.ok) throw new Error(`GWDG /models failed: ${res.status} ${await res.text()}`)
    gwdgModelListCache = (await res.json()).data ?? []
    if (gwdgModelListCache.length === 0) throw new Error('GWDG /models returned no entries.')
  }
  const availableIds = new Set(gwdgModelListCache.map((m) => m.id))
  for (const id of PREFERRED_MODELS) if (availableIds.has(id)) return id
  // Fallback if the roster has moved on from all 4 preferred ids: avoid
  // anything roster-tagged 'thought' or id-flagged as a reasoning model,
  // same spirit as the preference list above, not a guess at raw quality.
  const nonReasoning = gwdgModelListCache.filter(
    (m) => !/embed|whisper|tts/i.test(m.id) && !(m.output || []).includes('thought') && !/r1|reason|qwq|o1|o3|thinking/i.test(m.id)
  )
  if (nonReasoning.length === 0) throw new Error('No non-reasoning chat model found in GWDG roster -- every preferred fallback is gone; pick one manually and hardcode it here.')
  console.warn(`None of PREFERRED_MODELS are in the current roster -- falling back to ${nonReasoning[0].id}, not independently verified against this prompt shape.`)
  return nonReasoning[0].id
}

async function gwdgChatJson(gwdgKey, system, user, { retries = 3 } = {}) {
  const model = await selectSynthesisModel(gwdgKey)
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${GWDG_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gwdgKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (res.status === 429 || res.status >= 500) {
      const wait = 15 * attempt
      console.warn(`GWDG ${res.status}, retrying in ${wait}s (attempt ${attempt}/${retries})`)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok) throw new Error(`GWDG chat failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    const msg = data.choices[0].message
    const content = (msg.content || '').trim()
    if (!content) {
      // The failure mode found live 2026-10-10: a model reasoned instead
      // of answering and got cut off before emitting real JSON. Never
      // fall back to parsing msg.reasoning/reasoning_content here -- that
      // text is mid-thought, not a final answer, and silently parsing a
      // stray `{...}` out of it is exactly what produced garbage
      // ("method_key": "...") during this script's own live testing.
      throw new Error(`Model ${model} returned no content (finish_reason=${data.choices[0].finish_reason}) -- it reasoned instead of answering. Add a different model to PREFERRED_MODELS.`)
    }
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`No JSON object found in model response: ${content.slice(0, 300)}`)
    return JSON.parse(jsonMatch[0])
  }
  throw new Error('GWDG chat: retries exhausted')
}

function lernzielText(topic, content) {
  const parts = [topic.title, topic.thema, topic.unterthema].filter(Boolean)
  const ds = content?.didaktische_strategien
  if (ds?.originaltext) parts.push(ds.originaltext)
  return parts.join(' -- ')
}

async function main() {
  const { project: projectSlug, minConfirmed, limit, yes } = parseArgs(process.argv.slice(2))
  console.log(`${yes ? 'LIVE RUN' : 'DRY RUN'} -- project=${projectSlug}, min-confirmed=${minConfirmed}, limit=${limit}\n`)

  const auth = await getQaAccessToken()

  const projects = await restGet(`projects?slug=eq.${projectSlug}&select=id`, auth)
  if (projects.length === 0) throw new Error(`No project found with slug ${projectSlug}`)
  const projectId = projects[0].id

  const vocabLinks = await restGet(
    `method_vocabulary_links?select=method_key,methodsbase_snapshot(id,label,description,when_to_use)`,
    auth
  )
  const methodsWithRecord = vocabLinks.filter((v) => v.methodsbase_snapshot)

  const existingLinks = await restGet(
    `method_lernziel_links?project_id=eq.${projectId}&status=eq.confirmed&select=method_key,lernziel_id`,
    auth
  )
  const confirmedCountByMethod = new Map()
  for (const l of existingLinks) confirmedCountByMethod.set(l.method_key, (confirmedCountByMethod.get(l.method_key) ?? 0) + 1)
  const confirmedLernzielSetByMethod = new Map()
  for (const l of existingLinks) {
    const s = confirmedLernzielSetByMethod.get(l.method_key) ?? new Set()
    s.add(l.lernziel_id)
    confirmedLernzielSetByMethod.set(l.method_key, s)
  }

  const underCovered = methodsWithRecord.filter((v) => (confirmedCountByMethod.get(v.method_key) ?? 0) <= minConfirmed)
  console.log(`${underCovered.length} of ${methodsWithRecord.length} methods have <= ${minConfirmed} confirmed Lernziel link(s):`)
  for (const v of underCovered) console.log(`  ${v.method_key}: ${confirmedCountByMethod.get(v.method_key) ?? 0}`)
  if (underCovered.length === 0) {
    console.log('\nNothing under-covered -- nothing to suggest.')
    return
  }

  const lernziele = await restGet(
    `lpm_data_objects?project_id=eq.${projectId}&object_type=eq.performance_indicator&select=id,title,content`,
    auth
  )
  console.log(`\n${lernziele.length} Lernziele in ${projectSlug}.`)

  const alreadySuggested = await restGet(
    `method_lernziel_links?project_id=eq.${projectId}&select=method_key,lernziel_id`,
    auth
  )
  const alreadyLinkedSet = new Set(alreadySuggested.map((l) => `${l.method_key}::${l.lernziel_id}`))

  const gwdgKey = yes || process.env.GWDG_LLM_KEY ? loadGwdgKey() : null
  const methodsBlock = underCovered
    .map((v) => `### ${v.method_key}\n${v.methodsbase_snapshot.description ?? ''}\n${v.methodsbase_snapshot.when_to_use ? `When to use: ${v.methodsbase_snapshot.when_to_use}` : ''}`)
    .join('\n\n')
  const system = [
    'You are helping a German biology-curriculum researcher find plausible links between',
    'teaching methods and learning goals (Lernziele). You will be given one Lernziel and a',
    'set of candidate teaching methods, each with its real description. Reply with ONLY a',
    'JSON object: {"links": [{"method_key": "<exact method name from the list>",',
    '"rationale": "<one German or English sentence saying why this method fits THIS',
    'Lernziel specifically>"}]}. Only include a method if it genuinely, specifically fits --',
    'an empty "links" array is a correct and expected answer for most Lernziele. Never',
    'invent a method_key that is not exactly one of the ones given.',
  ].join(' ')

  let processed = 0
  let suggested = 0
  for (const topic of lernziele) {
    if (processed >= limit) break
    const candidates = underCovered.filter((v) => !confirmedLernzielSetByMethod.get(v.method_key)?.has(topic.id))
    if (candidates.length === 0) continue
    processed++

    const candidateMethodsBlock = underCovered
      .filter((v) => candidates.includes(v))
      .map((v) => `### ${v.method_key}\n${v.methodsbase_snapshot.description ?? ''}`)
      .join('\n\n')
    const user = `Lernziel: ${lernzielText(topic, topic.content)}\n\nCandidate methods:\n\n${candidateMethodsBlock}`

    if (!yes) {
      console.log(`\n[dry run] Would ask about Lernziel "${topic.title}" against ${candidates.length} candidate method(s).`)
      continue
    }

    let result
    try {
      result = await gwdgChatJson(gwdgKey, system, user)
    } catch (e) {
      console.error(`  GWDG call failed for Lernziel ${topic.id}: ${e.message}`)
      continue
    }
    const rows = (result.links ?? [])
      .filter((l) => candidates.some((c) => c.method_key === l.method_key))
      .filter((l) => !alreadyLinkedSet.has(`${l.method_key}::${topic.id}`))
      .map((l) => ({
        project_id: projectId,
        method_key: l.method_key,
        lernziel_id: topic.id,
        status: 'suggested',
        source: 'llm_suggested',
        rationale: l.rationale ?? null,
      }))
    if (rows.length > 0) {
      await restInsert('method_lernziel_links', rows, auth)
      suggested += rows.length
      console.log(`  Lernziel "${topic.title}": suggested ${rows.map((r) => r.method_key).join(', ')}`)
    }
    // Light throttle -- GWDG SAIA rate-limits aggressively on fast loops
    // (see curriculum-agents/tools/gwdg-dataset-forge/gwdg_client.py's own
    // MIN_CALL_INTERVAL_S comment for the live incident that taught this).
    await new Promise((r) => setTimeout(r, 2500))
  }

  console.log(`\n${yes ? `Done. Inserted ${suggested} suggested link(s) across ${processed} Lernziel call(s).` : `Dry run: would have made ${processed} GWDG call(s). Pass --yes to actually run them and write suggestions.`}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
