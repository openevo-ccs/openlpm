SET search_path = public, extensions;

-- A sandbox twin of the evomentor-thuringia space, for synthetic (AI-generated)
-- students. Decided with Dustin 2026-10-28: the fake students get their own
-- space with its own Custom View, so they never appear in the group lists,
-- rosters or exports of the real Uni Jena Biologiedidaktik students.
--
-- The copy is a snapshot of the Thuringia curriculum content (Lernziele,
-- Basiskonzepte and their sub-concepts, accepted connections, Kohärenzfäden,
-- method links), with fresh ids and every reference re-pointed to the copy.
-- It is repeatable: clone_project_content() clears the target's content and
-- copies again, which is how the sandbox is reset between synthetic runs or
-- refreshed after the real content changes. A reset also removes the
-- synthetic students' stars and prompts that point at the old rows (they
-- cascade), which is the intent for a sandbox. The function is not callable
-- through the Data API; run it with the service role or in a migration.
--
-- Columns are discovered from information_schema instead of listed by hand, so
-- a column added to these tables later is copied without editing this file.

CREATE OR REPLACE FUNCTION _clone_rows(p_table TEXT, p_where TEXT, p_overrides JSONB DEFAULT '{}'::jsonb)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public, extensions
AS $fn$
DECLARE
  v_cols TEXT;
  v_exprs TEXT;
  v_n INT;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
         string_agg(COALESCE(p_overrides ->> column_name, format('t.%I', column_name)), ', ' ORDER BY ordinal_position)
    INTO v_cols, v_exprs
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND is_generated = 'NEVER';

  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'table % not found', p_table;
  END IF;

  EXECUTE format('INSERT INTO %I (%s) SELECT %s FROM %I t WHERE %s', p_table, v_cols, v_exprs, p_table, p_where);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

CREATE OR REPLACE FUNCTION clone_project_content(p_source UUID, p_target UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_branch UUID;
  v_counts JSONB := '{}'::jsonb;
  v_src TEXT := quote_literal(p_source::text) || '::uuid';
  v_dst TEXT := quote_literal(p_target::text) || '::uuid';
  v_n INT;
BEGIN
  SELECT id INTO v_branch FROM branches WHERE project_id = p_target AND is_trunk;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'target project % has no trunk branch', p_target;
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'source and target must differ';
  END IF;

  -- Start clean so the function can be run again to reset or refresh.
  DELETE FROM lpm_thread_stations WHERE thread_id IN (SELECT id FROM lpm_threads WHERE project_id = p_target);
  DELETE FROM lpm_threads WHERE project_id = p_target;
  DELETE FROM lpm_connections WHERE project_id = p_target;
  DELETE FROM lpm_concept_relations WHERE project_id = p_target;
  DELETE FROM method_lernziel_links WHERE project_id = p_target;
  DELETE FROM method_basiskonzept_links WHERE project_id = p_target;
  DELETE FROM lpm_data_objects WHERE project_id = p_target;
  DELETE FROM lpm_schema_elements WHERE project_id = p_target;
  DELETE FROM project_source_declarations WHERE project_id = p_target;

  CREATE TEMP TABLE _map_se (old_id UUID PRIMARY KEY, new_id UUID NOT NULL DEFAULT uuid_generate_v4()) ON COMMIT DROP;
  CREATE TEMP TABLE _map_do (old_id UUID PRIMARY KEY, new_id UUID NOT NULL DEFAULT uuid_generate_v4()) ON COMMIT DROP;
  CREATE TEMP TABLE _map_th (old_id UUID PRIMARY KEY, new_id UUID NOT NULL DEFAULT uuid_generate_v4()) ON COMMIT DROP;

  INSERT INTO _map_se (old_id) SELECT id FROM lpm_schema_elements WHERE project_id = p_source;
  INSERT INTO _map_do (old_id) SELECT id FROM lpm_data_objects WHERE project_id = p_source;
  INSERT INTO _map_th (old_id) SELECT id FROM lpm_threads WHERE project_id = p_source;

  v_n := _clone_rows('lpm_schema_elements', 't.project_id = ' || v_src, jsonb_build_object(
    'id', '(SELECT new_id FROM _map_se WHERE old_id = t.id)',
    'project_id', v_dst,
    'branch_id', quote_literal(v_branch::text) || '::uuid',
    'parent_id', '(SELECT new_id FROM _map_se WHERE old_id = t.parent_id)'));
  v_counts := v_counts || jsonb_build_object('lpm_schema_elements', v_n);

  v_n := _clone_rows('lpm_data_objects', 't.project_id = ' || v_src, jsonb_build_object(
    'id', '(SELECT new_id FROM _map_do WHERE old_id = t.id)',
    'project_id', v_dst,
    'branch_id', quote_literal(v_branch::text) || '::uuid'));
  v_counts := v_counts || jsonb_build_object('lpm_data_objects', v_n);

  v_n := _clone_rows('lpm_connections', 't.project_id = ' || v_src, jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'project_id', v_dst,
    'branch_id', quote_literal(v_branch::text) || '::uuid',
    'from_object_id', '(SELECT new_id FROM _map_do WHERE old_id = t.from_object_id)',
    'to_object_id', '(SELECT new_id FROM _map_do WHERE old_id = t.to_object_id)'));
  v_counts := v_counts || jsonb_build_object('lpm_connections', v_n);

  v_n := _clone_rows('lpm_threads', 't.project_id = ' || v_src, jsonb_build_object(
    'id', '(SELECT new_id FROM _map_th WHERE old_id = t.id)',
    'project_id', v_dst,
    'branch_id', quote_literal(v_branch::text) || '::uuid',
    'explained_by_element_id', '(SELECT new_id FROM _map_se WHERE old_id = t.explained_by_element_id)'));
  v_counts := v_counts || jsonb_build_object('lpm_threads', v_n);

  v_n := _clone_rows('lpm_thread_stations', 't.thread_id IN (SELECT old_id FROM _map_th)', jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'thread_id', '(SELECT new_id FROM _map_th WHERE old_id = t.thread_id)',
    'data_object_id', '(SELECT new_id FROM _map_do WHERE old_id = t.data_object_id)',
    'via_element_id', '(SELECT new_id FROM _map_se WHERE old_id = t.via_element_id)'));
  v_counts := v_counts || jsonb_build_object('lpm_thread_stations', v_n);

  v_n := _clone_rows('lpm_concept_relations', 't.project_id = ' || v_src, jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'project_id', v_dst,
    'from_element_id', '(SELECT new_id FROM _map_se WHERE old_id = t.from_element_id)',
    'to_element_id', '(SELECT new_id FROM _map_se WHERE old_id = t.to_element_id)'));
  v_counts := v_counts || jsonb_build_object('lpm_concept_relations', v_n);

  v_n := _clone_rows('method_lernziel_links', 't.project_id = ' || v_src, jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'project_id', v_dst,
    'lernziel_id', '(SELECT new_id FROM _map_do WHERE old_id = t.lernziel_id)'));
  v_counts := v_counts || jsonb_build_object('method_lernziel_links', v_n);

  v_n := _clone_rows('method_basiskonzept_links', 't.project_id = ' || v_src, jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'project_id', v_dst,
    'basiskonzept_id', '(SELECT new_id FROM _map_se WHERE old_id = t.basiskonzept_id)'));
  v_counts := v_counts || jsonb_build_object('method_basiskonzept_links', v_n);

  v_n := _clone_rows('project_source_declarations', 't.project_id = ' || v_src, jsonb_build_object(
    'id', 'uuid_generate_v4()',
    'project_id', v_dst));
  v_counts := v_counts || jsonb_build_object('project_source_declarations', v_n);

  RETURN v_counts;
END;
$fn$;

-- Not part of the Data API surface: only the service role (or a migration)
-- may run these.
REVOKE ALL ON FUNCTION _clone_rows(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clone_project_content(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION _clone_rows(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION clone_project_content(UUID, UUID) TO service_role;

-- ============================================================================
-- Create the sandbox space (idempotent: skipped if it already exists or if the
-- source space is missing).
-- ============================================================================

DO $$
DECLARE
  v_src UUID;
  v_owner UUID;
  v_dst UUID := uuid_generate_v4();
  v_view UUID;
  v_counts JSONB;
  v_src_count INT;
  v_dst_count INT;
BEGIN
  SELECT id, created_by INTO v_src, v_owner FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_src IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia not found; sandbox space not created';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM projects WHERE slug = 'evomentor-thuringia-sandbox') THEN
    RAISE NOTICE 'evomentor-thuringia-sandbox already exists; nothing to do';
    RETURN;
  END IF;

  -- The project row: a copy of the source row with a new identity. Private,
  -- no parent, not a promoted branch.
  PERFORM _clone_rows('projects', 't.id = ' || quote_literal(v_src::text) || '::uuid', jsonb_build_object(
    'id', quote_literal(v_dst::text) || '::uuid',
    'slug', $q$'evomentor-thuringia-sandbox'$q$,
    'name', $q$'EvoMentor Thüringen – Sandbox (synthetische Studierende)'$q$,
    'description', $q$'Testbereich für synthetische (KI-erzeugte) Studierende. Abbild des Bereichs EvoMentor Thüringen. Hier arbeiten keine echten Studierenden; nichts aus diesem Bereich ist Studierendenarbeit.'$q$,
    'is_private', 'TRUE',
    'parent_project_id', 'NULL',
    'promoted_from_branch_id', 'NULL',
    'student_view_template', $q$'jena-biologiedidaktik-sandbox-de'$q$,
    'groups_enabled', 'TRUE',
    'created_at', 'NOW()',
    'updated_at', 'NOW()'));

  INSERT INTO branches (project_id, slug, label, is_trunk, created_by)
  VALUES (v_dst, 'main', 'main', TRUE, v_owner);

  -- Owners and maintainers of the real space can run the sandbox too.
  INSERT INTO project_members (project_id, user_id, role)
  SELECT v_dst, user_id, role FROM project_members
  WHERE project_id = v_src AND role IN ('owner', 'maintainer')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  v_counts := clone_project_content(v_src, v_dst);

  -- Same Custom View as the real space, forced for everyone who joins by a
  -- join rule (the synthetic students), with the Sandbox template so the page
  -- shows its banner and files carry a sandbox flag.
  INSERT INTO project_dashboard_views (project_id, name, kind, template_id, is_default, is_forced, created_by)
  VALUES (v_dst, 'Jena Biologiedidaktik (Sandbox)', 'template', 'jena-biologiedidaktik-sandbox-de', FALSE, TRUE, v_owner)
  RETURNING id INTO v_view;
  INSERT INTO project_dashboard_view_assignments (view_id, target_type, target_value)
  VALUES (v_view, 'join_method', 'self_join_rule');

  -- The copy must match the source row for row before this migration commits.
  SELECT count(*) INTO v_src_count FROM lpm_data_objects WHERE project_id = v_src;
  SELECT count(*) INTO v_dst_count FROM lpm_data_objects WHERE project_id = v_dst;
  IF v_src_count <> v_dst_count THEN
    RAISE EXCEPTION 'sandbox copy mismatch: % source Lernziele, % copied', v_src_count, v_dst_count;
  END IF;
  RAISE NOTICE 'sandbox created: %', v_counts;
END $$;

-- Data API grants extend automatically via 006's ALTER DEFAULT PRIVILEGES.
