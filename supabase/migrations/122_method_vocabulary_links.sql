-- Step 2 of the method<->Lernziel linking system (see migration 121's
-- header). OpenLPM's own didactic-method vocabulary
-- (prompt_template_libraries.option_lists.methods, migration 078) is a
-- plain list of German labels -- "Konzeptuelles Lernen", "Stationenlernen"
-- -- with no reference to anything else in the ecosystem. This table maps
-- each label onto the real MethodsBase record that now describes it
-- (methodsbase/records/methods.yaml, 12 of which were authored alongside
-- this migration specifically to close this gap -- see
-- methodsbase PR #1).
--
-- Global, not project-scoped: a method label like "Konzeptuelles Lernen"
-- names the same real technique wherever it's used, the same reasoning
-- METHOD_ICON in student-lernziele-page.tsx already uses for its own
-- global, unscoped label->icon map. A project using a different
-- language/subject-area vocabulary (prompt_template_libraries is scoped
-- by language+subject_area) simply won't find a row here yet -- read
-- code should treat a missing mapping as "no rich description available
-- yet," never as an error.

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS method_vocabulary_links (
  method_key TEXT PRIMARY KEY,
  methodsbase_id TEXT REFERENCES methodsbase_snapshot(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE method_vocabulary_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can browse method vocabulary links" ON method_vocabulary_links
  FOR SELECT USING (auth.role() = 'authenticated');

-- Mapping itself is ecosystem-reference data, not project content -- same
-- "only service_role writes it" shape as the snapshot table itself, so a
-- bad mapping can't be typo'd in by any one project's members. Corrections
-- go through a migration (like this one), the same place the vocabulary
-- itself (migration 078) was defined.

CREATE TRIGGER update_method_vocabulary_links_updated_at BEFORE UPDATE ON method_vocabulary_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Deliberately NOT seeded here with the real 15-method mapping. The real
-- mapping's methodsbase_id values (e.g. 'OE-METHOD-inquiry-based-learning')
-- only resolve once scripts/sync_methodsbase_snapshot.mjs has actually
-- synced methodsbase PR #1's content into methodsbase_snapshot -- a
-- separate, manually-run script, not something `supabase db push`
-- guarantees has already happened before this migration applies. Seeding
-- the mapping here would make this migration fail on the FK constraint
-- whenever it runs before that sync, which is the normal order for a
-- fresh push. scripts/sync_methodsbase_snapshot.mjs --seed-vocabulary-links
-- does the seeding instead, in the same run as the snapshot sync, so the
-- FK target always exists first.
