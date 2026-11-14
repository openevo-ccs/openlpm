SET search_path = public, extensions;

-- Removes the literature review space and its two tables added by migration 246 (2026-11-14). The space was neither a learning progression
-- model nor a curriculum repository, and it carried a collaborator group's name before any collaboration was agreed. Nothing had been saved in it.
DELETE FROM projects WHERE slug = 'evoke-literature-workshop';
DROP TABLE IF EXISTS literature_suggestions;
DROP TABLE IF EXISTS literature_reviews;
