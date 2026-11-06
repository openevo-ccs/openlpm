SET search_path = public, extensions;

-- Guided tours (2026-11-04): a step-by-step walk through a space or through
-- one view of a space, started from the Help menu. Replaces the plain text
-- notes the Help menu used to show (the tutorials table, migration 030, stays
-- as it is and is only shown outside student views).
--
-- Who sees a tour:
--   * members of the space the tour belongs to (project_id), and members of any
--     space it is also shared with (guided_tour_spaces);
--   * only while they are in the view the tour is meant for: view_id (one
--     defined view of that space) or template_id (every view built from that
--     student-view template, in any space the tour reaches); both NULL means
--     every view of the space;
--   * unpublished tours (drafts) are visible to owners and maintainers only.
-- Who writes a tour: owners and maintainers of the space it belongs to.
--
-- steps is an ordered JSON list. Each step: {title, body, anchor?, page?,
-- tryIt?, hint?, openFirst?}. anchor names a marked part of a screen (the keys
-- live in src/lib/tour-anchors.ts), page is the path inside the space
-- ('' = start page, 'basiskonzepte', ...), tryIt is the "Probiere es aus" box,
-- hint is shown when the marked part is not on screen, openFirst names an
-- anchor to click first when the marked part is not yet visible.
-- language and the other text columns are plain TEXT on purpose, like
-- student_view_template, so a new language or template needs no migration.

CREATE TABLE IF NOT EXISTS guided_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL DEFAULT 'de',
  view_id UUID REFERENCES project_dashboard_views(id) ON DELETE CASCADE,
  template_id TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  offer_on_first_visit BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guided_tours_one_view_scope CHECK (view_id IS NULL OR template_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_guided_tours_project ON guided_tours(project_id);

-- Other spaces a tour is also shown in (for example a second Jena space).
CREATE TABLE IF NOT EXISTS guided_tour_spaces (
  tour_id UUID NOT NULL REFERENCES guided_tours(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_guided_tour_spaces_project ON guided_tour_spaces(project_id);

ALTER TABLE guided_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE guided_tour_spaces ENABLE ROW LEVEL SECURITY;

-- True when the signed-in user may read the tour: a manager of its own space,
-- or a member of its own space or of a space it is shared with once it is
-- published. SECURITY DEFINER so the check can read guided_tour_spaces while
-- that table's own policy calls back into this function.
CREATE OR REPLACE FUNCTION can_see_guided_tour(p_tour_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM guided_tours t
    WHERE t.id = p_tour_id
      AND (
        has_project_role(t.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
        OR (
          t.is_published
          AND (
            is_project_member(t.project_id)
            OR EXISTS (
              SELECT 1 FROM guided_tour_spaces s
              WHERE s.tour_id = t.id AND is_project_member(s.project_id)
            )
          )
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE POLICY "Members see published tours; owners and maintainers see all" ON guided_tours
  FOR SELECT USING (auth.uid() IS NOT NULL AND can_see_guided_tour(id));
CREATE POLICY "Owners and maintainers create tours" ON guided_tours
  FOR INSERT WITH CHECK (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers update tours" ON guided_tours
  FOR UPDATE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));
CREATE POLICY "Owners and maintainers delete tours" ON guided_tours
  FOR DELETE USING (has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[]));

CREATE POLICY "Tour space links follow the tour" ON guided_tour_spaces
  FOR SELECT USING (auth.uid() IS NOT NULL AND can_see_guided_tour(tour_id));
-- Sharing a tour into another space needs a manager role in BOTH spaces.
CREATE POLICY "Managers of both spaces share a tour" ON guided_tour_spaces
  FOR INSERT WITH CHECK (
    has_project_role(project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    AND EXISTS (
      SELECT 1 FROM guided_tours t
      WHERE t.id = tour_id
        AND has_project_role(t.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );
CREATE POLICY "Managers of the tour's space unshare" ON guided_tour_spaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM guided_tours t
      WHERE t.id = tour_id
        AND has_project_role(t.project_id, ARRAY['owner', 'maintainer']::project_member_role[])
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON guided_tours TO authenticated;
GRANT SELECT, INSERT, DELETE ON guided_tour_spaces TO authenticated;

-- The first tour: the Jena Biologiedidaktik student view of evomentor-thuringia.
-- Text for the Lernziele and Basiskonzepte steps comes from Dustin's notes of
-- 2026-11-04. The welcome step and the Seitenmenue text are AI-drafted and
-- have not been read by Susan or another expert yet.
-- Rollback: DELETE FROM guided_tours WHERE title = 'Tour durch die Lernziele und Basiskonzepte';
DO $seed$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects WHERE slug = 'evomentor-thuringia';
  IF v_project_id IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM guided_tours WHERE project_id = v_project_id AND title = 'Tour durch die Lernziele und Basiskonzepte') THEN
    RETURN;
  END IF;

  INSERT INTO guided_tours (project_id, title, description, language, template_id, is_published, offer_on_first_visit, sort_order, steps)
  VALUES (
    v_project_id,
    'Tour durch die Lernziele und Basiskonzepte',
    'Das Seitenmenü, die Suche nach Lernzielen und die Übersicht der Basiskonzepte. Dauert etwa fünf Minuten.',
    'de',
    'jena-biologiedidaktik-de',
    true,
    false,
    0,
    $steps$[
      {"title": "Willkommen zur Tour",
       "body": "In wenigen Minuten lernst du die wichtigsten Bereiche dieser App kennen: das Seitenmenü, die Seite Lernziele und die Seite Basiskonzepte.\n\nDu kannst die Tour jederzeit mit »Tour beenden« verlassen und später über »Hilfe« oben rechts neu starten."},
      {"title": "Seitenmenü", "anchor": "sidebar",
       "body": "Hier wechselst du zwischen den Bereichen der App.\n\nMit dem Pfeil-Knopf oben im Seitenmenü klappst du es ein und aus. Eingeklappt hast du mehr Platz für den Inhalt, und die Symbole bleiben sichtbar."},
      {"title": "Seite Lernziele", "anchor": "lernziele.kopf", "page": "",
       "body": "Auf dieser Seite kannst du alle Lernziele des Thüringer Lehrplans (MNT und Biologie) des Gymnasiums von der 5. bis 10. Klasse durchsuchen. Dabei stehen verschiedene Suchfunktionen zur Verfügung."},
      {"title": "Freies Suchfeld", "anchor": "lernziele.suche", "page": "",
       "body": "Hier kannst du die Lernziele nach beliebigen Wörtern durchsuchen.",
       "tryIt": "Tippe das Wort »Pflanze« ein. Es erscheinen alle Lernziele, in denen das Wort Pflanze vorkommt."},
      {"title": "Klassenstufe", "anchor": "lernziele.klassenstufe", "page": "",
       "body": "Hier kannst du Lernziele nach Klassenstufen eingrenzen.",
       "tryIt": "Klicke die Klassenstufe »Kl. 5/6« an."},
      {"title": "Thema", "anchor": "lernziele.thema", "page": "",
       "body": "Hier kannst du Lernziele nach Themen eingrenzen. Dabei werden nur die Themen der ausgewählten Klassenstufe(n) angezeigt.",
       "tryIt": "Wähle das Thema »2.2.7 Samenpflanzen« aus."},
      {"title": "Unterthema", "anchor": "lernziele.unterthema", "page": "",
       "body": "Hier kannst du Lernziele nach Unterthemen eingrenzen. Dabei werden nur die Unterthemen der ausgewählten Themen angezeigt.",
       "tryIt": "Wähle das Unterthema »Ernährung der Samenpflanzen« aus.",
       "hint": "Dieses Feld erscheint erst, wenn du ein Thema ausgewählt hast. Wähle zuerst im Feld »Thema« das Thema »2.2.7 Samenpflanzen« aus."},
      {"title": "Basiskonzepte und Relevanz", "anchor": "lernziele.basiskonzepte", "page": "",
       "body": "Hier kannst du Lernziele danach eingrenzen, welche Relevanz bestimmte Basiskonzepte für ein Lernziel haben. Für jedes Lernziel werden alle Basiskonzepte einer von drei Relevanzstufen zugeordnet: niedrig, mittel oder hoch.",
       "tryIt": "Wähle das Basiskonzept »Struktur und Funktion« aus und wähle die Relevanzstufen niedrig und mittel ab. Es werden nur die Lernziele angezeigt, denen eine hohe Relevanzstufe für Struktur und Funktion zugeordnet wurde."},
      {"title": "Ansicht der Lernziele: Karten oder Liste", "anchor": "lernziele.ansicht", "page": "",
       "body": "Hier werden alle gefilterten Lernziele angezeigt. Du kannst sie auf unterschiedliche Weise sortieren, als Liste oder als Karten anzeigen lassen und die Details ein- und ausklappen.",
       "tryIt": "Klicke ein Lernziel an.",
       "hint": "Mit den gewählten Filtern wird gerade kein Lernziel angezeigt. Setze einen Filter zurück, zum Beispiel die Klassenstufe auf »Alle«, dann erscheinen wieder Lernziele."},
      {"title": "Karte für ein Lernziel", "anchor": "lernziele.karte", "page": "",
       "body": "Oben in der Karte siehst du die Klassenstufe sowie das Thema und Unterthema.\n\nWeiter unten folgt der Wortlaut des Lernziels, wie er im Lehrplan steht.\n\nDarunter werden die Relevanzeinstufungen für jedes Basiskonzept angezeigt.",
       "hint": "Mit den gewählten Filtern wird gerade kein Lernziel angezeigt. Setze einen Filter zurück, zum Beispiel die Klassenstufe auf »Alle«, dann erscheinen wieder Lernziele."},
      {"title": "Basiskonzept-Bezüge anzeigen", "anchor": "lernziele.bezuege", "page": "", "openFirst": "lernziele.karte",
       "body": "Hier können genauere Informationen zu den Basiskonzept-Bezügen aufgeklappt werden. Für jedes Basiskonzept, insbesondere für diejenigen mit mittlerer und hoher Relevanzeinstufung, wird kurz erklärt, inwiefern das Basiskonzept für das Lernziel relevant ist. Gegebenenfalls werden dabei auch weitere relevante Unterkonzepte angezeigt.",
       "tryIt": "Klicke auf »Basiskonzept-Bezüge anzeigen«."},
      {"title": "Didaktische Strategien anzeigen", "anchor": "lernziele.strategien", "page": "", "openFirst": "lernziele.karte",
       "body": "Hier können genauere Hinweise und Anregungen für die didaktische Umsetzung aufgeklappt werden.",
       "tryIt": "Klicke auf »Didaktische Strategien anzeigen«.",
       "hint": "Für dieses Lernziel sind noch keine didaktischen Strategien hinterlegt. Öffne ein anderes Lernziel, um sie zu sehen."},
      {"title": "Lernziel als Favorit markieren", "anchor": "lernziele.favorit", "page": "", "openFirst": "lernziele.karte",
       "body": "Mit einem Klick auf diesen Stern markierst du ein Lernziel als Favorit. Das ist für weitere Funktionen in dieser App wichtig.\n\nIn der Suche kannst du zum Beispiel auch nur die Favoriten anzeigen lassen."},
      {"title": "Seite Basiskonzepte", "anchor": "basiskonzepte.kopf", "page": "basiskonzepte",
       "body": "Auf der Seite Basiskonzepte werden verschiedene Informationen zu den Basiskonzepten bereitgestellt."},
      {"title": "Dashboard", "anchor": "basiskonzepte.dashboard", "page": "basiskonzepte",
       "body": "Auf der Dashboard-Seite siehst du eine Übersicht über die Verteilung der Basiskonzept-Relevanzen über die Klassenstufen hinweg."}
    ]$steps$::jsonb
  );
END
$seed$;
