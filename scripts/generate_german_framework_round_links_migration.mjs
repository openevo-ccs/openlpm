#!/usr/bin/env node
// Generates the German framework and policy linking round (4 Nov 2026), for German records that few or none of the four synthetic spaces reached:
//   node scripts/generate_german_framework_round_links_migration.mjs > supabase/migrations/229_german_framework_round_links.sql
//
// Input: scripts/data/german-framework-round-2026-11-04.json
//   links     AI-drafted proposals from a part of one of the four synthetic spaces to a German record already in the database.
//   dropped   links the second reading removed, kept in the data file for the record and not written to the migration.
//
// The links are proposals: the relation type starts with proposed_, so the views show them as unconfirmed. The migration adds links only: no records, no views, no roles.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/german-framework-round-2026-11-04.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const L = []
const w = (s = '') => L.push(s)

const bySpace = {}
for (const l of data.links) (bySpace[l.space] ??= []).push(l)
const records = new Set(data.links.map((l) => l.sourceRecordId))

w('-- German framework round: proposed links from the four synthetic spaces to German framework and policy records that few spaces reached.')
w(`-- ${data.links.length} proposed links (${Object.entries(bySpace).map(([k, v]) => `${v.length} ${k.replace('-lpm-synth', '')}`).join(', ')}) onto ${records.size} existing German records:`)
w('-- the 2026 trial Lehrplan editions for Biologie and Mensch-Natur-Technik in Thüringen (from the two-pass concept tagging of 2 Nov), KMK strategy and Abitur texts, and state records on subjects and cross-subject work.')
w('-- The first reading drafted 37 links and a second reading, done by the same working session, dropped 12. The relation type starts with proposed_, which the views show as unconfirmed.')
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
  w(links.map((l) => `  (${q(l.targetId)}, ${q(l.sourceRepo)}, ${q(l.sourceRecordId)}, ${q('proposed_' + l.relation.replace(/^proposed_/, ''))}, ${q(l.rationale)})`).join(',\n'))
  w(') AS v(object_id, source_repo, source_record_id, relation_type, rationale)')
  w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
  w('JOIN curriculum_repository_records r ON r.source_repo = v.source_repo AND r.source_record_id = v.source_record_id')
  w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
}
w()
process.stdout.write(L.join('\n'))
