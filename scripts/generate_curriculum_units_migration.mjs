#!/usr/bin/env node
// Generates the migration that adds curriculum-unit records and links to them (2026-10-28):
//   node scripts/generate_curriculum_units_migration.mjs > supabase/migrations/<n>_curriculum_unit_records.sql
//
// Input: scripts/data/comparison-curriculum-units-2026-10-28.json
//   units     one record per unit of an official Gymnasium Lehrplan (Bayern, Sachsen, Sachsen-Anhalt, Thüringen; Biologie and
//             Informatik): title, grades, hours where the Lehrplan states them, topic tags, a short paraphrase and the page it
//             was read from. Each was read from the official page and checked a second time.
//   newLinks  AI-drafted link proposals from parts of the synthetic spaces to those units.
//
// Everything is AI-drafted and unreviewed by an expert. Units are mandate records with mandateType 'curriculum-unit'; the comparison
// views read their grades, hours and tags to show when each state teaches a topic. Links start with proposed_, so the views show
// them as unconfirmed.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/comparison-curriculum-units-2026-10-28.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const url = (u) => (/[^ -~]/.test(u) ? encodeURI(u) : u)
const L = []
const w = (s = '') => L.push(s)

w('-- Curriculum-unit records for the comparison views, and proposed links to them. AI-drafted, unreviewed by an expert.')
w('--')
w(`-- 1. ${data.units.length} records, one per unit of an official Gymnasium Lehrplan: Bayern, Sachsen, Sachsen-Anhalt (Biologie and Informatik) and`)
w('--    Thüringen (Informatik and Medienbildung und Informatik). Titles, grades and hours are as the Lehrplan states them. Topic tags and')
w('--    the short summary were written when each unit was recorded and have not been checked by a person. Each unit carries the address of')
w('--    the official page it was read from.')
w(`-- 2. ${data.newLinks.length} proposed links from parts of Bio-Core, Computational-Core and Interdisciplinary to those units.`)
w('--')
w("-- To undo: DELETE FROM curriculum_repository_records WHERE source_repo = 'openlpm-starter-draft' AND source_record_id LIKE 'DE-%-LP-%'; (links go with them).")
w()
w('SET search_path = public, extensions;')
w()
w('-- ============================================================================')
w('-- 1. Unit records')
w('-- ============================================================================')
w()
const rows = data.units.map((r) => {
  const inForce = /^\d{4}-\d{2}-\d{2}$/.test(r.inForceFrom ?? '') ? r.inForceFrom : null
  const content = {
    id: r.sourceRecordId, label: r.title, labelDe: r.unitTitle, sourceUrl: url(r.sourceUrl),
    provenance: {
      date: '2026-10-28', added_by: 'claude-session', extracted_by: 'llm', review_status: 'author-draft',
      contributor_notes: `Read from ${url(r.sourceUrl)}${r.page ? ` (${r.page})` : ''}. Lehrplan: ${r.lehrplanTitle ?? ''}${r.lehrplanEdition ? `, ${r.lehrplanEdition}` : ''}. Not reviewed by a person.${r.notes ? ' ' + r.notes : ''}`,
    },
    jurisdiction: r.jurisdiction, issuingBody: r.issuingBody, mandateType: 'curriculum-unit', schoolType: r.schoolType, subject: r.subject,
    ...(r.unitNumber ? { unitNumber: String(r.unitNumber) } : {}), gradeFrom: r.gradeFrom, gradeTo: r.gradeTo,
    ...(r.hours !== null && r.hours !== undefined ? { hours: r.hours } : {}), ...(r.courseLevel ? { courseLevel: r.courseLevel } : {}),
    topicTags: r.topicTags, lehrplanEdition: r.lehrplanEdition, ...(inForce ? { adoptionDate: inForce, dateGranularity: 'day' } : {}),
    statementText: r.summary, description: r.summary, verificationStatus: r.verification,
  }
  return `  (${q(r.id)}, ${q(r.repository)}, ${q(r.jurisdiction)}, ${q(r.sourceRepo)}, ${q(r.sourceRecordId)}, ${q(r.title)}, ${q(JSON.stringify(content))})`
})
w('INSERT INTO curriculum_repository_records (id, project_id, record_type, jurisdiction, source_repo, source_record_id, title, content, access_tier)')
w("SELECT v.id::uuid, p.id, 'institutional-mandate-record', v.jurisdiction, v.source_repo, v.source_record_id, v.title, v.content::jsonb, 'summary-only'")
w('FROM (VALUES')
w(rows.join(',\n'))
w(') AS v(id, repo_slug, jurisdiction, source_repo, source_record_id, title, content)')
w('JOIN projects p ON p.slug = v.repo_slug')
w('ON CONFLICT (source_repo, source_record_id) DO NOTHING;')
w()
w('-- ============================================================================')
w('-- 2. Proposed links to the units')
w('-- ============================================================================')
w('-- Rows are skipped when the part or the unit is missing, or when the pair is already linked in any way.')
const bySpace = {}
for (const l of data.newLinks) (bySpace[l.space] ??= []).push(l)
for (const [space, links] of Object.entries(bySpace)) {
  w()
  w(`-- ${space}: ${links.length} proposals`)
  w('INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)')
  w('SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale')
  w('FROM (VALUES')
  w(links.map((l) => `  (${q(l.objectId)}, ${q(l.recordId)}, ${q('proposed_' + l.relationType)}, ${q(l.rationale)})`).join(',\n'))
  w(') AS v(object_id, record_id, relation_type, rationale)')
  w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
  w('JOIN curriculum_repository_records r ON r.id = v.record_id::uuid')
  w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
}
w()
process.stdout.write(L.join('\n'))
