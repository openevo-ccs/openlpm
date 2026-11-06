#!/usr/bin/env node
// Generates the data-enrichment migration for the comparison views (2026-10-28, second pass):
//   node scripts/generate_comparison_enrichment_migration.mjs > supabase/migrations/<n>_comparison_data_enrichment.sql
//
// Input: scripts/data/comparison-enrichment-2026-10-28.json
//   newRecords      records about US computing and social-studies policy and German national policy, each researched from
//                   a page that was fetched and read (the source URL and verification level are kept in the record)
//   proposalReview  outcome of a second review of the first 35 AI-drafted link proposals, against the full record text
//   newLinks        further AI-drafted link proposals, including links below strand level
//
// Everything is AI-drafted and unreviewed. New links carry a relation type that starts with proposed_, so the views show
// them as unconfirmed. Records carry provenance review_status author-draft.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/comparison-enrichment-2026-10-28.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
// Addresses with a non-ASCII character (a typographic hyphen, an umlaut) are percent-encoded so they stay clickable.
const url = (u) => (/[^ -~]/.test(u) ? encodeURI(u) : u)
const L = []
const w = (s = '') => L.push(s)

w('-- Data enrichment for the comparison views, second pass. All of it is AI-drafted and unreviewed by an expert.')
w('--')
w(`-- 1. ${data.newRecords.length} new records in the Curriculum Repository: US computing and social-studies policy for New York, California,`)
w('--    Florida, Pennsylvania, Tennessee and the national level, and German national policy. Each was researched from a page that was')
w('--    fetched and read; the page address and how well it was confirmed are kept in the record (verificationStatus).')
w(`-- 2. A second review of the first 35 link proposals against the full record text: ${data.proposalReview.filter((r) => r.verdict === 'remove').length} removed, ${data.proposalReview.filter((r) => r.verdict === 'revise').length} reworded. Only unconfirmed proposals (relation type starting`)
w('--    with proposed_) are touched. Confirmed links are never changed here.')
w(`-- 3. ${data.newLinks.length} further proposed links, including links on single grade-band parts and on records of German states that had none.`)
w('--')
w('-- To undo: DELETE FROM curriculum_repository_records WHERE source_repo = \'openlpm-starter-draft\' AND created_at >= \'2026-10-28\';')
w('-- (their links go with them) and DELETE FROM curriculum_repository_links WHERE relation_type LIKE \'proposed\\_%\' AND created_at >= \'2026-10-28\'.')
w()
w('SET search_path = public, extensions;')
w()
w('-- ============================================================================')
w('-- 1. New records')
w('-- ============================================================================')
w()
const rows = data.newRecords.map((r) => {
  const isMandate = r.recordType === 'institutional-mandate-record'
  const provenance = {
    date: '2026-10-28',
    added_by: 'claude-session',
    extracted_by: 'llm',
    review_status: 'author-draft',
    contributor_notes: `Researched by fetching ${url(r.sourceUrl)}.${r.notes ? ' ' + r.notes : ''} Not reviewed by a person.`,
  }
  const content = isMandate
    ? {
        id: r.sourceRecordId, label: r.title, sourceUrl: url(r.sourceUrl), provenance, jurisdiction: r.jurisdiction,
        issuingBody: r.issuingBody, mandateType: r.mandateType, adoptionDate: r.date, dateGranularity: r.dateGranularity,
        ...(r.effectiveFrom ? { effectiveFrom: r.effectiveFrom } : {}),
        statementText: r.summary, description: r.summary, verificationStatus: r.verification,
        ...(r.titleDe ? { labelDe: r.titleDe } : {}),
      }
    : {
        id: r.sourceRecordId, slug: r.slug, label: r.title, sourceUrl: url(r.sourceUrl), provenance, jurisdiction: r.jurisdiction,
        dateStart: r.date, dateGranularity: r.dateGranularity, eventType: r.eventType ?? 'other', temporalStatus: 'past-completed',
        description: r.summary, verificationStatus: r.verification,
        ...(r.titleDe ? { labelDe: r.titleDe } : {}),
      }
  const eventDate = r.dateGranularity === 'day' ? r.date : ''
  return `  (${q(r.id)}, ${q(r.repository)}, ${q(r.recordType)}, ${q(r.jurisdiction)}, ${q(r.sourceRepo)}, ${q(r.sourceRecordId)}, ${q(r.title)}, ${q(JSON.stringify(content))}, ${q(eventDate)})`
})
if (rows.length) {
  w('INSERT INTO curriculum_repository_records (id, project_id, record_type, jurisdiction, source_repo, source_record_id, title, content, access_tier, event_date)')
  w("SELECT v.id::uuid, p.id, v.record_type, v.jurisdiction, v.source_repo, v.source_record_id, v.title, v.content::jsonb, 'summary-only', NULLIF(v.event_date, '')::date")
  w('FROM (VALUES')
  w(rows.join(',\n'))
  w(') AS v(id, repo_slug, record_type, jurisdiction, source_repo, source_record_id, title, content, event_date)')
  w('JOIN projects p ON p.slug = v.repo_slug')
  w('ON CONFLICT (source_repo, source_record_id) DO NOTHING;')
}
w()
w('-- ============================================================================')
w('-- 2. Second review of the first proposals')
w('-- ============================================================================')
w()
for (const r of data.proposalReview) {
  const where = `data_object_id = ${q(r.objectId)}::uuid AND repository_record_id = ${q(r.recordId)}::uuid AND relation_type LIKE 'proposed\\_%'`
  // The reviewer's reason stays in the data file; the SQL carries the action only.
  if (r.verdict === 'remove') w('-- removed after the second review (reason in the data file)'), w(`DELETE FROM curriculum_repository_links WHERE ${where};`)
  else if (r.verdict === 'revise') w('-- reworded after the second review (reason in the data file)'), w(`UPDATE curriculum_repository_links SET rationale = ${q(r.newRationale)} WHERE ${where};`)
}
w()
w('-- ============================================================================')
w('-- 3. Further proposed links')
w('-- ============================================================================')
w('-- Rows are skipped when the part or the record is missing, or when the pair is already linked in any way.')
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
