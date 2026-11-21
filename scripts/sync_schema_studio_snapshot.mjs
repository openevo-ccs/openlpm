#!/usr/bin/env node
// Refreshes schema_studio_snapshot (migration 253): the map the Schema Studio (Admin > Base repos > Schema Studio) shows.
// Reads the schema files of every base repository from local checkouts, builds one JSON document, and adds a row only when the
// content has changed since the latest row. Safe to run as often as you like: an unchanged structure writes nothing.
//
// It runs in three places:
//   - the scheduled GitHub Action .github/workflows/schema-studio-sync.yml (every day, and when a base repository reports a change),
//   - by hand: node scripts/sync_schema_studio_snapshot.mjs --yes
//   - as a dry run (the default): prints what it found and what it would write.
//
// Options:
//   --lab-root <dir>   Folder that holds the repository checkouts side by side (default: the folder above this repository).
//   --yes              Actually write to the database. Without it nothing is written.
//   --out <file>       Also save the snapshot as a JSON file (used for local development: src/lib/schema-studio/dev-snapshot.json).
//   --keep <n>         Keep the newest n rows and delete older ones (default 60).
//
// Writes with the service role key (the table has no write policy for anyone else). The key is read from SUPABASE_SERVICE_ROLE_KEY,
// else from .supabase-secrets/service-role-key.txt in this repository or in the main checkout next to it.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildSnapshot } from './lib/schema-studio-build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }

const labRoot = path.resolve(opt('--lab-root', process.env.LAB_ROOT || path.dirname(ROOT)))
const snap = buildSnapshot(labRoot)
const types = snap.repos.reduce((a, r) => a + r.types.length, 0)
const fields = snap.repos.reduce((a, r) => a + r.types.reduce((b, t) => b + t.fields.length, 0), 0)
const summary = {
  repos: snap.repos.length, recordTypes: types, fields, classes: snap.core?.ontology?.classes.length ?? 0,
  commits: Object.fromEntries(snap.repos.map((r) => [r.key, r.git?.sha ?? null])),
  lastSchemaChange: Object.fromEntries(snap.repos.map((r) => [r.key, r.git?.lastSchemaChange?.date ?? null])),
  warnings: snap.warnings,
}
console.log(`Schema Studio snapshot: ${summary.repos} repositories, ${types} record types, ${fields} fields (hash ${snap.contentHash.slice(0, 10)}).`)
for (const w of snap.warnings) console.log('  warning:', w)

const out = opt('--out')
if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(snap)); console.log(`Saved ${out}`) }

function readKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  for (const dir of [ROOT, path.join(path.dirname(ROOT), 'openlpm')]) {
    const p = path.join(dir, '.supabase-secrets', 'service-role-key.txt')
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  }
  return null
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tfynvjjxyluzorigyfsp.supabase.co'

// No process.exit() calls: on Windows, Node 24 can abort with a libuv assertion when exiting while the HTTP client is still closing.
async function main() {
  if (!flag('--yes')) { console.log('Dry run: nothing written. Add --yes to write.'); return 0 }
  const key = readKey()
  if (!key) { console.error('No service role key found.'); return 1 }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: latest, error: e1 } = await sb.from('schema_studio_snapshot').select('id, content_hash').order('id', { ascending: false }).limit(1)
  if (e1) { console.error('Could not read schema_studio_snapshot (is migration 253 applied?):', e1.message); return 1 }
  if (latest?.[0]?.content_hash === snap.contentHash) { console.log('Already up to date: the structure has not changed since the latest row.'); return 0 }
  const { error: e2 } = await sb.from('schema_studio_snapshot').insert({ content_hash: snap.contentHash, generated_at: snap.generatedAt, summary, data: snap })
  if (e2) { console.error('Insert failed:', e2.message); return 1 }
  console.log('Wrote a new snapshot row.')
  const keep = Number(opt('--keep', 60))
  const { data: old } = await sb.from('schema_studio_snapshot').select('id').order('id', { ascending: false }).range(keep, keep + 500)
  if (old?.length) { await sb.from('schema_studio_snapshot').delete().in('id', old.map((r) => r.id)); console.log(`Pruned ${old.length} old rows.`) }
  return 0
}
process.exitCode = await main()
