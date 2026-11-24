SET search_path = public, extensions;

-- Theories of Schooling spaces (2026-11-24): a new kind of project space where a person, a community or a group keeps their own theory
-- of schooling and compares it with others. A theory is stored as one profile (the JSON format of the Theory of Schooling Atlas, see
-- docs/architecture/theories-of-schooling-space-2026-11-24.md). Nothing here touches an existing space.
--
-- NOT APPLIED YET. Check that the number 256 is still free with `supabase migration list --linked` right before running `supabase db push`.
-- Apply this migration before the interface that uses it reaches the live site: the pages query these tables.
--
-- What it adds:
--   1. projects.project_kind accepts a fourth value, 'theory-of-schooling' (drop and re-add of the CHECK, as migration 095 did).
--   2. tos_profiles: one row per theory profile in a space. The whole profile sits in `data` (JSONB); the columns beside it are copies of
--      the fields people filter by.
--   3. tos_elements: the statements of each profile, one row each, flattened so they can be searched and compared with SQL.
--      They are written by the app from `data` and can be rebuilt from it at any time.
--   4. tos_profile_ids_open_to_ai(project): which profiles of a space may be given to an AI assistant (see the opt-out rule below).
--
-- Who can do what:
--   - Every member of the space can read every profile and statement of the space (is_project_member, which includes admins).
--   - Editors (owner, maintainer, editor, contributor; is_project_editor from migration 135) can add, change and delete profiles and statements.
--   - Viewers and reviewers can read only. is_project_member is deliberately not used for writing, because it lets viewers write.
--   - Nobody outside the space can read anything. No row is public through the database. A profile marked "public" in its own data is a
--     statement about where it may be published, and publishing happens elsewhere.
--
-- AI opt-out rule (CLAUDE.md, "People who opted out of AI processing"; migration 238, table user_privacy_settings): the profiles hold text
-- that a person or a community wrote about their own schooling. That text must not go to a language model unless the person allows it.
--   - Any script that reads `tos_profiles.data` or `tos_elements` with the service key and shows the text to an AI assistant, or sends it to
--     any outside model, must load the opted-out ids with loadOptedOutUserIds (scripts/lib/ai-opt-out.mjs) and leave out every row whose
--     created_by is on the list. The service key sees every row, so the rule is the only protection.
--   - The "Prompt context" page builds a text that a person copies into a chat. It asks tos_profile_ids_open_to_ai() first and leaves out
--     every profile whose creator opted out. If the question cannot be answered, it leaves everything out.
--   - scripts/import_tos_profile.mjs only writes. It reads no text from the database, so it needs no opt-out list.
--
-- Account deletion: created_by points to users with ON DELETE CASCADE, so a profile goes when its creator's account is deleted
-- (execute_data_deletion.mjs deletes everything keyed to the account). A profile that a community wants to keep should be created by an
-- account that stays.
--
-- No sequences: every key is a UUID, so there is no sequence grant to forget (see migration 254 for the case where there is one).
--
-- To make a space of this kind there is no button yet. An admin runs one statement, for example for a new space:
--   INSERT INTO projects (slug, name, description, status, epistemic_status, hosting_mode, is_private, project_kind)
--   VALUES ('my-community-theory', 'My community''s theory of schooling', 'Our own ideas about what school is for.', 'active', 'in-development', 'hosted', TRUE, 'theory-of-schooling');
--   (then add the owner to project_members.)
-- Do not change an existing space with content to this kind: its sidebar changes and its learning goals stop being reachable from it.
--
-- Rollback (only while no project has the new kind and the tables hold nothing worth keeping):
--   DROP FUNCTION IF EXISTS tos_profile_ids_open_to_ai(UUID);
--   DROP TABLE IF EXISTS tos_elements; DROP TABLE IF EXISTS tos_profiles;
--   ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_kind_check;
--   ALTER TABLE projects ADD CONSTRAINT projects_project_kind_check CHECK (project_kind IN ('standard', 'curriculum-repository', 'curriculum-repository-custom-view'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_kind_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_kind_check
  CHECK (project_kind IN ('standard', 'curriculum-repository', 'curriculum-repository-custom-view', 'theory-of-schooling'));

COMMENT ON COLUMN projects.project_kind IS
  'standard = ordinary LPM project (full sidebar). curriculum-repository = a curated source archive, reduced sidebar, listed in its own section (migration 072). curriculum-repository-custom-view = an audience or language view of one Curriculum Repository, never listed in the main switcher (migration 095). theory-of-schooling = a place where a person, community or group keeps their own theory of schooling and compares it with others: its own sidebar (Atlas, Profiles, Prompt context, Settings) and its own frame in the project switcher (migration 256).';

CREATE TABLE IF NOT EXISTS tos_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The persistent code of the profile, OE-SCHOOLINGPROFILE-<slug>. An element is cited as this code, a hash sign and the element id.
  profile_id TEXT NOT NULL CHECK (profile_id ~ '^OE-SCHOOLINGPROFILE-[a-z0-9-]+$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  -- Open vocabulary (individual, community, group, author, scientific today). The app checks it against the domain model file.
  holder_kind TEXT NOT NULL CHECK (char_length(holder_kind) BETWEEN 1 AND 40),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'lab-only', 'local')),
  theory_ref TEXT CHECK (theory_ref IS NULL OR theory_ref ~ '^OE-THEORY-[a-z0-9-]+$'),
  version TEXT NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  license TEXT NOT NULL CHECK (char_length(license) BETWEEN 1 AND 100),
  -- Who has looked at the profile (ai-draft, author-reviewed, expert-reviewed, illustrative-example). Open vocabulary, copied from provenance.reviewStatus.
  review_status TEXT NOT NULL CHECK (char_length(review_status) BETWEEN 1 AND 40),
  data JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The profile must be a JSON object that carries the same code as the column, and stay under 4 MB.
  CONSTRAINT tos_profiles_data_matches CHECK (
    jsonb_typeof(data) = 'object'
    AND data->>'id' = profile_id
    AND octet_length(data::text) <= 4000000
  ),
  UNIQUE (project_id, profile_id),
  -- Lets tos_elements point at a profile and its space together, so a statement can never sit in a different space than its profile.
  UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_tos_profiles_project ON tos_profiles(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tos_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  profile_row_id UUID NOT NULL,
  element_id TEXT NOT NULL CHECK (element_id ~ '^[A-Za-z0-9_.-]+$'),
  -- Open vocabulary (proposition, observation, design, aim, practice, question, concept today).
  type TEXT NOT NULL CHECK (char_length(type) BETWEEN 1 AND 40),
  label TEXT CHECK (label IS NULL OR char_length(label) <= 200),
  statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 2000),
  -- Ids of the broad ideas (supers) and the aspects of schooling (subs) the statement is placed in, firm and weaker placements together.
  supers TEXT[] NOT NULL DEFAULT '{}',
  subs TEXT[] NOT NULL DEFAULT '{}',
  -- The base record this statement is, when it has one (for example OE-DESIGNPRINCIPLE-...).
  ref TEXT,
  visibility TEXT NOT NULL DEFAULT 'lab-only' CHECK (visibility IN ('public', 'lab-only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_row_id, element_id),
  FOREIGN KEY (profile_row_id, project_id) REFERENCES tos_profiles(id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tos_elements_project ON tos_elements(project_id, profile_row_id);
CREATE INDEX IF NOT EXISTS idx_tos_elements_supers ON tos_elements USING GIN (supers);
CREATE INDEX IF NOT EXISTS idx_tos_elements_subs ON tos_elements USING GIN (subs);

-- A profile cannot be moved to another space or handed to another creator, and the change time is kept by the database.
CREATE OR REPLACE FUNCTION tos_profiles_before_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.project_id := OLD.project_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tos_profiles_before_update ON tos_profiles;
CREATE TRIGGER tos_profiles_before_update
  BEFORE UPDATE ON tos_profiles
  FOR EACH ROW EXECUTE FUNCTION tos_profiles_before_update();

ALTER TABLE tos_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tos_elements ENABLE ROW LEVEL SECURITY;

-- Both tables use the same two functions on project_id, so no policy reads the other table (no recursion), and no sibling policy is left out.
DROP POLICY IF EXISTS "Members read theory profiles" ON tos_profiles;
CREATE POLICY "Members read theory profiles" ON tos_profiles
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Editors add theory profiles as themselves" ON tos_profiles;
CREATE POLICY "Editors add theory profiles as themselves" ON tos_profiles
  FOR INSERT WITH CHECK (is_project_editor(project_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Editors change theory profiles" ON tos_profiles;
CREATE POLICY "Editors change theory profiles" ON tos_profiles
  FOR UPDATE USING (is_project_editor(project_id)) WITH CHECK (is_project_editor(project_id));
DROP POLICY IF EXISTS "Editors delete theory profiles" ON tos_profiles;
CREATE POLICY "Editors delete theory profiles" ON tos_profiles
  FOR DELETE USING (is_project_editor(project_id));

DROP POLICY IF EXISTS "Members read theory statements" ON tos_elements;
CREATE POLICY "Members read theory statements" ON tos_elements
  FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "Editors add theory statements" ON tos_elements;
CREATE POLICY "Editors add theory statements" ON tos_elements
  FOR INSERT WITH CHECK (is_project_editor(project_id));
DROP POLICY IF EXISTS "Editors change theory statements" ON tos_elements;
CREATE POLICY "Editors change theory statements" ON tos_elements
  FOR UPDATE USING (is_project_editor(project_id)) WITH CHECK (is_project_editor(project_id));
DROP POLICY IF EXISTS "Editors delete theory statements" ON tos_elements;
CREATE POLICY "Editors delete theory statements" ON tos_elements
  FOR DELETE USING (is_project_editor(project_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON tos_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tos_elements TO authenticated;
REVOKE ALL ON tos_profiles FROM anon;
REVOKE ALL ON tos_elements FROM anon;
-- The import script (scripts/import_tos_profile.mjs) writes with the service key.
GRANT SELECT, INSERT, UPDATE, DELETE ON tos_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON tos_elements TO service_role;

-- Which profiles of a space may be given to an AI assistant: those whose creator has not opted out (migration 238). The table
-- user_privacy_settings shows each person only their own row, so a member cannot ask it directly. This function answers one narrow
-- question for members of the space: it returns profile ids, and says nothing about people. Callable by signed-in members only.
CREATE OR REPLACE FUNCTION tos_profile_ids_open_to_ai(p_project_id UUID)
RETURNS SETOF UUID AS $$
  SELECT p.id
  FROM tos_profiles p
  WHERE p.project_id = p_project_id
    AND is_project_member(p_project_id)
    AND NOT EXISTS (
      SELECT 1 FROM user_privacy_settings s
      WHERE s.user_id = p.created_by AND s.ai_processing_opt_out
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION tos_profile_ids_open_to_ai(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION tos_profile_ids_open_to_ai(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION tos_profile_ids_open_to_ai(UUID) TO authenticated;

COMMENT ON TABLE tos_profiles IS 'One theory of schooling per row, in the Theory of Schooling Atlas profile format (migration 256). Holds text written by people: see the AI opt-out rule at the top of that migration.';
COMMENT ON TABLE tos_elements IS 'The statements of a theory profile, one row each, flattened from tos_profiles.data for search and comparison (migration 256). Rebuildable from data. Holds text written by people: same AI opt-out rule.';
