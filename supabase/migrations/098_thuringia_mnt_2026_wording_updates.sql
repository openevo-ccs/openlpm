-- Thuringia MNT 2026 (grade 5/6): wording updates, the part migration 097
-- deliberately left undone.
--
-- Follows a direct question from Dustin after pushing 097: "can we be sure
-- the Grade 5/6 Thuringia curriculum is fully modeled in OpenLPM?" Checking
-- the live data directly after the push showed the honest answer was no --
-- 097 correctly re-filed all 121 items into the real 2026 unit structure and
-- resolved the ~41 moved-or-cut items, but it only ever touched the
-- content.thema field. For 29 of those 121 items, the 2026 document's actual
-- wording is broader, narrower, or more specific than the 2015 text still
-- sitting on the live row (e.g. the nutrition item still said "sort foods by
-- nutrient/energy content" instead of the 2026 document's seven named
-- nutrient categories with their functions). This migration updates those
-- 29 items' actual text, read directly from LP Thueringen MNT Gym 2026
-- Erprobungsfassung.md (not paraphrased from the item-level diff CSV).
-- ============================================================
-- Thuringia MNT 2026: update wording for the 29 grade 5/6 items whose
-- phrasing is broader, narrower, or more specific in the real 2026
-- document than the 2015 text still live on these rows. Migration 097
-- re-filed these into the correct 2026 Lernbereich but intentionally left
-- the wording untouched; this migration finishes that part of the job.
-- New wording is taken directly from LP Thueringen MNT Gym 2026
-- Erprobungsfassung.md, not paraphrased from the diff CSV's own summary.
--
-- Updates both the top-level title/description columns (what
-- student-lernziele-page.tsx actually renders) and the nested
-- content.kurzbezeichnung/originaltext fields (what prompt-builder.tsx
-- prefers) so the change is visible everywhere it's read from.
-- ============================================================

-- MNT-56-M1-NWA-1c (reworded-narrowed): Fragen mit Beobachtung/Experiment beantworten, Grenzen erkennen
--   old: Fragen mit Beobachtung/Experiment beantworten, Grenzen erkennen
--   new: Fragen mithilfe der experimentellen Methode beantworten: begründete Vermutungen ableiten, Experimente planen und durchführen, Messergebnisse auswerten
UPDATE lpm_data_objects SET title = 'Fragen mithilfe der experimentellen Methode beantworten', description = 'Fragen mithilfe der experimentellen Methode beantworten: begründete Vermutungen ableiten, Experimente planen und durchführen, Messergebnisse auswerten', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Fragen mithilfe der experimentellen Methode beantworten"'), '{originaltext}', '"Fragen mithilfe der experimentellen Methode beantworten: begründete Vermutungen ableiten, Experimente planen und durchführen, Messergebnisse auswerten"'), updated_at = now() WHERE id = '59217437-cc96-52b4-af1c-972d77c7a4b2';

-- MNT-56-M1-NWA-2a (reworded-narrowed): Sinne bewusst zum Beobachten nutzen; Möglichkeiten/Grenzen erkennen
--   old: Sinne bewusst zum Beobachten nutzen; Möglichkeiten/Grenzen erkennen
--   new: kriteriengeleitetes Betrachten/Beobachten und Beschreiben anwenden
UPDATE lpm_data_objects SET title = 'Kriteriengeleitet betrachten und beobachten', description = 'kriteriengeleitetes Betrachten/Beobachten und Beschreiben anwenden', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Kriteriengeleitet betrachten und beobachten"'), '{originaltext}', '"kriteriengeleitetes Betrachten/Beobachten und Beschreiben anwenden"'), updated_at = now() WHERE id = 'ba79c252-b7ab-569e-9ea5-0ffc6ba38dfc';

-- MNT-56-M1-NWA-2b (reworded-expanded): Hilfsmittel sachgerecht nutzen (messen/beobachten)
--   old: Hilfsmittel sachgerecht nutzen (messen/beobachten)
--   new: ausgewählte Arbeitsmittel benennen und sachgerecht verwenden: Messen (z. B. Maßband, Waage, Thermometer), Beobachten (z. B. Lupe), Experimentieren (z. B. Reagenzglas, Becherglas, Pipette)
UPDATE lpm_data_objects SET title = 'Arbeitsmittel sachgerecht verwenden', description = 'ausgewählte Arbeitsmittel benennen und sachgerecht verwenden: Messen (z. B. Maßband, Waage, Thermometer), Beobachten (z. B. Lupe), Experimentieren (z. B. Reagenzglas, Becherglas, Pipette)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Arbeitsmittel sachgerecht verwenden"'), '{originaltext}', '"ausgewählte Arbeitsmittel benennen und sachgerecht verwenden: Messen (z. B. Maßband, Waage, Thermometer), Beobachten (z. B. Lupe), Experimentieren (z. B. Reagenzglas, Becherglas, Pipette)"'), updated_at = now() WHERE id = 'a518c1c4-1286-552b-9155-6e3e30e0ff3e';

-- MNT-56-M2-FOR-3 (reworded-expanded): Fortpflanzung/Entwicklung von Samenpflanzen beschreiben
--   old: Fortpflanzung/Entwicklung von Samenpflanzen beschreiben
--   new: Bestäubung, Befruchtung, Fruchtbildung, Samenbau und Keimung als Schritte der Fortpflanzung und Entwicklung von Samenpflanzen beschreiben
UPDATE lpm_data_objects SET title = 'Fortpflanzung und Entwicklung der Samenpflanzen beschreiben', description = 'Bestäubung, Befruchtung, Fruchtbildung, Samenbau und Keimung als Schritte der Fortpflanzung und Entwicklung von Samenpflanzen beschreiben', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Fortpflanzung und Entwicklung der Samenpflanzen beschreiben"'), '{originaltext}', '"Bestäubung, Befruchtung, Fruchtbildung, Samenbau und Keimung als Schritte der Fortpflanzung und Entwicklung von Samenpflanzen beschreiben"'), updated_at = now() WHERE id = 'c41dc217-6ba3-57b4-9cde-de22d68bebf8';

-- MNT-56-M2-FPA-2 (reworded-expanded): Blüten zergliedern
--   old: Blüten zergliedern
--   new: Blüten zergliedern und ein Blütendiagramm erstellen (KB)
UPDATE lpm_data_objects SET title = 'Blüten zergliedern und Blütendiagramm erstellen', description = 'Blüten zergliedern und ein Blütendiagramm erstellen (KB)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Blüten zergliedern und Blütendiagramm erstellen"'), '{originaltext}', '"Blüten zergliedern und ein Blütendiagramm erstellen (KB)"'), updated_at = now() WHERE id = 'c7c1a118-efda-59ea-8ff2-5a0357724320';

-- MNT-56-M2-NAC-1 (reworded-expanded): Nachweis von Stärke/Fett in Samen
--   old: Nachweis von Stärke/Fett in Samen
--   new: Stärkenachweis (Iod-Kaliumiodid-Lösung) und Fettnachweis (Fettfleckprobe) in Samen durchführen (z. B. Bohne, Raps)
UPDATE lpm_data_objects SET title = 'Stärke- und Fettnachweis in Samen', description = 'Stärkenachweis (Iod-Kaliumiodid-Lösung) und Fettnachweis (Fettfleckprobe) in Samen durchführen (z. B. Bohne, Raps)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Stärke- und Fettnachweis in Samen"'), '{originaltext}', '"Stärkenachweis (Iod-Kaliumiodid-Lösung) und Fettnachweis (Fettfleckprobe) in Samen durchführen (z. B. Bohne, Raps)"'), updated_at = now() WHERE id = '206e608f-bc89-525c-8dfd-48d4ffcf7ee4';

-- MNT-56-M2-ERN-2 (reworded-expanded): Fotosynthese: Herstellung körpereigener Stoffe
--   old: Fotosynthese: Herstellung körpereigener Stoffe
--   new: Fotosynthese als Umwandlung von Kohlenstoffdioxid und Wasser im Chlorophyll mit Sonnenlicht zu Traubenzucker und Sauerstoff beschreiben; Traubenzucker als Grundlage für Stärke, Fette und Farbstoffe
UPDATE lpm_data_objects SET title = 'Fotosynthese beschreiben', description = 'Fotosynthese als Umwandlung von Kohlenstoffdioxid und Wasser im Chlorophyll mit Sonnenlicht zu Traubenzucker und Sauerstoff beschreiben; Traubenzucker als Grundlage für Stärke, Fette und Farbstoffe', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Fotosynthese beschreiben"'), '{originaltext}', '"Fotosynthese als Umwandlung von Kohlenstoffdioxid und Wasser im Chlorophyll mit Sonnenlicht zu Traubenzucker und Sauerstoff beschreiben; Traubenzucker als Grundlage für Stärke, Fette und Farbstoffe"'), updated_at = now() WHERE id = '1fdb5b8b-238f-5042-a8e2-07ed83535545';

-- MNT-56-M2-ERN-3 (reworded-expanded): Wasseraufnahme (Oberflächenvergrößerung)/Transport beschreiben
--   old: Wasseraufnahme (Oberflächenvergrößerung)/Transport beschreiben
--   new: Wasseraufnahme über die Wurzelhaare (Oberflächenvergrößerung) und Transport in der Sprossachse über Kapillarität beschreiben; Kohlenstoffdioxid-Aufnahme über die Spaltöffnungen
UPDATE lpm_data_objects SET title = 'Wasseraufnahme und -transport beschreiben', description = 'Wasseraufnahme über die Wurzelhaare (Oberflächenvergrößerung) und Transport in der Sprossachse über Kapillarität beschreiben; Kohlenstoffdioxid-Aufnahme über die Spaltöffnungen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Wasseraufnahme und -transport beschreiben"'), '{originaltext}', '"Wasseraufnahme über die Wurzelhaare (Oberflächenvergrößerung) und Transport in der Sprossachse über Kapillarität beschreiben; Kohlenstoffdioxid-Aufnahme über die Spaltöffnungen"'), updated_at = now() WHERE id = '9fc5fa06-610c-5212-aac5-cf05c7bcb300';

-- MNT-56-M2-ORD-1c (reworded-expanded): Nach Verwandtschaft ordnen (Pflanzenfamilien)
--   old: Nach Verwandtschaft ordnen (Pflanzenfamilien)
--   new: Samenpflanzen aufgrund gemeinsamer Merkmale (Blüten-/Sprossachsenbau, Blattstellung, Fruchtformen) in Pflanzenfamilien einordnen (z. B. Kreuzblütengewächse)
UPDATE lpm_data_objects SET title = 'Samenpflanzen in Pflanzenfamilien einordnen', description = 'Samenpflanzen aufgrund gemeinsamer Merkmale (Blüten-/Sprossachsenbau, Blattstellung, Fruchtformen) in Pflanzenfamilien einordnen (z. B. Kreuzblütengewächse)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Samenpflanzen in Pflanzenfamilien einordnen"'), '{originaltext}', '"Samenpflanzen aufgrund gemeinsamer Merkmale (Blüten-/Sprossachsenbau, Blattstellung, Fruchtformen) in Pflanzenfamilien einordnen (z. B. Kreuzblütengewächse)"'), updated_at = now() WHERE id = 'd3bc4da1-e7d0-54a0-ba53-88d20cb2b784';

-- MNT-56-M2-ORD-2 (reworded-narrowed): Zwei Pflanzenfamilien definieren
--   old: Zwei Pflanzenfamilien definieren
--   new: zwei Vertreter einer Pflanzenfamilie im Vergleich zu anderen Familien einordnen
UPDATE lpm_data_objects SET title = 'Zwei Vertreter einer Pflanzenfamilie einordnen', description = 'zwei Vertreter einer Pflanzenfamilie im Vergleich zu anderen Familien einordnen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Zwei Vertreter einer Pflanzenfamilie einordnen"'), '{originaltext}', '"zwei Vertreter einer Pflanzenfamilie im Vergleich zu anderen Familien einordnen"'), updated_at = now() WHERE id = 'b60088aa-780c-5a06-83df-2c25d0d9a760';

-- MNT-56-M3-WIR-2 (reworded-expanded): Begriff Wirbeltier definieren
--   old: Begriff Wirbeltier definieren
--   new: Begriff Wirbeltier definieren (Innenskelett mit Schädel und Wirbelsäule) und von Wirbellosen abgrenzen
UPDATE lpm_data_objects SET title = 'Begriff Wirbeltier definieren und abgrenzen', description = 'Begriff Wirbeltier definieren (Innenskelett mit Schädel und Wirbelsäule) und von Wirbellosen abgrenzen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Begriff Wirbeltier definieren und abgrenzen"'), '{originaltext}', '"Begriff Wirbeltier definieren (Innenskelett mit Schädel und Wirbelsäule) und von Wirbellosen abgrenzen"'), updated_at = now() WHERE id = '015d0a14-02d0-5ded-8244-bf1876f2a951';

-- MNT-56-M3-ERN-2 (reworded-narrowed): Körpereigene Stoffe mit Teilchenmodell beschreiben
--   old: Körpereigene Stoffe mit Teilchenmodell beschreiben
--   new: Zerlegung der Nahrung und Aufbau körpereigener Stoffe beschreiben
UPDATE lpm_data_objects SET title = 'Zerlegung der Nahrung und Aufbau körpereigener Stoffe beschreiben', description = 'Zerlegung der Nahrung und Aufbau körpereigener Stoffe beschreiben', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Zerlegung der Nahrung und Aufbau körpereigener Stoffe beschreiben"'), '{originaltext}', '"Zerlegung der Nahrung und Aufbau körpereigener Stoffe beschreiben"'), updated_at = now() WHERE id = 'b62370af-2fe2-5a6c-9b4a-f65a7b008337';

-- MNT-56-M3-ATM-1 (reworded-expanded): Bau der Atmungsorgane <-> Lebensraum (Kiemen/Haut/Lunge)
--   old: Bau der Atmungsorgane <-> Lebensraum (Kiemen/Haut/Lunge)
--   new: Atmungsorgane der Wirbeltierklassen im Zusammenhang mit ihrem Lebensraum beschreiben (z. B. Kiemen bei Fischen und Larven der Lurche, Lunge bei erwachsenen Lurchen, Säugetieren und Vögeln)
UPDATE lpm_data_objects SET title = 'Atmungsorgane im Zusammenhang mit dem Lebensraum beschreiben', description = 'Atmungsorgane der Wirbeltierklassen im Zusammenhang mit ihrem Lebensraum beschreiben (z. B. Kiemen bei Fischen und Larven der Lurche, Lunge bei erwachsenen Lurchen, Säugetieren und Vögeln)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Atmungsorgane im Zusammenhang mit dem Lebensraum beschreiben"'), '{originaltext}', '"Atmungsorgane der Wirbeltierklassen im Zusammenhang mit ihrem Lebensraum beschreiben (z. B. Kiemen bei Fischen und Larven der Lurche, Lunge bei erwachsenen Lurchen, Säugetieren und Vögeln)"'), updated_at = now() WHERE id = 'b2dc23c5-661a-532c-8247-2829885f1d2f';

-- MNT-56-M3-FBW-1 (reworded-expanded): Körperbau/Fortbewegung/Lebensraum (Struktur-Funktion)
--   old: Körperbau/Fortbewegung/Lebensraum (Struktur-Funktion)
--   new: Zusammenhang zwischen Gliedmaßenskelett und Fortbewegungsart bei Säugetieren beschreiben (z. B. Rotfuchs: Laufen, Kleine Hufeisennase: Fliegen, Delfin: Schwimmen)
UPDATE lpm_data_objects SET title = 'Zusammenhang Gliedmaßenskelett und Fortbewegung beschreiben', description = 'Zusammenhang zwischen Gliedmaßenskelett und Fortbewegungsart bei Säugetieren beschreiben (z. B. Rotfuchs: Laufen, Kleine Hufeisennase: Fliegen, Delfin: Schwimmen)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Zusammenhang Gliedmaßenskelett und Fortbewegung beschreiben"'), '{originaltext}', '"Zusammenhang zwischen Gliedmaßenskelett und Fortbewegungsart bei Säugetieren beschreiben (z. B. Rotfuchs: Laufen, Kleine Hufeisennase: Fliegen, Delfin: Schwimmen)"'), updated_at = now() WHERE id = 'f4d3b010-c86d-5569-9737-6c776e803acc';

-- MNT-56-M3-FOR-2 (reworded-expanded): Befruchtungsformen vergleichen/definieren
--   old: Befruchtungsformen vergleichen/definieren
--   new: äußere Befruchtung (z. B. Lurche) und innere Befruchtung (z. B. Säugetiere) vergleichen
UPDATE lpm_data_objects SET title = 'Äußere und innere Befruchtung vergleichen', description = 'äußere Befruchtung (z. B. Lurche) und innere Befruchtung (z. B. Säugetiere) vergleichen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Äußere und innere Befruchtung vergleichen"'), '{originaltext}', '"äußere Befruchtung (z. B. Lurche) und innere Befruchtung (z. B. Säugetiere) vergleichen"'), updated_at = now() WHERE id = '47322576-0224-581b-a15c-5a2b08ad7247';

-- MNT-56-M3-FOR-3 (reworded-expanded): Befruchtung/Eibau/Entwicklung/Lebensraum verknüpfen
--   old: Befruchtung/Eibau/Entwicklung/Lebensraum verknüpfen
--   new: Entwicklung vom befruchteten Ei zum erwachsenen Tier klassenspezifisch beschreiben (z. B. Lurche: Laich - Larve - erwachsenes Tier; Säugetiere: Embryo - Geburt)
UPDATE lpm_data_objects SET title = 'Entwicklung vom befruchteten Ei zum erwachsenen Tier beschreiben', description = 'Entwicklung vom befruchteten Ei zum erwachsenen Tier klassenspezifisch beschreiben (z. B. Lurche: Laich - Larve - erwachsenes Tier; Säugetiere: Embryo - Geburt)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Entwicklung vom befruchteten Ei zum erwachsenen Tier beschreiben"'), '{originaltext}', '"Entwicklung vom befruchteten Ei zum erwachsenen Tier klassenspezifisch beschreiben (z. B. Lurche: Laich - Larve - erwachsenes Tier; Säugetiere: Embryo - Geburt)"'), updated_at = now() WHERE id = '37cce1bb-7cbf-5c24-bb71-51277b0c612a';

-- MNT-56-M3-KRA-3 (reworded-narrowed): Strömungsverläufe beschreiben (Stromlinienkörper/Flügel/Verwirbelung)
--   old: Strömungsverläufe beschreiben (Stromlinienkörper/Flügel/Verwirbelung)
--   new: stromlinienförmige Körperform bei Fischen und Vögeln als Anpassung an die Fortbewegung in Wasser bzw. Luft beschreiben
UPDATE lpm_data_objects SET title = 'Stromlinienform als Anpassung beschreiben', description = 'stromlinienförmige Körperform bei Fischen und Vögeln als Anpassung an die Fortbewegung in Wasser bzw. Luft beschreiben', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Stromlinienform als Anpassung beschreiben"'), '{originaltext}', '"stromlinienförmige Körperform bei Fischen und Vögeln als Anpassung an die Fortbewegung in Wasser bzw. Luft beschreiben"'), updated_at = now() WHERE id = 'c1cc6b14-9c5f-5f0d-a0a0-8ebc9d635eb8';

-- MNT-56-M3-ORD-1b (reworded-expanded): Nach Nutzung ordnen (Heim-/Nutz-/Wildtiere)
--   old: Nach Nutzung ordnen (Heim-/Nutz-/Wildtiere)
--   new: Wirbeltiere nach Nutzung (Heim-/Nutz-/Wildtiere) und Lebensraum ordnen
UPDATE lpm_data_objects SET title = 'Wirbeltiere nach Nutzung und Lebensraum ordnen', description = 'Wirbeltiere nach Nutzung (Heim-/Nutz-/Wildtiere) und Lebensraum ordnen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Wirbeltiere nach Nutzung und Lebensraum ordnen"'), '{originaltext}', '"Wirbeltiere nach Nutzung (Heim-/Nutz-/Wildtiere) und Lebensraum ordnen"'), updated_at = now() WHERE id = '393ea953-4880-51f3-9503-6f8b534f3126';

-- MNT-56-M4-GES-1 (reworded-expanded): Vorbeugung von Haltungsschäden begründen
--   old: Vorbeugung von Haltungsschäden begründen
--   new: Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen (sportliche Tätigkeit, rückengerechtes Sitzen, Heben und Tragen)
UPDATE lpm_data_objects SET title = 'Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen', description = 'Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen (sportliche Tätigkeit, rückengerechtes Sitzen, Heben und Tragen)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen"'), '{originaltext}', '"Maßnahmen zur Gesunderhaltung des Stütz- und Bewegungssystems begründen (sportliche Tätigkeit, rückengerechtes Sitzen, Heben und Tragen)"'), updated_at = now() WHERE id = 'df9b858f-e765-5fef-be27-d90b789b3da6';

-- MNT-56-M4-GES-2 (reworded-expanded): Gesundheitsfördernde Ernährung begründen
--   old: Gesundheitsfördernde Ernährung begründen
--   new: abwechslungsreiche und vollwertige Ernährung begründen: Mangel- und Übergewichtsfolgen, Karies-Kausalkette, Ernährungskreis der DGE, Portionsgrößen
UPDATE lpm_data_objects SET title = 'Abwechslungsreiche und vollwertige Ernährung begründen', description = 'abwechslungsreiche und vollwertige Ernährung begründen: Mangel- und Übergewichtsfolgen, Karies-Kausalkette, Ernährungskreis der DGE, Portionsgrößen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Abwechslungsreiche und vollwertige Ernährung begründen"'), '{originaltext}', '"abwechslungsreiche und vollwertige Ernährung begründen: Mangel- und Übergewichtsfolgen, Karies-Kausalkette, Ernährungskreis der DGE, Portionsgrößen"'), updated_at = now() WHERE id = '678fe211-d660-5bbe-bb8d-5688ec0b8781';

-- MNT-56-M4-GES-4 (reworded-narrowed): Körperhygiene begründen (Zahnpflege/Hautschutz)
--   old: Körperhygiene begründen (Zahnpflege/Hautschutz)
--   new: Zahnpflege im Zusammenhang mit der Karies-Kausalkette begründen
UPDATE lpm_data_objects SET title = 'Zahnpflege begründen', description = 'Zahnpflege im Zusammenhang mit der Karies-Kausalkette begründen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Zahnpflege begründen"'), '{originaltext}', '"Zahnpflege im Zusammenhang mit der Karies-Kausalkette begründen"'), updated_at = now() WHERE id = '32a2ac6a-65ac-5380-9bec-ef7160df2fb7';

-- MNT-56-M4-ERN-1 (reworded-expanded): Nahrungsmittel nach Nährstoffen/Energiegehalt ordnen
--   old: Nahrungsmittel nach Nährstoffen/Energiegehalt ordnen
--   new: Nahrungsbestandteile und ihre Bedeutung benennen: Kohlenhydrate, Fette und Eiweiße (Baustoffe/Energie), Wasser (Transport/Lösen), Ballaststoffe (Quellung/Darmflora), Mineralsalze z. B. Calcium (Knochenaufbau), Vitamine z. B. Vitamin C (Immunsystem)
UPDATE lpm_data_objects SET title = 'Nahrungsbestandteile und ihre Bedeutung benennen', description = 'Nahrungsbestandteile und ihre Bedeutung benennen: Kohlenhydrate, Fette und Eiweiße (Baustoffe/Energie), Wasser (Transport/Lösen), Ballaststoffe (Quellung/Darmflora), Mineralsalze z. B. Calcium (Knochenaufbau), Vitamine z. B. Vitamin C (Immunsystem)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Nahrungsbestandteile und ihre Bedeutung benennen"'), '{originaltext}', '"Nahrungsbestandteile und ihre Bedeutung benennen: Kohlenhydrate, Fette und Eiweiße (Baustoffe/Energie), Wasser (Transport/Lösen), Ballaststoffe (Quellung/Darmflora), Mineralsalze z. B. Calcium (Knochenaufbau), Vitamine z. B. Vitamin C (Immunsystem)"'), updated_at = now() WHERE id = '05deb095-b225-5d30-930e-b12966e4d6bb';

-- MNT-56-M4-SEX-1 (reworded-expanded): Körperliche/Verhaltensänderungen in der Pubertät nennen
--   old: Körperliche/Verhaltensänderungen in der Pubertät nennen
--   new: körperliche und Verhaltensänderungen in der Pubertät nennen (sekundäre Geschlechtsmerkmale, Menstruation/Pollution) und Akzeptanz unterschiedlicher sexueller Orientierungen und Identitäten als Teil dieser Entwicklung thematisieren
UPDATE lpm_data_objects SET title = 'Veränderungen in der Pubertät nennen', description = 'körperliche und Verhaltensänderungen in der Pubertät nennen (sekundäre Geschlechtsmerkmale, Menstruation/Pollution) und Akzeptanz unterschiedlicher sexueller Orientierungen und Identitäten als Teil dieser Entwicklung thematisieren', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Veränderungen in der Pubertät nennen"'), '{originaltext}', '"körperliche und Verhaltensänderungen in der Pubertät nennen (sekundäre Geschlechtsmerkmale, Menstruation/Pollution) und Akzeptanz unterschiedlicher sexueller Orientierungen und Identitäten als Teil dieser Entwicklung thematisieren"'), updated_at = now() WHERE id = '1f1f0869-8f45-5a69-8681-1b36b73e7699';

-- MNT-56-M4-SEX-3 (reworded-expanded): Fortpflanzung/Entwicklung des Menschen beschreiben
--   old: Fortpflanzung/Entwicklung des Menschen beschreiben
--   new: Fortpflanzung des Menschen beschreiben (innere Befruchtung, Schwangerschaft und Embryonalentwicklung über die Nabelschnur, Geburt)
UPDATE lpm_data_objects SET title = 'Fortpflanzung des Menschen beschreiben', description = 'Fortpflanzung des Menschen beschreiben (innere Befruchtung, Schwangerschaft und Embryonalentwicklung über die Nabelschnur, Geburt)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Fortpflanzung des Menschen beschreiben"'), '{originaltext}', '"Fortpflanzung des Menschen beschreiben (innere Befruchtung, Schwangerschaft und Embryonalentwicklung über die Nabelschnur, Geburt)"'), updated_at = now() WHERE id = '502540d2-8051-58e4-bcef-4b0f2fc931ca';

-- MNT-56-M5-LR-3 (reworded-narrowed): Bau/Lebensweise/Lebensraum (Struktur-Funktion: Temp/Aktivität, Körperbedeckung/Dämmung, Farbe/Tarnung)
--   old: Bau/Lebensweise/Lebensraum (Struktur-Funktion: Temp/Aktivität, Körperbedeckung/Dämmung, Farbe/Tarnung)
--   new: Zusammenhang zwischen Körperbau, Körpertemperatur und Lebensraum bei Wirbeltieren erläutern
UPDATE lpm_data_objects SET title = 'Körperbau, Körpertemperatur und Lebensraum verknüpfen', description = 'Zusammenhang zwischen Körperbau, Körpertemperatur und Lebensraum bei Wirbeltieren erläutern', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Körperbau, Körpertemperatur und Lebensraum verknüpfen"'), '{originaltext}', '"Zusammenhang zwischen Körperbau, Körpertemperatur und Lebensraum bei Wirbeltieren erläutern"'), updated_at = now() WHERE id = '30abcc70-ab22-52c9-87f0-895e38202d5f';

-- MNT-56-M5-FPA-1a (reworded-narrowed): Lupe und Mikroskop sachgerecht handhaben
--   old: Lupe und Mikroskop sachgerecht handhaben
--   new: die Lupe sachgerecht als wiederkehrendes Hilfsmittel verwenden (z. B. bei Samenpflanzen, Wirbeltieren, Bionik)
UPDATE lpm_data_objects SET title = 'Lupe sachgerecht handhaben', description = 'die Lupe sachgerecht als wiederkehrendes Hilfsmittel verwenden (z. B. bei Samenpflanzen, Wirbeltieren, Bionik)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Lupe sachgerecht handhaben"'), '{originaltext}', '"die Lupe sachgerecht als wiederkehrendes Hilfsmittel verwenden (z. B. bei Samenpflanzen, Wirbeltieren, Bionik)"'), updated_at = now() WHERE id = '4b6fd514-838b-5ec7-84d5-5883dcb43f06';

-- MNT-56-M6-BIO-2a (reworded-narrowed): Festlegen der technisch zu realisierenden Funktion
--   old: Festlegen der technisch zu realisierenden Funktion
--   new: ein biologisches Vorbild untersuchen und das zugrunde liegende Prinzip erkennen
UPDATE lpm_data_objects SET title = 'Biologisches Vorbild untersuchen und Prinzip erkennen', description = 'ein biologisches Vorbild untersuchen und das zugrunde liegende Prinzip erkennen', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Biologisches Vorbild untersuchen und Prinzip erkennen"'), '{originaltext}', '"ein biologisches Vorbild untersuchen und das zugrunde liegende Prinzip erkennen"'), updated_at = now() WHERE id = 'fd5a26b5-5f51-5be3-bd09-28c7559e8ce1';

-- MNT-56-M6-PRO-1a (reworded-expanded): Vorgehensweise der Bionik am ausgewählten Beispiel umsetzen
--   old: Vorgehensweise der Bionik am ausgewählten Beispiel umsetzen
--   new: die Schrittfolge der Bionik an einem der vier Fallbeispiele umsetzen (Klettverschluss, Leichtbauweise, Vom Nebeltrinkerkäfer zur Trinkwassergewinnung, Lotuseffekt)
UPDATE lpm_data_objects SET title = 'Schrittfolge der Bionik umsetzen', description = 'die Schrittfolge der Bionik an einem der vier Fallbeispiele umsetzen (Klettverschluss, Leichtbauweise, Vom Nebeltrinkerkäfer zur Trinkwassergewinnung, Lotuseffekt)', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Schrittfolge der Bionik umsetzen"'), '{originaltext}', '"die Schrittfolge der Bionik an einem der vier Fallbeispiele umsetzen (Klettverschluss, Leichtbauweise, Vom Nebeltrinkerkäfer zur Trinkwassergewinnung, Lotuseffekt)"'), updated_at = now() WHERE id = '858afecb-1cf2-5b96-acdb-155cb9a032b9';

-- MNT-56-M6-PRO-1b (reworded-expanded): Anschauungsmodell herstellen, Bedeutung erläutern
--   old: Anschauungsmodell herstellen, Bedeutung erläutern
--   new: ein Funktionsmodell zum gewählten Bionik-Beispiel herstellen und die Übertragung auf die technische Anwendung erläutern
UPDATE lpm_data_objects SET title = 'Funktionsmodell herstellen und Übertragung erläutern', description = 'ein Funktionsmodell zum gewählten Bionik-Beispiel herstellen und die Übertragung auf die technische Anwendung erläutern', content = jsonb_set(jsonb_set(content, '{kurzbezeichnung}', '"Funktionsmodell herstellen und Übertragung erläutern"'), '{originaltext}', '"ein Funktionsmodell zum gewählten Bionik-Beispiel herstellen und die Übertragung auf die technische Anwendung erläutern"'), updated_at = now() WHERE id = '3567aeb7-d9af-5298-b227-533a9df8c167';

