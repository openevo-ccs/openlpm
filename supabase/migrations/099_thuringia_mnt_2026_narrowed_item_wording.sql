-- ============================================================
-- Thuringia MNT 2026 (grade 5/6): wording for the 5 'moved-narrowed'
-- items. Migration 097 retagged these to 2.2.8 Wirbeltiere (Schutz von
-- Wirbeltieren) but, same gap as the 29 'reworded' items fixed in 098,
-- never updated the text itself -- and these genuinely narrowed in scope
-- (general ecosystem/animal-welfare language -> vertebrate-specific),
-- not just relocated. Wording read directly from the real 2026 subsection
-- text, which gives exactly two asks that these four items collapse onto.
-- ============================================================

-- MNT-56-M5-LR-7 (moved-narrowed): Auswirkungen von Lebensraumveränderungen erläutern
--   old: Auswirkungen von Lebensraumveränderungen erläutern
--   new: Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)
UPDATE lpm_data_objects SET title = 'Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten', description = 'Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten"'), '{originaltext}', '"Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)"'), updated_at = now() WHERE id = '8943afd8-3ac7-525f-a4df-bce4f8d264c3';

-- MNT-56-M5-MEN-1a (moved-narrowed): Einfluss von Eingriffen auf einzelne Lebewesen bewerten
--   old: Einfluss von Eingriffen auf einzelne Lebewesen bewerten
--   new: Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)
UPDATE lpm_data_objects SET title = 'Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten', description = 'Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)', content = jsonb_set(jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten"'), '{originaltext}', '"Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)"'), '{migration_note_2026}', '"Diese Zeile überschneidet sich inhaltlich mit MNT-56-M5-LR-7 und MNT-56-M5-MEN-1b -- alle drei verweisen auf denselben Satz im 2026er Dokument. Keine eigenständige, distinct abgrenzbare Formulierung gefunden; hier bewusst nicht erfunden."'), updated_at = now() WHERE id = 'af819a99-ad45-50bf-a00f-3b989fb5ab6c';

-- MNT-56-M5-MEN-1b (moved-narrowed): Einfluss von Eingriffen auf den Lebensraum bewerten
--   old: Einfluss von Eingriffen auf den Lebensraum bewerten
--   new: Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)
UPDATE lpm_data_objects SET title = 'Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten', description = 'Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Auswirkungen von Lebensraumveränderungen auf Wirbeltiere ableiten"'), '{originaltext}', '"Auswirkungen von Lebensraumeinflüssen auf Wirbeltiere ableiten (z. B. Abholzen -> Nahrungs-/Brutverlust für Vögel; Entfernen von Steinhaufen/Totholz -> Lebensraumverlust für Schlangen/Echsen; Abfischen -> Nahrungskettenauswirkungen)"'), updated_at = now() WHERE id = 'ff60d353-d357-5efa-9f78-527d45f1eec9';

-- MNT-56-M5-MEN-2 (moved-narrowed): Umweltschutz begründen (Lebensgrundlagen, Artenschutz)
--   old: Umweltschutz begründen (Lebensgrundlagen, Artenschutz)
--   new: Schutzmaßnahmen begründen und bewerten
UPDATE lpm_data_objects SET title = 'Schutzmaßnahmen für Wirbeltiere begründen und bewerten', description = 'Schutzmaßnahmen begründen und bewerten', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Schutzmaßnahmen für Wirbeltiere begründen und bewerten"'), '{originaltext}', '"Schutzmaßnahmen begründen und bewerten"'), updated_at = now() WHERE id = 'bac4e87c-18bc-59f2-bd73-cb3bbe2448d4';

-- MNT-56-M5-NUT-1 (moved-narrowed): Nutzung von Pflanzen UND Tieren begründen
--   old: Nutzung von Pflanzen UND Tieren begründen
--   new: Nutzung von Samenpflanzen durch den Menschen begründen (Nahrung, Energieträger, Baumaterialien, Textilien, Heilkräuter/Arzneipflanzen); kein entsprechender Nutztier-Inhalt mehr im 2026er Wirbeltiere-Lernbereich
UPDATE lpm_data_objects SET title = 'Nutzung von Samenpflanzen durch den Menschen begründen', description = 'Nutzung von Samenpflanzen durch den Menschen begründen (Nahrung, Energieträger, Baumaterialien, Textilien, Heilkräuter/Arzneipflanzen); kein entsprechender Nutztier-Inhalt mehr im 2026er Wirbeltiere-Lernbereich', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Nutzung von Samenpflanzen durch den Menschen begründen"'), '{originaltext}', '"Nutzung von Samenpflanzen durch den Menschen begründen (Nahrung, Energieträger, Baumaterialien, Textilien, Heilkräuter/Arzneipflanzen); kein entsprechender Nutztier-Inhalt mehr im 2026er Wirbeltiere-Lernbereich"'), updated_at = now() WHERE id = 'b4055e65-e605-5b8c-b6d8-1cc21947800c';

