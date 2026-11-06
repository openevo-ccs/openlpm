-- 201: factual correction in the Klasse 5/6 Lernziel "Wasseraufnahme und -transport beschreiben".
--
-- Susan Hanisch, feedback af3a1cd2 (2026-10-29): the reason given for the Basiskonzept
-- "Evolutive Entwicklung" said that roots take up carbon dioxide. They do not. Roots take up
-- water and the minerals dissolved in it. Carbon dioxide enters through the stomata of the
-- leaves, which the Lernziel text itself says, and which the reason for "Stoff- und
-- Energieumwandlung" in the same record already states correctly.
--
-- Only the first clause of that one reason is rewritten; the rest of the paragraph stays as it
-- was. The same record exists in the live space (evomentor-thuringia) and in the sandbox copy
-- (evomentor-thuringia-sandbox, different id). Both are fixed. The WHERE clause matches only a
-- record that still contains the wrong clause, so running this twice changes nothing.
--
-- Check after applying: this should return 0 rows.
--   SELECT id FROM lpm_data_objects WHERE content::text LIKE '%Wurzeln Kohlenstoffdioxid und vor allem Wasser%';

UPDATE lpm_data_objects
SET content = jsonb_set(
      content,
      '{basiskonzeptbezug}',
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN elem ->> 'basiskonzept_id' = 'bk_evolutive_entwicklung'
                   THEN jsonb_set(
                          elem,
                          '{begruendung}',
                          to_jsonb(replace(
                            elem ->> 'begruendung',
                            'Dass Wurzeln Kohlenstoffdioxid und vor allem Wasser',
                            'Dass Wurzeln Wasser und darin gelöste Mineralstoffe'
                          ))
                        )
                   ELSE elem
                 END
                 ORDER BY ord
               )
        FROM jsonb_array_elements(content -> 'basiskonzeptbezug') WITH ORDINALITY AS t(elem, ord)
      )
    ),
    updated_at = now()
WHERE id IN (
        '9fc5fa06-610c-5212-aac5-cf05c7bcb300',  -- evomentor-thuringia
        '75c73376-0ec7-4369-a218-6b03eb2ac54e'   -- evomentor-thuringia-sandbox
      )
  AND content::text LIKE '%Dass Wurzeln Kohlenstoffdioxid und vor allem Wasser%';
