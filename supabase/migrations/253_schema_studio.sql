SET search_path = public, extensions;

-- Schema Studio (Admin > Base repos > Schema Studio, 2026-11-21): a map of every base repository's schemas, with a shared
-- board for suggested changes.
--
-- 1. schema_studio_snapshot: the map itself. The schemas live in the base repositories, most of them private, so the map cannot be
--    a public file on the app's own web address. It is kept here instead, readable by admins only, and rewritten by
--    scripts/sync_schema_studio_snapshot.mjs whenever a schema changes (the scheduled GitHub Action
--    .github/workflows/schema-studio-sync.yml runs it every hour and on request from a base repository). A new row is added only
--    when the content hash differs from the latest row, so the table doubles as a short history of the structure.
-- 2. schema_suggestions: a suggested change to a repository, a record type or a single field. Like base_repo_record_edits (237),
--    suggestions are collected in the app and sent back to the repositories in batches through a normal pull request.
-- 3. schema_suggestion_comments and schema_suggestion_agrees: discussion and "I agree" marks on a suggestion.
--
-- Everything is admin-only, the same boundary as the Base Repo Explorer.

CREATE TABLE IF NOT EXISTS schema_studio_snapshot (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL,
  -- Short summary shown without parsing the whole document (repo count, type count, field count, commit ids).
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_studio_snapshot_generated ON schema_studio_snapshot(generated_at DESC);

ALTER TABLE schema_studio_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read the schema snapshot" ON schema_studio_snapshot
  FOR SELECT USING (is_admin());
-- No INSERT or UPDATE policy: only the service role (the sync script) writes here.

CREATE TABLE IF NOT EXISTS schema_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Where the suggestion points. repo is a snapshot key ('theory', 'literature', ...) or 'core' or 'system' (across repositories).
  target_repo TEXT NOT NULL,
  -- Record type name ('theory-record') or null when the suggestion is about the whole repository.
  target_type TEXT,
  -- Field name, or a dotted path for a nested field ('citation.authors'), or null.
  target_field TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('rename', 'add-field', 'remove-field', 'change-type', 'change-values', 'clarify', 'new-link', 'new-record-type', 'merge', 'split', 'other')),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 3 AND 200),
  -- What it says now, what it should say, and why. All plain text.
  current_value TEXT CHECK (char_length(current_value) <= 2000),
  proposed_value TEXT CHECK (char_length(proposed_value) <= 4000),
  rationale TEXT CHECK (char_length(rationale) <= 4000),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'discussing', 'accepted', 'declined', 'applied')),
  -- The snapshot the author was looking at, so a later reader can tell whether the structure has moved since.
  snapshot_hash TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT CHECK (char_length(decision_note) <= 2000),
  -- Set when the change has been taken into the repositories through a pull request.
  exported_at TIMESTAMPTZ,
  export_batch TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_suggestions_target ON schema_suggestions(target_repo, target_type, target_field);
CREATE INDEX IF NOT EXISTS idx_schema_suggestions_status ON schema_suggestions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS schema_suggestion_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggestion_id UUID NOT NULL REFERENCES schema_suggestions(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_suggestion_comments_suggestion ON schema_suggestion_comments(suggestion_id, created_at);

CREATE TABLE IF NOT EXISTS schema_suggestion_agrees (
  suggestion_id UUID NOT NULL REFERENCES schema_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

ALTER TABLE schema_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_suggestion_agrees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read schema suggestions" ON schema_suggestions FOR SELECT USING (is_admin());
CREATE POLICY "Admins can add schema suggestions as themselves" ON schema_suggestions FOR INSERT WITH CHECK (is_admin() AND created_by = auth.uid());
CREATE POLICY "Admins can update schema suggestions" ON schema_suggestions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can read schema suggestion comments" ON schema_suggestion_comments FOR SELECT USING (is_admin());
CREATE POLICY "Admins can comment as themselves" ON schema_suggestion_comments FOR INSERT WITH CHECK (is_admin() AND created_by = auth.uid());

CREATE POLICY "Admins can read agrees" ON schema_suggestion_agrees FOR SELECT USING (is_admin());
CREATE POLICY "Admins can agree as themselves" ON schema_suggestion_agrees FOR INSERT WITH CHECK (is_admin() AND user_id = auth.uid());
CREATE POLICY "Admins can withdraw their own agree" ON schema_suggestion_agrees FOR DELETE USING (is_admin() AND user_id = auth.uid());

-- A suggestion's wording is a record of what was proposed. After it is written, only its workflow columns can change.
REVOKE UPDATE, DELETE ON schema_suggestions FROM authenticated, anon;
GRANT UPDATE (status, priority, decided_by, decision_note, exported_at, export_batch, updated_at) ON schema_suggestions TO authenticated;
REVOKE UPDATE, DELETE ON schema_suggestion_comments FROM authenticated, anon;
