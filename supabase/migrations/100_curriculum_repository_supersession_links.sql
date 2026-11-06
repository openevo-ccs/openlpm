SET search_path = public, extensions;

-- Triggered by Dustin asking how to best represent Thuringia Biology's real
-- curriculum history (1999 -> 2024 -> 2026-Erprobungsfassung, already
-- researched and imported into the live Thuringia Curriculum Repository
-- project) in an accurate and helpful way. Checking the live data found two
-- real gaps, both ecosystem-wide, not Thuringia-specific:
--
-- 1. `event_date`/`effective_from`/`effective_until` (migration 094) exist
--    on every `curriculum_repository_records` row but are null on all 227
--    live records, across every jurisdiction -- confirmed live. The source
--    YAML (deutsche_lp's policy-timeline-event / institutional-mandate-
--    record schemas) already carries real dates (dateStart/dateEnd/
--    adoptionDate/targetDate); `import_curriculum_repository.py` never
--    learned to map them onto these columns. Fixed in the same commit as
--    this migration, not here (that's a script change, not schema).
--
-- 2. There is no way to record that one record directly replaces another.
--    `standards_documents.supersedes_document_id` (migration 044) already
--    solves this at the whole-document-version level; individual
--    `curriculum_repository_records` had no equivalent. deutsche_lp's
--    policy-timeline-event schema already has a `supersedes` field (added
--    2026-10-02 specifically for this Thuringia Biologie edition chain) and
--    institutional-mandate-record has the mirrored `supersededBy` -- neither
--    had anywhere to land once imported. This migration adds that mirror.
ALTER TABLE curriculum_repository_records
  ADD COLUMN IF NOT EXISTS supersedes_record_id UUID REFERENCES curriculum_repository_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_curriculum_repository_records_supersedes
  ON curriculum_repository_records(supersedes_record_id);

COMMENT ON COLUMN curriculum_repository_records.supersedes_record_id IS
  'The prior record (same record_type, almost always policy-timeline-event) this one directly replaces, if any -- e.g. a curriculum edition pointing at the edition it replaced. Mirrors standards_documents.supersedes_document_id (migration 044) one level down, at the individual-record granularity. Nullable; most records are not part of any edition chain.';
