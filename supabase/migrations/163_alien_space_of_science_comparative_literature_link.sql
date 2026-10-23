-- Links Artiles et al. (2026), "The Alien Space of Science" (arXiv:2603.01092,
-- OE-LITERATURE-artiles-2026-alien-space-of-science) to both synthetic LPMs,
-- following the same per-project literature_references.notes pattern migration
-- 149 established ("Grounds this project's '<theory>' theory: <why>") -- the
-- first paper added under that pattern for a reason that isn't primarily
-- "supports this project's own content," but "gives the two-project
-- comparison itself a methodological vocabulary."
--
-- The paper separates two things people conflate when judging a research
-- idea: whether it is sound, and whether the field's current researchers
-- have the habits of mind to propose it. Read against this comparative
-- study: Bio-Core's decentralized-causation framing (DCR) was the
-- combination evolution-education research was already organized around;
-- Interdisciplinary's agency-inclusive framing (ICR, Hanisch et al. 2025)
-- was sound before it was common -- a real instance of the paper's own
-- distinction, rather than a loose analogy. Confirmed live 2026-10-23: no existing
-- literature_references row for this literaturebase_id on either project.
--
-- literaturebase_snapshot already holds this record (synced 2026-10-23
-- immediately before this migration, scripts/sync_literaturebase_snapshot.mjs).
-- type left NULL: 'preprint' is not in literature_references.type's CHECK
-- (article, chapter, book, report, thesis) and no close match exists --
-- migration 149's own documented convention for exactly this case, rather
-- than guessing.

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, status, notes)
SELECT '28997544-0d87-4b05-9ee2-7c474513c108', 'OE-LITERATURE-artiles-2026-alien-space-of-science',
  'The Alien Space of Science: Sampling Coherent but Cognitively Unavailable Research Directions',
  '["Artiles, Alejandro H.","Weiss, Martin","Brinkmann, Levin","Rahwan, Iyad","Schölkopf, Bernhard","Pal, Christopher","Larochelle, Hugo","Goyal, Anirudh","Rahaman, Nasim"]'::jsonb,
  2026, '10.48550/arXiv.2603.01092', 'arXiv', 'accepted',
  'Relevant to this project''s standing in the comparative study with interdisciplinary-lpm-synth, rather than a primary source for Dichotomized Causal Reasoning (DCR) itself: this 2026 MPI paper formalizes the difference between an idea being scientifically sound and an idea being one a field''s current researchers would readily propose, given their own training and publication history. Bio-Core''s decentralized-causation framing is the position evolution-education research was already organized around when this comparative study began -- the side of the two projects'' documented DCR/ICR divergence that was, in this paper''s terms, already available to the field. The paper does not argue DCR is wrong; it gives a vocabulary for why a field settles on one defensible framing over another, which is the open, empirical question this comparative study investigates rather than assumes.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '28997544-0d87-4b05-9ee2-7c474513c108' AND literaturebase_id = 'OE-LITERATURE-artiles-2026-alien-space-of-science');

INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, status, notes)
SELECT '371fce26-d1f3-439b-95df-0a0e38b8a824', 'OE-LITERATURE-artiles-2026-alien-space-of-science',
  'The Alien Space of Science: Sampling Coherent but Cognitively Unavailable Research Directions',
  '["Artiles, Alejandro H.","Weiss, Martin","Brinkmann, Levin","Rahwan, Iyad","Schölkopf, Bernhard","Pal, Christopher","Larochelle, Hugo","Goyal, Anirudh","Rahaman, Nasim"]'::jsonb,
  2026, '10.48550/arXiv.2603.01092', 'arXiv', 'accepted',
  'Grounds this project''s "Restructuration Theory (Wilensky & Papert)" theory, extended to AI-assisted ideation: this 2026 MPI paper''s method for finding research directions that are sound under a field''s existing knowledge but outside what its current researchers would readily propose is a computational analogue of restructuration -- a change in available infrastructure changing what is discoverable, the same mechanism Restructuration Theory already claims for agent-based modeling and decentralized causal reasoning. The paper''s own validated finding (a real 2025 paper its method could have flagged a year early, because it sat in exactly this kind of sound-but-unexplored region) is an independent, external instance of the same pattern this project''s own agency-inclusive framing instantiates for evolution education (Hanisch et al. 2025): a framing that was sound before it was common.'
WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = '371fce26-d1f3-439b-95df-0a0e38b8a824' AND literaturebase_id = 'OE-LITERATURE-artiles-2026-alien-space-of-science');
