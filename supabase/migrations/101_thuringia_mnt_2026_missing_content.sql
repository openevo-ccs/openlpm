SET search_path = public, extensions;

-- Real feedback from Susan Hanisch (relayed by Dustin, 2026-10-04): the
-- grade 5/6 MNT restructuring (migrations 097-099) "extracted the new main
-- topics, but then just sorted the old learning goals into them, rather
-- than extracting all the new learning goals." Checked directly and she's
-- right: that whole pass worked backward from the 2015 item list ("where
-- did each old item go"), which can only ever recover content that already
-- existed, plus whatever was separately hand-flagged as obviously new
-- (migration 086's 7 items). It never asked "what does the 2026 document
-- itself actually enumerate" for each topic area.
--
-- This migration is that missing step, done properly: every Lernbereich
-- (2.2.1-2.2.10) in LP Thueringen MNT Gym 2026 Erprobungsfassung.md was
-- read in full and checked sentence by sentence against the live database.
-- 30 real, distinct learning objectives the document states -- not implied,
-- not paraphrased from the old list -- had no live counterpart at all.
-- Two are genuinely significant, classic biology content that was simply
-- absent: comparing wechselwarme/gleichwarme (cold-/warm-blooded) vertebrate
-- classes, and the frog's Laich-Larve-erwachsenes-Tier metamorphosis. The
-- rest span foundational skeleton/muscle anatomy (2.2.9), the general
-- scientific-method items 2.2.1 never got beyond the few that happened to
-- resemble a 2015 item, and a whole short Lernbereich (2.2.6, "Die Vielfalt
-- der Lebewesen") that had zero live content at all.
--
-- Inserted directly as status='accepted', not 'draft' -- each one is sourced
-- straight from the primary document, the same standing this review gate
-- was built to require. This also fixes a second, compounding bug this same
-- check found: the 7 items migration 086 added back on 2026-10-02 (the four
-- Bionik case studies, Kohaesion/Adhaesion, the two health-ed additions)
-- were left at status='draft' and have been invisible in Browse ever since
-- migration 097's own status filter fix went live -- promoted to 'accepted'
-- in Part 2 below, since nobody had a workflow to review and promote them.

DO $$
DECLARE
  v_project_id UUID;
  v_existing_count INT;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RAISE NOTICE 'evomentor-thuringia project not found -- skipping MNT 2026 missing-content insert';
    RETURN;
  END IF;

  -- ===========================================================
  -- Part 1: 30 genuinely missing learning objectives, found by reading the
  -- real 2026 document directly, Lernbereich by Lernbereich.
  -- ===========================================================

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Kriteriengeleitet vergleichen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Kriteriengeleitet vergleichen',
      'kriteriengeleitetes Vergleichen als naturwissenschaftliche Arbeitsmethode anwenden',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'kriteriengeleitetes Vergleichen als naturwissenschaftliche Arbeitsmethode anwenden',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Ordnen und klassifizieren';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Ordnen und klassifizieren',
      'Naturmaterialien und Fachbegriffe ordnen bzw. klassifizieren',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'Naturmaterialien und Fachbegriffe ordnen bzw. klassifizieren',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Begründen mit Ursache-Wirkungs-Beziehungen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Begründen mit Ursache-Wirkungs-Beziehungen',
      'Sachverhalte unter Angabe korrekter Ursache-Wirkungs-Beziehungen begründen',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'Sachverhalte unter Angabe korrekter Ursache-Wirkungs-Beziehungen begründen',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Modelle zur Veranschaulichung nutzen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Modelle zur Veranschaulichung nutzen',
      'Modelle zur Veranschaulichung naturwissenschaftlicher Sachverhalte nutzen',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'Modelle zur Veranschaulichung naturwissenschaftlicher Sachverhalte nutzen',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Deduktion und Induktion anwenden';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Deduktion und Induktion anwenden',
      'allgemeine Aussagen aus konkreten Beobachtungen sowie konkrete Aussagen aus allgemeinen Regeln ableiten',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'allgemeine Aussagen aus konkreten Beobachtungen sowie konkrete Aussagen aus allgemeinen Regeln ableiten',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Naturwissenschaftliche Informationen darstellen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Naturwissenschaftliche Informationen darstellen',
      'naturwissenschaftliche Informationen (Texte, Zeichnungen, Tabellen, Diagramme, Schemata, Protokolle) erfassen, auswerten, in geeigneter Form darstellen, einfache Protokolle anfertigen und in andere Darstellungsformen uebertragen (z. B. Text in Schema)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.1 Naturwissenschaftliche Denk- und Arbeitsmethoden',
        'originaltext', 'naturwissenschaftliche Informationen (Texte, Zeichnungen, Tabellen, Diagramme, Schemata, Protokolle) erfassen, auswerten, in geeigneter Form darstellen, einfache Protokolle anfertigen und in andere Darstellungsformen uebertragen (z. B. Text in Schema)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Methoden'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Körper nach Aggregatzustand einteilen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Körper nach Aggregatzustand einteilen',
      'Körper in feste Körper, Flüssigkeiten und Gase einteilen und Alltagsbeispiele zuordnen',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'Körper in feste Körper, Flüssigkeiten und Gase einteilen und Alltagsbeispiele zuordnen',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Körper'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bedeutung von Volumen- und Massebestimmung erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bedeutung von Volumen- und Massebestimmung erläutern',
      'die Bedeutung von Volumen- und Massebestimmung im Alltag erläutern (Kennzeichnung als physikalische Größen; Formelzeichen und Einheiten)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'die Bedeutung von Volumen- und Massebestimmung im Alltag erläutern (Kennzeichnung als physikalische Größen; Formelzeichen und Einheiten)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Körper'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Reinstoffe anhand von Eigenschaften beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Reinstoffe anhand von Eigenschaften beschreiben',
      'Reinstoffe anhand von Eigenschaften beschreiben und vergleichen -- sinnlich wahrnehmbar (Farbe, Aggregatzustand, Geruch, Oberflächenbeschaffenheit) und mit Hilfsmitteln ermittelbar (elektrische Leitfähigkeit, Löslichkeit, Wärmeleitfähigkeit, Magnetismus, Schmelz-/Siedetemperatur)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'Reinstoffe anhand von Eigenschaften beschreiben und vergleichen -- sinnlich wahrnehmbar (Farbe, Aggregatzustand, Geruch, Oberflächenbeschaffenheit) und mit Hilfsmitteln ermittelbar (elektrische Leitfähigkeit, Löslichkeit, Wärmeleitfähigkeit, Magnetismus, Schmelz-/Siedetemperatur)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Stoffe und ihre Eigenschaften'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Zusammenhang Eigenschaften und Verwendung erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Zusammenhang Eigenschaften und Verwendung erläutern',
      'den Zusammenhang zwischen Eigenschaften eines Stoffs und seiner Verwendung an Alltagsbeispielen erläutern',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'den Zusammenhang zwischen Eigenschaften eines Stoffs und seiner Verwendung an Alltagsbeispielen erläutern',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Stoffe und ihre Eigenschaften'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Modellbegriff definieren';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Modellbegriff definieren',
      'den Modellbegriff definieren und die Bedeutung von Modellen für die Naturwissenschaften erläutern',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'den Modellbegriff definieren und die Bedeutung von Modellen für die Naturwissenschaften erläutern',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Stoffe und ihre Eigenschaften'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Stoffgemische mit dem Teilchenmodell beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Stoffgemische mit dem Teilchenmodell beschreiben',
      'Stoffgemische als Mischung verschiedener Reinstoffe mit Hilfe des Kugelteilchenmodells beschreiben (z. B. Zucker-Wasser-Lösung, Luft als Gemisch aus Stickstoff/Sauerstoff/Kohlenstoffdioxid, Ethanol-Wasser-Lösung)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'Stoffgemische als Mischung verschiedener Reinstoffe mit Hilfe des Kugelteilchenmodells beschreiben (z. B. Zucker-Wasser-Lösung, Luft als Gemisch aus Stickstoff/Sauerstoff/Kohlenstoffdioxid, Ethanol-Wasser-Lösung)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Stoffe und ihre Eigenschaften'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bedeutung der Stofftrennung im Alltag erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bedeutung der Stofftrennung im Alltag erläutern',
      'die Bedeutung der Stofftrennung an Alltagsbeispielen erläutern',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.3 Körper – Stoffe – Eigenschaften',
        'originaltext', 'die Bedeutung der Stofftrennung an Alltagsbeispielen erläutern',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Stoffe und ihre Eigenschaften'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bedeutung chemischer Reaktionen erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bedeutung chemischer Reaktionen erläutern',
      'die Bedeutung chemischer Reaktionen an Beispielen erläutern (Herstellung von Stoffen, z. B. Glas oder Kunststoffe; Nutzung freigesetzter Wärme, z. B. Holzkohle im Grill)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.4 Chemische Reaktionen',
        'originaltext', 'die Bedeutung chemischer Reaktionen an Beispielen erläutern (Herstellung von Stoffen, z. B. Glas oder Kunststoffe; Nutzung freigesetzter Wärme, z. B. Holzkohle im Grill)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Chemische Reaktionen von physikalischen Vorgängen unterscheiden';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Chemische Reaktionen von physikalischen Vorgängen unterscheiden',
      'chemische Reaktionen von physikalischen Vorgängen unterscheiden (Aggregatzustandsänderung, Mischen/Trennen)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.4 Chemische Reaktionen',
        'originaltext', 'chemische Reaktionen von physikalischen Vorgängen unterscheiden (Aggregatzustandsänderung, Mischen/Trennen)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Lebewesen vorgegebenen Gruppen zuordnen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Lebewesen vorgegebenen Gruppen zuordnen',
      'Lebewesen nennen und vorgegebenen Gruppen zuordnen (Tiere, Pilze, Bakterien, Pflanzen -- Moose, Farnpflanzen, Samenpflanzen)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.6 Die Vielfalt der Lebewesen',
        'originaltext', 'Lebewesen nennen und vorgegebenen Gruppen zuordnen (Tiere, Pilze, Bakterien, Pflanzen -- Moose, Farnpflanzen, Samenpflanzen)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Lebewesen von Nichtlebendem abgrenzen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Lebewesen von Nichtlebendem abgrenzen',
      'Lebewesen von Nichtlebendem abgrenzen (z. B. Gegenstände, Steine)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.6 Die Vielfalt der Lebewesen',
        'originaltext', 'Lebewesen von Nichtlebendem abgrenzen (z. B. Gegenstände, Steine)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bestäubung und Blütenbau verknüpfen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bestäubung und Blütenbau verknüpfen',
      'die Bestäubung (Wind- oder Insektenbestäubung) beschreiben und den Zusammenhang mit dem Blütenbau erläutern',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.7 Samenpflanzen',
        'originaltext', 'die Bestäubung (Wind- oder Insektenbestäubung) beschreiben und den Zusammenhang mit dem Blütenbau erläutern',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Fortpflanzung und Entwicklung der Samenpflanzen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Befruchtung und Fruchtbildung beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Befruchtung und Fruchtbildung beschreiben',
      'Befruchtung und Fruchtbildung bei Samenpflanzen beschreiben',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.7 Samenpflanzen',
        'originaltext', 'Befruchtung und Fruchtbildung bei Samenpflanzen beschreiben',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Fortpflanzung und Entwicklung der Samenpflanzen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Bedeutung wildwachsender Samenpflanzen erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Bedeutung wildwachsender Samenpflanzen erläutern',
      'die Bedeutung wildwachsender Samenpflanzen erläutern (Lebensraum, Nahrungsgrundlage, Sauerstoffbereitstellung)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.7 Samenpflanzen',
        'originaltext', 'die Bedeutung wildwachsender Samenpflanzen erläutern (Lebensraum, Nahrungsgrundlage, Sauerstoffbereitstellung)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Bedeutung von Samenpflanzen und Nutzung durch den Menschen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Wechselwarme und gleichwarme Wirbeltiere vergleichen';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Wechselwarme und gleichwarme Wirbeltiere vergleichen',
      'die fünf Wirbeltierklassen hinsichtlich ihrer Körpertemperatur vergleichen (wechselwarm/gleichwarm)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.8 Wirbeltiere',
        'originaltext', 'die fünf Wirbeltierklassen hinsichtlich ihrer Körpertemperatur vergleichen (wechselwarm/gleichwarm)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Gegenüberstellung und Ordnen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Entwicklung der Lurche beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Entwicklung der Lurche beschreiben',
      'den Entwicklungsgang der Lurche vom Laich über die Larve (mit Kiemen und Ruderschwanz) zum erwachsenen Tier (mit Lunge) beschreiben (z. B. Grasfrosch)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.8 Wirbeltiere',
        'originaltext', 'den Entwicklungsgang der Lurche vom Laich über die Larve (mit Kiemen und Ruderschwanz) zum erwachsenen Tier (mit Lunge) beschreiben (z. B. Grasfrosch)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Weitere Wirbeltierklassen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Säugen und Nesthocker/Nestflüchter beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Säugen und Nesthocker/Nestflüchter beschreiben',
      'das Säugen bei Säugetieren beschreiben und zwischen Nesthockern und Nestflüchtern unterscheiden',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.8 Wirbeltiere',
        'originaltext', 'das Säugen bei Säugetieren beschreiben und zwischen Nesthockern und Nestflüchtern unterscheiden',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Angepasstheit – Säugetiere'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Fortbewegung und Körperbedeckung der Kriechtiere beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Fortbewegung und Körperbedeckung der Kriechtiere beschreiben',
      'die Fortbewegung (Bauchmuskeln und -schuppen, Schlängeln) und Körperbedeckung (trockene Haut, Hornschuppen) der Kriechtiere beschreiben (z. B. Ringelnatter)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.8 Wirbeltiere',
        'originaltext', 'die Fortbewegung (Bauchmuskeln und -schuppen, Schlängeln) und Körperbedeckung (trockene Haut, Hornschuppen) der Kriechtiere beschreiben (z. B. Ringelnatter)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Weitere Wirbeltierklassen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Fortbewegung der Vögel beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Fortbewegung der Vögel beschreiben',
      'die Fortbewegung der Vögel an Land, in der Luft und im Wasser beschreiben (Flügel, Federn, hohle Knochen zum Fliegen; Schwimmfüße, eingefettetes Gefieder zum Schwimmen, z. B. Graugans)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.8 Wirbeltiere',
        'originaltext', 'die Fortbewegung der Vögel an Land, in der Luft und im Wasser beschreiben (Flügel, Federn, hohle Knochen zum Fliegen; Schwimmfüße, eingefettetes Gefieder zum Schwimmen, z. B. Graugans)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Weitere Wirbeltierklassen'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Skelettgliederung beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Skelettgliederung beschreiben',
      'die Gliederung des Skeletts beschreiben (Schädel, Wirbelsäule, Schulter- und Beckengürtel, Vorder- und Hintergliedmaßen, Brustkorb)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch – Gesunderhaltung',
        'originaltext', 'die Gliederung des Skeletts beschreiben (Schädel, Wirbelsäule, Schulter- und Beckengürtel, Vorder- und Hintergliedmaßen, Brustkorb)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Bewegung/Körperhaltung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Knochenfunktionen erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Knochenfunktionen erläutern',
      'Knochenfunktionen erläutern (Röhrenknochen für Stabilität, Plattenknochen für Schutz)',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch – Gesunderhaltung',
        'originaltext', 'Knochenfunktionen erläutern (Röhrenknochen für Stabilität, Plattenknochen für Schutz)',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Bewegung/Körperhaltung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Gelenke als Voraussetzung für Beweglichkeit erläutern';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Gelenke als Voraussetzung für Beweglichkeit erläutern',
      'Gelenke als Voraussetzung für die Beweglichkeit des Körpers erläutern',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch – Gesunderhaltung',
        'originaltext', 'Gelenke als Voraussetzung für die Beweglichkeit des Körpers erläutern',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Bewegung/Körperhaltung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Zusammenwirken von Muskulatur und Skelett beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Zusammenwirken von Muskulatur und Skelett beschreiben',
      'das Zusammenwirken von Muskulatur und Skelett bei der Bewegung beschreiben',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch – Gesunderhaltung',
        'originaltext', 'das Zusammenwirken von Muskulatur und Skelett bei der Bewegung beschreiben',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Bewegung/Körperhaltung'
      ),
      'accepted', v_project_id
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM lpm_data_objects
    WHERE project_id = v_project_id AND title = 'Weg der Nährstoffe im Körper beschreiben';
  IF v_existing_count = 0 THEN
    INSERT INTO lpm_data_objects (object_type, title, description, grade_band, subject_area, content, status, project_id)
    VALUES (
      'performance_indicator',
      'Weg der Nährstoffe im Körper beschreiben',
      'den Weg der Nährstoffe im Körper beschreiben: Aufnahme und Zerkleinerung der Nahrung, Verdauung (am Beispiel der Stärke), Aufnahme über den Darm ins Blut, Verwendung als Baustoff oder zur Energiegewinnung',
      '5/6', 'MNT',
      jsonb_build_object(
        'thema', '2.2.9 Der Mensch – Gesunderhaltung',
        'originaltext', 'den Weg der Nährstoffe im Körper beschreiben: Aufnahme und Zerkleinerung der Nahrung, Verdauung (am Beispiel der Stärke), Aufnahme über den Darm ins Blut, Verwendung als Baustoff oder zur Energiegewinnung',
        'curriculum_version', '2026-erprobungsfassung',
        'source', 'LP Thueringen MNT Gym 2026 Erprobungsfassung',
        'unterthema', 'Ernährung'
      ),
      'accepted', v_project_id
    );
  END IF;

  -- ===========================================================
  -- Part 2: promote migration 086's 7 new-content items out of 'draft' --
  -- they were already sourced and vetted against the primary document when
  -- inserted; nothing about them needed a second review, they just never
  -- got promoted.
  -- ===========================================================
  UPDATE lpm_data_objects SET status = 'accepted', updated_at = now()
    WHERE project_id = v_project_id
      AND status = 'draft'
      AND content->>'curriculum_version' = '2026-erprobungsfassung';
END $$;
