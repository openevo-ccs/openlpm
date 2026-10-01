SET search_path = public, extensions;

-- Real feedback 2371cbf7 (2026-10-01): "Add subtle project-specific
-- (though not necessarily project unique) color boundaries (let users
-- select project color in the project dashboard)." TEXT, not a DB enum --
-- same convention as every other extensible-vocabulary column in this
-- schema (relation_type, action_type, student_view_template). The
-- frontend offers a small fixed palette (not a free color picker, per
-- Dustin's own framing "not necessarily unique"), but the column itself
-- doesn't enforce that set, so the palette can grow without a migration.
--
-- IF NOT EXISTS, not a plain ADD COLUMN: a real, uncommitted concurrent
-- session (2026-10-01, same day) independently built this exact same
-- feature and already pushed a `color TEXT` column to the live database
-- under a migration numbered 064 that was never committed to git (and
-- the "EvoMentor" project already has color='blue' set live, from their
-- own working UI) -- confirmed via REST before writing this version.
-- This migration exists so git history actually reflects what's live on
-- production; it must not error just because the column already got
-- there a different way.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT;
COMMENT ON COLUMN projects.color IS 'Optional accent color key for this project''s card border (e.g. "teal", "rose") -- cosmetic only, not unique, picked from a small fixed palette in the frontend (src/lib/project-colors.ts).';
