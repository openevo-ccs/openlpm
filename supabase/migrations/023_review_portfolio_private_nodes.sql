SET search_path = public, extensions;

-- Lets a Notebook's private draft (a note, question, draft_concept, or
-- draft_lesson -- portfolio_private_nodes) be submitted into the peer
-- review queue, per Dustin's explicit ask ("ask for a notebook or notebook
-- item to go into peer review"). Not 'portfolio_item' (migration 020's
-- other addition) -- a portfolio_item only ever references already-real,
-- already-reviewed canonical content, so resubmitting it for review
-- wouldn't mean anything; a private draft is the thing that's actually
-- being proposed. Same open-CHECK, extend-don't-replace pattern used every
-- time this column has grown (012, 020).
ALTER TABLE peer_review_assignments DROP CONSTRAINT IF EXISTS peer_review_assignments_reviewable_type_check;
ALTER TABLE peer_review_assignments ADD CONSTRAINT peer_review_assignments_reviewable_type_check
  CHECK (reviewable_type IN (
    'literature_reference', 'lpm_data_object', 'lpm_connection', 'lpm_thread',
    'framework_tag', 'theory', 'portfolio_item', 'portfolio_private_node'
  ));
