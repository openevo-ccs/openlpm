#!/usr/bin/env node
// Generates the migration behind the rebuilt comparison views (2026-10-28):
//   node scripts/generate_comparison_views_migration.mjs > supabase/migrations/<n>_comparison_views_and_link_proposals.sql
//
// What it writes:
//   1. curriculum_link_reviews: a reviewer's verdict and comment on one link (the "question this" feature of the views).
//   2. The dashboard views. Each of the four synthetic spaces ends with three template views: Deutschland (Deutsch),
//      United States (English) and Cross-national comparison (English). Bio-Core and Interdisciplinary carry their old
//      Sachsen/Thüringen and New York/California views forward under the new ids, and their Florida/Pennsylvania/Tennessee
//      view is retired, because the United States view now covers all states in one place.
//   3. AI-drafted link proposals for Social-Core and Computational-Core (scripts/data/comparison-link-proposals.json), loaded
//      with relation types that start with proposed_ so the views mark them as unconfirmed.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(readFileSync(path.join(root, 'scripts/data/comparison-link-proposals.json'), 'utf8'))
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"

const SPACES = [
  { key: 'bio-core', slug: 'bio-core-lpm-synth', legacy: true },
  { key: 'social-core', slug: 'social-core-lpm-synth', legacy: false },
  { key: 'computational-core', slug: 'computational-core-lpm-synth', legacy: false },
  { key: 'interdisciplinary', slug: 'interdisciplinary-lpm-synth', legacy: true },
]
const VIEWS = [
  { suffix: 'germany-de', name: 'Deutschland (Deutsch)' },
  { suffix: 'united-states-en', name: 'United States (English)' },
  { suffix: 'cross-national-en', name: 'Cross-national comparison (English)' },
]

const L = []
const w = (s = '') => L.push(s)

w('-- Rebuilt comparison views: a Germany view, a United States view and a cross-national view for each of the four synthetic spaces,')
w('-- a place for reviewers to question a link, and AI-drafted link proposals for Social-Core and Computational-Core.')
w('--')
w('-- 1. curriculum_link_reviews. A verdict and a comment on one link. Anyone who can review or edit may add one; the author or an')
w('--    editor may remove it. The verdict is open vocabulary: supports, questions, too_broad or wrong_place.')
w('-- 2. Dashboard views. Bio-Core and Interdisciplinary keep their Sachsen/Thüringen and New York/California views, now under the')
w('--    new template ids, and lose the separate Florida/Pennsylvania/Tennessee view (the United States view covers every state).')
w('--    Social-Core and Computational-Core get all three. Every view is offered to the editor, contributor, reviewer and viewer roles.')
w('-- 3. Link proposals. Relation types start with proposed_, which the views show as "AI-drafted, unconfirmed". Nobody has reviewed')
w('--    them. A person confirms (the relation type loses the prefix), edits or removes each one.')
w('--')
w('-- To undo: DELETE FROM curriculum_repository_links WHERE relation_type LIKE \'proposed\\_%\'; DROP TABLE curriculum_link_reviews;')
w('-- and delete the three template views per space that this file added.')
w()
w('SET search_path = public, extensions;')
w()
w('-- ============================================================================')
w('-- 1. Reviewer verdicts on links')
w('-- ============================================================================')
w()
w('CREATE TABLE IF NOT EXISTS curriculum_link_reviews (')
w('  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),')
w('  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,')
w('  link_id UUID NOT NULL REFERENCES curriculum_repository_links(id) ON DELETE CASCADE,')
w('  -- Open vocabulary (supports, questions, too_broad, wrong_place). A text column, so a new verdict needs no schema change.')
w('  verdict TEXT NOT NULL,')
w('  comment TEXT,')
w('  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,')
w('  created_at TIMESTAMPTZ DEFAULT NOW()')
w(');')
w()
w('CREATE INDEX IF NOT EXISTS idx_curriculum_link_reviews_link ON curriculum_link_reviews(link_id);')
w('CREATE INDEX IF NOT EXISTS idx_curriculum_link_reviews_project ON curriculum_link_reviews(project_id);')
w()
w('ALTER TABLE curriculum_link_reviews ENABLE ROW LEVEL SECURITY;')
w()
w('DROP POLICY IF EXISTS "Project members can view link reviews" ON curriculum_link_reviews;')
w('CREATE POLICY "Project members can view link reviews" ON curriculum_link_reviews')
w('  FOR SELECT USING (is_project_member(project_id));')
w('DROP POLICY IF EXISTS "Reviewers and editors can add link reviews" ON curriculum_link_reviews;')
w('CREATE POLICY "Reviewers and editors can add link reviews" ON curriculum_link_reviews')
w("  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer', 'editor', 'contributor', 'reviewer']::project_member_role[]) AND reviewed_by = auth.uid());")
w('DROP POLICY IF EXISTS "Authors and editors can remove link reviews" ON curriculum_link_reviews;')
w('CREATE POLICY "Authors and editors can remove link reviews" ON curriculum_link_reviews')
w('  FOR DELETE USING (reviewed_by = auth.uid() OR is_project_editor(project_id));')
w()
w('-- ============================================================================')
w('-- 2. Dashboard views')
w('-- ============================================================================')
w()
w('DO $MIGRATION$')
w('DECLARE')
w('  v_project UUID;')
w('  v_view UUID;')
w('  v_role TEXT;')
w('BEGIN')
for (const sp of SPACES) {
  w(`  -- ${sp.key}`)
  w(`  SELECT id INTO v_project FROM projects WHERE slug = ${q(sp.slug)};`)
  w('  IF v_project IS NOT NULL THEN')
  if (sp.legacy) {
    w(`    DELETE FROM project_dashboard_views WHERE project_id = v_project AND template_id = ${q(sp.key + '-us-fl-pa-tn-en')};`)
    w(`    UPDATE project_dashboard_views SET template_id = ${q(sp.key + '-germany-de')}, name = ${q(VIEWS[0].name)} WHERE project_id = v_project AND template_id = ${q(sp.key + '-sachsen-thueringen-de')};`)
    w(`    UPDATE project_dashboard_views SET template_id = ${q(sp.key + '-united-states-en')}, name = ${q(VIEWS[1].name)} WHERE project_id = v_project AND template_id = ${q(sp.key + '-us-ny-ca-en')};`)
    w(`    UPDATE projects SET student_view_template = ${q(sp.key + '-germany-de')} WHERE id = v_project AND student_view_template = ${q(sp.key + '-sachsen-thueringen-de')};`)
    w(`    UPDATE projects SET student_view_template = ${q(sp.key + '-united-states-en')} WHERE id = v_project AND student_view_template IN (${q(sp.key + '-us-ny-ca-en')}, ${q(sp.key + '-us-fl-pa-tn-en')});`)
  }
  for (const v of VIEWS) {
    const tpl = `${sp.key}-${v.suffix}`
    w(`    INSERT INTO project_dashboard_views (project_id, name, kind, template_id)`)
    w(`    SELECT v_project, ${q(v.name)}, 'template', ${q(tpl)}`)
    w(`    WHERE NOT EXISTS (SELECT 1 FROM project_dashboard_views WHERE project_id = v_project AND template_id = ${q(tpl)});`)
    w(`    SELECT id INTO v_view FROM project_dashboard_views WHERE project_id = v_project AND template_id = ${q(tpl)} ORDER BY created_at LIMIT 1;`)
    w(`    FOREACH v_role IN ARRAY ARRAY['editor', 'contributor', 'reviewer', 'viewer'] LOOP`)
    w(`      INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value) VALUES (v_view, 'role', v_role) ON CONFLICT DO NOTHING;`)
    w(`    END LOOP;`)
  }
  w('  END IF;')
  w()
}
w('END $MIGRATION$;')
w()
w('-- ============================================================================')
w('-- 3. AI-drafted link proposals (Social-Core, Computational-Core)')
w('-- ============================================================================')
w('-- Each row ties one part of the progression to one record of the real-world corpus, with a written reason. Rows are skipped when')
w('-- the part or the record is missing, or when the pair is already linked in any way.')
for (const [space, block] of Object.entries(data.spaces)) {
  w()
  w(`-- ${space}: ${block.links.length} proposals, ${block.itemsWithoutLinks.length} parts left without one. Gaps in the corpus: ${block.corpusGaps.replace(/\s+/g, ' ')}`.replace(/\n/g, ' '))
  w('INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)')
  w('SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale')
  w('FROM (VALUES')
  const rows = block.links.map((l) => `  (${q(l.objectId)}, ${q(l.recordId)}, ${q('proposed_' + l.relationType)}, ${q(l.rationale)})`)
  w(rows.join(',\n'))
  w(') AS v(object_id, record_id, relation_type, rationale)')
  w('JOIN lpm_data_objects o ON o.id = v.object_id::uuid')
  w('JOIN curriculum_repository_records r ON r.id = v.record_id::uuid')
  w('WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);')
}
w()
process.stdout.write(L.join('\n'))
