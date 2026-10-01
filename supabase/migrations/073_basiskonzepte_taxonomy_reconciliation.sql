SET search_path = public, extensions;

-- Reconcile evomentor-thuringia/evomentor Basiskonzepte Netz taxonomy against
-- the real ground-truth source (EvoMentor_DE/data/thuringia_2026_lp_data/
-- "Basiskonzepte Taxonomie - Sheet1.csv"), per real feedback d2b88b82
-- (Susan Hanisch, 2026-10-01): "the info in the network is not congruent with
-- the info in the ... csv. Make sure it has the exact same subconcepts on
-- level 1 and level 2, nested correctly."
--
-- Found: 5 of 6 Basiskonzepte had an extra organizational tier in live data
-- that is not in the CSV at all (invented "chapter" nodes grouping the CSV's
-- real flat items as children), plus some outright duplicates (the same real
-- concept existing twice under two different ids). Dustin's real decision
-- (2026-10-01, asked directly): simplify the live tree's top two levels down
-- to match the CSV exactly. 44 of the ~60 affected items were already real
-- tags on real Lernziele -- those are kept, relocated one level deeper under
-- their closest correct real concept rather than deleted, so no real lesson
-- silently loses its most specific sub-concept tag. Full reasoning for every
-- individual placement is in
-- lab_manager/docs/design-notes/openlpm-basiskonzepte-netz-taxonomy-mismatch-2026-10-01.md.
--
-- Same procedural re-link discipline as migration 063 (which fixed the same
-- class of problem once before): Step 1 redirects every real Lernziel tag
-- off a node Step 3 is about to delete, onto its one real surviving
-- duplicate, BEFORE anything is deleted -- so no live content is ever left
-- pointing at an id that no longer exists. Step 2 relocates real,
-- CSV-uncatalogued detail (never deletes it). Step 3 only ever deletes an id
-- confirmed unreferenced after steps 1-2. Verified in advance (not just by
-- hand): a dry-run simulation of this exact plan against the real live data
-- confirmed (a) no reparent/merge target is itself among the deleted ids,
-- (b) the resulting tree's levels 1-2 match the CSV exactly for all 6
-- Basiskonzepte, (c) no two siblings end up with the same label anywhere.

DO $$
DECLARE
  v_project_ids UUID[];
  v_redirect JSONB := '{
    "f872506d-e87d-4a4f-bbf5-8798dfd671ff": "59dd49f3-1858-4891-bbd8-92c7a008c2af",
    "c6074e79-abdd-443e-a40b-fec48bf5133b": "a4fea8b0-1264-43c8-ab4c-ce962327d26a",
    "3431c9e8-98ab-4498-8888-170ee93567e2": "a6c1d105-286c-4240-9db6-9c1851ee30fc",
    "a3e373fd-fa44-43bf-aa61-3665729fa487": "3e44a913-ee29-460c-9966-a383349ac270",
    "c6b27ac7-df7d-48b9-8895-6e3806e5fef0": "52df2759-22a0-44c1-bad9-bdbae69a8c11",
    "d395bfd3-f745-46dd-af9f-d97e2e5550f8": "d1597cd6-5648-49bc-9ad2-9f27f9f43bc5",
    "a8d8d8b2-939b-49d0-82cb-7db1f0eade94": "77e0949b-32a4-4392-9b4b-f753ce14a851",
    "2bd44780-afe9-41e8-8d77-434aa9caf5ce": "5851bfb6-38a1-46dc-80ea-e97b2d142f2f",
    "24b5d301-2f6b-4962-a151-709e15943e41": "fe794c62-8a4e-4b54-9221-5e4107d2ef8b",
    "07ba8fb3-bea5-4784-8505-9a070b6d4014": "df02b3b0-a83a-49e6-9834-f6e799d4d576",
    "1bb4c3a3-4b27-4058-8299-1147ba15a564": "e32cd062-e674-46d4-91cd-86541a4a32f5",
    "9ae7254f-e651-448b-ab64-e9c3021dd459": "cac35a85-b91c-43ba-b0d3-b6eec8cecfb2"
  }'::jsonb;
  obj RECORD;
  bk_entry JSONB;
  new_bk_entries JSONB;
  tag JSONB;
  new_unterkonzepte JSONB;
  new_evolutionskonzepte JSONB;
  v_old_id TEXT;
  v_new_id TEXT;
  v_objects_touched INT := 0;
  v_tags_redirected INT := 0;
BEGIN
  SELECT array_agg(id) INTO v_project_ids FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor');

  -- Step 1: redirect every real tag off a soon-to-be-deleted duplicate id
  -- onto its one real surviving node.
  FOR obj IN SELECT id, content FROM lpm_data_objects WHERE project_id = ANY(v_project_ids) LOOP
    new_bk_entries := '[]'::jsonb;
    FOR bk_entry IN SELECT * FROM jsonb_array_elements(COALESCE(obj.content->'basiskonzeptbezug', '[]'::jsonb)) LOOP
      new_unterkonzepte := '[]'::jsonb;
      FOR tag IN SELECT * FROM jsonb_array_elements(COALESCE(bk_entry->'relevante_unterkonzepte_taxonomie', '[]'::jsonb)) LOOP
        v_old_id := tag->>'taxonomyElementId';
        v_new_id := v_redirect->>v_old_id;
        IF v_new_id IS NOT NULL THEN
          new_unterkonzepte := new_unterkonzepte || jsonb_build_array(jsonb_set(tag, '{taxonomyElementId}', to_jsonb(v_new_id)));
          v_tags_redirected := v_tags_redirected + 1;
        ELSE
          new_unterkonzepte := new_unterkonzepte || jsonb_build_array(tag);
        END IF;
      END LOOP;
      new_evolutionskonzepte := '[]'::jsonb;
      FOR tag IN SELECT * FROM jsonb_array_elements(COALESCE(bk_entry->'relevante_evolutionskonzepte_taxonomie', '[]'::jsonb)) LOOP
        v_old_id := tag->>'taxonomyElementId';
        v_new_id := v_redirect->>v_old_id;
        IF v_new_id IS NOT NULL THEN
          new_evolutionskonzepte := new_evolutionskonzepte || jsonb_build_array(jsonb_set(tag, '{taxonomyElementId}', to_jsonb(v_new_id)));
          v_tags_redirected := v_tags_redirected + 1;
        ELSE
          new_evolutionskonzepte := new_evolutionskonzepte || jsonb_build_array(tag);
        END IF;
      END LOOP;
      bk_entry := jsonb_set(bk_entry, '{relevante_unterkonzepte_taxonomie}', new_unterkonzepte);
      bk_entry := jsonb_set(bk_entry, '{relevante_evolutionskonzepte_taxonomie}', new_evolutionskonzepte);
      new_bk_entries := new_bk_entries || jsonb_build_array(bk_entry);
    END LOOP;
    IF obj.content ? 'basiskonzeptbezug' THEN
      UPDATE lpm_data_objects SET content = jsonb_set(content, '{basiskonzeptbezug}', new_bk_entries) WHERE id = obj.id;
      v_objects_touched := v_objects_touched + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Step 1 complete: % Lernziele scanned, % real sub-concept tags redirected', v_objects_touched, v_tags_redirected;

  -- Step 2: relocate real content to its correct or closest-real home
  -- (never deleted).
  -- "Morphologische und anatomische Angepasstheit"  ->  under "Anpassung und Angepasstheit"
  UPDATE lpm_schema_elements SET parent_id = '4f68d0c0-d7e4-4ceb-97d2-330f10713d60' WHERE id = '66a61c3c-2ad8-44b1-8568-9c7fdc388e23';
  -- "Energieaustausch mit der Umwelt"  ->  under "Offene Systeme"
  UPDATE lpm_schema_elements SET parent_id = '5ff075a2-7b3d-4a93-bae7-d75b78a9127b' WHERE id = '4ec2a74e-1c73-46b1-8888-4e5644c43332';
  -- "Energiefluss durch Nahrungsketten"  ->  under "Offene Systeme"
  UPDATE lpm_schema_elements SET parent_id = '5ff075a2-7b3d-4a93-bae7-d75b78a9127b' WHERE id = 'a4f52ebd-a511-417d-8dfa-40028b379690';
  -- "Trophieebenen und Energieverlust"  ->  under "Offene Systeme"
  UPDATE lpm_schema_elements SET parent_id = '5ff075a2-7b3d-4a93-bae7-d75b78a9127b' WHERE id = 'eb7da560-09bc-4b42-8d56-23c90d715723';
  -- "Energieumwandlung"  ->  under "Offene Systeme"
  UPDATE lpm_schema_elements SET parent_id = '5ff075a2-7b3d-4a93-bae7-d75b78a9127b' WHERE id = 'cae3dfc7-1e67-428e-94a3-1bce20a1c28a';
  -- "Stoffaustausch mit der Umwelt"  ->  under "Stoffkreislauf"
  UPDATE lpm_schema_elements SET parent_id = 'a6c1d105-286c-4240-9db6-9c1851ee30fc' WHERE id = 'fea929f6-568f-4630-8de4-84f4aa700f63';
  -- "Stoffumwandlung"  ->  under "Stoffkreislauf"
  UPDATE lpm_schema_elements SET parent_id = 'a6c1d105-286c-4240-9db6-9c1851ee30fc' WHERE id = '0d4c7b1d-0a19-483e-82fc-e5c1cc3a863d';
  -- "Genetischer Code (Transkription/Translation)"  ->  under "Codierung und Decodierung von Information"
  UPDATE lpm_schema_elements SET parent_id = 'e3e511e0-2950-4026-a57e-442c206f75a7' WHERE id = '74009993-fef3-4929-9352-72281d9d03fd';
  -- "Rezeptor-vermittelte Signalübertragung"  ->  under "Signaltransduktion"
  UPDATE lpm_schema_elements SET parent_id = '876b0ce3-b903-4bcc-9364-382a7ceae31e' WHERE id = '2ec2b640-40c1-4d05-b65b-8892ce31ec99';
  -- "Sinnesorgane und Rezeptortypen"  ->  under "Informationsverarbeitung"
  UPDATE lpm_schema_elements SET parent_id = 'c6c8fd2d-6987-447f-9b0c-e86c10084ec5' WHERE id = '8b649947-e0db-469f-bd86-0e451fea77c2';
  -- "Reizweiterleitung und zentrale Verarbeitung"  ->  under "Informationsverarbeitung"
  UPDATE lpm_schema_elements SET parent_id = 'c6c8fd2d-6987-447f-9b0c-e86c10084ec5' WHERE id = 'ffeb5148-e656-44f8-9d71-37de90d75701';
  -- "Reizaufnahme und Reizverarbeitung"  ->  under "Informationsverarbeitung"
  UPDATE lpm_schema_elements SET parent_id = 'c6c8fd2d-6987-447f-9b0c-e86c10084ec5' WHERE id = '4e33eeea-81b4-4cba-ae31-6cb24b5637b6';
  -- "Regelkreis-Struktur (Sollwert, Regler, Regelgröße, Istwert)"  ->  under "negative Rückkopplung"
  UPDATE lpm_schema_elements SET parent_id = '3681e72e-4710-41da-9ccb-046628762706' WHERE id = 'c1077a86-61d9-4917-a401-fbf75065d7ce';
  -- "Negative Rückkopplung (inkl. Homöostase-Prinzip)"  ->  under "negative Rückkopplung"
  UPDATE lpm_schema_elements SET parent_id = '3681e72e-4710-41da-9ccb-046628762706' WHERE id = 'b1a84980-ecba-4199-8157-4be6c4fada55';
  -- "Offener Wirkungskreis (Steuerkette)"  ->  under "Reaktion auf äußere Zustände"
  UPDATE lpm_schema_elements SET parent_id = '8a6b4be3-8942-479b-942f-8fb11bfb7b50' WHERE id = '34ea7533-5d77-426c-b66f-fdfbb80a1064';
  -- "Vorprogrammierte/genetisch determinierte Steuerungsprozesse"  ->  under "Reaktion auf äußere Zustände"
  UPDATE lpm_schema_elements SET parent_id = '8a6b4be3-8942-479b-942f-8fb11bfb7b50' WHERE id = '54e8f1fd-a167-4791-9d4d-900ea9dd05b6';
  -- "Reizaufnahme und Reizverarbeitung"  ->  under "Reaktion auf äußere Zustände"
  UPDATE lpm_schema_elements SET parent_id = '8a6b4be3-8942-479b-942f-8fb11bfb7b50' WHERE id = 'f4420d45-ebba-4c7d-8994-05892789b9b7';
  -- "Wachstum"  ->  under "Lebenszyklus und Entwicklungsphasen"
  UPDATE lpm_schema_elements SET parent_id = '9a7ffac9-3344-468f-99b7-b52c1c002e88' WHERE id = 'cdbe94e3-b8d8-4ad9-843f-58ad11a56faf';
  -- "Seneszenz/Alterung"  ->  under "Lebenszyklus und Entwicklungsphasen"
  UPDATE lpm_schema_elements SET parent_id = '9a7ffac9-3344-468f-99b7-b52c1c002e88' WHERE id = 'fd772680-41ea-4c70-a704-0461d2d5a550';
  -- "Pubertät und Geschlechtsreife"  ->  under "Reproduktion/Fortpflanzung"
  UPDATE lpm_schema_elements SET parent_id = 'd1597cd6-5648-49bc-9ad2-9f27f9f43bc5' WHERE id = '6173fdb3-eb7b-4f23-a49d-586b760416f3';
  -- "Hormonelle Regelkreise der Reifung"  ->  under "Reproduktion/Fortpflanzung"
  UPDATE lpm_schema_elements SET parent_id = 'd1597cd6-5648-49bc-9ad2-9f27f9f43bc5' WHERE id = '1fa2b534-f9e1-4f1a-a7ef-8e73031c185b';
  -- "Metamorphose (vollständige/unvollständige Verwandlung)"  ->  under "Lebenszyklus und Entwicklungsphasen"
  UPDATE lpm_schema_elements SET parent_id = '9a7ffac9-3344-468f-99b7-b52c1c002e88' WHERE id = '99c41e90-ca7d-41d4-a0e4-18d3cf5f4752';
  -- "Direkte und indirekte Entwicklung"  ->  under "Lebenszyklus und Entwicklungsphasen"
  UPDATE lpm_schema_elements SET parent_id = '9a7ffac9-3344-468f-99b7-b52c1c002e88' WHERE id = 'eec14523-684d-46e0-94f6-de6f5e844b42';
  -- "Embryonalentwicklung (Furchung, Gastrulation, Organogenese)"  ->  under "Zelldifferenzierung"
  UPDATE lpm_schema_elements SET parent_id = '77e0949b-32a4-4392-9b4b-f753ce14a851' WHERE id = '923e15db-ca8c-4258-83b2-7973e0e94f2e';
  -- "Zelldifferenzierung und Embryonalentwicklung"  ->  under "Zelldifferenzierung"
  UPDATE lpm_schema_elements SET parent_id = '77e0949b-32a4-4392-9b4b-f753ce14a851' WHERE id = '53dc0a51-e30f-4d75-ac2f-6a77958c66c4';

  -- Step 3: delete the now-childless invented/duplicate nodes. Every id here
  -- was either unreferenced by any real Lernziel, or redirected in Step 1 above.
  -- "Energieentwertung"  (merged into 59dd49f3-1858-4891-bbd8-92c7a008c2af)
  DELETE FROM lpm_schema_elements WHERE id = 'f872506d-e87d-4a4f-bbf5-8798dfd671ff';
  -- "Energetische Kopplung"  (merged into a4fea8b0-1264-43c8-ab4c-ce962327d26a)
  DELETE FROM lpm_schema_elements WHERE id = 'c6074e79-abdd-443e-a40b-fec48bf5133b';
  -- "Stoffkreislauf"  (merged into a6c1d105-286c-4240-9db6-9c1851ee30fc)
  DELETE FROM lpm_schema_elements WHERE id = '3431c9e8-98ab-4498-8888-170ee93567e2';
  -- "Neuronale Codierung von Reizen"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '65a774c4-509a-438a-972e-7f0a7d222092';
  -- "Codierung und Decodierung von Information"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '4bce5ae4-4e79-4187-b439-9964df6df071';
  -- "Second-Messenger-Systeme"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '32a27a90-28e5-4e8d-a71b-e6b657343a2b';
  -- "Signaltransduktion"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '14091b94-7ee4-46a0-b295-a921fdaf448d';
  -- "Positive Rückkopplung"  (merged into 3e44a913-ee29-460c-9966-a383349ac270)
  DELETE FROM lpm_schema_elements WHERE id = 'a3e373fd-fa44-43bf-aa61-3665729fa487';
  -- "Adaptation und Gewöhnung"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '144a648e-82b2-4def-95f0-83198626458b';
  -- "Fließgleichgewicht"  (merged into 52df2759-22a0-44c1-bad9-bdbae69a8c11)
  DELETE FROM lpm_schema_elements WHERE id = 'c6b27ac7-df7d-48b9-8895-6e3806e5fef0';
  -- "Regelung"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = 'f1283353-f4d2-4879-b0ef-70c2bfc46330';
  -- "Steuerung"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = 'c9b101e2-9402-4af0-a9b0-3ee07e3b5267';
  -- "Wachstum und Alterung"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '7d594d83-b60c-4085-a66d-7a75b482e0c0';
  -- "Reproduktion"  (merged into d1597cd6-5648-49bc-9ad2-9f27f9f43bc5)
  DELETE FROM lpm_schema_elements WHERE id = 'd395bfd3-f745-46dd-af9f-d97e2e5550f8';
  -- "Erfahrungsabhängige Plastizität"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '122bb7a6-caa9-4fa4-a559-85feaa251890';
  -- "Modifikation"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '792201f0-3ffc-4e5f-8b24-0109581441a9';
  -- "Lernen und Prägung im Entwicklungsverlauf"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '85f66fa2-6162-4045-9ecb-a292b6336ef5';
  -- "Kompensationsfähigkeit/Regeneration"  (invented, unreferenced, no CSV slot)
  DELETE FROM lpm_schema_elements WHERE id = '4eb36064-fda2-4dc6-b98e-3f800c02f23e';
  -- "Erworbene Anpassungsfähigkeit"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '1c21a85f-e233-427b-b73c-4bf3e1f33cd2';
  -- "Hormonelle Reifung"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '9bc30d9c-a60f-49da-9e76-d3ca61145cb1';
  -- "Lebenszyklus"  (invented header, unreferenced after relocating real children)
  DELETE FROM lpm_schema_elements WHERE id = '2b9ab7d7-941d-4567-a1f5-ffd8efb86bf2';
  -- "Zelldifferenzierung"  (merged into 77e0949b-32a4-4392-9b4b-f753ce14a851)
  DELETE FROM lpm_schema_elements WHERE id = 'a8d8d8b2-939b-49d0-82cb-7db1f0eade94';
  -- "genetische Vererbung"  (merged into 5851bfb6-38a1-46dc-80ea-e97b2d142f2f)
  DELETE FROM lpm_schema_elements WHERE id = '2bd44780-afe9-41e8-8d77-434aa9caf5ce';
  -- "epigenetische Vererbung"  (merged into fe794c62-8a4e-4b54-9221-5e4107d2ef8b)
  DELETE FROM lpm_schema_elements WHERE id = '24b5d301-2f6b-4962-a151-709e15943e41';
  -- "soziale/kulturelle Vererbung"  (merged into df02b3b0-a83a-49e6-9834-f6e799d4d576)
  DELETE FROM lpm_schema_elements WHERE id = '07ba8fb3-bea5-4784-8505-9a070b6d4014';
  -- "ökologische Vererbung"  (merged into e32cd062-e674-46d4-91cd-86541a4a32f5)
  DELETE FROM lpm_schema_elements WHERE id = '1bb4c3a3-4b27-4058-8299-1147ba15a564';
  -- "sexuelle Selektion"  (merged into cac35a85-b91c-43ba-b0d3-b6eec8cecfb2)
  DELETE FROM lpm_schema_elements WHERE id = '9ae7254f-e651-448b-ab64-e9c3021dd459';
END $$;
