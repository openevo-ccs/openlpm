-- 231: three steps of the EvoMentor tour point at the right place.
--
-- Susan Hanisch, feedback rows of 2026-11-06 on the guided tour "Tour durch die EvoMentor App":
--   * 2eb06e6e: the step "Meine Arbeit" should highlight the section "Meine Arbeit" in the side menu
--     (it highlighted the whole side menu).
--   * 601cf713: the step "Gruppen" should open the Gruppen page and be shown there (it only pointed at the side menu).
--   * 13d22687 (follow-up): "Details zu den Basiskonzepten" was set to the Dashboard tab; it belongs on the Details tab.
-- The code that makes these parts pointable (data-tour marks "sidebar.meine-arbeit", "gruppen.liste", the page "groups") ships in the same pull request.
--
-- Each step is only changed when it still has the exact old values, so a later edit made by an owner in the tour editor is never overwritten, and
-- running this twice changes nothing. Steps are matched by title, so it also applies to a copy of the tour in another space.
SET search_path = public, extensions;

WITH fixed AS (
  SELECT
    g.id,
    s.ord,
    s.step AS old_step,
    CASE
      WHEN s.step ->> 'title' = 'Details zu den Basiskonzepten'
           AND s.step ->> 'page' = 'basiskonzepte'
           AND (s.step -> 'anchor') IS NULL
        THEN jsonb_set(s.step, '{page}', '"basiskonzepte/detail"'::jsonb)
      WHEN s.step ->> 'title' = 'Meine Arbeit'
           AND s.step ->> 'anchor' = 'sidebar'
           AND (s.step -> 'page') IS NULL
        THEN jsonb_set(s.step, '{anchor}', '"sidebar.meine-arbeit"'::jsonb)
      WHEN s.step ->> 'title' = 'Gruppen'
           AND s.step ->> 'anchor' = 'sidebar'
           AND (s.step -> 'page') IS NULL
        THEN s.step || jsonb_build_object('anchor', 'gruppen.liste', 'page', 'groups')
      ELSE s.step
    END AS new_step
  FROM guided_tours g
  CROSS JOIN LATERAL jsonb_array_elements(g.steps) WITH ORDINALITY AS s(step, ord)
  WHERE g.title = 'Tour durch die EvoMentor App'
), agg AS (
  SELECT id, jsonb_agg(new_step ORDER BY ord) AS steps, bool_or(new_step IS DISTINCT FROM old_step) AS changed
  FROM fixed
  GROUP BY id
)
UPDATE guided_tours g
SET steps = agg.steps
FROM agg
WHERE g.id = agg.id
  AND agg.changed;

-- Rollback (restores the old pointers):
--   UPDATE guided_tours SET steps = ... set "page" of "Details zu den Basiskonzepten" back to "basiskonzepte", the anchor of "Meine Arbeit" and "Gruppen" back to "sidebar", and remove "page" from "Gruppen".
