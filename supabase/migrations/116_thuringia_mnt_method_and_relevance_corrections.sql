SET search_path = public, extensions;

-- Real feedback (Susan Hanisch, 2026-10-09/10, rows f88d8f01, 74be95c7,
-- 72134219, 97750bd9, 9a4d1c28): five specific, named content corrections
-- on real Thuringia MNT Lernziele. Each one is Susan telling us the exact
-- correct value herself (a subject-matter expert's own review), not a
-- guess -- this migration applies exactly what she said, nothing more.
--
-- While tracking these down, found that the method "(bioethische)
-- Diskussion" was used as a rang-3 filler on 91 real Lernziele total, not
-- just these four -- almost certainly a systemic default from whatever
-- process first generated this content, not 91 independent mistakes. This
-- migration deliberately touches only the 4 Susan actually reviewed and
-- flagged; the other 87 are real, not touched here, and would need their
-- own review pass before any of them should change.

-- f88d8f01: "Enzymatische Stärkespaltung nachweisen" -- the rang-3 entry
-- is phrased as a bare question ("Warum haben Menschen mehr Amylasegene
-- als Schimpansen?"), not a method/activity description, and this
-- Lernziel already has its own, different, good Leitfrage in
-- evolutionsdidaktischer_impuls. Susan: "this example is more appropriate
-- as a Leitfrage" -- since a real Leitfrage already exists here, the
-- right fix is dropping this redundant rang-3 entry rather than writing a
-- second one, leaving 2 real methods instead of 3.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden}',
  (content->'didaktische_strategien'->'top3_methoden') - 2
)
WHERE id = '3782189c-a5fb-59ed-8b4d-829f35afa656'
  AND content->'didaktische_strategien'->'top3_methoden'->2->>'methode' = '(bioethische) Diskussion';

-- 74be95c7: "Insektenstaat erläutern" -- the rang-3 entry is literally an
-- analogy/comparison exercise ("Analogie und Abgrenzung: Vergleich des
-- Insektenstaates mit einer menschlichen Gesellschaft..."), mislabeled as
-- bioethical discussion. Susan: "this example should definitely be
-- categorized as 'Analogien und Vergleiche'". Text unchanged, only the
-- method label.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden,2,methode}',
  '"Analogien und Vergleiche"'
)
WHERE id = '21f94a7e-8a81-51a6-9fa9-601863d4b49e'
  AND content->'didaktische_strategien'->'top3_methoden'->2->>'methode' = '(bioethische) Diskussion';

-- 97750bd9: "Insekten: Angepasstheit Fortbewegung" -- the rang-3 entry's
-- own text already names "Einblick in die Natur der Wissenschaft" (a
-- nature-of-science framing: students research two competing hypotheses
-- about insect wing origins and weigh the evidence), mislabeled as
-- bioethical discussion. Susan: "this is not really a method that fits
-- the category of discussion, rather it's forschendes lernen or nature of
-- science" -- "Forschendes Lernen" is the closest real category in this
-- app's controlled vocabulary (there is no separate "Nature of Science"
-- method). Text unchanged, only the method label.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden,2,methode}',
  '"Forschendes Lernen"'
)
WHERE id = '64eba29c-e79b-5ac9-b240-278d4784ce3b'
  AND content->'didaktische_strategien'->'top3_methoden'->2->>'methode' = '(bioethische) Diskussion';

-- 72134219: "Insektenordnungen unterscheiden" -- the rang-3 entry
-- ("Besuch eines Naturkundemuseums oder Nutzung digitaler
-- Insektensammlungen zur Vertiefung") bundles two genuinely different
-- activities into one generic "Erfahrungs-/handlungsorientiertes Lernen"
-- entry. Susan: "this example should be categorized as two different
-- methods: Außerschulische Lernorte (Besuch Naturkundemuseum) and
-- digitale Medien (Nutzung digitaler Insektensammlungen - do you have a
-- specific website or platform to suggest here?)". Split into two real
-- entries, keeping her exact split. Her platform question is left open --
-- naming a specific real website/tool isn't something to invent here.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden}',
  ((content->'didaktische_strategien'->'top3_methoden') - 2) || jsonb_build_array(
    jsonb_build_object(
      'rang', 3, 'favorit', false, 'methode', 'Außerschulische Lernorte',
      'beschreibung', 'Besuch eines Naturkundemuseums zur Vertiefung.'
    ),
    jsonb_build_object(
      'rang', 4, 'favorit', false, 'methode', 'Digitale Medien',
      'beschreibung', 'Nutzung digitaler Insektensammlungen zur Vertiefung (konkrete Plattform noch offen).'
    )
  )
)
WHERE id = '5c2e5bc2-b8b3-5e55-89cc-beb1c1c5ee5c'
  AND content->'didaktische_strategien'->'top3_methoden'->2->>'methode' = 'Erfahrungs-/handlungsorientiertes Lernen';

-- 9a4d1c28: "Stabilität durch Struktur- und Artenvielfalt begründen" --
-- the Struktur-und-Funktion relevance entry's own begründung text
-- explicitly argues a direct structural-functional link to ecosystem
-- stability, but was rated "mittel" (2/3). Susan: "seems like this
-- learning goal should then be rated highly relevant for this concept" --
-- raising it to "hoch" (3/3) matches what its own justification already
-- says. Begründung text unchanged, only the rating.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{basiskonzeptbezug,2,relevanz_beurteilung}',
  '3'
)
WHERE id = '811162f7-107e-5b84-943c-ce1fbb257c2b'
  AND content->'basiskonzeptbezug'->2->>'basiskonzept_id' = 'bk_struktur_funktion';
