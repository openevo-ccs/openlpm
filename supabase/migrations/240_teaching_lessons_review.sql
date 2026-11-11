SET search_path = public, extensions;

-- Teaching lessons review: experts check, inside OpenLPM, the links that a machine drafted between
-- TeachingBase lessons and the other base repos (concepts, competencies, theories, methods, species,
-- literature, questions, quotes, features). Nobody has reviewed any of them yet.
--
-- Two tables:
--   teachingbase_snapshot       a copy of the lessons and their drafted links, refreshed by
--                               scripts/sync_teachingbase_snapshot.mjs (same cache pattern as migration 155).
--   teachingbase_link_verdicts  one row per judgement an expert makes. Rows are never changed or deleted.
--
-- Design note: lab_manager/docs/design-notes/openlpm-teaching-lessons-review-2026-11-11.md

-- ---------------------------------------------------------------------------------------------
-- The copy of the lessons. One row per lesson record; id is the lesson's slug.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachingbase_snapshot (
  id TEXT PRIMARY KEY,
  -- The lesson's English title.
  label TEXT NOT NULL,
  -- Collections the lesson belongs to, e.g. 'human-evolution-lesson-collection'.
  collections TEXT[] NOT NULL DEFAULT '{}',
  -- true when a drafted link file exists for this lesson.
  graph_present BOOLEAN NOT NULL DEFAULT false,
  link_count INTEGER NOT NULL DEFAULT 0,
  -- Number of links in the "start here" sample (about 150 across all lessons).
  sample_count INTEGER NOT NULL DEFAULT 0,
  -- The lesson fields plus components, assets, links and rights flags. Every link and component carries
  -- an item_key (first 12 hex characters of a sha1 over its content) that the verdicts refer to.
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teachingbase_snapshot_collections ON teachingbase_snapshot USING gin (collections);
CREATE INDEX IF NOT EXISTS idx_teachingbase_snapshot_search ON teachingbase_snapshot USING gin (to_tsvector('english', label));

ALTER TABLE teachingbase_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse the TeachingBase snapshot" ON teachingbase_snapshot
  FOR SELECT USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy on purpose: only service_role (the sync script) writes this table.

-- ---------------------------------------------------------------------------------------------
-- The judgements. Append-only, like base_repo_record_edits (237): changing a verdict adds a new row,
-- and the newest row per (lesson_id, item_kind, item_key) is the one that counts.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachingbase_link_verdicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id TEXT NOT NULL,
  -- 'link' or 'component' (TEXT so a new kind needs no migration).
  item_kind TEXT NOT NULL,
  -- The item_key stored in teachingbase_snapshot.data for that link or component.
  item_key TEXT NOT NULL,
  -- What the reviewer was looking at: type, to, label, evidence. Kept so a verdict stays readable
  -- after the lesson data is refreshed or the item changes.
  item_summary JSONB NOT NULL,
  -- 'correct', 'wrong' or 'unsure' (TEXT so a new value needs no migration).
  verdict TEXT NOT NULL,
  note TEXT,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- The name at the time of the verdict, so it still shows if the account is removed.
  reviewer_name TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teachingbase_link_verdicts_lesson ON teachingbase_link_verdicts(lesson_id, item_kind, item_key, reviewed_at);

ALTER TABLE teachingbase_link_verdicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read TeachingBase verdicts" ON teachingbase_link_verdicts
  FOR SELECT USING (auth.role() = 'authenticated');

-- For now only admins record verdicts. This will widen to the named reviewers once Dustin decides who
-- reviews besides the admins (open question in the design note). The check that the row is written
-- as the signed-in person stays.
CREATE POLICY "Admins can add TeachingBase verdicts as themselves" ON teachingbase_link_verdicts
  FOR INSERT WITH CHECK (is_admin() AND reviewer_id = auth.uid());

-- No UPDATE or DELETE policy, and the grants are removed as well.
REVOKE UPDATE, DELETE ON teachingbase_link_verdicts FROM authenticated, anon;
