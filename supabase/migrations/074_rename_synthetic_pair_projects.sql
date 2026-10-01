SET search_path = public, extensions;

-- Real feedback a4be05a6 (2026-10-01): "bio-core-k12 and
-- 'oe-interdisciplinary-k12' ... must also note must be renamed
-- bio-core-lpm-synth and interdisciplinary-lpm-synth; to be fully clear
-- that these spaces are for experimental AI synthetic design and never to
-- be confused with LPMs under active human curation."
--
-- Both are real top-level project spaces (epistemic_status
-- 'designed-thought-experiment', the synthetic-theoretical comparison pair
-- described in migration 016's own comment) with no sub-projects and no
-- real content that links to them by slug outside this app's own dynamic
-- :project route -- confirmed by grepping the app's source and every other
-- migration for the old slugs before writing this; the only other matches
-- are migration 005's original seed and migration 016/056's own prose
-- comments, both historical and untouched. The sibling GitHub repos
-- `bio-core-k12`/`oe-interdisciplinary-k12` are a separate thing entirely
-- (curriculum-strand source repos, not this app's database) and are not
-- touched by this migration -- nothing in the feedback asks for that.
--
-- Slugs set to Dustin's own exact given values. Display names drop "K-12"
-- the same way the new slugs do, and add "(Synthetic)" -- plain, matches
-- the existing "Synthetic-Theoretical" badge/filter language already used
-- everywhere else in this app, not a new invented term.
UPDATE projects
SET slug = 'bio-core-lpm-synth', name = 'Bio-Core LPM (Synthetic)'
WHERE slug = 'bio-core-k12';

UPDATE projects
SET slug = 'interdisciplinary-lpm-synth', name = 'Interdisciplinary LPM (Synthetic)'
WHERE slug = 'oe-interdisciplinary-k12';
