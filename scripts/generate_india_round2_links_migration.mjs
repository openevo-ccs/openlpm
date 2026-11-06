#!/usr/bin/env node
// Generates the second round of proposed India links (4 Nov 2026), for India records that no synthetic space reached after round 1:
//   node scripts/generate_india_round2_links_migration.mjs > supabase/migrations/228_india_round2_computing_and_kerala_links.sql
//
// Input: scripts/data/india-round2-computing-and-kerala-links-2026-11-04.json
//   links   AI-drafted proposals from a part of one of the four synthetic spaces to an India record already in the database.
//
// Everything is AI-drafted and unreviewed by an Indian curriculum expert. Links carry a relation type that starts with proposed_, so
// the views show them as unconfirmed. The migration adds links only: no records, no views, no roles.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/india-round2-computing-and-kerala-links-2026-11-04.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const L = []
const w = (s = '') => L.push(s)

const SOURCE_REPO = 'openlpm-starter-draft'
const bySpace = {}
for (const l of data.links) (bySpace[l.space] ??= []).push(l)
const records = new Set(data.links.map((l) => l.sourceRecordId))

w('-- India round 2: proposed links from the four synthetic spaces to India records that round 1 left unreached.')
w(`-- ${data.links.length} proposed links (${Object.entries(bySpace).map(([k, v]) => `${v.length} ${k.replace('-lpm-synth', '')}`).join(', ')}) onto ${records.size} existing India records:`)
w('-- computing and AI records (national curriculum, Ganita Prakash, Kerala KITE clubs, UP Board Computer syllabus) and Kerala science and social science textbook records.')
w('-- All of it is AI-drafted and unreviewed by an Indian curriculum expert. The relation type starts with proposed_, which the views show as "AI-drafted, unconfirmed".')
w('-- A person confirms, edits or removes each one. No record, view, role or repository link is created or changed here.')
w('--')
w('-- To undo: delete the rows with these (part, record) pairs from curriculum_repository_links (only rows whose relation_type starts with proposed_):')
for (const l of data.links) w(`--   ${l.targetId}  ${l.sourceRecordId}`)
w()
w('SET search_path = public, extensions;')
w()
w('-- Rows are skipped when the part or the record is missing, or when the pair is already linked in any way.')
for (const [space, links] of Object.entries(bySpace)) {
  w()
  w(`-- ${space}: ${links.length} proposals`)
  w('INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)')
  w('SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale')
  w('FROM (VALUES')
  w(links.map((l) => `  (${q(l.targetId)}, ${q(l.sourceRecordId)}, ${q('proposed_' + l.relation.replace(/^proposed_/, ''))}, ${q(l.rationale)})`).join(',\n'))
  w(') AS v(object_id, source_record_id, relation_type, rationale)')
  w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
  w(`JOIN curriculum_repository_records r ON r.source_repo = ${q(SOURCE_REPO)} AND r.source_record_id = v.source_record_id`)
  w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
}
w()
process.stdout.write(L.join('\n'))
