-- Migration 253 created schema_studio_snapshot with a BIGSERIAL id, but the sync script (service role) could not use its sequence.
-- This lets the service role insert new snapshot rows.
GRANT USAGE, SELECT ON SEQUENCE schema_studio_snapshot_id_seq TO service_role;
GRANT ALL ON schema_studio_snapshot TO service_role;
