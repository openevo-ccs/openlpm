SET search_path = public, extensions;

-- Real gap found live 2026-09-30: "Preview as student" was showing on
-- EVERY project any owner/maintainer manages, and rendering the SAME
-- German, EvoMentor-Thuringia-specific UI regardless of which project --
-- because the student view was gated purely on the VIEWER's own role
-- (self-joined vs. owner), never on whether THIS project actually has a
-- student template configured at all. Those are two different questions:
-- "is this person a student" is about the viewer; "which UI, in which
-- language, should render for them" is a property of the project space
-- itself, and needs to be something an owner explicitly turns on and
-- picks, not something that appears everywhere by default the moment one
-- project (evomentor-thuringia) happens to use the feature.
--
-- Open vocabulary (like relation_type, action_type elsewhere in this
-- schema) rather than an enum -- a real second template (a different
-- language, a different subject) is a new registry entry in
-- lib/student-view-templates.ts, not a schema migration.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS student_view_template TEXT;

-- Turns the real Jena pilot template on for the one project it was
-- actually built for -- every other project space now correctly shows no
-- "Preview as student" option until its own owner picks a template.
UPDATE projects SET student_view_template = 'jena-biologiedidaktik-de' WHERE slug = 'evomentor-thuringia';
