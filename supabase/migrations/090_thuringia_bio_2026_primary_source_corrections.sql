SET search_path = public, extensions;

-- Real feedback b70e39a5 (Susan Hanisch, 2026-10-03): she flagged
-- "Einzellern zu Vielzellern (Grünalgen)" as a learning goal that doesn't
-- belong, pointing at the real 2024->2026 Thuringia Biologie changes CSV
-- (EvoMentor_DE/data/thuringia_2026_lp_data/LP Thüringen Bio Änderungen
-- 2024-2026.csv) and asking that the live list actually be checked against
-- it. That CSV, and the two migrations that acted on it (028, 034), were
-- both written without live database read access (migration 085's
-- service_role grant didn't exist yet) -- this migration is the first pass
-- done WITH real read access, AND against the real primary-source PDF
-- itself (EvoMentor_DE/data/thuringia_2026_lp_data/LP Thüringen Bio Gym
-- 2026 Erprobungsfassung.pdf, read directly via pdftotext, every detailed
-- Lernbereich section for Kl.7/8, 9 and 10 checked line by line), not just
-- the pre-built diff CSV, since the CSV turned out to have its own real
-- gaps (see below).
--
-- ============================================================
-- Part 1: two erroneous items, created by migration 028 without live read
-- access to check whether they already existed.
-- ============================================================
--
-- "Einzellern zu Vielzellern (Grünalgen)" is NOT a real learning objective
-- anywhere in the 2026 document -- confirmed by reading every Kl.7/8, 9 and
-- 10 Lernbereich section in full. The phrase only appears once, in the
-- document's high-level cross-cutting Basiskonzepte overview table (a
-- thematic summary, not a graded "Schülerinnen und Schüler können..."
-- objective). It's also already a real taxonomy concept
-- ("Evolution von Einzellern zu Vielzellern", inserted by this same
-- migration 028's own Part 1) used as a *relevance tag* on several already-
-- existing items (Fotosynthese, Pilz-Zellen, genetischer Code, Zellkern) in
-- the original source data (EvoMentor_DE/data/lernziele_gy910.json).
-- Migration 028 double-counted the overview table's label: correctly as a
-- tag, and incorrectly again as a brand-new standalone Lernziel. Deleting
-- outright, not archiving -- there is no real cut content here to preserve,
-- just a duplicate-in-spirit row that should never have been created.
--
-- "Ökosysteme nach Kriterien einteilen" (migration 028's other "genuinely
-- new" item) is a real duplicate of an already-existing item,
-- "Ökosysteme einteilen" (source id GY-910-OKO-OSY-6, from the original
-- lernziele_gy910.json, with a full Basiskonzept-Bezug analysis the
-- migration-028 version never got). Same root cause: migration 028 had no
-- live read access to notice this content already existed under a
-- near-identical title. Deleting the thinner duplicate, keeping the
-- original.
DELETE FROM lpm_data_objects WHERE id = '0180d214-b257-4ddc-b5d7-34fafb752904'; -- "Einzellern zu Vielzellern (Grünalgen)"
DELETE FROM lpm_data_objects WHERE id = 'bbe26b00-b905-43ff-bdb2-786ed53d5b24'; -- "Ökosysteme nach Kriterien einteilen" (dup of c7205902...)

-- ============================================================
-- Part 2: real content the 2026 Erprobungsfassung actually cut. Confirmed
-- directly: the real Kl.9 "Ökologie" Lernbereich section's abiotic-factors
-- objective now reads only "Licht- und Schattenblätter" -- "Feucht- und
-- Trockenlufttiere" has no counterpart anywhere in the 2026 document.
-- Archived, not deleted -- this was real, previously-taught content (an
-- actual curriculum change, not a data-entry error), so a researcher may
-- still want historical access to what used to be taught. Relies on
-- listTopics() now filtering to status='accepted' (see the matching
-- frontend fix in this same commit) to actually stop showing it in Browse
-- -- archiving alone did nothing before that fix, since nothing ever
-- filtered on status.
--
-- Fix, caught live 2026-10-03 (this migration failed on first attempt,
-- SQLSTATE 23514): 'archived' was never a legal value of this column's own
-- status_check constraint (001_initial_schema.sql only ever defined draft/
-- submitted/under_review/accepted/rejected). Widening it here, in the same
-- migration that's the first to actually need the new value.
ALTER TABLE lpm_data_objects DROP CONSTRAINT lpm_data_objects_status_check;
ALTER TABLE lpm_data_objects ADD CONSTRAINT lpm_data_objects_status_check
  CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'archived'));

UPDATE lpm_data_objects SET status = 'archived', updated_at = now()
WHERE id = 'b056e65a-efa0-5b00-863a-1cf38d5863ef'; -- "Angepasstheit: Feucht- und Trockenlufttiere"

-- ============================================================
-- Part 3: the Kl.9/Kl.10 split design note (thuringia-2026-lehrplan-
-- wording-changes-followup.md, item 4) flagged as "worth checking" is now
-- confirmed real: the 2026 document gives Genetik and Evolution their own
-- exclusive "Klassenstufe 10" sections (2.3.1.1, 2.3.1.2), separate from
-- Kl.9's "Stoff- und Energiewechselprozesse"/"Ökologie". These 18 live
-- items are genetics content (replication, mitosis/meiosis, Mendel,
-- karyotype, chromatin) that the *original* EvoMentor import left tagged
-- grade_band='9' -- while the rest of the Genetik section (genetic code,
-- gene technology, mutation, recombination, prenatal diagnostics) was
-- already correctly tagged '10'. An old, inconsistent split, not something
-- 2026 changed -- but one real document structure to align 18 real items
-- to, confirmed by reading the Genetik section directly rather than
-- guessing from the topic name alone. By exact id, not by title/pattern
-- match, since this is a real content edit on live rows a pilot teacher is
-- actively using.
UPDATE lpm_data_objects SET grade_band = '10', updated_at = now()
WHERE project_id = (SELECT id FROM projects WHERE slug = 'evomentor-thuringia')
  AND grade_band = '9'
  AND id IN (
    'd8c70c32-b43b-5cc8-aff2-c69fe80d613a', -- Bedeutung der Weitergabe für die Fortpflanzung
    '2773d520-029c-5a2a-a7b3-99a9f401fa54', -- MENDELsche Regeln: Bedeutung erläutern
    'a92f7e0d-d0a2-53ef-b7c3-dbd32b3d19f3', -- Mikroskopie: Riesenchromosomen (DP)
    '05736d97-42e3-558c-a03b-47fade83a6dd', -- Mikroskopie: Mitosestadien (DP oder FP)
    '19f1e926-a746-5189-aa65-809e6fa5902f', -- Kreuzungsschema: Allelkombinationen darstellen
    '3cbbd668-3c70-5abd-9c52-55d9c873fe35', -- Zustandsformen des Chromatins
    '8f4197c9-7729-5628-9041-facbbec21979', -- Zellkern als Träger der Erbinformation
    'ae2983a9-8b18-59f1-9f61-aa1716177fd4', -- Meiose und Keimzellenbildung
    '665905b2-673d-53c3-a189-0ad9634552b4', -- Dominant-rezessive, intermediäre und kodominante Erbgänge
    'c563e901-c1f3-58e0-94d2-8d624be26579', -- Genetische Grundbegriffe anwenden
    '464b0e44-6f01-5660-b0f9-389556354a6d', -- Blutgruppenvererbung und Geschlechtsvererbung
    '3e7bf117-4ee8-59f3-a6a6-85bf3c6ec9e8', -- Karyogramm: Chromosomensatz des Menschen
    '573c90a8-8c14-549e-8378-b05a6ff50809', -- Bedeutung der Experimente von Griffith und Avery
    '2d10892d-1458-5cc8-ac67-b7cc7a4576f5', -- Bau von DNA und RNA
    'cdd32fad-813d-5127-a7c9-18897b05db3f', -- Semikonservative Replikation
    '62323fec-9362-5cff-9de2-3a88c14f0d59', -- Fehlerkontrolle und Reparatur bei Replikation
    '10abe302-3205-5b2a-ad9b-11eabd34805f', -- Zellzyklus und Mitose
    '54125812-9164-5015-ac25-d8936d599110'  -- Bedeutung der Weitergabe für Zellteilungen
  );

-- ============================================================
-- Note on the rest of the original ~15-item wording-corrections backlog
-- (thuringia-2026-lehrplan-wording-changes-followup.md, items 5, 7-15):
-- checked every one directly against both the live row and the real PDF
-- text. All of them (Pilz-Zellen "am Beispiel der Hefen", Hutpilze/
-- Schimmelpilze/Hefepilze, "Konkurrenz" in biotische Wechselbeziehungen,
-- Kreuzungsschema "statistischer Charakter", Proteine "als Grundlage für",
-- the Rekombination/Mutation/Modifikation Variabilität split, named
-- hereditary-disease examples + Therapiemöglichkeiten, "menschliche
-- Rassen" + Jenaer Erklärung) are already live and already correct --
-- no action needed. Item 5's "(MB, BO, BNE)" tag is the document's own
-- internal competency-framework code, not part of the substantive
-- objective text; every other live item already omits these same codes
-- (e.g. item 14/15's own "(DB)"/"(MB, DB)"), so adding it here would break
-- an existing, deliberate convention, not fix a gap.
