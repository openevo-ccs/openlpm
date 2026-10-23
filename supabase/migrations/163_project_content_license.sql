-- content_license: lets a project owner set the license for their project's
-- own original work (strands, Lernziele, data objects), distinct from the
-- per-record rights tracking third-party source documents already have
-- (curriculum_repository_records.access_tier / license_or_rights_note,
-- migration 066; standards_documents.license_or_rights_note, migration 019).
-- That existing mechanism is untouched -- this column is about a project's
-- OWN authored content, never about material it quotes from elsewhere.
--
-- Proposed in RFC-0007 (proposals/0007-data-rights-and-licensing-framework.md,
-- merged PR #87) and decided with Dustin via AskUserQuestion, 2026-10-23:
-- a new project inherits the default silently (NULL = "ecosystem default,
-- CC BY-NC-SA 4.0"), same safe-default shape is_private already uses
-- (migration 025) -- no extra step at project creation, the choice lives in
-- Settings whenever an owner wants it.
--
-- No new RLS policy: migration 004's "Owners and maintainers can update
-- their project" is a row-level UPDATE policy rather than a column-level
-- one, so it already covers this column like every other one on `projects`.
SET search_path = public, extensions;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_license TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_content_license_check;
ALTER TABLE projects ADD CONSTRAINT projects_content_license_check
  CHECK (content_license IS NULL OR content_license IN ('cc-by-4.0', 'cc0-1.0', 'all-rights-reserved', 'custom'));

-- Only meaningful when content_license = 'custom' (the UI enforces that;
-- not worth a CHECK for a single free-text field nothing else depends on).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_license_note TEXT;
