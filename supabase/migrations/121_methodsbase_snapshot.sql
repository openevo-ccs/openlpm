-- Responds to Dustin's ask (2026-10-10): EvoMentor Thuringia's didactic
-- methods are "not linked well to the Lernziele" -- advance the whole
-- ecosystem from real MethodsBase entries through to a researcher-facing
-- methods panel that can synthesize good method<->Lernziel links. Scoped
-- in lab_manager/docs/design-notes/
-- methodsbase-evomentor-researcher-view-and-lernziel-linking-system-2026-10-10.md.
--
-- This migration is step 1: a real, citable description for every method,
-- cached locally. Exact structural mirror of literaturebase_snapshot
-- (migration 111) and theorybase_snapshot (migration 096) -- same "public
-- base repo, no single combined index to fetch live from a browser, so a
-- periodically-refreshed cache synced by a local script with filesystem
-- access to a sibling checkout" shape, via scripts/sync_methodsbase_snapshot.mjs.
--
-- Companion migrations 122 (method_vocabulary_links: map OpenLPM's plain
-- German method labels onto a real methodsbase_snapshot id) and 123
-- (method_lernziel_links: the actual method<->Lernziel relation, with a
-- review gate for AI-suggested links) build on this one.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS methodsbase_snapshot (
  -- The real OE-METHOD-<slug> id, used as-is -- never regenerated.
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  method_class TEXT,
  description TEXT,
  when_to_use TEXT,
  discipline TEXT,
  status TEXT,
  review_status TEXT,
  -- Full real record (protocolSteps, primarySources, theoreticalGrounding,
  -- implementedBy, etc.) as extracted from the repo's own YAML, for detail
  -- display and for feeding a synthesis prompt without a second
  -- round-trip -- same "cache the whole thing" shape as theorybase_snapshot
  -- .data / literaturebase_snapshot.data.
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_methodsbase_snapshot_class ON methodsbase_snapshot(method_class);
CREATE INDEX IF NOT EXISTS idx_methodsbase_snapshot_search ON methodsbase_snapshot USING gin (to_tsvector('english', label || ' ' || coalesce(description, '')));

ALTER TABLE methodsbase_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse the MethodsBase snapshot" ON methodsbase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy on purpose: only service_role (the sync
-- script) writes this table, the same "cache table, not user content"
-- shape as theorybase_snapshot/literaturebase_snapshot.
