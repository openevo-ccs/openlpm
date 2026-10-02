SET search_path = public, extensions;

-- Real feedback 040fedc1 (Dustin Eirdosh, 2026-10-02), second half: "lets drop
-- the 'Curriculum Repository' half of the country level repos here, just the
-- Country name - it should appear in its mother tongue name / english (e.g
-- Deutschland / Germany)." The first half of this feedback (no generic
-- top-level 'Curriculum Repositories' hub) is already done -- that project
-- was deleted directly (scripts/delete_project.mjs), confirmed gone before
-- this migration was written.
--
-- Only the two country-level entries are renamed here. New York stays
-- "New York Curriculum Repository" -- it's a state-level sub-project, not a
-- country, and Dustin's feedback only asked about "country level" naming.
-- English is already United States' own language, so it gets no slash form
-- (Dustin's own example in the feedback).
UPDATE projects SET name = 'Deutschland / Germany'
  WHERE slug = 'germany-curriculum-repository';

UPDATE projects SET name = 'United States'
  WHERE slug = 'united-states-curriculum-repository';
