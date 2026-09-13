SET search_path = public, extensions;

-- theory_relations.target_type (migration 020) only allowed
-- 'framework_tag' | 'data_object' | 'thread' -- but Concepts still runs on
-- lpm_schema_elements today (the frameworks/framework_tags migration to
-- Concepts is a deliberately separate, not-yet-done pass, per migration
-- 018's own comment). A theory needs to link to the concepts that actually
-- exist right now, not only to a table that has no real rows yet. Adding
-- 'schema_element' alongside the original three -- same open-CHECK,
-- extend-don't-replace pattern migration 012 already established for
-- peer_review_assignments.
ALTER TABLE theory_relations DROP CONSTRAINT IF EXISTS theory_relations_target_type_check;
ALTER TABLE theory_relations ADD CONSTRAINT theory_relations_target_type_check
  CHECK (target_type IN ('framework_tag', 'schema_element', 'data_object', 'thread'));
