-- Fixes a real bug in 066_curriculum_repository.sql's record_type CHECK
-- constraint: it used shortened names ('institutional-actor',
-- 'policy-principle', etc.) that don't actually match what
-- scripts/import_curriculum_repository.py derives from each source schema's
-- own $schema filename (e.g. institutional-actor-RECORD.schema.json,
-- policy-principle-RECORD.schema.json) -- 7 of the 9 real schema filenames
-- in deutsche-lpm/nys-lpm carry a "-record" suffix the constraint omitted.
-- Caught live on the real import: "violates check constraint
-- curriculum_repository_records_record_type_check" on the very first batch.
SET search_path = public, extensions;

ALTER TABLE curriculum_repository_records DROP CONSTRAINT curriculum_repository_records_record_type_check;

ALTER TABLE curriculum_repository_records ADD CONSTRAINT curriculum_repository_records_record_type_check
  CHECK (record_type IN (
    'institutional-actor-record', 'institutional-mandate-record', 'policy-timeline-event',
    'coherence-finding-record', 'latent-connection-record', 'curriculum-crosswalk-record',
    'synthetic-curriculum-redesign-record', 'policy-principle-record', 'policy-brief-manifest'
  ));
