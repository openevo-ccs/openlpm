#!/usr/bin/env node
// Signs a real Playwright page in as the standing QA test account
// (dustin+openlpmtest2@globalesd.org, see openlpm-design-session skill's
// Step 0) WITHOUT ever touching or storing its password -- mints a one-time
// magic-link OTP via Supabase's Admin API using the service_role key,
// verifies it via the direct OTP-verify REST call (returns the session as
// plain JSON; sidesteps the app's own PKCE flow, which only applies to the
// redirect-based code-exchange path capture.mjs's login-form approach would
// otherwise need OPENLPM_TEST_PASSWORD for), then injects that session into
// the target page's own localStorage under supabase-js's real storage key.
//
// Use as a CLI (screenshots one route) or import `mintQaSession(page, base)`
// into another script (e.g. layout_check/capture.mjs) to skip needing
// OPENLPM_TEST_PASSWORD in the environment at all.
//
// CLI usage:
//   node scripts/mint_qa_session.mjs [base] [outPath] [hashRoute]

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SUPABASE_URL = 'https://tfynvjjxyluzorigyfsp.supabase.co'
const PROJECT_REF = 'tfynvjjxyluzorigyfsp'
const QA_EMAIL = 'dustin+openlpmtest2@globalesd.org'

function loadServiceRoleKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? readFileSync(path.join(ROOT, '.supabase-secrets', 'service-role-key.txt'), 'utf8')).trim()
}

function loadAnonKey() {
  const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  return env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
}

/** Signs `page` in as the standing QA account. `base` must already be the page's current origin (call page.goto(base) first). */
export async function mintQaSession(page, base, email = QA_EMAIL) {
  const serviceKey = loadServiceRoleKey()
  const anonKey = loadAnonKey()

  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!genRes.ok) throw new Error(`generate_link failed: ${genRes.status} ${await genRes.text()}`)
  const emailOtp = (await genRes.json()).email_otp
  if (!emailOtp) throw new Error('No email_otp in generate_link response')

  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token: emailOtp, email }),
  })
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`)
  const session = await verifyRes.json()
  if (!session.access_token) throw new Error('No access_token in verify response')

  const storageKey = `sb-${PROJECT_REF}-auth-token`
  const sessionForStorage = {
    access_token: session.access_token,
    token_type: session.token_type ?? 'bearer',
    expires_in: session.expires_in ?? 3600,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    refresh_token: session.refresh_token,
    user: session.user,
  }
  await page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify(v)), { k: storageKey, v: sessionForStorage })
  // A hash-only navigation is same-document in Chromium (no reload), so the
  // app's Supabase client would never re-read localStorage -- reload once,
  // here, so it initializes WITH the session already present.
  await page.reload({ waitUntil: 'networkidle' })
}

async function cli() {
  const base = process.argv[2] || 'http://localhost:5173/'
  const out = process.argv[3] || path.join(ROOT, 'layout_check', 'out', 'qa-session-check.png')
  const route = process.argv[4] || '#/dashboard/evomentor-thuringia'
  // Optional 5th arg: sign in as a different real member instead of the
  // standing QA account -- same use case already documented for the
  // exported mintQaSession(page, base, email) signature, just reachable
  // from the CLI too now instead of only from an importing script.
  const email = process.argv[5] || QA_EMAIL

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(base, { waitUntil: 'networkidle' })
  await mintQaSession(page, base, email)

  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: out, fullPage: true })
  console.log('Signed in as', email, '-- saved', out)
  await browser.close()
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  cli().catch((e) => { console.error(e); process.exit(1) })
}
