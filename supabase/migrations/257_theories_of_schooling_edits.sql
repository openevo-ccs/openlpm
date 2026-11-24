SET search_path = public, extensions;

-- Checking and correcting a theory of schooling inside OpenLPM (Dustin Eirdosh, 2026-11-24: "integrate intuitive data editing functions for these ToS Models",
-- starting with "check and move statements").
--
-- A language model sorted the 1,684 statements of the OpenEvo theory of schooling into domains. People now confirm or correct that sorting one statement at a
-- time in the Atlas. Each change is stored here as one row and is never changed or deleted. Undo is a new row that puts the earlier value back, the same way the
-- edit log of the Base Repo Explorer works (migration 237). Two kinds of change exist:
--   placement  the broad ideas (super) and the aspects of schooling (sub) a statement is placed in: { "super": [{id, strength}], "sub": [{id, strength}] }
--   review     the mark a person leaves: { "status": "checked" | "unsure" | "excluded", "note": "..." }, or NULL to take the mark away.
--              checked = placed right, unsure = ask someone, excluded = not about schooling (left out of the views).
--
-- The rows are keyed by the profile's persistent code and not by the id of its database row, so a profile that is saved again (a new machine sort, a new version)
-- keeps every human decision. tos_reapply_edits puts the latest change of each field back on top of a profile that was just replaced.
--
-- A trigger applies each new row to the profile at once: it rewrites that statement inside tos_profiles.data and in tos_elements (supers, subs, review_status).
-- So every reader (the Atlas, the Profiles page, the prompt builder, Me-Mo) sees the people's decisions without knowing about this table. The name and time on a
-- mark come from the database. The browser's values are ignored.
--
-- AI opt-out (CLAUDE.md): the "note" a person types is theirs. It is stored here and in the review mark inside tos_profiles.data, but no part of the app gives
-- notes to an assistant, and a script that reads this table to show text to an assistant must leave out rows whose edited_by is on the opt-out list
-- (scripts/lib/ai-opt-out.mjs).
--
-- Who may do what: members of the space read, editors add rows as themselves, nobody changes or deletes a row (the service role excepted).

CREATE TABLE IF NOT EXISTS tos_element_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The persistent code of the profile (tos_profiles.profile_id) and the id of the statement inside it.
  profile_code TEXT NOT NULL CHECK (profile_code ~ '^OE-SCHOOLINGPROFILE-[a-z0-9-]+$'),
  element_id TEXT NOT NULL CHECK (element_id ~ '^[A-Za-z0-9_.-]+$'),
  field_path TEXT NOT NULL CHECK (field_path IN ('placement', 'review')),
  -- What the editor saw and what they saved. A review value of NULL means "no mark".
  before_value JSONB,
  after_value JSONB,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 400),
  -- A placement is two short lists of domain ids and a review mark is a few words. Nothing here needs more than this.
  CONSTRAINT tos_element_edits_size CHECK (octet_length(COALESCE(after_value::text, '')) <= 20000 AND octet_length(COALESCE(before_value::text, '')) <= 20000),
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A check that evaluates to NULL passes, so every part is wrapped to give true or false.
  CONSTRAINT tos_element_edits_shape CHECK (
    COALESCE(
      (field_path = 'placement'
        AND jsonb_typeof(after_value) = 'object'
        AND jsonb_typeof(after_value->'super') = 'array'
        AND jsonb_typeof(after_value->'sub') = 'array')
      OR
      (field_path = 'review'
        AND (after_value IS NULL
             OR (jsonb_typeof(after_value) = 'object' AND COALESCE(after_value->>'status' IN ('checked', 'unsure', 'excluded'), false)))),
      false)
  )
);

CREATE INDEX IF NOT EXISTS idx_tos_element_edits_element
  ON tos_element_edits(project_id, profile_code, element_id, field_path, edited_at DESC);

-- Whether a person has looked at a statement, copied from the review mark so that counts and filters need no JSON. NULL = not checked yet.
ALTER TABLE tos_elements ADD COLUMN IF NOT EXISTS review_status TEXT
  CHECK (review_status IS NULL OR review_status IN ('checked', 'unsure', 'excluded'));
CREATE INDEX IF NOT EXISTS idx_tos_elements_review ON tos_elements(project_id, review_status);

-- ---- Row level security ----
ALTER TABLE tos_element_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read theory edits" ON tos_element_edits;
CREATE POLICY "Members read theory edits" ON tos_element_edits
  FOR SELECT USING (is_project_member(project_id));

DROP POLICY IF EXISTS "Editors add theory edits as themselves" ON tos_element_edits;
CREATE POLICY "Editors add theory edits as themselves" ON tos_element_edits
  FOR INSERT WITH CHECK (is_project_editor(project_id) AND edited_by = auth.uid());

GRANT SELECT, INSERT ON tos_element_edits TO authenticated;
REVOKE ALL ON tos_element_edits FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tos_element_edits TO service_role;

-- ---- Applying a change to the profile ----

-- The review mark as it is stored inside the profile: the editor's name and the time come from the database.
CREATE OR REPLACE FUNCTION tos_review_mark(p_after JSONB, p_by UUID, p_at TIMESTAMPTZ)
RETURNS JSONB AS $$
  SELECT CASE
    WHEN p_after IS NULL OR jsonb_typeof(p_after) <> 'object' THEN NULL
    ELSE (p_after - 'by' - 'at')
         || jsonb_build_object('by', COALESCE((SELECT u.name FROM users u WHERE u.id = p_by), ''), 'at', to_jsonb(p_at))
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- The ids of a list of placements ([{id, strength}] or bare ids).
CREATE OR REPLACE FUNCTION tos_placed_ids(p_list JSONB)
RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(DISTINCT x.id), '{}')
  FROM (
    SELECT CASE WHEN jsonb_typeof(p) = 'string' THEN p #>> '{}' ELSE p->>'id' END AS id
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_list) = 'array' THEN p_list ELSE '[]'::jsonb END) AS p
  ) x
  WHERE x.id IS NOT NULL;
$$ LANGUAGE sql IMMUTABLE;

-- Puts one new row onto the profile. A profile that is gone leaves the row in the log and changes nothing else.
CREATE OR REPLACE FUNCTION tos_apply_edit()
RETURNS TRIGGER AS $$
DECLARE
  v_profile UUID;
  v_mark JSONB;
BEGIN
  SELECT p.id INTO v_profile FROM tos_profiles p WHERE p.project_id = NEW.project_id AND p.profile_id = NEW.profile_code;
  IF v_profile IS NULL THEN
    RETURN NEW;
  END IF;
  v_mark := CASE WHEN NEW.field_path = 'review' THEN tos_review_mark(NEW.after_value, NEW.edited_by, NEW.edited_at) ELSE NULL END;

  UPDATE tos_profiles p
  SET data = jsonb_set(p.data, '{elements}', COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN e.elem->>'id' <> NEW.element_id THEN e.elem
        WHEN NEW.field_path = 'placement' THEN e.elem || jsonb_build_object('placement', NEW.after_value)
        WHEN v_mark IS NULL THEN e.elem - 'review'
        ELSE e.elem || jsonb_build_object('review', v_mark)
      END ORDER BY e.ord)
    FROM jsonb_array_elements(p.data->'elements') WITH ORDINALITY AS e(elem, ord)
  ), '[]'::jsonb))
  WHERE p.id = v_profile;

  IF NEW.field_path = 'placement' THEN
    UPDATE tos_elements t
    SET supers = tos_placed_ids(NEW.after_value->'super'), subs = tos_placed_ids(NEW.after_value->'sub')
    WHERE t.profile_row_id = v_profile AND t.element_id = NEW.element_id;
  ELSE
    UPDATE tos_elements t
    SET review_status = v_mark->>'status'
    WHERE t.profile_row_id = v_profile AND t.element_id = NEW.element_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION tos_apply_edit() FROM PUBLIC;

DROP TRIGGER IF EXISTS tos_element_edits_apply ON tos_element_edits;
CREATE TRIGGER tos_element_edits_apply
  AFTER INSERT ON tos_element_edits
  FOR EACH ROW EXECUTE FUNCTION tos_apply_edit();

-- After a profile was saved again (a new sort or a new version), puts the latest change of every field back on top of it. Returns how many statements it touched.
-- The caller must be an editor of the space.
CREATE OR REPLACE FUNCTION tos_reapply_edits(p_project_id UUID, p_profile_code TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_profile UUID;
  v_n INTEGER;
BEGIN
  IF NOT (is_project_editor(p_project_id) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only an editor of the space may do this' USING ERRCODE = '42501';
  END IF;
  SELECT p.id INTO v_profile FROM tos_profiles p WHERE p.project_id = p_project_id AND p.profile_id = p_profile_code;
  IF v_profile IS NULL THEN
    RETURN 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tos_latest_edits (element_id TEXT, field_path TEXT, after_value JSONB, mark JSONB) ON COMMIT DROP;
  DELETE FROM tos_latest_edits;
  INSERT INTO tos_latest_edits
  SELECT l.element_id, l.field_path, l.after_value,
         CASE WHEN l.field_path = 'review' THEN tos_review_mark(l.after_value, l.edited_by, l.edited_at) ELSE NULL END
  FROM (
    SELECT DISTINCT ON (d.element_id, d.field_path) d.element_id, d.field_path, d.after_value, d.edited_by, d.edited_at
    FROM tos_element_edits d
    WHERE d.project_id = p_project_id AND d.profile_code = p_profile_code
    ORDER BY d.element_id, d.field_path, d.edited_at DESC, d.id DESC
  ) l;

  UPDATE tos_profiles p
  SET data = jsonb_set(p.data, '{elements}', COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN rv.element_id IS NULL THEN x1.elem
        WHEN rv.mark IS NULL THEN x1.elem - 'review'
        ELSE x1.elem || jsonb_build_object('review', rv.mark)
      END ORDER BY e.ord)
    FROM jsonb_array_elements(p.data->'elements') WITH ORDINALITY AS e(elem, ord)
    LEFT JOIN tos_latest_edits pl ON pl.field_path = 'placement' AND pl.element_id = e.elem->>'id'
    LEFT JOIN tos_latest_edits rv ON rv.field_path = 'review' AND rv.element_id = e.elem->>'id'
    CROSS JOIN LATERAL (
      SELECT CASE WHEN pl.element_id IS NULL THEN e.elem ELSE e.elem || jsonb_build_object('placement', pl.after_value) END AS elem
    ) x1
  ), '[]'::jsonb))
  WHERE p.id = v_profile;

  UPDATE tos_elements t
  SET supers = tos_placed_ids(l.after_value->'super'), subs = tos_placed_ids(l.after_value->'sub')
  FROM tos_latest_edits l
  WHERE l.field_path = 'placement' AND t.profile_row_id = v_profile AND t.element_id = l.element_id;

  -- A statement whose latest review change took the mark away goes back to "not checked yet". A statement with no review change keeps what the new profile said.
  UPDATE tos_elements t
  SET review_status = l.mark->>'status'
  FROM tos_latest_edits l
  WHERE l.field_path = 'review' AND t.profile_row_id = v_profile AND t.element_id = l.element_id;

  SELECT count(DISTINCT element_id) INTO v_n FROM tos_latest_edits;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION tos_reapply_edits(UUID, TEXT) TO authenticated, service_role;

-- How far a space's statements have been checked by a person: one row, for the badge in the space header.
CREATE OR REPLACE FUNCTION tos_review_progress(p_project_id UUID)
RETURNS TABLE (total BIGINT, checked BIGINT, unsure BIGINT, excluded BIGINT) AS $$
  SELECT count(*) FILTER (WHERE t.review_status IS DISTINCT FROM 'excluded'),
         count(*) FILTER (WHERE t.review_status = 'checked'),
         count(*) FILTER (WHERE t.review_status = 'unsure'),
         count(*) FILTER (WHERE t.review_status = 'excluded')
  FROM tos_elements t
  WHERE t.project_id = p_project_id AND is_project_member(p_project_id);
$$ LANGUAGE sql STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION tos_review_progress(UUID) TO authenticated, service_role;
