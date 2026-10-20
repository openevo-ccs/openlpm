-- Comparative-analysis infrastructure for the two synthetic LPMs
-- (bio-core-lpm-synth / interdisciplinary-lpm-synth), built generically
-- (not hardcoded to these two projects) so it applies to any future
-- deliberate LPM comparison. Four real pieces:
--
-- 1. theorybase_snapshot's record_type CHECK didn't allow 'divergence' --
--    needed before scripts/sync_theorybase_snapshot.mjs (extended
--    2026-10-20 to also read divergences.yaml, RFC-0009's real registry of
--    8 named DCR-vs-ICR disagreements plus 5 Hurst-lab ones) can sync.
--
-- 2. lpm_comparative_links -- an intentional, cross-project connection
--    between two specific lpm_data_objects, e.g. "Bio-Core's Natural
--    Selection strand" <-> "Interdisciplinary's Agency/Niche strand,"
--    with real researcher commentary and an optional reference to the
--    specific TheoryBase Divergence record it illustrates. Deliberately a
--    NEW table rather than reusing lpm_connections: lpm_connections' own
--    schema technically allows a cross-project row (no CHECK ties its
--    project_id to from_object/to_object's own project_id) but every real
--    frontend consumer (grade-band matrices, the review queue, Explore)
--    assumes same-project and would mis-render or break on a cross-project
--    row -- confirmed by direct code read, 2026-10-20. A dedicated table
--    avoids silently corrupting that existing, working assumption.
--
-- 3. lpm_divergence_reviews -- answers a real, separate question from "has
--    anyone ever linked this divergence": whether a project's own
--    treatment of a specific real Divergence record is still CURRENT.
--    TheoryBase's divergence records can themselves be revised later (a
--    real, versioned, provenance.version field) -- this tracks, per
--    project per divergence, the version that was true at review time, so
--    a later design session (or a future Open Universe agent) can compute
--    real staleness/coverage rather than just "has this ever been looked
--    at." outcome covers the real cases found while building this: a
--    divergence can be reviewed and result in a real node-level
--    comparative_link, or reviewed and judged project-wide/not
--    node-mappable (several of the 8 real Kampourakis divergences are
--    about overall philosophy or assessment design, not one specific
--    strand pair), or reviewed and explicitly deferred.
--
-- 4. Two views: lpm_data_object_richness (per-object computed content
--    measures) and lpm_project_comparison_profile (per-project
--    aggregate). Deliberately reports depth-within-scope and
--    breadth-of-scope as SEPARATE fields, never combined into one score --
--    Dustin's own explicit 2026-10-20 design decision, since Bio-Core's
--    narrower scope is a deliberate feature of what it's testing (DCR),
--    not a deficiency relative to Interdisciplinary's deliberately wider
--    one (ICR) -- collapsing them into one number would misrepresent what
--    either model is actually trying to prove.

SET search_path = public, extensions;

ALTER TABLE theorybase_snapshot DROP CONSTRAINT IF EXISTS theorybase_snapshot_record_type_check;
ALTER TABLE theorybase_snapshot ADD CONSTRAINT theorybase_snapshot_record_type_check CHECK (record_type IN (
  'theory', 'proposition', 'assumption', 'competing_proposition',
  'misconception', 'cross_domain_construct', 'design_principle', 'curriculum_decision',
  'divergence'
));

-- ============================================================================
-- 1. Comparative links
-- ============================================================================

CREATE TABLE IF NOT EXISTS lpm_comparative_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  to_data_object_id UUID NOT NULL REFERENCES lpm_data_objects(id) ON DELETE CASCADE,
  -- Open vocabulary (TEXT, not ENUM -- this schema's own established
  -- convention for extensible classification, e.g. relation_type on
  -- lpm_connections/curriculum_repository_links). Real values used by this
  -- migration's own seed data: 'contrasting_treatment' (both models address
  -- the same real-world phenomenon, framed differently -- the common case),
  -- 'assessment_item_divergence'/'assessment_scoring_divergence' (a
  -- concrete illustration of a named TheoryBase Divergence via real
  -- assessment-item text or scoring outcomes -- kept distinct per
  -- divergence rather than one shared 'divergence_instance' value, since
  -- the same strand pair can illustrate more than one divergence and the
  -- UNIQUE constraint is keyed on relation_type). No 'absent_counterpart'
  -- value is used: a strand with no real counterpart at all is represented
  -- by the ABSENCE of any row for it, not a row pointing nowhere -- see
  -- migration 144's own closing note.
  relation_type TEXT NOT NULL DEFAULT 'relates_to',
  -- References theorybase_snapshot.id where record_type='divergence' --
  -- not a DB foreign key, since theorybase_snapshot's own content is
  -- synced from an external repo and a link shouldn't hard-fail if a
  -- divergence record is ever renamed/removed upstream before a re-sync.
  divergence_ref TEXT,
  commentary TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_data_object_id <> to_data_object_id),
  UNIQUE (from_data_object_id, to_data_object_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_lpm_comparative_links_from ON lpm_comparative_links(from_data_object_id);
CREATE INDEX IF NOT EXISTS idx_lpm_comparative_links_to ON lpm_comparative_links(to_data_object_id);
CREATE INDEX IF NOT EXISTS idx_lpm_comparative_links_divergence ON lpm_comparative_links(divergence_ref);

ALTER TABLE lpm_comparative_links ENABLE ROW LEVEL SECURITY;

-- "Either side's members" -- same precedent as project_repository_links
-- (migration 066), since a comparative link's two ends can belong to two
-- different projects with two different membership lists.
DROP POLICY IF EXISTS "Either side's members can view comparative links" ON lpm_comparative_links;
CREATE POLICY "Either side's members can view comparative links" ON lpm_comparative_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = from_data_object_id AND is_project_member(o.project_id))
    OR EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = to_data_object_id AND is_project_member(o.project_id))
  );

DROP POLICY IF EXISTS "Either side's editors can create comparative links" ON lpm_comparative_links;
CREATE POLICY "Either side's editors can create comparative links" ON lpm_comparative_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = from_data_object_id AND is_project_editor(o.project_id))
    OR EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = to_data_object_id AND is_project_editor(o.project_id))
  );

DROP POLICY IF EXISTS "Either side's editors can update comparative links" ON lpm_comparative_links;
CREATE POLICY "Either side's editors can update comparative links" ON lpm_comparative_links
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = from_data_object_id AND is_project_editor(o.project_id))
    OR EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = to_data_object_id AND is_project_editor(o.project_id))
  );

DROP POLICY IF EXISTS "Either side's editors can delete comparative links" ON lpm_comparative_links;
CREATE POLICY "Either side's editors can delete comparative links" ON lpm_comparative_links
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = from_data_object_id AND is_project_editor(o.project_id))
    OR EXISTS (SELECT 1 FROM lpm_data_objects o WHERE o.id = to_data_object_id AND is_project_editor(o.project_id))
  );

-- ============================================================================
-- 2. Divergence review tracking (coverage + staleness, not just "linked")
-- ============================================================================

CREATE TABLE IF NOT EXISTS lpm_divergence_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- theorybase_snapshot.id where record_type='divergence' -- same
  -- external-reference-not-FK reasoning as lpm_comparative_links.divergence_ref.
  divergence_ref TEXT NOT NULL,
  -- What the review concluded -- a node-level link is only one real outcome.
  outcome TEXT NOT NULL CHECK (outcome IN ('linked', 'reviewed_project_wide', 'reviewed_no_action', 'deferred')),
  -- The divergence record's own real provenance.version/date at the moment
  -- of this review (read from theorybase_snapshot.data at review time,
  -- copied here) -- compared against the CURRENT snapshot row's own
  -- version/date to compute staleness later, without needing a content
  -- hash. Null is honestly allowed: an older divergence record predating
  -- RFC-0009's own version field, or a review done before checking it,
  -- shouldn't be blocked from being recorded.
  reviewed_version TEXT,
  comparative_link_id UUID REFERENCES lpm_comparative_links(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, divergence_ref)
);

CREATE INDEX IF NOT EXISTS idx_lpm_divergence_reviews_project ON lpm_divergence_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_lpm_divergence_reviews_divergence ON lpm_divergence_reviews(divergence_ref);

ALTER TABLE lpm_divergence_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view divergence reviews" ON lpm_divergence_reviews;
CREATE POLICY "Project members can view divergence reviews" ON lpm_divergence_reviews
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Project editors can record divergence reviews" ON lpm_divergence_reviews;
CREATE POLICY "Project editors can record divergence reviews" ON lpm_divergence_reviews
  FOR INSERT WITH CHECK (is_project_editor(project_id));
DROP POLICY IF EXISTS "Project editors can update divergence reviews" ON lpm_divergence_reviews;
CREATE POLICY "Project editors can update divergence reviews" ON lpm_divergence_reviews
  FOR UPDATE USING (is_project_editor(project_id));

-- Readable by anyone who can already read theorybase_snapshot (ecosystem
-- reference content, no project secrecy concern) -- this view's whole
-- point is cross-project staleness/coverage checking, which a per-project
-- RLS gate would defeat.
CREATE OR REPLACE VIEW lpm_divergence_coverage AS
SELECT
  r.project_id,
  r.divergence_ref,
  t.label AS divergence_label,
  r.outcome,
  r.reviewed_version,
  (t.data -> 'provenance' ->> 'version') AS current_version,
  (r.reviewed_version IS DISTINCT FROM (t.data -> 'provenance' ->> 'version')) AS is_stale,
  r.created_at AS reviewed_at
FROM lpm_divergence_reviews r
LEFT JOIN theorybase_snapshot t ON t.id = r.divergence_ref AND t.record_type = 'divergence';

-- ============================================================================
-- 3. Richness / development-profile views -- depth-within-scope and
--    breadth-of-scope kept as separate fields throughout, never combined.
-- ============================================================================

CREATE OR REPLACE VIEW lpm_data_object_richness AS
SELECT
  o.id AS data_object_id,
  o.project_id,
  o.object_type,
  o.title,
  o.grade_band,
  length(coalesce(o.description, '')) AS description_length,
  jsonb_array_length(CASE WHEN jsonb_typeof(o.content -> 'performanceIndicators') = 'array' THEN o.content -> 'performanceIndicators' ELSE '[]'::jsonb END) AS performance_indicator_count,
  jsonb_array_length(CASE WHEN jsonb_typeof(o.content -> 'concepts') = 'array' THEN o.content -> 'concepts' ELSE '[]'::jsonb END) AS concept_link_count,
  (SELECT count(*) FROM curriculum_repository_links l WHERE l.data_object_id = o.id) AS curriculum_repository_link_count,
  (SELECT count(*) FROM lpm_comparative_links c WHERE c.from_data_object_id = o.id OR c.to_data_object_id = o.id) AS comparative_link_count,
  (SELECT count(*) FROM evidence_links e WHERE e.target_type = 'data_object' AND e.target_id = o.id) AS evidence_link_count
FROM lpm_data_objects o;

CREATE OR REPLACE VIEW lpm_project_comparison_profile AS
SELECT
  p.id AS project_id,
  p.slug,
  p.name,
  -- Breadth of scope -- what the model declares it covers.
  (SELECT count(*) FROM lpm_threads th WHERE th.project_id = p.id) AS strand_count,
  (SELECT count(*) FROM lpm_data_objects o WHERE o.project_id = p.id AND o.object_type = 'substrand') AS substrand_count,
  (SELECT count(DISTINCT o.grade_band) FROM lpm_data_objects o WHERE o.project_id = p.id AND o.grade_band IS NOT NULL) AS grade_bands_covered,
  (SELECT count(DISTINCT d) FROM lpm_data_objects o, jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(o.content -> 'associatedDomains') = 'array' THEN o.content -> 'associatedDomains' ELSE '[]'::jsonb END
    ) AS d WHERE o.project_id = p.id) AS subject_domain_count,
  -- Depth within that declared scope -- averaged per-object richness.
  (SELECT round(avg(r.description_length), 0) FROM lpm_data_object_richness r WHERE r.project_id = p.id) AS avg_description_length,
  (SELECT round(avg(r.performance_indicator_count), 1) FROM lpm_data_object_richness r WHERE r.project_id = p.id) AS avg_performance_indicators,
  (SELECT round(avg(r.curriculum_repository_link_count), 1) FROM lpm_data_object_richness r WHERE r.project_id = p.id) AS avg_real_world_links,
  -- Ecosystem grounding -- how connected this project is to the wider base
  -- repos, independent of its own content's depth or breadth.
  (SELECT count(*) FROM theories th WHERE th.project_id = p.id) AS theory_count,
  (SELECT count(*) FROM literature_references lr WHERE lr.project_id = p.id) AS literature_count,
  (SELECT count(*) FROM curriculum_repository_links l WHERE l.project_id = p.id) AS curriculum_repository_link_count,
  -- Comparative-analysis coverage against the sibling LPM(s).
  (SELECT count(*) FROM lpm_comparative_links c
     JOIN lpm_data_objects o ON o.id = c.from_data_object_id OR o.id = c.to_data_object_id
     WHERE o.project_id = p.id) AS comparative_link_count,
  (SELECT count(*) FROM lpm_divergence_reviews r WHERE r.project_id = p.id) AS divergences_reviewed,
  (SELECT count(*) FROM lpm_divergence_coverage c WHERE c.project_id = p.id AND c.is_stale) AS divergences_stale
FROM projects p;
