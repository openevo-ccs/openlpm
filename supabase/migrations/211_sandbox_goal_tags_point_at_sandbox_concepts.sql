-- 211: in the sandbox copy of EvoMentor Thuringia, every learning goal's concept tags point at the concepts of the LIVE space.
--
-- Found 2026-10-30 from Susan Hanisch's feedback 7ec9cfa0 ("there are no subconcepts shown"): the sandbox was copied with new concept
-- ids, but the 1,145 sub-concept tags inside its goals (content -> basiskonzeptbezug -> ...taxonomie -> taxonomyElementId) still carried
-- the live space's ids. None of the 102 ids referenced exists in the sandbox, so the Netz could not draw a single sub-concept, and
-- counts per sub-concept in the sandbox were empty.
--
-- Matches every concept of the live space to the concept of the sandbox with the same label path (root > parent > name), checks
-- that the path is unique on both sides, and replaces the old id with the new one inside the sandbox's goals. Goals of the live
-- space are not touched. Running it twice changes nothing (after the first run no old id is left to replace).
-- Check after applying: this should return 0.
--   SELECT count(*) FROM lpm_data_objects o, projects p
--   WHERE p.slug = 'evomentor-thuringia-sandbox' AND o.project_id = p.id
--     AND o.content::text LIKE ANY (SELECT '%' || e.id::text || '%' FROM lpm_schema_elements e WHERE e.project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia'));
SET search_path = public, extensions;

DO $$
DECLARE
  live_id uuid := (SELECT id FROM projects WHERE slug = 'evomentor-thuringia');
  sandbox_id uuid := (SELECT id FROM projects WHERE slug = 'evomentor-thuringia-sandbox');
  m record;
  mapped integer := 0;
BEGIN
  FOR m IN
    WITH RECURSIVE pe AS (
      SELECT e.id, e.project_id, e.parent_id, e.label::text AS path
      FROM lpm_schema_elements e
      WHERE e.parent_id IS NULL AND e.project_id IN (live_id, sandbox_id)
      UNION ALL
      SELECT c.id, c.project_id, c.parent_id, pe.path || ' > ' || c.label
      FROM lpm_schema_elements c JOIN pe ON c.parent_id = pe.id
    ),
    unique_paths AS (
      SELECT path FROM pe GROUP BY path HAVING count(*) FILTER (WHERE project_id = live_id) = 1 AND count(*) FILTER (WHERE project_id = sandbox_id) = 1
    )
    SELECT l.id AS old_id, s.id AS new_id
    FROM pe l JOIN pe s ON s.path = l.path AND s.project_id = sandbox_id
    WHERE l.project_id = live_id AND l.path IN (SELECT path FROM unique_paths)
  LOOP
    UPDATE lpm_data_objects
    SET content = replace(content::text, m.old_id::text, m.new_id::text)::jsonb, updated_at = now()
    WHERE project_id = sandbox_id AND content::text LIKE '%' || m.old_id::text || '%';
    mapped := mapped + 1;
  END LOOP;
  RAISE NOTICE 'concept ids remapped for % sandbox concepts', mapped;
END $$;
