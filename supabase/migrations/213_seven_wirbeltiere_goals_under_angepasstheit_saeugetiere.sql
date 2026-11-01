-- 213: seven grade 5/6 learning goals of 2.2.8 Wirbeltiere move into the subtopic
-- "Angepasstheit an Lebensweise und Lebensräume (Säugetiere)".
--
-- Susan Hanisch, feedback 6a11cb1b and d43df476 (2026-10-31): the original CSV left the topic and subtopic cells blank for these seven
-- goals (CSV rows 98 to 104, directly after the first goal of that subtopic). Migration 203 took the subtopic from the goal text, so
-- four goals landed in "Ernährung und Atmung" and three in "Fortpflanzung und Entwicklung". Susan says they all belong to
-- "Angepasstheit an Lebensweise und Lebensräume (Säugetiere)".
--
-- Only the subtopic changes. The goal wording, the order (curriculum_sequence follows her CSV exactly) and every other field stay as
-- they are. The same seven goals exist in the live space and in the sandbox copy; both are changed. Each update names the goal by its
-- CSV id and carries the old subtopic, so running it twice changes nothing.
SET search_path = public, extensions;

DO $$
DECLARE
  new_sub constant text := 'Angepasstheit an Lebensweise und Lebensräume (Säugetiere)';
  changed integer;
BEGIN
  UPDATE lpm_data_objects o
  SET content = jsonb_set(o.content, '{unterthema}', to_jsonb(new_sub)), updated_at = now()
  WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
    AND o.grade_band = '5/6' AND o.status = 'accepted'
    AND o.content ->> 'thema' = '2.2.8 Wirbeltiere'
    AND (
      (o.content ->> 'unterthema' = 'Ernährung und Atmung'
        AND o.content ->> 'id' IN ('MNT56-CSV26B-8-098', 'MNT56-CSV26B-8-099', 'MNT56-CSV26B-8-100', 'MNT56-CSV26B-8-101'))
      OR
      (o.content ->> 'unterthema' = 'Fortpflanzung und Entwicklung'
        AND o.content ->> 'id' IN ('MNT56-CSV26-2.2.8-FOR-ENT', 'MNT56-CSV26B-8-103', 'MNT56-CSV26B-8-104'))
    );
  GET DIAGNOSTICS changed = ROW_COUNT;
  -- Seven goals in each of the two spaces. On a second run nothing is left to change, which is fine.
  IF changed NOT IN (0, 14) THEN
    RAISE EXCEPTION 'migration 213: expected 14 goals (7 per space) or 0 on a re-run, changed %', changed;
  END IF;
  IF (SELECT count(*) FROM lpm_data_objects o
      WHERE o.project_id IN (SELECT id FROM projects WHERE slug IN ('evomentor-thuringia', 'evomentor-thuringia-sandbox'))
        AND o.grade_band = '5/6' AND o.status = 'accepted' AND o.content ->> 'unterthema' = new_sub) <> 2 * 8 THEN
    RAISE EXCEPTION 'migration 213: the subtopic should now hold 8 goals per space (the first goal plus these seven)';
  END IF;
END $$;
