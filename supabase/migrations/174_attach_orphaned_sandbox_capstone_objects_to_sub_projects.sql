-- Migration 160 seeded four nested sandbox sub-projects under bio-core-lpm-synth and
-- interdisciplinary-lpm-synth (Human Lineage Capstone, Human Lineage K-12, Evo-Anthro
-- Capstone, Machine Culture and Human-AI Coevolution Capstone). Its lpm_data_objects
-- INSERT statements left out project_id and branch_id, so the 15 content rows it created
-- (4 strands, 7 substrands, 4 assessment items) have project_id NULL. The sub-projects'
-- threads, stations and connections were written with the right project_id, which is why
-- each sub-project shows threads but no learning goals, and why its content is invisible
-- to project members.
--
-- Checked on 2026-10-25 against the live database: exactly 15 rows have project_id NULL,
-- all created 2026-10-22 by migration 160, and every one is reached by exactly one
-- sub-project through its thread stations or connections.
--
-- This migration attaches each orphan to that sub-project and its trunk branch. It only
-- touches rows that are still orphaned and only for these four sub-projects, so it is
-- safe to re-run.

WITH sandbox_projects AS (
  SELECT id FROM projects
  WHERE slug IN (
    'bio-core-human-lineage-capstone',
    'bio-core-human-lineage-k12',
    'interdisciplinary-evo-anthro-capstone',
    'interdisciplinary-machine-culture-coevolution'
  )
),
reached AS (
  SELECT s.data_object_id AS object_id, t.project_id
  FROM lpm_thread_stations s
  JOIN lpm_threads t ON t.id = s.thread_id
  WHERE t.project_id IN (SELECT id FROM sandbox_projects)
  UNION
  SELECT c.from_object_id, c.project_id FROM lpm_connections c
  WHERE c.project_id IN (SELECT id FROM sandbox_projects)
  UNION
  SELECT c.to_object_id, c.project_id FROM lpm_connections c
  WHERE c.project_id IN (SELECT id FROM sandbox_projects)
),
unique_owner AS (
  SELECT object_id, min(project_id::text)::uuid AS project_id
  FROM reached
  GROUP BY object_id
  HAVING count(DISTINCT project_id) = 1
)
UPDATE lpm_data_objects o
SET project_id = u.project_id,
    branch_id = (SELECT b.id FROM branches b WHERE b.project_id = u.project_id AND b.is_trunk = TRUE LIMIT 1),
    updated_at = now()
FROM unique_owner u
WHERE o.id = u.object_id
  AND o.project_id IS NULL;
