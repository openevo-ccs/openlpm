SET search_path = public, extensions;

-- theory_relations.target_type (migrations 020/021) allows
-- 'framework_tag' | 'schema_element' | 'data_object' | 'thread' -- every
-- one a *curriculum* object. There is no way today for a project to say
-- "this theory is disputed by / is this project's adopted alternative to
-- that other theory" -- a real gap found while wiring EvoMentor
-- Thuringia's researcher view up to real TheoryBase content: OpenEvo's
-- own Integrated Causal Reasoning (ICR) theory and the rival Dichotomized
-- Causal Reasoning (DCR) position it was decided against are both real,
-- citable, locally-authored theories in that project today, with no
-- structured way to link one to the other -- only free-text description
-- prose. Adding 'theory' alongside the existing four, same
-- extend-don't-replace pattern migration 021 established for
-- 'schema_element'. target_id then points at another row in this same
-- theories table (self-referencing by convention, not a DB-level FK, the
-- same way target_id already works for every other target_type here).
ALTER TABLE theory_relations DROP CONSTRAINT IF EXISTS theory_relations_target_type_check;
ALTER TABLE theory_relations ADD CONSTRAINT theory_relations_target_type_check
  CHECK (target_type IN ('framework_tag', 'schema_element', 'data_object', 'thread', 'theory'));
