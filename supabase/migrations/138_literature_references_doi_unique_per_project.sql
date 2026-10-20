-- Phase 0 repair (Dustin, 2026-10-20), item 4: literature_references.doi
-- is UNIQUE globally (migration 001's inline `doi TEXT UNIQUE`), which
-- blocks the same real paper being saved into two different OpenLPM
-- projects' own literature collections. literature_references.project_id
-- (added by migration 004) means a paper only needs to be unique *within*
-- a project. It no longer needs to be unique across the whole platform.
--
-- project_id is nullable (migration 004 added it with ADD COLUMN, no NOT
-- NULL, so any pre-project-scoping row stays NULL). Postgres treats NULL
-- as distinct from every other value in a UNIQUE constraint, so multiple
-- NULL-project rows (or NULL-doi rows, already common for sources without
-- a DOI) can still coexist -- exactly the same as today, for both cases.
--
-- literature_references_doi_key is Postgres' own auto-generated name for
-- migration 001's inline column-level UNIQUE (the standard
-- <table>_<column>_key pattern); confirmed no later migration ever
-- renamed or otherwise touched it.

SET search_path = public, extensions;

ALTER TABLE literature_references DROP CONSTRAINT IF EXISTS literature_references_doi_key;
ALTER TABLE literature_references ADD CONSTRAINT literature_references_project_doi_key UNIQUE (project_id, doi);

COMMENT ON CONSTRAINT literature_references_project_doi_key ON literature_references IS
  'Replaces the old platform-wide UNIQUE(doi) from migration 001 -- the same paper can now be saved into more than one project''s own literature collection.';
