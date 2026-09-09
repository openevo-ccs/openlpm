-- Fixes project_epistemic_status (004_projects_branches_portfolios.sql) to
-- actually match ConceptBase's real, live oe:epistemicStatus enum
-- (RFC-0019), which this column was documented as "mirroring" but didn't:
-- the real schema (conceptbase/schemas/common.defs.yaml) has exactly two
-- values, 'designed-thought-experiment' and 'field-validated-curriculum' --
-- migration 004 instead shipped 'field-validated' (missing '-curriculum')
-- and 'in-process' (doesn't exist upstream at all; ConceptBase's own schema
-- comment anticipates a future value like 'field-piloted' via ordinary RFC,
-- but hasn't added one). Caught during a 2026-09-06 cross-repo reconciliation
-- session, not by any user-visible bug.
--
-- Resolution: fix the two real values to match ConceptBase exactly, and keep
-- a third, clearly-non-upstream value 'in-development' for real (non-
-- synthetic) project work that isn't yet claiming field-validated status --
-- an OpenLPM-local extension, documented as such (see
-- components/epistemic-status-badge.tsx), not a silent re-divergence.
--
-- Postgres has no ALTER TYPE ... DROP VALUE, so removing the two wrong
-- values (rather than just adding the right ones and leaving the wrong ones
-- reachable) requires the standard swap-the-whole-type pattern: build the
-- correct enum under a temp name, migrate the column's data across via a
-- CASE mapping, then drop the old type and rename the new one into place.

CREATE TYPE project_epistemic_status_new AS ENUM (
  'designed-thought-experiment',
  'field-validated-curriculum',
  'in-development'
);

ALTER TABLE projects ADD COLUMN epistemic_status_new project_epistemic_status_new;

UPDATE projects SET epistemic_status_new = (
  CASE epistemic_status::text
    WHEN 'designed-thought-experiment' THEN 'designed-thought-experiment'
    WHEN 'field-validated' THEN 'field-validated-curriculum'
    WHEN 'in-process' THEN 'in-development'
  END
)::project_epistemic_status_new;

ALTER TABLE projects ALTER COLUMN epistemic_status_new SET NOT NULL;

ALTER TABLE projects DROP COLUMN epistemic_status;
ALTER TABLE projects RENAME COLUMN epistemic_status_new TO epistemic_status;

DROP TYPE project_epistemic_status;
ALTER TYPE project_epistemic_status_new RENAME TO project_epistemic_status;
