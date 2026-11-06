-- Adds 'policy-controversy-record' to curriculum_repository_records'
-- record_type CHECK constraint. This is a new, tenth record-schema type
-- first authored in florida-lpm (curriculum-sources/florida-lpm, see its
-- own GOVERNANCE.md) alongside the nine deutsche-lpm/nys-lpm/india-lpm
-- schemas the constraint from 067_fix_curriculum_repository_record_types.sql
-- already covers.
--
-- Caught live on the real import: "new row for relation
-- curriculum_repository_records violates check constraint
-- curriculum_repository_records_record_type_check" on florida-lpm's first
-- policy-controversy-record row -- the schema/record files were ready
-- before this constraint was, same failure shape 067 itself already fixed
-- once for the original nine types.
SET search_path = public, extensions;

ALTER TABLE curriculum_repository_records DROP CONSTRAINT curriculum_repository_records_record_type_check;

ALTER TABLE curriculum_repository_records ADD CONSTRAINT curriculum_repository_records_record_type_check
  CHECK (record_type IN (
    'institutional-actor-record', 'institutional-mandate-record', 'policy-timeline-event',
    'coherence-finding-record', 'latent-connection-record', 'curriculum-crosswalk-record',
    'synthetic-curriculum-redesign-record', 'policy-principle-record', 'policy-brief-manifest',
    'policy-controversy-record'
  ));
