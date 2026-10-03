SET search_path = public, extensions;

-- Stage 1 of the MNT 2026 integration plan (see lab_manager/docs/
-- design-notes/thuringia-mnt-2026-item-level-comparison-2026-10-02.md):
-- the genuinely NEW grade 5/6 MNT content the 2026 Erprobungsfassung adds,
-- compared item-by-item against the live project's 2015-sourced baseline
-- (EvoMentor_DE/data/lernziele_MNT56.json, 121 items). Deliberately safe
-- and additive only -- nothing here edits or retags any existing row,
-- because this session still has no live read access to lpm_data_objects
-- (a real grant gap, just fixed in migration 085, not yet pushed as of
-- this file's writing) to safely match against what's already there.
-- Stage 2 (re-tagging the ~19 items that moved to a different Lernbereich,
-- and rewording the ~29 that are the same content with modified scope) and
-- Stage 3 (resolving the ~41 items with no 2026 counterpart -- moved to a
-- later grade, or genuinely cut) both need that live-matching step and are
-- deliberately NOT attempted here.
--
-- 7 new items, all status='draft', all tagged content.curriculum_version
-- so they're clearly distinguishable from the 2015-sourced content and
-- safe to find-or-create by title (idempotent, same discipline as 028):
--   - 4 Bionik case studies (2.2.10.1-10.4): the 2015 curriculum taught
--     only the general method + one open "pick your own example" project;
--     2026 mandates four specific, fully worked examples. None of the 4
--     has a real 2015 counterpart at this level of detail.
--   - 1 Kohaesion/Adhaesion item: the 2015 curriculum had a bare
--     "Kapillaritaet" experiment (already live) with no surrounding
--     Kohaesion/Adhaesion concept vocabulary at all -- 2026 builds a
--     whole named Lernbereich (2.2.5) around it. This item is the new
--     conceptual surround; the existing Kapillaritaet experiment itself
--     is NOT duplicated here (Stage 2's job, since it needs to be
--     RE-TAGGED to this Lernbereich, not re-inserted).
--   - 2 new health-education items: explicit acceptance of different
--     sexual orientations/identities, and contraception methods -- real
--     additions to Sexualitaet und Fortpflanzung with no 2015 precedent
--     at all (as opposed to the existing items in that subsection, which
--     are Stage 2 reword candidates, not new inserts).

DO $$
DECLARE
  v_project_id UUID;
  v_existing_count INT;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping MNT 2026 new-content insert';
    RETURN;
  END IF;

  -- ===========================================================
  -- Bionik: 4 named case studies (2.2.10.1-10.4)
  -- ===========================================================

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bionik: Der Klettverschluss';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bionik: Der Klettverschluss',
      'Schuelerinnen und Schueler koennen die Schrittfolge der Bionik am Beispiel des Klettverschlusses erlaeutern und das biologische Vorbild mit der technischen Umsetzung vergleichen.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.10.1 Bionik - Der Klettverschluss',
        'originaltext', 'Vorbild: Klettfrucht, die am Fell von Tieren haften bleibt, sich aber loesen laesst. Prinzip: biegsame Widerhaken, die bei Verhakung nicht abbrechen und sich immer wieder erneut verhaken koennen. Funktionsmodell: zwei Kunststoffstreifen, wovon einer flexible Widerhaekchen, der andere Schlaufen hat; geprueft auf Material, Zugbelastung, Haltbarkeit. Uebertragen: Klettverschluss fuer Schuhe und Jacken, der leicht und beliebig haeufig zu oeffnen und zu schliessen ist. Fachpraktisch: Fruechte einer Klettfrucht (Widerhaken) sowie Haft- und Klettband eines Klettverschlusses (z. B. aus Polyamid) mit der Lupe betrachten.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.10.1',
        'note_2015_baseline', 'Kein direktes 2015-Gegenstueck -- 2015 kannte nur die allgemeine Bionik-Methode und ein offenes Projekt, kein benanntes Klettverschluss-Fallbeispiel.'
      ),
      'draft', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bionik: Die Leichtbauweise';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bionik: Die Leichtbauweise',
      'Schuelerinnen und Schueler koennen die Schrittfolge der Bionik am Beispiel der Leichtbauweise anwenden und ein stabiles, leichtes Brueckenmodell nach dem Forschenden Lernen entwickeln.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.10.2 Bionik - Die Leichtbauweise',
        'originaltext', 'Vorbild: feste, aber leichte Strukturen, z. B. Bienenwaben, Knochen, Palmenblaetter. Prinzip: hohe Stabilitaet bei geringem Materialeinsatz, z. B. durch Faltung. Funktionsmodell: selbstversteifende Wirkung von Woelb- und Faltungsstrukturen; geprueft auf Zusammenhang zwischen Strukturen und Festigkeit (Druckbelastung). Uebertragen: Bau von Bruecken und Daechern, Verpackungsmaterialien. Fachpraktisch: Forschendes Lernen am Beispiel eines Brueckenmodells -- Konstruktion einer leichten, stabilen Bruecke; Untersuchen von Vorbildern aus der Natur (Knochenquerschnitt, Palmenblattstruktur mit der Lupe); Planen von Faltkonstruktionen; Bauen, Variieren und Testen einfacher Brueckenmodelle auf Stabilitaet.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.10.2',
        'note_2015_baseline', 'Kein direktes 2015-Gegenstueck -- gleiche Anmerkung wie Klettverschluss.'
      ),
      'draft', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bionik: Vom Nebeltrinkerkaefer zur Trinkwassergewinnung';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bionik: Vom Nebeltrinkerkaefer zur Trinkwassergewinnung',
      'Schuelerinnen und Schueler koennen die Wassergewinnung des Nebeltrinkerkaefers als biologisches Vorbild fuer technische Nebelkollektoren erlaeutern.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.10.3 Bionik - Vom Nebeltrinkerkaefer zur Trinkwassergewinnung',
        'originaltext', 'Vorbild: Fluegeldecken des Nebeltrinkerkaefers mit kleinen Hoeckern kondensieren Wasserdampf; Rillen transportieren die Wassertroepfchen zum Mund des Kaefers. Prinzip: "wasserliebende" Stoffe mit vergroesserter Oberflaeche ermoeglichen Kondensation; Rillen aus "wasserabweisenden" Stoffen ermoeglichen Transport. Funktionsmodell: Netze zur Kondensation von Wasserdampf plus Ablaufrinnen zum Auffangen des kondensierten Wassers; geprueft wird die gewonnene Wassermenge an verschiedenen Netzen. Uebertragen: Nebelkollektoren (Netze und Auffangvorrichtungen) zur Gewinnung von Trinkwasser in Trockengebieten. Fachpraktisch: ein Modell einer Nebelfangeinrichtung gestalten, z. B. mit unterschiedlicher Maschengroesse des Netzes variieren, und auf Effizienz untersuchen.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.10.3',
        'note_2015_baseline', 'Kein direktes 2015-Gegenstueck -- gleiche Anmerkung wie Klettverschluss.'
      ),
      'draft', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bionik: Der Lotuseffekt';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bionik: Der Lotuseffekt',
      'Schuelerinnen und Schueler koennen den Lotuseffekt als biologisches Vorbild fuer wasserabweisende, selbstreinigende technische Oberflaechen erlaeutern.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.10.4 Bionik - Der Lotuseffekt',
        'originaltext', 'Vorbild: Laubblaetter, von denen Wassertropfen abperlen und dabei Schmutzteilchen mitnehmen. Prinzip: Oberflaeche mit Wachsnoppen, sodass die Adhaesion eines Wassertropfens kleiner ist als die Kohaesion -- die Wassertropfen perlen ab. Funktionsmodell: Verhalten von Wasser auf wasserabweisender, genoppter Oberflaeche; geprueft an verschiedenen Materialien mit entsprechenden Oberflaechen. Uebertragen: Autolacke, wasserabweisende Materialien fuer Zeltplanen, Wetterjacken und Schuhe. Fachpraktisch: Verhalten von Wassertropfen auf Laubblaettern unterschiedlicher Oberflaechenbeschaffenheit beobachten (z. B. Kohlrabi, Gartenkresse, Erdbeere); Modellversuche mit unbehandeltem vs. gewachstem Baumwollstoff, einem wassergefuellten Ballon auf glatter vs. genoppter Oberflaeche (z. B. Eierkarton, Akustikschaumstoff), und der Mitnahme von Russteilchen beim Abrollen von Wassertropfen ueber eine schraeg gestellte, berusste Glasplatte.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.10.4',
        'note_2015_baseline', 'Kein direktes 2015-Gegenstueck -- gleiche Anmerkung wie Klettverschluss. Baut ausdruecklich auf dem neuen Kohaesion/Adhaesion-Lernbereich (2.2.5) auf.'
      ),
      'draft', v_project_id
    );
  END IF;

  -- ===========================================================
  -- Kohaesion/Adhaesion concept (2.2.5) -- new conceptual surround
  -- ===========================================================

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Kohaesion und Adhaesion';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Kohaesion und Adhaesion',
      'Schuelerinnen und Schueler koennen das Benetzen von Materialien mit Wasser und das Abperlen von Wassertropfen auf verschiedenen Materialien beschreiben und mit Kohaesions- und Adhaesionskraeften begruenden.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.5 Kohaesion, Adhaesion, Kapillaritaet',
        'originaltext', 'Kugelform eines Wassertropfens aufgrund anziehender Kraefte zwischen den Wasserteilchen (Kohaesion) und Oberflaechenspannung. Kraefte zwischen Wasserteilchen und Teilchen eines anderen Stoffes, z. B. Glas (Adhaesion). Benetzung, wenn Adhaesion groesser als Kohaesion (z. B. auf wasserliebenden Oberflaechen). Abperlen, wenn Adhaesion kleiner als Kohaesion (z. B. auf wasserabweisenden Oberflaechen). Alltagsbeispiele fuer Adhaesion (z. B. Kreide an Tafel). Einsatz wasserabweisender bzw. fein genoppter Materialien begruenden (z. B. Outdoorkleidung, Autowachs). Fachpraktisch: Verhalten eines Wassertropfens auf "wasserliebender" und "wasserabweisender" Oberflaeche; Veraenderung der Oberflaechenspannung durch Spuelmittel; Benetzen und Abrollen von Wassertropfen auf geneigten Ebenen unterschiedlicher Materialien.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.5',
        'note_2015_baseline', 'Neu als benanntes Konzept mit eigener Fachsprache (Kohaesion, Adhaesion, Oberflaechenspannung, Benetzen/Abperlen). Die zugehoerige Kapillaritaets-Experiment existierte 2015 bereits (Modul 2, "Untersuchungen: Kapillaritaet") und ist vermutlich bereits als eigenes Lernziel live -- das wird in Stage 2 zu diesem Lernbereich umgetaggt, nicht hier dupliziert.'
      ),
      'draft', v_project_id
    );
  END IF;

  -- ===========================================================
  -- Two genuinely new health-education items (2.2.9)
  -- ===========================================================

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Akzeptanz unterschiedlicher sexueller Orientierungen und Identitaeten';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Akzeptanz unterschiedlicher sexueller Orientierungen und Identitaeten',
      'Im Rahmen der koerperlichen und Verhaltensaenderungen in der Pubertaet lernen Schuelerinnen und Schueler die Akzeptanz unterschiedlicher sexueller Orientierungen und Identitaeten als Teil der sexuellen Entwicklung kennen.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch - Gesunderhaltung, Sexualitaet und Fortpflanzung',
        'originaltext', 'Akzeptanz unterschiedlicher sexueller Orientierungen und Identitaeten.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.9',
        'note_2015_baseline', 'Kein 2015-Gegenstueck -- echte neue inhaltliche Ergaenzung, nicht nur eine Umformulierung des bestehenden Pubertaets-Lernziels (MNT-56-M4-SEX-1), neben dem dieses Item bewusst eigenstaendig eingefuegt wird statt das bestehende Lernziel live zu ueberschreiben.'
      ),
      'draft', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Moeglichkeiten zur Schwangerschaftsverhuetung';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Moeglichkeiten zur Schwangerschaftsverhuetung',
      'Schuelerinnen und Schueler koennen Moeglichkeiten zur Schwangerschaftsverhuetung nennen.',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch - Gesunderhaltung, Sexualitaet und Fortpflanzung',
        'originaltext', 'Moeglichkeiten zur Schwangerschaftsverhuetung nennen.',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung, Abschnitt 2.2.9',
        'note_2015_baseline', 'Kein 2015-Gegenstueck -- echte neue inhaltliche Ergaenzung.'
      ),
      'draft', v_project_id
    );
  END IF;

  RAISE NOTICE 'MNT 2026 Stage 1 new-content insert complete for evomentor-thuringia.';
END $$;
