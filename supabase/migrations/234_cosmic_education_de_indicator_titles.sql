-- 234: German indicator titles in Cosmic Education LPM (Deutsch) read "Universums · GB-1.1" (genitive form of the strand name).
-- Changes them to "Universum", "Leben", "Mensch". Titles only. Running this twice changes nothing.
SET search_path = public, extensions;

UPDATE lpm_data_objects o
SET title = CASE split_part(o.title, ' · ', 1)
              WHEN 'Universums' THEN 'Universum'
              WHEN 'Lebens' THEN 'Leben'
              WHEN 'Menschen' THEN 'Mensch'
            END || ' · ' || split_part(o.title, ' · ', 2)
WHERE o.object_type = 'performance_indicator'
  AND o.project_id = (SELECT id FROM projects WHERE slug = 'cosmic-education-lpm-de')
  AND split_part(o.title, ' · ', 1) IN ('Universums', 'Lebens', 'Menschen');
