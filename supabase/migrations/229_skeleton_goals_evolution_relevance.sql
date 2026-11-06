-- 229: higher Evolutive-Entwicklung relevance for three skeleton goals (grade 5/6, 2.2.9 Der Mensch, Bewegung/Körperhaltung).
--
-- Susan Hanisch, feedback row 2fa51f24 (2026-11-04): the skeleton goals should carry a higher relevance for the Basiskonzept Evolution, because the
-- skeleton can be explained through evolutionary history (spine, feet, pelvis, upright walking, endurance running).
-- Changes, in the live space and in the sandbox copy (the sandbox has its own ids):
--   * Skelettgliederung beschreiben: Evolution 1 -> 2 (mittel), new explanation, concept added to the secondary concepts.
--   * Zusammenwirken von Muskulatur und Skelett erläutern: Evolution 1 -> 2 (mittel), new explanation, concept added to the secondary concepts.
--   * Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen: Evolution 1 -> 3 (hoch). Its explanation already argued the
--     evolutionary mismatch of the upright body (spine, sitting); only the rating was too low. Concept added to the main concepts.
-- Left at 1 on purpose, for Susan to say otherwise: "Funktionen der Knochen nennen" and "Gelenke als Voraussetzung für Beweglichkeit beschreiben".
-- The new texts and ratings are AI drafts that no expert has checked. content.ki_entwurf gets relevanz_angepasst = 2026-11-05.
-- Each UPDATE only changes a goal that still has the exact old rating, text and concept lists, so a later human edit is never overwritten and running
-- this twice changes nothing.
SET search_path = public, extensions;

-- ===== evomentor-thuringia =====
-- Skelettgliederung beschreiben
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(2)), '{basiskonzeptbezug,0,begruendung}', to_jsonb($t$Die Gliederung des Skeletts in Schädel, Wirbelsäule, Schulter- und Beckengürtel, Vorder- und Hintergliedmaßen und Brustkorb ist ein Bauplan, den der Mensch mit den anderen Wirbeltieren teilt. An Wirbelsäule, Becken und Füßen lässt sich außerdem erklären, wie sich der aufrechte Gang im Lauf der Stammesgeschichte des Menschen entwickelt hat: Die doppelt geschwungene Wirbelsäule, das kurze, breite Becken und das Fußgewölbe unterscheiden sich von denen der Menschenaffen. Das Lernziel verlangt nur, die Gliederung zu beschreiben, deshalb ist die Relevanz mittel. Der evolutionsgeschichtliche Bezug ergibt sich, sobald die beschriebenen Teile mit dem Skelett anderer Wirbeltiere und der Menschenaffen verglichen werden.$t$::text)), '{basiskonzepte_sekundaer}', '["bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = '16b57533-6fb5-4c10-965f-8ac390baa407'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Die Gliederung wird beschrieben ohne Artvergleich oder Abstammung.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '[]'::jsonb;

-- Zusammenwirken von Muskulatur und Skelett erläutern
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(2)), '{basiskonzeptbezug,0,begruendung}', to_jsonb($t$Beim aufrechten Gehen und beim ausdauernden Laufen wirken Muskulatur und Skelett des Menschen zusammen: Bein-, Gesäß- und Rückenmuskulatur, Becken, Wirbelsäule und Füße. Dieses Zusammenspiel hat sich im Lauf der Stammesgeschichte des Menschen herausgebildet und unterscheidet sich vom Bewegungsapparat der Menschenaffen. Das Lernziel verlangt nur ein Beispiel für das Zusammenwirken, deshalb ist die Relevanz mittel. Der evolutionsgeschichtliche Bezug entsteht, wenn als Beispiel das Gehen und Laufen auf zwei Beinen gewählt wird.$t$::text)), '{basiskonzepte_sekundaer}', '["bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = '67912053-96bf-4aa8-9c7d-e99c706435f5'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Das Lernziel nennt keinen Evolutionsbezug.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '[]'::jsonb;

-- Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(3)), '{basiskonzepte_primaer}', '["bk_struktur_funktion", "bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = 'df9b858f-e765-5fef-be27-d90b789b3da6'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Der aufrechte, zweibeinige Bewegungsapparat des Menschen ist über Jahrmillionen für ausdauerndes Gehen, Laufen und Tragen geformt worden, mit einer doppelt gekrümmten Wirbelsäule, die Stöße abfedert und Lasten verteilt. Diese Struktur funktioniert am besten unter den vielseitigen, bewegungsreichen Bedingungen, unter denen sie sich entwickelt hat, nicht unter stundenlangem, einseitigem Sitzen an Schulbank oder Bildschirm. Rücken- und Nackenmuskulatur sind darauf ausgelegt, wechselnde Haltungen und Belastungen auszugleichen, werden aber durch dauerhaft gleichförmige Sitzhaltungen einseitig beansprucht. Haltungsschäden entstehen so nicht, weil der Körper 'fehlerhaft' gebaut ist, sondern weil die moderne Lebensumgebung von den Bedingungen abweicht, unter denen das Skelett-Muskel-System evolutionär geformt wurde. Vorbeugende Maßnahmen wie Bewegungspausen oder ergonomisches Sitzen gleichen diesen Mismatch gezielt aus.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '["bk_stoff_energie_umwandlung"]'::jsonb;


-- ===== evomentor-thuringia-sandbox =====
-- Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(3)), '{basiskonzepte_primaer}', '["bk_struktur_funktion", "bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = 'f94388d9-b608-41f7-a19c-1a3c58da7d98'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Der aufrechte, zweibeinige Bewegungsapparat des Menschen ist über Jahrmillionen für ausdauerndes Gehen, Laufen und Tragen geformt worden, mit einer doppelt gekrümmten Wirbelsäule, die Stöße abfedert und Lasten verteilt. Diese Struktur funktioniert am besten unter den vielseitigen, bewegungsreichen Bedingungen, unter denen sie sich entwickelt hat, nicht unter stundenlangem, einseitigem Sitzen an Schulbank oder Bildschirm. Rücken- und Nackenmuskulatur sind darauf ausgelegt, wechselnde Haltungen und Belastungen auszugleichen, werden aber durch dauerhaft gleichförmige Sitzhaltungen einseitig beansprucht. Haltungsschäden entstehen so nicht, weil der Körper 'fehlerhaft' gebaut ist, sondern weil die moderne Lebensumgebung von den Bedingungen abweicht, unter denen das Skelett-Muskel-System evolutionär geformt wurde. Vorbeugende Maßnahmen wie Bewegungspausen oder ergonomisches Sitzen gleichen diesen Mismatch gezielt aus.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '["bk_stoff_energie_umwandlung"]'::jsonb;

-- Skelettgliederung beschreiben
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(2)), '{basiskonzeptbezug,0,begruendung}', to_jsonb($t$Die Gliederung des Skeletts in Schädel, Wirbelsäule, Schulter- und Beckengürtel, Vorder- und Hintergliedmaßen und Brustkorb ist ein Bauplan, den der Mensch mit den anderen Wirbeltieren teilt. An Wirbelsäule, Becken und Füßen lässt sich außerdem erklären, wie sich der aufrechte Gang im Lauf der Stammesgeschichte des Menschen entwickelt hat: Die doppelt geschwungene Wirbelsäule, das kurze, breite Becken und das Fußgewölbe unterscheiden sich von denen der Menschenaffen. Das Lernziel verlangt nur, die Gliederung zu beschreiben, deshalb ist die Relevanz mittel. Der evolutionsgeschichtliche Bezug ergibt sich, sobald die beschriebenen Teile mit dem Skelett anderer Wirbeltiere und der Menschenaffen verglichen werden.$t$::text)), '{basiskonzepte_sekundaer}', '["bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = 'e16cbfbb-4340-4904-a459-7daf748d7b0c'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Die Gliederung wird beschrieben ohne Artvergleich oder Abstammung.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '[]'::jsonb;

-- Zusammenwirken von Muskulatur und Skelett erläutern
UPDATE lpm_data_objects SET content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content, '{basiskonzeptbezug,0,relevanz_beurteilung}', to_jsonb(2)), '{basiskonzeptbezug,0,begruendung}', to_jsonb($t$Beim aufrechten Gehen und beim ausdauernden Laufen wirken Muskulatur und Skelett des Menschen zusammen: Bein-, Gesäß- und Rückenmuskulatur, Becken, Wirbelsäule und Füße. Dieses Zusammenspiel hat sich im Lauf der Stammesgeschichte des Menschen herausgebildet und unterscheidet sich vom Bewegungsapparat der Menschenaffen. Das Lernziel verlangt nur ein Beispiel für das Zusammenwirken, deshalb ist die Relevanz mittel. Der evolutionsgeschichtliche Bezug entsteht, wenn als Beispiel das Gehen und Laufen auf zwei Beinen gewählt wird.$t$::text)), '{basiskonzepte_sekundaer}', '["bk_evolutive_entwicklung"]'::jsonb), '{ki_entwurf}', COALESCE(content->'ki_entwurf', '{}'::jsonb) || jsonb_build_object('relevanz_angepasst', '2026-11-05', 'relevanz_feedback', '2fa51f24'))
WHERE id = 'fc9896eb-8094-45fb-a4c4-c1977620cb46'::uuid
  AND content #>> '{basiskonzeptbezug,0,basiskonzept_id}' = 'bk_evolutive_entwicklung'
  AND (content #>> '{basiskonzeptbezug,0,relevanz_beurteilung}')::int = 1
  AND content #>> '{basiskonzeptbezug,0,begruendung}' = $t$Das Lernziel nennt keinen Evolutionsbezug.$t$
  AND content->'basiskonzepte_primaer' = '["bk_struktur_funktion"]'::jsonb
  AND content->'basiskonzepte_sekundaer' = '[]'::jsonb;

