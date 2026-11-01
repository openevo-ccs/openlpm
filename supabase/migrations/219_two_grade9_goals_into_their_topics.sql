-- 219: two grade 9 goals of EvoMentor Thüringen get their topic and subtopic.
--
-- Susan Hanisch, 2026-11-02:
--   "Ertragssteigerung: optimale Temperatur begründen" belongs to the topic "Stoff- und Energiewechselprozesse von Pilzen und grünen Pflanzen",
--   subtopic "Grüne Pflanzen: Fotosynthese" (its last goal).
--   "Biotische Wechselbeziehung: Konkurrenz" belongs to the topic "Ökologie", subtopic "Wechselwirkungen zwischen Organismen und ihrer Umwelt"
--   (its last goal).
-- Both goals had no topic and no subtopic. Their place in the order was already right (directly after the last goal of that subtopic), so only
-- the two fields change. The grade 9 order is then numbered 0 to 47 without fractions or gaps (the two goals had 11.5 and 35.5), in the live
-- space and the sandbox copy. The structure nodes of the Thuringia repository (migration 216) filed the two goals under an empty-titled node
-- "Weitere Lernziele"; they move to the nodes of their subtopics, and that node is removed once it holds no goal.
-- The edition tag and the edition link are left alone: whether both goals are part of the 2026 Erprobungsfassung is a question for Susan.
-- Running this twice changes nothing.
SET search_path = public, extensions;

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('thema', 'Stoff- und Energiewechselprozesse von Pilzen und grünen Pflanzen', 'unterthema', 'Grüne Pflanzen: Fotosynthese'),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND o.grade_band = '9' AND o.status = 'accepted'
  AND o.title = 'Ertragssteigerung: optimale Temperatur begründen'
  AND (o.content ->> 'thema') IS NULL;

UPDATE lpm_data_objects o
SET content = o.content || jsonb_build_object('thema', 'Ökologie', 'unterthema', 'Wechselwirkungen zwischen Organismen und ihrer Umwelt'),
    updated_at = now()
WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
  AND o.grade_band = '9' AND o.status = 'accepted'
  AND o.title = 'Biotische Wechselbeziehung: Konkurrenz'
  AND (o.content ->> 'thema') IS NULL;

WITH ranked AS (
  SELECT id, (row_number() OVER (PARTITION BY project_id ORDER BY curriculum_sequence, id) - 1) AS rn
  FROM lpm_data_objects
  WHERE project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND grade_band = '9' AND status = 'accepted'
)
UPDATE lpm_data_objects o
SET curriculum_sequence = r.rn, updated_at = now()
FROM ranked r
WHERE o.id = r.id AND o.curriculum_sequence IS DISTINCT FROM r.rn;

-- Structure nodes of the Thuringia repository: move the two goals out of "Weitere Lernziele" into their subtopic nodes.
WITH repo AS (SELECT id FROM projects WHERE slug = 'thuringia-curriculum-repository'),
nodes AS (
  SELECT n.id, n.node_key FROM curriculum_repository_structure_nodes n, repo
  WHERE n.project_id = repo.id
    AND n.node_key IN (
      'DE-TH/biologie-gymnasium-2026/9/stoff-und-energiewechselprozesse-von-pilzen-und/gruene-pflanzen-fotosynthese-1',
      'DE-TH/biologie-gymnasium-2026/9/oekologie/wechselwirkungen-zwischen-organismen-und-ihrer-u-0',
      'DE-TH/biologie-gymnasium-2026/9/weitere-lernziele/ohne-titel-0')
),
goals AS (
  SELECT o.id AS goal_id, o.project_id,
         CASE o.title WHEN 'Ertragssteigerung: optimale Temperatur begründen'
              THEN 'DE-TH/biologie-gymnasium-2026/9/stoff-und-energiewechselprozesse-von-pilzen-und/gruene-pflanzen-fotosynthese-1'
              ELSE 'DE-TH/biologie-gymnasium-2026/9/oekologie/wechselwirkungen-zwischen-organismen-und-ihrer-u-0' END AS target_key
  FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.grade_band = '9' AND o.status = 'accepted'
    AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz')
)
INSERT INTO curriculum_repository_node_goals (node_id, data_object_id, project_id)
SELECT t.id, g.goal_id, g.project_id FROM goals g JOIN nodes t ON t.node_key = g.target_key
ON CONFLICT DO NOTHING;

DELETE FROM curriculum_repository_node_goals ng
USING curriculum_repository_structure_nodes n, lpm_data_objects o
WHERE ng.node_id = n.id AND ng.data_object_id = o.id
  AND n.node_key = 'DE-TH/biologie-gymnasium-2026/9/weitere-lernziele/ohne-titel-0'
  AND o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz');

DELETE FROM curriculum_repository_structure_nodes n
WHERE n.node_key IN ('DE-TH/biologie-gymnasium-2026/9/weitere-lernziele/ohne-titel-0', 'DE-TH/biologie-gymnasium-2026/9/weitere-lernziele')
  AND n.project_id = (SELECT id FROM projects WHERE slug = 'thuringia-curriculum-repository')
  AND NOT EXISTS (SELECT 1 FROM curriculum_repository_node_goals ng WHERE ng.node_id = n.id);

DO $$
DECLARE placed integer; filed integer; maxseq numeric; cnt integer;
BEGIN
  SELECT count(*) INTO placed FROM lpm_data_objects o
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.grade_band = '9' AND o.status = 'accepted'
    AND ((o.title = 'Ertragssteigerung: optimale Temperatur begründen' AND o.content ->> 'unterthema' = 'Grüne Pflanzen: Fotosynthese')
      OR (o.title = 'Biotische Wechselbeziehung: Konkurrenz' AND o.content ->> 'unterthema' = 'Wechselwirkungen zwischen Organismen und ihrer Umwelt'));
  SELECT count(*) INTO filed FROM curriculum_repository_node_goals ng
  JOIN curriculum_repository_structure_nodes n ON n.id = ng.node_id
  JOIN lpm_data_objects o ON o.id = ng.data_object_id
  WHERE o.title IN ('Ertragssteigerung: optimale Temperatur begründen', 'Biotische Wechselbeziehung: Konkurrenz')
    AND n.node_key NOT LIKE '%weitere-lernziele%' AND o.grade_band = '9';
  SELECT max(curriculum_sequence), count(*) INTO maxseq, cnt FROM lpm_data_objects
  WHERE project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia') AND grade_band = '9' AND status = 'accepted';
  IF placed <> 4 OR filed <> 4 OR maxseq <> cnt - 1 THEN
    RAISE EXCEPTION 'migration 219: placed % of 4, filed % of 4, grade 9 highest number % for % goals', placed, filed, maxseq, cnt;
  END IF;
END $$;
