#!/usr/bin/env node
// Puts one theory of schooling profile (the JSON format of the Theory of Schooling Atlas) into a Theories of Schooling space (migration 256),
// and writes one row per statement into tos_elements. It uses the same checks and the same flattening as the Profiles page
// (src/lib/tos-profile.ts), so a profile that passes here also passes there.
//
//   node scripts/import_tos_profile.mjs <profile.json> <project-slug>                  dry run: checks the file, writes nothing, contacts nothing
//   node scripts/import_tos_profile.mjs <profile.json> <project-slug> --as <email> --yes   writes with the service role key
//
// Options:
//   --as <email>   The account the profile is saved under (created_by). Needed with --yes. The AI opt-out of this account applies to the
//                  profile: the Prompt context page leaves the profile out when this person has opted out.
//   --yes          Actually write to the database. Without it nothing is written and the database is not contacted.
//
// With --yes the script checks that the space exists and has the kind 'theory-of-schooling', replaces a profile with the same code in the
// same space (a new version), and replaces its statements. The service key is read from SUPABASE_SERVICE_ROLE_KEY, else from
// .supabase-secrets/service-role-key.txt in this repository or in the main checkout next to it.
//
// AI opt-out (CLAUDE.md): this script only writes. It reads no profile text from the database, so it needs no opt-out list. Any script
// that reads tos_profiles.data or tos_elements and shows the text to an AI assistant must call loadOptedOutUserIds (scripts/lib/ai-opt-out.mjs)
// and leave out rows whose created_by is on the list.
//
// Do not run it against the live database before migration 256 is applied. The tables do not exist until then.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--as'))

function readKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  for (const dir of [ROOT, path.join(path.dirname(ROOT), 'openlpm')]) {
    const p = path.join(dir, '.supabase-secrets', 'service-role-key.txt')
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  }
  return null
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tfynvjjxyluzorigyfsp.supabase.co'

// The checks live in TypeScript, so they are bundled to a temporary file first (the test scripts do the same).
async function loadLib() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-import-'))
  const out = path.join(dir, 'tos-profile.mjs')
  await build({ entryPoints: [path.join(ROOT, 'src/lib/tos-profile.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
  const lib = await import(pathToFileURL(out).href)
  fs.rmSync(dir, { recursive: true, force: true })
  return lib
}

// No process.exit() calls: on Windows, Node 24 can abort with a libuv assertion when exiting while the HTTP client is still closing.
async function main() {
  const [file, slug] = positional
  if (!file || !slug) {
    console.error('Usage: node scripts/import_tos_profile.mjs <profile.json> <project-slug> [--as <email>] [--yes]')
    return 1
  }
  if (!fs.existsSync(file)) { console.error(`File not found: ${file}`); return 1 }

  const lib = await loadLib()
  const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/vendor/openevo-atlas/atlas/model-schooling-domains-v1.json'), 'utf8'))
  const read = lib.parseProfileText(fs.readFileSync(file, 'utf8'))
  if (read.error) { console.error(read.error); return 1 }
  const result = lib.validateProfile(read.value, model)
  for (const w of result.warnings) console.log('  note:', w)
  if (!result.ok) {
    console.error('The profile cannot be imported:')
    for (const e of result.errors) console.error('  -', e)
    return 1
  }
  const profile = result.profile
  const fields = lib.profileRowFields(profile)
  const rows = lib.flattenProfile(profile)
  const hidden = rows.filter((r) => r.visibility !== 'public').length
  console.log(`Profile ${profile.id} "${profile.title}" version ${profile.version}: ${rows.length} statements (${hidden} lab-only), review state ${fields.review_status}, visibility ${fields.visibility}.`)
  console.log(`Target space: ${slug}`)

  if (!flag('--yes')) { console.log('Dry run: nothing written, database not contacted. Add --as <email> --yes to write.'); return 0 }

  const email = opt('--as')
  if (!email) { console.error('--as <email> is needed with --yes: the account the profile is saved under.'); return 1 }
  const key = readKey()
  if (!key) { console.error('No service role key found.'); return 1 }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: project, error: e1 } = await sb.from('projects').select('id, slug, project_kind').eq('slug', slug).maybeSingle()
  if (e1) { console.error('Could not read the space:', e1.message); return 1 }
  if (!project) { console.error(`No space with the slug "${slug}".`); return 1 }
  if (project.project_kind !== 'theory-of-schooling') { console.error(`The space "${slug}" is not a Theories of Schooling space (its kind is ${project.project_kind}).`); return 1 }
  const { data: user, error: e2 } = await sb.from('users').select('id').eq('email', email).maybeSingle()
  if (e2 || !user) { console.error(`No account with the e-mail ${email}.`); return 1 }

  const { data: found, error: e3 } = await sb.from('tos_profiles').select('id').eq('project_id', project.id).eq('profile_id', profile.id).maybeSingle()
  if (e3) { console.error('Could not read tos_profiles (is migration 256 applied?):', e3.message); return 1 }
  let rowId
  if (found) {
    rowId = found.id
    const { error } = await sb.from('tos_profiles').update(fields).eq('id', rowId)
    if (error) { console.error('Update failed:', error.message); return 1 }
    console.log('Replaced the saved version of the profile. It stays under the account it was first saved under.')
  } else {
    const { data, error } = await sb.from('tos_profiles').insert({ ...fields, project_id: project.id, created_by: user.id }).select('id').single()
    if (error) { console.error('Insert failed:', error.message); return 1 }
    rowId = data.id
    console.log('Added the profile.')
  }
  const { error: e4 } = await sb.from('tos_elements').delete().eq('profile_row_id', rowId)
  if (e4) { console.error('Could not clear the old statements:', e4.message); return 1 }
  const out = rows.map((r) => ({ ...r, project_id: project.id, profile_row_id: rowId }))
  for (let i = 0; i < out.length; i += 500) {
    const { error } = await sb.from('tos_elements').insert(out.slice(i, i + 500))
    if (error) { console.error('Statement insert failed:', error.message); return 1 }
  }
  console.log(`Wrote ${out.length} statements.`)
  return 0
}
process.exitCode = await main()
