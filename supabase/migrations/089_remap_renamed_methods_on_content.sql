SET search_path = public, extensions;

-- Real feedback ee644d5d (Susan Hanisch, 2026-10-02), second half: "you will
-- have to remap some of these added methods to the learning goals."
-- Migration 078 renamed/retired method names in the *vocabulary*
-- (prompt_template_libraries.option_lists.methods) but never touched the
-- method tags already sitting on real content
-- (lpm_data_objects.content.didaktische_strategien.top3_methoden[].methode)
-- -- checked live 2026-10-03: 156 real items still say 'Diskussion', 50 still
-- say 'Erfahrungsbasiertes Lernen', 28 still say 'Einblick in
-- Wissenschaftsgeschichte' (a category 078 dropped outright, Susan's own
-- words: "not really a didactic strategy"). Every one of those tags is
-- invisible to the Lernziele page's own method filter now, since the filter
-- only offers the current vocabulary's names.
--
-- Mechanical only: renames two tags to their new names, drops the retired
-- one (no substitute guessed -- Susan already said it isn't a real
-- strategy). Tagging the 4 brand-new methods (Problembasiertes Lernen,
-- Gestalterische/kreative Aufgaben, Außerschulische Lernorte,
-- Stationenlernen) onto specific learning goals is real subject-matter
-- judgment -- deliberately NOT attempted here, same reasoning as 078's own
-- carve-out for e09987a0/459423b6.
--
-- Idempotent: the WHERE EXISTS guard only matches rows still carrying one of
-- the three old strings, so a second run touches nothing.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'methode' = 'Diskussion' THEN jsonb_set(elem, '{methode}', to_jsonb('(bioethische) Diskussion'::text))
        WHEN elem->>'methode' = 'Erfahrungsbasiertes Lernen' THEN jsonb_set(elem, '{methode}', to_jsonb('Erfahrungs-/handlungsorientiertes Lernen'::text))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(content->'didaktische_strategien'->'top3_methoden') elem
    WHERE elem->>'methode' <> 'Einblick in Wissenschaftsgeschichte'
  ), '[]'::jsonb)
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(content->'didaktische_strategien'->'top3_methoden') e
  WHERE e->>'methode' IN ('Diskussion', 'Erfahrungsbasiertes Lernen', 'Einblick in Wissenschaftsgeschichte')
);
