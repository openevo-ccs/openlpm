SET search_path = public, extensions;

-- Fix for migration 257 (found by the first live test, 2026-11-24).
--
-- tos_reapply_edits emptied its work table with "DELETE FROM tos_latest_edits;". Supabase refuses a DELETE or UPDATE without a WHERE clause (the
-- pg_safeupdate guard), so saving a profile again failed after the profile was written with "DELETE requires a WHERE clause" and the earlier checks were not
-- put back. The function now drops and creates its work table, which needs no DELETE. Nothing else changes. Checking and moving statements was not affected,
-- because the trigger that applies each change has a WHERE clause in every statement.
--
-- The test scripts/test_tos_edits_sql.mjs now also reads migrations 257 and 258 and refuses any UPDATE or DELETE statement without a WHERE clause, because
-- the in-memory database it runs on does not carry that guard.

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

  DROP TABLE IF EXISTS pg_temp.tos_latest_edits;
  CREATE TEMP TABLE tos_latest_edits (element_id TEXT, field_path TEXT, after_value JSONB, mark JSONB) ON COMMIT DROP;
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
