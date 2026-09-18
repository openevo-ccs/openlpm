SET search_path = public, extensions;

-- Harvests real material from EvoMentor_DE's data/thuringia_2026_lp_data/
-- (pulled into that repo 2026-09-06, analyzed 2026-09-10, never committed
-- there or brought into OpenLPM -- see Dustin's 2026-09-18 call: EvoMentor/
-- EvoMentor_DE are being retired once OpenLPM covers their ground, so this
-- harvests the useful content directly rather than fixing up a repo that's
-- going away).
--
-- Two real source documents:
-- 1. "Basiskonzepte Taxonomie - Sheet1.csv" -- a materially richer 3-level
--    concept hierarchy (Basiskonzept -> Unterkonzept1 -> Unterkonzept2)
--    than what's in the live evomentor-thuringia project's tagged content
--    today, 70 rows, all 6 Basiskonzepte covered.
-- 2. "LP Thüringen Bio Änderungen 2024-2026.csv" -- a real row-by-row diff
--    against Thuringia's own 2026 Erprobungsfassung (trial curriculum),
--    confirming (per the 2026-09-10 analysis) the 6 core Basiskonzepte
--    themselves are untouched -- changes are all at the learning-objective
--    level.
--
-- Deliberately safe/idempotent: no live read access to the real
-- evomentor-thuringia project's current rows was available this session
-- (RLS correctly blocks the anon key without a real login), so every
-- INSERT below finds-or-creates by label/project rather than assuming any
-- specific existing id -- running this twice, or after other real content
-- already exists, does not duplicate anything.
--
-- Scope, deliberately narrow: only the taxonomy (safe, additive, no
-- ambiguity) and the two genuinely NEW curriculum items the changes CSV
-- shows (2024 column empty, 2026 column has real content) are inserted
-- here. The remaining ~15 changes are wording refinements to EXISTING
-- items (e.g. "Lebensmittelampel" -> "Nutri-Score", added "Konkurrenz" to
-- an existing Wechselbeziehungen list) -- blind-matching those against
-- live rows this session can't see risks silently editing the wrong row,
-- so they're left as a documented follow-up (see the design note this
-- migration's own commit links to) for whoever next has real DB read
-- access, not attempted here.

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping harvest (nothing to attach it to)';
    RETURN;
  END IF;

  -- ===========================================================
  -- Part 1: the richer 3-level Basiskonzepte taxonomy
  -- ===========================================================

  CREATE TEMP TABLE _taxonomy_import (basiskonzept TEXT, unterkonzept1 TEXT, unterkonzept2 TEXT) ON COMMIT DROP;

  INSERT INTO _taxonomy_import (basiskonzept, unterkonzept1, unterkonzept2) VALUES
    ('Evolutive Entwicklung', 'Variation und Diversität', 'genetische Variation'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'phänotypische Variation'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'Modifikation'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'Rekombination'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'Gentransfer'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'Epigenetik'),
    ('Evolutive Entwicklung', 'Variation und Diversität', 'Phänotypische Plastizität'),
    ('Evolutive Entwicklung', 'Vererbung von Merkmalen', 'genetische'),
    ('Evolutive Entwicklung', 'Vererbung von Merkmalen', 'epigenetische'),
    ('Evolutive Entwicklung', 'Vererbung von Merkmalen', 'soziale/kulturelle'),
    ('Evolutive Entwicklung', 'Vererbung von Merkmalen', 'ökologische'),
    ('Evolutive Entwicklung', 'Natürliche Selektion und Selektionsdruck', 'stabilisierende Selektion'),
    ('Evolutive Entwicklung', 'Natürliche Selektion und Selektionsdruck', 'gerichtete Selektion'),
    ('Evolutive Entwicklung', 'Natürliche Selektion und Selektionsdruck', 'balancierende Selektion'),
    ('Evolutive Entwicklung', 'Natürliche Selektion und Selektionsdruck', 'frequenzabhängige Selektion'),
    ('Evolutive Entwicklung', 'Natürliche Selektion und Selektionsdruck', 'Trade-offs/Zielkonflikte'),
    ('Evolutive Entwicklung', 'Sexuelle Selektion', NULL),
    ('Evolutive Entwicklung', 'Fitness', NULL),
    ('Evolutive Entwicklung', 'Anpassung und Angepasstheit', 'Funktion von Merkmalen'),
    ('Evolutive Entwicklung', 'Anpassung und Angepasstheit', 'Exaptation (Umfunktionieren von Merkmalen)'),
    ('Evolutive Entwicklung', 'Anpassung und Angepasstheit', 'Evolutionäres Mismatch'),
    ('Evolutive Entwicklung', 'Gendrift', NULL),
    ('Evolutive Entwicklung', 'Migration/Genfluss', NULL),
    ('Evolutive Entwicklung', 'Flaschenhalseffekt', NULL),
    ('Evolutive Entwicklung', 'Gründereffekt', NULL),
    ('Evolutive Entwicklung', 'Lebensgeschichte / Life-History-Theorie', NULL),
    ('Evolutive Entwicklung', 'Koevolution', NULL),
    ('Evolutive Entwicklung', 'Koevolution', 'Domestikation'),
    ('Evolutive Entwicklung', 'Nischenkonstruktion', NULL),
    ('Evolutive Entwicklung', 'Multilevel-Selektion', 'Endosymbiontentheorie'),
    ('Evolutive Entwicklung', 'Multilevel-Selektion', 'Evolution von Einzellern zu Vielzellern'),
    ('Evolutive Entwicklung', 'Multilevel-Selektion', 'Verwandtenselektion'),
    ('Evolutive Entwicklung', 'Multilevel-Selektion', 'Evolution von Kooperation/Altruismus'),
    ('Evolutive Entwicklung', 'Multilevel-Selektion', 'Evolutionäre Prozesse innerhalb von Organismen'),
    ('Evolutive Entwicklung', 'Tiefenzeit', 'geologische Epochen'),
    ('Evolutive Entwicklung', 'Tiefenzeit', 'Fossilien'),
    ('Evolutive Entwicklung', 'Tiefenzeit', 'Übergangsformen/Entwicklungslinien'),
    ('Evolutive Entwicklung', 'Stammbäume und phylogenetische Systematik', 'gemeinsame Abstammung/Verwandtschaft'),
    ('Evolutive Entwicklung', 'Konservierung von Merkmalen (gemeinsame genetische Grundlagen, Baupläne, Entwicklungsprozesse usw.)', NULL),
    ('Evolutive Entwicklung', 'Homologie und Analogie/Konvergente und divergente Evolution', NULL),
    ('Evolutive Entwicklung', 'Artbildung und adaptive Radiation', NULL),
    ('Evolutive Entwicklung', 'Aussterben', NULL),
    ('Evolutive Entwicklung', 'Evolutionäre Entwicklungsbiologie (Evo-Devo)', 'biogenetische Grundregel'),
    ('Evolutive Entwicklung', 'kulturelle Evolution', NULL),
    ('Individuelle Entwicklung', 'Zellteilung', NULL),
    ('Individuelle Entwicklung', 'Zelldifferenzierung', NULL),
    ('Individuelle Entwicklung', 'Lebenszyklus und Entwicklungsphasen', NULL),
    ('Individuelle Entwicklung', 'Modifikation und Plastizität', NULL),
    ('Individuelle Entwicklung', 'Lernen und Prägung', NULL),
    ('Individuelle Entwicklung', 'Reproduktion/Fortpflanzung', NULL),
    ('Struktur und Funktion', 'Anpassung und Angepasstheit', NULL),
    ('Struktur und Funktion', 'Kompartimentierung', NULL),
    ('Struktur und Funktion', 'Schlüssel-Schloss-Prinzip', NULL),
    ('Struktur und Funktion', 'Oberflächenvergrößerung', NULL),
    ('Struktur und Funktion', 'Gegenstromprinzip', NULL),
    ('Struktur und Funktion', 'Gegenspielerprinzip', NULL),
    ('Stoff- und Energieumwandlung', 'Fließgleichgewicht', NULL),
    ('Stoff- und Energieumwandlung', 'Stoffkreislauf', NULL),
    ('Stoff- und Energieumwandlung', 'Offene Systeme', NULL),
    ('Stoff- und Energieumwandlung', 'Energieentwertung', NULL),
    ('Stoff- und Energieumwandlung', 'energetische Kopplung', NULL),
    ('Information und Kommunikation', 'Informationsverarbeitung', 'Signaltransduktion'),
    ('Information und Kommunikation', 'Informationsverarbeitung', 'Codierung und Decodierung von Information'),
    ('Information und Kommunikation', 'Kommunikation zwischen Organismen', NULL),
    ('Information und Kommunikation', 'Kommunikation innerhalb eines Organismus', NULL),
    ('Steuerung und Regelung', 'positive Rückkopplung', NULL),
    ('Steuerung und Regelung', 'negative Rückkopplung', 'Homöostase'),
    ('Steuerung und Regelung', 'Fließgleichgewicht', NULL),
    ('Steuerung und Regelung', 'Reaktion auf äußere Zustände', NULL);

  -- Level 1: the 6 Basiskonzepte themselves (find-or-create -- may already
  -- exist as real schema_elements from the original EvoMentor import).
  -- NULL must be cast explicitly here: SELECT DISTINCT forces a concrete
  -- type onto every output column to make the row comparable for
  -- deduplication, and an untyped NULL defaults to text in that position --
  -- which Postgres then refuses to implicitly assign into the uuid
  -- parent_id column, even though the value itself is NULL either way.
  INSERT INTO lpm_schema_elements (project_id, element_type, label, parent_id, status)
  SELECT DISTINCT v_project_id, 'concept', t.basiskonzept, NULL::uuid, 'accepted'
  FROM _taxonomy_import t
  WHERE NOT EXISTS (
    SELECT 1 FROM lpm_schema_elements e
    WHERE e.project_id = v_project_id AND e.label = t.basiskonzept AND e.parent_id IS NULL
  );

  -- Level 2: Unterkonzept1, parented under its real Basiskonzept row.
  INSERT INTO lpm_schema_elements (project_id, element_type, label, parent_id, status)
  SELECT DISTINCT v_project_id, 'concept', t.unterkonzept1, bk.id, 'accepted'
  FROM _taxonomy_import t
  JOIN lpm_schema_elements bk ON bk.project_id = v_project_id AND bk.label = t.basiskonzept AND bk.parent_id IS NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM lpm_schema_elements e
    WHERE e.project_id = v_project_id AND e.label = t.unterkonzept1 AND e.parent_id = bk.id
  );

  -- Level 3: Unterkonzept2, parented under its real Unterkonzept1 row.
  INSERT INTO lpm_schema_elements (project_id, element_type, label, parent_id, status)
  SELECT DISTINCT v_project_id, 'concept', t.unterkonzept2, uk1.id, 'accepted'
  FROM _taxonomy_import t
  JOIN lpm_schema_elements bk ON bk.project_id = v_project_id AND bk.label = t.basiskonzept AND bk.parent_id IS NULL
  JOIN lpm_schema_elements uk1 ON uk1.project_id = v_project_id AND uk1.label = t.unterkonzept1 AND uk1.parent_id = bk.id
  WHERE t.unterkonzept2 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lpm_schema_elements e
    WHERE e.project_id = v_project_id AND e.label = t.unterkonzept2 AND e.parent_id = uk1.id
  );

  -- ===========================================================
  -- Part 2: the two genuinely NEW curriculum items from the real
  -- 2024->2026 Erprobungsfassung diff (2024 column empty, 2026 column
  -- real -- not a reworded existing item). Landed as drafts, same
  -- convention every other importer already uses -- a human reviews from
  -- Browse before these count as real, visible content.
  -- ===========================================================

  IF NOT EXISTS (
    SELECT 1 FROM lpm_data_objects
    WHERE project_id = v_project_id AND title LIKE 'Einzellern zu Vielzellern%'
  ) THEN
    INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, status)
    SELECT v_project_id, 'performance_indicator',
      'Einzellern zu Vielzellern (Grünalgen)',
      'die Entwicklung von Einzellern zu Vielzellern am Beispiel der Grünalgen erläutern',
      '7/8', 'Biologie',
      jsonb_build_object(
        'originaltext', 'die Entwicklung von Einzellern zu Vielzellern am Beispiel der Grünalgen erläutern',
        'quelle', 'LP Thüringen Biologie Gymnasium, Erprobungsfassung 2026 -- neu gegenüber 2024',
        'basiskonzeptbezug', jsonb_build_array(
          jsonb_build_object(
            'basiskonzept_id', bk.id,
            'relevanz_beurteilung', 3,
            'begruendung', 'Der Übergang von Einzellern zu Vielzellern ist ein zentrales Beispiel für Multilevel-Selektion -- Selektion wirkt hier auf mehreren biologischen Ebenen zugleich (Zelle und entstehender Organismus).',
            'relevante_unterkonzepte_taxonomie', jsonb_build_array(jsonb_build_object('value', 'Evolution von Einzellern zu Vielzellern', 'taxonomyElementId', uk2.id))
          )
        )
      ),
      'draft'
    FROM lpm_schema_elements bk
    JOIN lpm_schema_elements uk1 ON uk1.parent_id = bk.id AND uk1.label = 'Multilevel-Selektion'
    JOIN lpm_schema_elements uk2 ON uk2.parent_id = uk1.id AND uk2.label = 'Evolution von Einzellern zu Vielzellern'
    WHERE bk.project_id = v_project_id AND bk.label = 'Evolutive Entwicklung' AND bk.parent_id IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM lpm_data_objects
    WHERE project_id = v_project_id AND title LIKE 'Ökosysteme nach Kriterien einteilen%'
  ) THEN
    INSERT INTO lpm_data_objects (project_id, object_type, title, description, grade_band, subject_area, content, status)
    VALUES (
      v_project_id, 'performance_indicator',
      'Ökosysteme nach Kriterien einteilen',
      'Ökosysteme nach ausgewählten Kriterien einteilen',
      '9/10', 'Biologie',
      jsonb_build_object(
        'originaltext', 'Ökosysteme nach ausgewählten Kriterien einteilen',
        'quelle', 'LP Thüringen Biologie Gymnasium, Erprobungsfassung 2026 -- neu gegenüber 2024',
        'basiskonzeptbezug', jsonb_build_array()
      ),
      'draft'
    );
  END IF;
END $$;
