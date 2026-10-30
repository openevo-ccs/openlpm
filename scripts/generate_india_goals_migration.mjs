#!/usr/bin/env node
// Generates the India goals-and-standards migration (2026-10-30), built for partner educators at CHRIST (Deemed to be University):
//   node scripts/generate_india_goals_migration.mjs > supabase/migrations/<n>_india_goals_and_standards_for_christ_partners.sql
//
// Input: scripts/data/india-goals-and-standards-2026-10-30.json
//   records   one object per record: national frameworks and syllabi, and the states of Karnataka, Maharashtra and Uttar Pradesh.
//             Each was researched from a document that was fetched and read; the address, the passage read and how well it was
//             confirmed are kept in the record.
//   links     AI-drafted proposals from a part (or a whole strand) of one of the four synthetic spaces to a record.
//
// Everything is AI-drafted and unreviewed by an Indian curriculum expert. Links carry a relation type that starts with proposed_, so
// the views show them as unconfirmed. Records carry provenance review_status author-draft.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/india-goals-and-standards-2026-10-30.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
// Addresses with a non-ASCII character are percent-encoded so they stay clickable.
const url = (u) => (/[^ -~]/.test(u) ? encodeURI(u) : u)
const L = []
const w = (s = '') => L.push(s)

// A stable id per record, so regenerating the file gives the same rows (version 5 style, fixed namespace).
const NAMESPACE = 'a7c3f1e0-5b2d-4c8a-9e61-0d4f7b2c1a35'
function uuid5(name) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex')
  const h = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

const SOURCE_REPO = 'openlpm-starter-draft'
const SPACES = [
  { key: 'bio-core', slug: 'bio-core-lpm-synth' },
  { key: 'social-core', slug: 'social-core-lpm-synth' },
  { key: 'computational-core', slug: 'computational-core-lpm-synth' },
  { key: 'interdisciplinary', slug: 'interdisciplinary-lpm-synth' },
]
const REPOS = [
  { slug: 'india-curriculum-repository', jurisdiction: 'IN', note: 'India view: national frameworks and syllabi for school education (NEP 2020, NCF-SE 2023 and the subject documents under them). AI-drafted from public documents; no Indian curriculum expert has reviewed it.' },
  { slug: 'karnataka-curriculum-repository', jurisdiction: 'IN-KA', note: 'India view: Karnataka school curriculum goals and standards. AI-drafted from public documents; no Indian curriculum expert has reviewed it.' },
  { slug: 'maharashtra-curriculum-repository', jurisdiction: 'IN-MH', note: 'India view: Maharashtra school curriculum goals and standards. AI-drafted from public documents; no Indian curriculum expert has reviewed it.' },
  { slug: 'uttar-pradesh-curriculum-repository', jurisdiction: 'IN-UP', note: 'India view: Uttar Pradesh school curriculum goals and standards. AI-drafted from public documents; no Indian curriculum expert has reviewed it.' },
]

const records = data.records.map((r) => ({ ...r, id: uuid5(`${SOURCE_REPO}/${r.sourceRecordId}`) }))
const nBySpace = {}
for (const l of data.links) nBySpace[l.space] = (nBySpace[l.space] ?? 0) + 1
const nByRepo = {}
for (const r of records) nByRepo[r.repo] = (nByRepo[r.repo] ?? 0) + 1

w('-- India goals and standards for the four synthetic spaces, built for partner educators at CHRIST (Deemed to be University)')
w('-- (campuses in Karnataka, Uttar Pradesh and Maharashtra). All of it is AI-drafted and unreviewed by an Indian curriculum expert.')
w('--')
w(`-- 1. A new Uttar Pradesh Curriculum Repository (the first for that state), nested under the India repository, and an honest label for the`)
w('--    four India repositories that carry this content: public documents summarised by an AI. No expert has reviewed them yet.')
w(`-- 2. ${records.length} new records (${Object.entries(nByRepo).map(([k, v]) => `${v} ${k.replace('-curriculum-repository', '')}`).join(', ')}): frameworks and syllabus topics`)
w('--    that set school goals and standards, each with the document it was read from and the passage. Summaries are in our own words.')
w('-- 3. Each synthetic space is declared as grounded in the four India repositories, so its members can read them.')
w(`-- 4. ${data.links.length} proposed links from parts of the spaces to those records (${Object.entries(nBySpace).map(([k, v]) => `${v} ${k.replace('-lpm-synth', '')}`).join(', ')}). Their relation type`)
w('--    starts with proposed_, which the views show as "AI-drafted, unconfirmed". A person confirms, edits or removes each one.')
w('-- 5. An "India (English)" view for each space, offered to the editor, contributor, reviewer and viewer roles.')
w('--')
w(`-- To undo: DELETE FROM curriculum_repository_records WHERE source_repo = '${SOURCE_REPO}' AND source_record_id LIKE 'IN-%'; (their links go with them),`)
w("-- DELETE FROM project_repository_links WHERE jurisdiction IN ('IN','IN-KA','IN-MH','IN-UP') AND project_id IN (SELECT id FROM projects WHERE slug LIKE '%-lpm-synth'),")
w("-- DELETE FROM project_dashboard_views WHERE template_id LIKE '%-india-en', and DELETE FROM projects WHERE slug = 'uttar-pradesh-curriculum-repository'.")
w()
w('SET search_path = public, extensions;')
w()
w('-- ============================================================================')
w('-- 1. Uttar Pradesh repository, and labels for the India repositories')
w('-- ============================================================================')
w()
w('DO $MIGRATION$')
w('DECLARE')
w('  v_india UUID;')
w('  v_owner_id UUID;')
w('  v_owner_invited_by UUID;')
w('  v_up UUID;')
w('  v_project UUID;')
w('  v_view UUID;')
w('  v_role TEXT;')
w('BEGIN')
w("  SELECT id INTO v_india FROM projects WHERE slug = 'india-curriculum-repository';")
w("  SELECT user_id, invited_by INTO v_owner_id, v_owner_invited_by FROM project_members WHERE project_id = v_india AND role = 'owner' LIMIT 1;")
w()
w('  INSERT INTO projects (slug, name, description, project_kind, parent_project_id, is_private, epistemic_status, epistemic_status_note, focus_type, region_tags, created_by)')
w('  SELECT')
w("    'uttar-pradesh-curriculum-repository',")
w("    'Uttar Pradesh Curriculum Repository',")
w(`    ${q('School curriculum goals and standards for Uttar Pradesh: who sets the syllabus, how the state uses the national (NCERT) books and framework, and what its science, social science and computing syllabi ask. First layer, written 2026-10-30 from public documents for partner educators at CHRIST (Deemed to be University), Delhi NCR campus (Ghaziabad).')},`)
w("    'curriculum-repository',")
w('    v_india,')
w('    TRUE,')
w("    'in-development',")
w(`    ${q('AI-drafted from public documents and summarised in our own words. No Indian curriculum expert has reviewed it. Each record says which document was read and which passage; treat anything marked secondary-source-only as unconfirmed.')},`)
w("    'regional',")
w("    ARRAY['IN-UP'],")
w('    v_owner_id')
w("  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'uttar-pradesh-curriculum-repository');")
w()
w("  SELECT id INTO v_up FROM projects WHERE slug = 'uttar-pradesh-curriculum-repository';")
w('  IF v_owner_id IS NOT NULL THEN')
w('    INSERT INTO project_members (project_id, user_id, role, invited_by)')
w("    VALUES (v_up, v_owner_id, 'owner', v_owner_invited_by)")
w('    ON CONFLICT (project_id, user_id) DO NOTHING;')
w('  END IF;')
w()
w("  -- The India repositories hold public documents summarised by an AI. Their earlier label (human-curated, already in classroom use)")
w("  -- overstates that. Kerala keeps its label because it is outside this view.")
w("  UPDATE projects SET epistemic_status = 'in-development',")
w(`    epistemic_status_note = ${q('AI-drafted from public documents and summarised in our own words. No Indian curriculum expert has reviewed it. Each record says which document was read and which passage; treat anything marked secondary-source-only as unconfirmed.')}`)
w("  WHERE slug IN ('india-curriculum-repository', 'karnataka-curriculum-repository', 'maharashtra-curriculum-repository');")
w('END')
w('$MIGRATION$;')
w()
w('-- ============================================================================')
w('-- 2. Records')
w('-- ============================================================================')
w()
const rows = records.map((r) => {
  const isMandate = r.recordType === 'institutional-mandate-record'
  const provenance = {
    date: '2026-10-30',
    added_by: 'claude-session',
    extracted_by: 'llm',
    review_status: 'author-draft',
    contributor_notes: `${r.verificationStatus === 'primary-source-confirmed' ? 'Read in the primary document' : 'Not confirmed against a primary copy'}: ${r.sourcePassage}.${r.notes ? ' ' + r.notes : ''} Written in our own words. Not reviewed by an Indian curriculum expert.`,
  }
  const common = {
    id: r.sourceRecordId, label: r.title, sourceUrl: url(r.sourceUrl), provenance, jurisdiction: r.jurisdiction,
    sourcePassage: r.sourcePassage, description: r.statementText, verificationStatus: r.verificationStatus,
  }
  const content = isMandate
    ? {
        ...common,
        issuingBody: r.issuingBody, mandateType: r.mandateType, adoptionDate: r.adoptionDate, dateGranularity: r.dateGranularity,
        statementText: r.statementText,
        ...(r.subject ? { subject: r.subject } : {}),
        ...(r.gradeFrom != null ? { gradeFrom: r.gradeFrom, gradeTo: r.gradeTo ?? r.gradeFrom } : {}),
        ...(r.topicTags?.length ? { topicTags: r.topicTags } : {}),
      }
    : {
        ...common,
        slug: r.sourceRecordId.toLowerCase().replace(/^in-(?:ka-|mh-|up-)?event-/, ''),
        dateStart: r.adoptionDate, dateGranularity: r.dateGranularity, eventType: r.eventType ?? 'other', temporalStatus: 'past-completed',
        ...(r.topicTags?.length ? { topicTags: r.topicTags } : {}),
      }
  const eventDate = r.dateGranularity === 'day' ? r.adoptionDate : ''
  return `  (${q(r.id)}, ${q(r.repo)}, ${q(r.recordType)}, ${q(r.jurisdiction)}, ${q(SOURCE_REPO)}, ${q(r.sourceRecordId)}, ${q(r.title)}, ${q(JSON.stringify(content))}, ${q(eventDate)})`
})
w('INSERT INTO curriculum_repository_records (id, project_id, record_type, jurisdiction, source_repo, source_record_id, title, content, access_tier, event_date)')
w("SELECT v.id::uuid, p.id, v.record_type, v.jurisdiction, v.source_repo, v.source_record_id, v.title, v.content::jsonb, 'summary-only', NULLIF(v.event_date, '')::date")
w('FROM (VALUES')
w(rows.join(',\n'))
w(') AS v(id, repo_slug, record_type, jurisdiction, source_repo, source_record_id, title, content, event_date)')
w('JOIN projects p ON p.slug = v.repo_slug')
w('ON CONFLICT (source_repo, source_record_id) DO NOTHING;')
w()
if (data.updates?.length) {
  w('-- ============================================================================')
  w('-- 2b. Corrections to earlier India records, found when the primary documents were read')
  w('-- ============================================================================')
  w()
  for (const u of data.updates) {
    w(`-- ${u.sourceRecordId}: ${u.why}`)
    w('UPDATE curriculum_repository_records SET')
    if (u.title) w(`  title = ${q(u.title)},`)
    const label = u.title ? `'label', ${q(u.title)}::text, ` : ''
    // fields: the text fields to replace in the record's content (an earlier record may keep its text in summary or description).
    const fields = Object.entries(u.fields).map(([k, v]) => `${q(k)}, ${q(v)}::text, `).join('')
    w(`  content = content || jsonb_build_object(${label}${fields}'correctionNote', ${q(u.correctionNote)}::text, 'correctedOn', '2026-10-30')`)
    w(`WHERE source_repo = 'india-lpm' AND source_record_id = ${q(u.sourceRecordId)};`)
    w()
  }
}
w('-- ============================================================================')
w('-- 3. Each synthetic space is grounded in the four India repositories')
w('-- ============================================================================')
w()
w('INSERT INTO project_repository_links (project_id, repository_project_id, jurisdiction, note)')
w('SELECT s.id, r.id, v.jurisdiction, v.note')
w('FROM (VALUES')
const l1 = []
for (const s of SPACES) for (const r of REPOS) l1.push(`  (${q(s.slug)}, ${q(r.slug)}, ${q(r.jurisdiction)}, ${q(r.note)})`)
w(l1.join(',\n'))
w(') AS v(space_slug, repo_slug, jurisdiction, note)')
w('JOIN projects s ON s.slug = v.space_slug')
w('JOIN projects r ON r.slug = v.repo_slug')
w('ON CONFLICT (project_id, repository_project_id, jurisdiction) DO NOTHING;')
w()
w('-- ============================================================================')
w('-- 4. Proposed links')
w('-- ============================================================================')
w('-- Rows are skipped when the part or the record is missing, or when the pair is already linked in any way.')
const bySpace = {}
for (const l of data.links) (bySpace[l.space] ??= []).push(l)
for (const [space, links] of Object.entries(bySpace)) {
  w()
  w(`-- ${space}: ${links.length} proposals`)
  w('INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)')
  w('SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale')
  w('FROM (VALUES')
  w(links.map((l) => `  (${q(l.targetId)}, ${q(l.sourceRecordId)}, ${q('proposed_' + l.relation.replace(/^proposed_/, ''))}, ${q(l.rationale)})`).join(',\n'))
  w(') AS v(object_id, source_record_id, relation_type, rationale)')
  w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
  w(`JOIN curriculum_repository_records r ON r.source_repo IN (${q(SOURCE_REPO)}, 'india-lpm') AND r.source_record_id = v.source_record_id`)
  w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
}
w()
w('-- ============================================================================')
w('-- 5. The India view for each space')
w('-- ============================================================================')
w()
w('DO $MIGRATION$')
w('DECLARE')
w('  v_project UUID;')
w('  v_view UUID;')
w('  v_role TEXT;')
w('BEGIN')
for (const s of SPACES) {
  w(`  SELECT id INTO v_project FROM projects WHERE slug = ${q(s.slug)};`)
  w('  IF v_project IS NOT NULL THEN')
  w('    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)')
  w(`    SELECT v_project, 'India (English)', 'template', ${q(s.key + '-india-en')}`)
  w(`    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = ${q(s.key + '-india-en')});`)
  w(`    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = ${q(s.key + '-india-en')} ORDER BY created_at LIMIT 1;`)
  w("    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP")
  w("      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;")
  w('    END LOOP;')
  w('  END IF;')
}
w('END')
w('$MIGRATION$;')
w()
process.stdout.write(L.join('\n'))
