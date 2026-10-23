-- Renumbered 163 -> 165, 2026-10-23. Three sessions working the same day
-- independently claimed migration number 163 for three different features
-- (this one, 163_alien_space_of_science_comparative_literature_link.sql,
-- 163_literature_collections.sql) -- no atomic-reservation script exists for
-- migration numbers the way reserve_proposal_number.py covers RFC numbers,
-- so nothing caught it before all three merged to main. The live database's
-- migration-history table already has "163" recorded as applied (from
-- whichever of the three got pushed first, directly from its own branch) --
-- re-running this file under 163 would be silently skipped rather than
-- actually applied, so content_license never existed live despite PR #88
-- merging.
-- This file's actual content is unchanged from PR #88; only the number and
-- this note are new.
--
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
