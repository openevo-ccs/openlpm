SET search_path = public, extensions;

-- Real feedback, Susan Hanisch 2026-10-02 (5bedf854): "the taxonomy of
-- didactic strategies could still be improved, including the order."
-- Same kind of one-line content edit as migration 068's societal_context
-- update -- no schema change, just the real wording/membership/order of
-- the `methods` option list.
--
-- Changes, each tied to a specific line of her feedback:
-- - Dropped "Einblick in Wissenschaftsgeschichte" -- her own words: "not
--   really a didactic strategy."
-- - "Diskussion" -> "(bioethische) Diskussion" and "Erfahrungsbasiertes
--   Lernen" -> "Erfahrungs-/handlungsorientiertes Lernen", both renames she
--   asked for directly.
-- - Added the four methods she listed: "Gestalterische/kreative Aufgaben",
--   "Außerschulische Lernorte", "Problembasiertes Lernen", "Stationenlernen".
-- - Reordered general approaches first (Forschendes Lernen,
--   Erfahrungs-/handlungsorientiertes Lernen, ...), specific approaches and
--   media after (Analogien, Digitale Medien, außerschulische Lernorte,
--   ...) -- her own stated principle, not a finished taxonomy; she may
--   want it refined further once she sees it live.
--
-- Deliberately NOT attempted here -- real pedagogical-content judgment
-- calls, not a mechanical wording fix, flagged back to Dustin/Susan rather
-- than guessed: making "Konzeptuelles Lernen" substantively distinct from
-- "Analogien und Vergleiche" (feedback e09987a0), and linking each method
-- to the specific Basiskonzepte/Konzeptanker it actually strengthens
-- (feedback 459423b6).
UPDATE prompt_template_libraries
SET option_lists = option_lists || jsonb_build_object(
  'methods', jsonb_build_array(
    'Forschendes Lernen',
    'Erfahrungs-/handlungsorientiertes Lernen',
    'Problembasiertes Lernen',
    'Projektbasiertes Lernen',
    'Kooperative Lernformen',
    'Konzeptuelles Lernen',
    'Analogien und Vergleiche',
    'Narrativer Zugang',
    'Modelle und Simulationen',
    '(bioethische) Diskussion',
    'Digitale Medien',
    'Außerschulische Lernorte',
    'Recherche',
    'Stationenlernen',
    'Gestalterische/kreative Aufgaben'
  )
)
WHERE language = 'de' AND subject_area = 'Biologie';
