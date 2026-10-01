SET search_path = public, extensions;

-- Real feedback 2371cbf7 (2026-10-01): "Add subtle project-specific
-- (though not necessarily project unique) color boundaries (let users
-- select project color in the project dashboard)." TEXT, not a DB enum --
-- same convention as every other extensible-vocabulary column in this
-- schema (relation_type, action_type, student_view_template). The
-- frontend offers a small fixed palette (not a free color picker, per
-- Dustin's own framing "not necessarily unique"), but the column itself
-- doesn't enforce that set, so the palette can grow without a migration.
ALTER TABLE projects ADD COLUMN color TEXT;
COMMENT ON COLUMN projects.color IS 'Optional accent color key for this project''s card border (e.g. "teal", "rose") -- cosmetic only, not unique, picked from a small fixed palette in the frontend (src/lib/project-colors.ts).';
