-- Folds "branch" (a draft/experiment mechanism) into the Project/Project
-- Space model. Before this migration, OpenLPM had three overlapping ways to
-- say "a smaller thing inside a bigger thing": Project, a same-day-old
-- "sub-project" pattern (parent_project_id, migration 015), and Branch (an
-- older draft/fork mechanism, migration 004). Checked the live data before
-- deciding anything (see verification queries run alongside this file):
--
--   - Every one of the 5 real projects has exactly one branch: its own
--     trunk. Trunks hold 100% of real content (302 Lernziele + 39 schema
--     elements for EvoMentor Thuringia; everything else's content lives
--     directly on project_id with no other branch involved).
--   - Exactly one non-trunk branch has ever existed in production
--     (`evomentor-de`, the old Thuringia branch) -- and it already has ZERO
--     content, because migration 015 (earlier today) already moved
--     everything real out of it into the real `evomentor-thuringia` project.
--     It is a pure historical pointer (status='promoted',
--     promoted_to_project_id set), not live data.
--   - Branches never actually forked content (no copy-on-write) -- a
--     "branch" was only ever a foreign-key tag on the same project's rows,
--     not an isolated sandbox. It provided no real capability that a nested
--     Project (already built in migration 015) doesn't provide better: a
--     nested Project gets a real identity, its own membership, and no
--     forced vocabulary coupling to its parent (RFC-0010 precedent), all
--     from the moment it's created -- no separate "promote" step, and
--     critically no risky content-move step (migration 015's own promote
--     button had exactly one bug: it initially forgot to move content).
--
-- Conclusion: no genuinely different use case for "branch" survives once
-- sub-projects exist. Both "an early-stage draft someone's trying out" and
-- "a fully proven regional curriculum" become the same kind of thing -- a
-- Project nested in a Project Space -- differing only in maturity, which is
-- just a status, not a different mechanism. This migration adds that status
-- field. It deliberately does NOT drop the branches table, its columns, or
-- any branch_id column on content tables -- per Dustin's own process rule,
-- those stay intact as a real way back until the new shape is confirmed
-- working. The one leftover non-trunk branch record is left exactly as is
-- (it is real provenance history, not live data, and holds nothing).
--
-- The application-level retirement of "branch" as a user-facing concept
-- (routes, copy, the branches-page.tsx admin UI) is a separate, later pass,
-- deliberately not bundled into this migration.

CREATE TYPE project_maturity AS ENUM ('draft', 'established');

ALTER TABLE projects ADD COLUMN IF NOT EXISTS maturity project_maturity NOT NULL DEFAULT 'draft';

-- Backfill: every project that exists today is a real, legitimate, already
-- in-use project space or project -- none of the 6 live rows are actually
-- someone's early-stage draft (that includes the two intentionally-synthetic
-- ones, bio-core-k12 and oe-interdisciplinary-k12: being a thought
-- experiment is an epistemic-status question, answered by the existing
-- `epistemic_status` column, not a maturity one). The DEFAULT above only
-- governs projects created after this migration (e.g. a brand-new draft
-- created directly as a nested Project going forward).
UPDATE projects SET maturity = 'established';
