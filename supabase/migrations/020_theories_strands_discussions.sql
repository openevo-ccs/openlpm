-- Schema for three of the new content spaces in the 2026-09-13 sidebar
-- restructure: Theories (genuinely new), Strands (extends the existing
-- lpm_threads/lpm_thread_stations narrative-station mechanism with real
-- multi-parent nesting), and Discussions (adds tagging to tables that have
-- existed unused since migration 001). Also extends peer_review_assignments'
-- open target-type vocabulary, which migration 012 already designed to be
-- extended this way, to cover every new content type.

-- ============================================================================
-- Theories: find/curate a theoretical position, link it to the literature
-- that clarifies or supports it, and to the concepts/learning-goals/strands
-- it's meant to inform.
-- ============================================================================

CREATE TABLE IF NOT EXISTS theories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Property of the theoretical CLAIM itself (per the LP-research four-stage
  -- validation cycle: Theory Development -> Empirical Recovery -> Comparison
  -- to Competing Models -> Instructional Efficacy), not of any one project
  -- that cites it -- e.g. DCR sits at 'tested-against-alternatives', ICR at
  -- 'theoretically-developed'. Kept OpenLPM-local for now (extensions-first,
  -- same discipline RFC-0002 used for Basiskonzepte) rather than pushed into
  -- TheoryBase's own canonical schema -- a future TheoryBase-promotion
  -- candidate once used across a couple of real cases, not before.
  evidentiary_maturity TEXT CHECK (evidentiary_maturity IN (
    'theoretically-developed', 'empirically-recovered',
    'tested-against-alternatives', 'efficacy-demonstrated'
  )),
  evidentiary_maturity_note TEXT,
  -- Mirrors project_base_links: set when this record was imported from a
  -- base repo's public registry (TheoryBase) rather than authored locally,
  -- exactly the way Schema's existing ConceptBase import already works.
  base_repo base_repo_enum,
  base_repo_ref TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theory_literature_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES literature_references(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('theoretical-clarification', 'empirical-support', 'empirical-challenge')),
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (theory_id, reference_id, relation_type)
);

CREATE TABLE IF NOT EXISTS theory_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  -- Polymorphic target, same pattern as evidence_links/portfolio_items: a
  -- labeled link to a concept (framework_tags), a learning goal
  -- (lpm_data_objects), or a strand (lpm_threads).
  target_type TEXT NOT NULL CHECK (target_type IN ('framework_tag', 'data_object', 'thread')),
  target_id UUID NOT NULL,
  relation_label TEXT NOT NULL,
  annotation TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theories_project ON theories(project_id);
CREATE INDEX IF NOT EXISTS idx_theory_literature_links_theory ON theory_literature_links(theory_id);
CREATE INDEX IF NOT EXISTS idx_theory_literature_links_reference ON theory_literature_links(reference_id);
CREATE INDEX IF NOT EXISTS idx_theory_relations_theory ON theory_relations(theory_id);
CREATE INDEX IF NOT EXISTS idx_theory_relations_target ON theory_relations(target_type, target_id);

ALTER TABLE theories ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_literature_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_relations ENABLE ROW LEVEL SECURITY;

-- Same collaborative-curation shape as lpm_connections/lpm_threads (migration
-- 010): any project member can propose; nothing here gates visibility the
-- way a peer_review_assignments row would for a specific proposal.
CREATE POLICY "Project members can view theories" ON theories
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can manage theories" ON theories
  FOR ALL USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can view theory literature links" ON theory_literature_links
  FOR SELECT USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));
CREATE POLICY "Project members can manage theory literature links" ON theory_literature_links
  FOR ALL USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));

CREATE POLICY "Project members can view theory relations" ON theory_relations
  FOR SELECT USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));
CREATE POLICY "Project members can manage theory relations" ON theory_relations
  FOR ALL USING (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM theories t WHERE t.id = theory_id AND is_project_member(t.project_id)));

CREATE TRIGGER update_theories_updated_at BEFORE UPDATE ON theories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Strands: a sub-strand nestable under more than one higher-level strand,
-- which a single parent_id column can't express -- a join table instead.
-- Built on top of lpm_threads/lpm_thread_stations (migration 010), which
-- already are a strand's real content (a named, curated, multi-station
-- narrative) -- not thrown away and rebuilt, just given real multi-parent
-- nesting. The application-level rename (UI calls these "Strands," not
-- "threads") is a later, code-only pass, not this migration's job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS strand_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strand_id UUID NOT NULL REFERENCES lpm_threads(id) ON DELETE CASCADE,
  parent_strand_id UUID NOT NULL REFERENCES lpm_threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (strand_id <> parent_strand_id),
  UNIQUE (strand_id, parent_strand_id)
);

CREATE INDEX IF NOT EXISTS idx_strand_parents_strand ON strand_parents(strand_id);
CREATE INDEX IF NOT EXISTS idx_strand_parents_parent ON strand_parents(parent_strand_id);

ALTER TABLE strand_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view strand nesting" ON strand_parents
  FOR SELECT USING (EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = strand_id AND is_project_member(t.project_id)));
CREATE POLICY "Project members can manage strand nesting" ON strand_parents
  FOR ALL USING (EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = strand_id AND is_project_member(t.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM lpm_threads t WHERE t.id = strand_id AND is_project_member(t.project_id)));

-- ============================================================================
-- Discussions: tagging for discussion_topics (table has existed, unused,
-- since migration 001 -- RFC 0002 Phase 2 UI never got built until now).
-- ============================================================================

CREATE TABLE IF NOT EXISTS discussion_topic_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES discussion_topics(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (topic_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_discussion_topic_tags_topic ON discussion_topic_tags(topic_id);
CREATE INDEX IF NOT EXISTS idx_discussion_topic_tags_tag ON discussion_topic_tags(tag);

ALTER TABLE discussion_topic_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view discussion tags" ON discussion_topic_tags
  FOR SELECT USING (EXISTS (SELECT 1 FROM discussion_topics d WHERE d.id = topic_id AND is_project_member(d.project_id)));
CREATE POLICY "Project members can manage discussion tags" ON discussion_topic_tags
  FOR ALL USING (EXISTS (SELECT 1 FROM discussion_topics d WHERE d.id = topic_id AND is_project_member(d.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM discussion_topics d WHERE d.id = topic_id AND is_project_member(d.project_id)));

-- ============================================================================
-- Review: extend the existing open target-type vocabulary (plain TEXT +
-- CHECK, not an enum, specifically so this never needs a type migration --
-- see migration 012's own comment) so learning goals, theories, concepts,
-- strands, and notebook items can all be proposed for peer review, not only
-- curriculum connections.
-- ============================================================================

ALTER TABLE peer_review_assignments DROP CONSTRAINT IF EXISTS peer_review_assignments_reviewable_type_check;
ALTER TABLE peer_review_assignments ADD CONSTRAINT peer_review_assignments_reviewable_type_check
  CHECK (reviewable_type IN (
    'literature_reference', 'lpm_data_object', 'lpm_connection', 'lpm_thread',
    'framework_tag', 'theory', 'portfolio_item'
  ));

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
