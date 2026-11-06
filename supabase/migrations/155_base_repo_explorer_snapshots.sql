-- Base Repo Explorer, step 1: snapshot tables for the four Foundational
-- Repos that have never been connected to OpenLPM in any form --
-- QuestionBase, QuoteBase, CompetencyBase, ProjectBase. ConceptBase,
-- TheoryBase, LiteratureBase, and MethodsBase already have this exact
-- pattern (migrations 096, 111, 121); this migration is a direct
-- structural mirror of methodsbase_snapshot (121), adapted to each
-- repo's own real fields. Synced by scripts/link_base_repo_content.mjs.
--
-- Scope note: Base Repos only (ConceptBase/TheoryBase/LiteratureBase/
-- QuestionBase/MethodsBase/CompetencyBase/QuoteBase/SpeciesBase/
-- ProjectBase/TeachingBase). The ccs-graph/openevo-graph/eva-graph
-- dispute-and-relations layer is a deliberately separate layer and is
-- explicitly out of scope for the Base Repo Explorer (Dustin, 2026-10-21).

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS questionbase_snapshot (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  question_type TEXT,
  status TEXT,
  priority TEXT,
  review_status TEXT,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotebase_snapshot (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  -- The quote's own wording -- "label" above is the attribution (who said
  -- it), since quote records have no title field of their own.
  text TEXT,
  attribution TEXT,
  review_status TEXT,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competencybase_snapshot (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  source_vocabulary TEXT,
  domain TEXT,
  record_status TEXT,
  review_status TEXT,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projectbase_snapshot (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questionbase_snapshot_type ON questionbase_snapshot(question_type);
CREATE INDEX IF NOT EXISTS idx_questionbase_snapshot_search ON questionbase_snapshot USING gin (to_tsvector('english', label));
CREATE INDEX IF NOT EXISTS idx_quotebase_snapshot_search ON quotebase_snapshot USING gin (to_tsvector('english', label || ' ' || coalesce(text, '')));
CREATE INDEX IF NOT EXISTS idx_competencybase_snapshot_vocab ON competencybase_snapshot(source_vocabulary);
CREATE INDEX IF NOT EXISTS idx_competencybase_snapshot_search ON competencybase_snapshot USING gin (to_tsvector('english', label));
CREATE INDEX IF NOT EXISTS idx_projectbase_snapshot_search ON projectbase_snapshot USING gin (to_tsvector('english', label));

ALTER TABLE questionbase_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotebase_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencybase_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectbase_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse the QuestionBase snapshot" ON questionbase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Any authenticated user can browse the QuoteBase snapshot" ON quotebase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Any authenticated user can browse the CompetencyBase snapshot" ON competencybase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Any authenticated user can browse the ProjectBase snapshot" ON projectbase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy on purpose: only service_role (the sync
-- script) writes these tables, same "cache table, not user content" shape
-- as theorybase_snapshot/literaturebase_snapshot/methodsbase_snapshot.
