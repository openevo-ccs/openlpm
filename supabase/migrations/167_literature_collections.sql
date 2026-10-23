-- Builds the "shared Collections with branching" piece of the strategy
-- locked 2026-10-23 (lab_manager/docs/design-notes/
-- openlpm-literature-collections-and-analytics-strategy-2026-10-23.md,
-- decisions 1, 5, 6). A Collection groups LiteratureBase records under a
-- named theme (e.g. "Misconceptions in Evolution Education") so a project
-- can show "the evidence behind this" rather than one flat reference pile.
--
-- Real discovery while building this: the peer field-mapping session
-- (same repo, same day) already invented and is actively using an exact
-- `domains` tag vocabulary on real LiteratureBase records for this -- not
-- a plan, already true of 61 merged records (PR #8) and two more open PRs
-- (#9, #10, 142 more records). Checked directly against the real
-- literaturebase checkout rather than assumed from the design note:
--   Evolution Education (umbrella, every record), Conceptual Change,
--   Assessment Instruments, US Policy and Acceptance,
--   International and Comparative, Teaching Methods (the 5 subject areas)
--   and Misconceptions, Religion and Worldview, Teacher Education,
--   Computational Modeling, Field Synthesis (5 cross-cutting themes --
--   the design doc's planned 6th, "Law, policy, and public controversy",
--   turned out to have been folded into "US Policy and Acceptance" in the
--   real drafted records rather than kept separate).
--
-- This means a *canonical* (shared, unbranched) collection needs no
-- stored item list at all: its membership is just "every
-- literaturebase_snapshot row whose domains array contains this
-- collection's domain_tag" -- always current as more PRs merge and
-- scripts/sync_literaturebase_snapshot.mjs re-syncs, no parallel list to
-- keep in sync by hand. A *branch* (decision 5: "shared, but each project
-- can branch off it") does need its own stored item list, since the whole
-- point of branching is to diverge from the live tag-based set -- that's
-- literature_collection_items, used by branches only.

SET search_path = public, extensions;

-- ============================================================================
-- 1. Collections themselves
-- ============================================================================

CREATE TABLE IF NOT EXISTS literature_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('subject_area', 'cross_cutting')),
  -- Matches a literaturebase_snapshot.domains entry exactly, for a
  -- canonical collection. Copied onto a branch for display/provenance
  -- ("branched from a collection built around this tag") but no longer
  -- used for live matching there -- a branch's membership is whatever is
  -- in literature_collection_items instead.
  domain_tag TEXT NOT NULL,
  description TEXT,
  -- 'provisional': built from the field map's fast keyword scan, not yet
  -- checked paper-by-paper (decision 6 -- ship now, mark it, refine over
  -- time). 'verified': a person has actually checked this collection's
  -- real membership. TEXT, not a richer enum, matching this schema's own
  -- "extensible vocabulary = TEXT" convention (see literaturebase_id/tags
  -- in migration 111, relation_type/action_type elsewhere).
  maturity TEXT NOT NULL DEFAULT 'provisional' CHECK (maturity IN ('provisional', 'verified')),
  -- NULL = canonical, shared across every project. Set = this row IS a
  -- project's own branch (decision 5), owned by that project.
  owner_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  forked_from_collection_id UUID REFERENCES literature_collections(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_literature_collections_owner ON literature_collections(owner_project_id);
-- A canonical collection's domain_tag identifies it uniquely. A plain
-- table-level UNIQUE(domain_tag, owner_project_id) wouldn't actually
-- enforce this -- Postgres treats every NULL as distinct from every other
-- NULL, so it would happily accept two canonical (owner_project_id NULL)
-- rows with the same tag. A project can still hold several of its own
-- branches built from the same tag (e.g. two independent branches of
-- "Misconceptions"), so this only constrains canonical rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_literature_collections_canonical_tag_unique
  ON literature_collections (domain_tag) WHERE owner_project_id IS NULL;

ALTER TABLE literature_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Canonical collections are visible to any authenticated user" ON literature_collections
  FOR SELECT USING (owner_project_id IS NULL AND auth.role() = 'authenticated');
CREATE POLICY "A project's own branches are visible to its members" ON literature_collections
  FOR SELECT USING (owner_project_id IS NOT NULL AND is_project_member(owner_project_id));
-- Only branches can be created/edited/deleted by ordinary users -- the
-- canonical set is seeded below and grown deliberately (service_role or a
-- future curation flow), not user-authored, this round.
CREATE POLICY "Project members can create their own branch" ON literature_collections
  FOR INSERT WITH CHECK (owner_project_id IS NOT NULL AND is_project_member(owner_project_id));
CREATE POLICY "Project members can edit their own branch" ON literature_collections
  FOR UPDATE USING (owner_project_id IS NOT NULL AND is_project_member(owner_project_id))
  WITH CHECK (owner_project_id IS NOT NULL AND is_project_member(owner_project_id));
CREATE POLICY "Project members can delete their own branch" ON literature_collections
  FOR DELETE USING (owner_project_id IS NOT NULL AND is_project_member(owner_project_id));

CREATE TRIGGER update_literature_collections_updated_at BEFORE UPDATE ON literature_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Branch-only item list. Canonical collections never get rows here --
--    their membership is computed live from literaturebase_snapshot.domains.
-- ============================================================================

CREATE TABLE IF NOT EXISTS literature_collection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES literature_collections(id) ON DELETE CASCADE,
  literaturebase_id TEXT NOT NULL REFERENCES literaturebase_snapshot(id) ON DELETE CASCADE,
  note TEXT,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, literaturebase_id)
);

CREATE INDEX IF NOT EXISTS idx_literature_collection_items_collection ON literature_collection_items(collection_id);

ALTER TABLE literature_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items are visible wherever their collection is visible" ON literature_collection_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM literature_collections c WHERE c.id = collection_id
      AND (
        (c.owner_project_id IS NULL AND auth.role() = 'authenticated')
        OR (c.owner_project_id IS NOT NULL AND is_project_member(c.owner_project_id))
      )
    )
  );
CREATE POLICY "Project members can edit their own branch's items" ON literature_collection_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM literature_collections c WHERE c.id = collection_id AND c.owner_project_id IS NOT NULL AND is_project_member(c.owner_project_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM literature_collections c WHERE c.id = collection_id AND c.owner_project_id IS NOT NULL AND is_project_member(c.owner_project_id))
  );

-- ============================================================================
-- 3. A project's (or a specific strand/curriculum-repository-record's)
--    relationship to a collection -- live attachment to the shared
--    version, or to one of the project's own branches.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_literature_collection_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES literature_collections(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('live', 'branch')),
  -- At most one of these two is set -- a project-wide attachment (the
  -- Literature page's "Collections" panel) leaves both NULL; attaching to
  -- a specific strand (lpm_threads -- the real, user-facing "Strand" the
  -- Strands page shows, not the lower-level lpm_data_objects table a
  -- strand's stations are built from) or a specific Curriculum Repository
  -- record narrows it to exactly that context.
  lpm_thread_id UUID REFERENCES lpm_threads(id) ON DELETE CASCADE,
  curriculum_repository_record_id UUID REFERENCES curriculum_repository_records(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_lit_collection_links_project ON project_literature_collection_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_lit_collection_links_thread ON project_literature_collection_links(lpm_thread_id);
CREATE INDEX IF NOT EXISTS idx_project_lit_collection_links_record ON project_literature_collection_links(curriculum_repository_record_id);
-- Prevents the same collection being attached twice at the same scope
-- (project-wide, or the same strand, or the same repository record).
-- COALESCE to a fixed nil UUID so two project-wide attachments (both
-- NULL/NULL) still collide -- a plain UNIQUE() table constraint can't
-- express that since Postgres treats NULL <> NULL even there.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lit_collection_links_unique ON project_literature_collection_links (
  project_id, collection_id,
  COALESCE(lpm_thread_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(curriculum_repository_record_id, '00000000-0000-0000-0000-000000000000')
);

ALTER TABLE project_literature_collection_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view their collection links" ON project_literature_collection_links
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Project members can attach collections" ON project_literature_collection_links
  FOR INSERT WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can remove their collection links" ON project_literature_collection_links
  FOR DELETE USING (is_project_member(project_id));

-- ============================================================================
-- 4. Seed the real canonical set -- evolution-education literature first
--    (decision 1), straight from the peer session's field map, flagged
--    provisional (decision 6). Names/descriptions condensed from
--    lab_manager/docs/design-notes/
--    evolution-education-literaturebase-field-map-and-collections-2026-10-23.md;
--    domain_tag values are the real, already-in-use vocabulary checked
--    directly against the literaturebase repo (see header note above),
--    not re-derived from the design doc's own earlier, slightly different
--    working list.
-- ============================================================================

INSERT INTO literature_collections (slug, name, kind, domain_tag, description, maturity) VALUES
  ('conceptual-change', 'How Students Think About Evolution', 'subject_area', 'Conceptual Change',
   'The cognitive/conceptual-change research core: misconceptions, teleological reasoning, essentialism, tree-thinking, genetic drift, deep time.', 'provisional'),
  ('assessment-instruments-subject', 'Measuring Understanding and Belief', 'subject_area', 'Assessment Instruments',
   'The instrument-building tradition: CINS, MATE, I-SEA, GAENE, ACORNS, KAEVO, and the validity debates between them.', 'provisional'),
  ('us-policy-and-acceptance', 'Evolution Education in the US', 'subject_area', 'US Policy and Acceptance',
   'Legal history, National Academies/NSTA/NABT statements, state standards and NGSS, textbooks, teacher and public acceptance research.', 'provisional'),
  ('international-and-comparative', 'Evolution Education Around the World', 'subject_area', 'International and Comparative',
   'Europe and every other non-US research tradition, including genuinely cross-national comparative work.', 'provisional'),
  ('teaching-methods', 'Teaching Methods and the Field''s Own History', 'subject_area', 'Teaching Methods',
   'Instructional-strategy research, computational/simulation-based teaching, and the field''s self-reflective review/synthesis literature.', 'provisional'),
  ('misconceptions', 'Misconceptions in Evolution Education', 'cross_cutting', 'Misconceptions',
   'Everywhere a specific misunderstanding gets named, measured, or targeted: teleological reasoning, essentialism, genetic drift confusion, tree-thinking errors, Lamarckian/use-inheritance reasoning, deep time.', 'provisional'),
  ('religion-and-worldview', 'Religion and Worldview', 'cross_cutting', 'Religion and Worldview',
   'Where evolution teaching meets a student''s or teacher''s religious belief directly: creationism, Muslim-majority contexts, Jewish and Christian contexts, the "reconciliation" teaching approach.', 'provisional'),
  ('teacher-education', 'Teacher Education and Belief', 'cross_cutting', 'Teacher Education',
   'Preservice and in-service teachers specifically as the subject of the study, rather than just the instructor delivering an intervention.', 'provisional'),
  ('computational-modeling', 'Computational and Simulation-Based Teaching', 'cross_cutting', 'Computational Modeling',
   'Avida-ED, NetLogo, and smaller simulation tools -- the sub-thread closest to this lab''s own modeling work.', 'provisional'),
  ('field-synthesis', 'Field-Level Synthesis', 'cross_cutting', 'Field Synthesis',
   'The field looking at itself: reviews, meta-analyses, special-issue framing pieces, the 2024 instrument-builders'' meeting report.', 'provisional')
ON CONFLICT (slug) DO NOTHING;

-- Data API grants extend automatically via migration 006's ALTER DEFAULT PRIVILEGES.
