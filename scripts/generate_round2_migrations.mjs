#!/usr/bin/env node
// Generates the second round of the India worked example (2026-10-30 and after). Two files from one data file:
//   node scripts/generate_round2_migrations.mjs records      > supabase/migrations/<n>_kerala_and_language_records.sql
//   node scripts/generate_round2_migrations.mjs strandlinks  > supabase/migrations/<m>_links_to_schooling_and_language_strands.sql
//
// Input: scripts/data/round2-goals-and-standards-2026-10-30.json
//   records       records for Kerala (a new Kerala School Curriculum Repository) and for language and schooling policy, national and in the states
//   links         proposed links from parts of the existing spaces to those records
//   strandLinks   proposed links from the two new Interdisciplinary strands ("The Nature of Schooling", "The Languages of Being Human")
//                 to records of both rounds. Applied by the second file, which must run after the migration that adds those strands.
//   updates       corrections to earlier records
//
// Everything is AI-drafted and unreviewed by an Indian curriculum expert. Links carry a relation type that starts with proposed_.
//
// Kerala already has a Curriculum Repository (kerala-curriculum-repository) that holds separate, unreviewed research on the education of
// Scheduled Tribe communities. Linking a space to a repository gives its members read access to every record in it, so the school-curriculum
// records go into a repository of their own and only that one is linked.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2]
if (!['records', 'strandlinks'].includes(mode)) { console.error('usage: records | strandlinks'); process.exit(1) }
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/round2-goals-and-standards-2026-10-30.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const url = (u) => (/[^ -~]/.test(u) ? encodeURI(u) : u)
const L = []
const w = (s = '') => L.push(s)

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
const KL_SLUG = 'kerala-school-curriculum-repository'
const SPACES = ['bio-core-lpm-synth', 'social-core-lpm-synth', 'computational-core-lpm-synth', 'interdisciplinary-lpm-synth']
const REPO_NOTE = 'AI-drafted from public documents and summarised in our own words. No Indian curriculum expert has reviewed it. Each record says which document was read and which passage; treat anything marked secondary-source-only as unconfirmed.'
const KL_LINK_NOTE = 'India view: Kerala school curriculum goals and standards. AI-drafted from public documents; no Indian curriculum expert has reviewed it.'
const NEW_STRAND_IDS = ['4dba2f37-8343-5a95-8180-ec785af885fb', '19a6d1e8-96b6-58c9-8dff-f68b0ad2fe84']

const records = data.records.map((r) => ({ ...r, id: uuid5(`${SOURCE_REPO}/${r.sourceRecordId}`) }))
const count = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a }, {})
const byRepo = count(records, (r) => r.repo.replace('-curriculum-repository', '').replace('kerala-school', 'kerala'))

function sourceFor(l) { return l.sourceRecordId }

if (mode === 'records') {
  const nLinks = data.links.length
  w('-- India worked example, second round: Kerala, and language and schooling policy. All of it is AI-drafted and unreviewed by an Indian curriculum expert.')
  w('--')
  w('-- 1. A new Kerala School Curriculum Repository, nested under the India repository. The existing Kerala repository holds separate research on')
  w("--    the education of Scheduled Tribe communities that has not been reviewed, so it is not linked here: a link gives a space's members")
  w('--    read access to every record in the repository it points at.')
  w(`-- 2. ${records.length} records (${Object.entries(byRepo).map(([k, v]) => `${v} ${k}`).join(', ')}), each with the document it was read from and the passage. Summaries are in our own words.`)
  w('-- 3. Each synthetic space is declared as grounded in the Kerala repository, so its members can read it.')
  w(`-- 4. ${nLinks} proposed links from parts of the spaces to those records. Their relation type starts with proposed_, which the views show as`)
  w('--    "AI-drafted, unconfirmed". A person confirms, edits or removes each one.')
  if (data.updates?.length) w(`-- 5. ${data.updates.length} correction${data.updates.length === 1 ? '' : 's'} to earlier records.`)
  w('-- Needs migration 200 (the India repositories and views) applied first; it stops with an error otherwise, so nothing is skipped without notice.')
  w('--')
  w("-- To undo, delete exactly these records (their links go with them), then the Kerala repository link rows and the Kerala repository:")
  w(`--   DELETE FROM curriculum_repository_records WHERE source_repo = '${SOURCE_REPO}' AND source_record_id IN (`)
  w(records.map((r) => `--     ${q(r.sourceRecordId)}`).join(',\n'))
  w('--   );')
  w(`--   DELETE FROM project_repository_links WHERE jurisdiction = 'IN-KL' AND repository_project_id = (SELECT id FROM projects WHERE slug = '${KL_SLUG}');`)
  w(`--   DELETE FROM projects WHERE slug = '${KL_SLUG}';`)
  w()
  w('SET search_path = public, extensions;')
  w()
  w('DO $MIGRATION$')
  w('DECLARE')
  w('  v_india UUID;')
  w('  v_owner_id UUID;')
  w('  v_owner_invited_by UUID;')
  w('  v_kl UUID;')
  w('BEGIN')
  w("  IF NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'uttar-pradesh-curriculum-repository') THEN")
  w("    RAISE EXCEPTION 'Apply migration 200 first: the Uttar Pradesh repository is missing.';")
  w('  END IF;')
  w("  SELECT id INTO v_india FROM projects WHERE slug = 'india-curriculum-repository';")
  w("  SELECT user_id, invited_by INTO v_owner_id, v_owner_invited_by FROM project_members WHERE project_id = v_india AND role = 'owner' LIMIT 1;")
  w('  INSERT INTO projects (slug, name, description, project_kind, parent_project_id, is_private, epistemic_status, epistemic_status_note, focus_type, region_tags, created_by)')
  w('  SELECT')
  w(`    ${q(KL_SLUG)},`)
  w("    'Kerala School Curriculum Repository',")
  w(`    ${q('School curriculum goals and standards for Kerala: the Kerala Curriculum Framework, the SCERT Kerala textbooks for science, social science and ICT, and the state programmes that bear on them. First layer, written 2026-10-30 from public documents. Research on the education of Scheduled Tribe communities is held separately in the Kerala Curriculum Repository.')},`)
  w("    'curriculum-repository',")
  w('    v_india,')
  w('    TRUE,')
  w("    'in-development',")
  w(`    ${q(REPO_NOTE)},`)
  w("    'regional',")
  w("    ARRAY['IN-KL'],")
  w('    v_owner_id')
  w(`  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = ${q(KL_SLUG)});`)
  w(`  SELECT id INTO v_kl FROM projects WHERE slug = ${q(KL_SLUG)};`)
  w('  IF v_owner_id IS NOT NULL THEN')
  w('    INSERT INTO project_members (project_id, user_id, role, invited_by)')
  w("    VALUES (v_kl, v_owner_id, 'owner', v_owner_invited_by)")
  w('    ON CONFLICT (project_id, user_id) DO NOTHING;')
  w('  END IF;')
  w('END')
  w('$MIGRATION$;')
  w()
  w('-- ============================================================================')
  w('-- Records')
  w('-- ============================================================================')
  w()
  const rows = records.map((r) => {
    const isMandate = r.recordType === 'institutional-mandate-record'
    const provenance = {
      date: '2026-10-30', added_by: 'claude-session', extracted_by: 'llm', review_status: 'author-draft',
      contributor_notes: `${r.verificationStatus === 'primary-source-confirmed' ? 'Read in the primary document' : 'Not confirmed against a primary copy'}: ${r.sourcePassage}.${r.notes ? ' ' + r.notes : ''} Written in our own words. Not reviewed by an Indian curriculum expert.`,
    }
    const common = { id: r.sourceRecordId, label: r.title, sourceUrl: url(r.sourceUrl), provenance, jurisdiction: r.jurisdiction, sourcePassage: r.sourcePassage, description: r.statementText, verificationStatus: r.verificationStatus }
    const content = isMandate
      ? { ...common, issuingBody: r.issuingBody, mandateType: r.mandateType, ...(r.adoptionDate ? { adoptionDate: r.adoptionDate, dateGranularity: r.dateGranularity } : {}), statementText: r.statementText,
          ...(r.subject ? { subject: r.subject } : {}), ...(r.gradeFrom != null ? { gradeFrom: r.gradeFrom, gradeTo: r.gradeTo ?? r.gradeFrom } : {}), ...(r.topicTags?.length ? { topicTags: r.topicTags } : {}) }
      : { ...common, slug: r.sourceRecordId.toLowerCase().replace(/^in-(?:ka-|mh-|up-|kl-)?event-/, ''), dateStart: r.adoptionDate, dateGranularity: r.dateGranularity, eventType: r.eventType ?? 'other', temporalStatus: 'past-completed', ...(r.topicTags?.length ? { topicTags: r.topicTags } : {}) }
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
    w('-- Corrections to earlier records')
    w('-- ============================================================================')
    w()
    for (const u of data.updates) {
      w(`-- ${u.sourceRecordId}: ${u.why}`)
      w('UPDATE curriculum_repository_records SET')
      if (u.title) w(`  title = ${q(u.title)},`)
      const label = u.title ? `'label', ${q(u.title)}::text, ` : ''
      const fields = Object.entries(u.fields).map(([k, v]) => `${q(k)}, ${q(v)}::text, `).join('')
      w(`  content = content || jsonb_build_object(${label}${fields}'correctionNote', ${q(u.correctionNote)}::text, 'correctedOn', '2026-10-30')`)
      w(`WHERE source_repo = 'india-lpm' AND source_record_id = ${q(u.sourceRecordId)};`)
      w()
    }
  }
  w('-- ============================================================================')
  w('-- Each synthetic space is grounded in the Kerala repository')
  w('-- ============================================================================')
  w()
  w('INSERT INTO project_repository_links (project_id, repository_project_id, jurisdiction, note)')
  w('SELECT s.id, r.id, v.jurisdiction, v.note')
  w('FROM (VALUES')
  w(SPACES.map((s) => `  (${q(s)}, ${q(KL_SLUG)}, 'IN-KL', ${q(KL_LINK_NOTE)})`).join(',\n'))
  w(') AS v(space_slug, repo_slug, jurisdiction, note)')
  w('JOIN projects s ON s.slug = v.space_slug')
  w('JOIN projects r ON r.slug = v.repo_slug')
  w('ON CONFLICT (project_id, repository_project_id, jurisdiction) DO NOTHING;')
  w()
  w('-- ============================================================================')
  w('-- Proposed links to the parts the spaces already have')
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
    w(links.map((l) => `  (${q(l.targetId)}, ${q(sourceFor(l))}, ${q('proposed_' + l.relation.replace(/^proposed_/, ''))}, ${q(l.rationale)})`).join(',\n'))
    w(') AS v(object_id, source_record_id, relation_type, rationale)')
    w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
    w(`JOIN curriculum_repository_records r ON r.source_repo IN (${q(SOURCE_REPO)}, 'india-lpm') AND r.source_record_id = v.source_record_id`)
    w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
  }
} else {
  const links = data.strandLinks
  w('-- Proposed links from the two new Interdisciplinary strands, "The Nature of Schooling" and "The Languages of Being Human", to India records.')
  w(`-- ${links.length} links. Their relation type starts with proposed_, which the views show as "AI-drafted, unconfirmed". AI-drafted and unreviewed.`)
  w('--')
  w('-- The two strands and their parts are added by the migration "schooling and language strands" (OpenLPM PR #146). This file stops with an error if')
  w('-- they are missing, so no link is skipped without notice. The parts start in draft status, and the comparison views read accepted parts only,')
  w('-- so these links appear in the views once a reviewer accepts the parts.')
  w('--')
  w("-- To undo: DELETE FROM curriculum_repository_links WHERE relation_type LIKE 'proposed\\_%' AND data_object_id IN (SELECT id FROM lpm_data_objects WHERE parent_id IS NOT NULL AND project_id = (SELECT id FROM projects WHERE slug = 'interdisciplinary-lpm-synth') AND created_at >= '2026-10-30') AND repository_record_id IN (SELECT id FROM curriculum_repository_records WHERE source_record_id LIKE 'IN-%') AND created_at >= '2026-10-30';")
  w()
  w('SET search_path = public, extensions;')
  w()
  w('DO $MIGRATION$')
  w('BEGIN')
  for (const id of NEW_STRAND_IDS) {
    w(`  IF NOT EXISTS (SELECT 1 FROM lpm_data_objects WHERE id = ${q(id)}::uuid) THEN`)
    w(`    RAISE EXCEPTION 'Apply the schooling and language strands migration first: strand ${id} is missing.';`)
    w('  END IF;')
  }
  w('END')
  w('$MIGRATION$;')
  w()
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
process.stdout.write(L.join('\n'))
