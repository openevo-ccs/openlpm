-- Real feedback (2026-10-20): "Major style fix needed across the whole LPM
-- for both bio-core and interdisciplinary -- especially superfluous 'own'
-- and 'real' ... rarely ever needed or helpful and very often very strange
-- and annoying." Also fixes every instance of the separately-banned
-- ", not X" / "not just X" contrast-crutch construction found in the same
-- content while doing this pass.
--
-- "own" in "X's own Y" is almost always pure filler here -- cut to "X's Y".
-- "real" is kept wherever it's doing real work distinguishing a real-world/
-- government curriculum document or a real empirical finding from this
-- project's synthetic/theoretical content (that axis is a genuine, load-
-- bearing feature of this whole comparison); cut everywhere it's pure
-- intensifier with nothing being contrasted.

-- lpm_data_objects
UPDATE lpm_data_objects SET description =
  'The central mechanistic strand. Builds the full four-component natural selection model (variation, heritability, differential reproduction, population-level change) using exclusively decentralized causal vocabulary -- BIO-CORE contains no organism-agency concepts, so this strand is structurally incapable of invoking behavioral niche selection or agential framing. That limitation comes from vocabulary scope, built in from the start, rather than from simplifying richer content.'
WHERE id = 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'; -- Natural Selection and Adaptation (bio-core)

UPDATE lpm_data_objects SET content = jsonb_set(content, '{description}', to_jsonb(
  'The central mechanistic strand. Builds the full four-component natural selection model (variation, heritability, differential reproduction, population-level change) using exclusively decentralized causal vocabulary -- BIO-CORE contains no organism-agency concepts, so this strand is structurally incapable of invoking behavioral niche selection or agential framing. That limitation comes from vocabulary scope, built in from the start, rather than from simplifying richer content.'::text))
WHERE id = 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'; -- same strand, mirrored inside content JSON

UPDATE lpm_data_objects SET content = jsonb_set(content, '{disputeInstantiation}', to_jsonb(
  'This strand''s structural incapacity to invoke organism agency instantiates the decentralized-causal-reasoning (DCR) position (TheoryBase OE-THEORY-dichotomized-causal-reasoning) in the real, published dispute with Kampourakis (2020) / Nehm & Kampourakis (2022) -- see openevo-graph''s nodes/disputes/dispute-openevo-vs-kampourakis.yaml, whose instantiatesIn edge already points at this strand''s id.'::text))
WHERE id = 'd1b088f7-a940-5d5e-a5bc-45c0a049d351'; -- Natural Selection and Adaptation (bio-core)

UPDATE lpm_data_objects SET content = jsonb_set(content, '{disputeInstantiation}', to_jsonb(
  'This strand instantiates the integrated-causal-reasoning (ICR) position (TheoryBase OE-THEORY-integrated-causal-reasoning) in the real, published dispute with Kampourakis (2020) / Nehm & Kampourakis (2022) -- see openevo-graph''s nodes/disputes/dispute-openevo-vs-kampourakis.yaml, whose instantiatesIn edge already points at this strand''s id.'::text))
WHERE id = '408a667a-93d5-58a1-bb50-f8e6606b9745'; -- Agency, Development, and Niche Construction (interdisciplinary)

UPDATE lpm_data_objects SET content = jsonb_set(content, '{note}', to_jsonb(
  'Marked optional (elective/regional extension) at this specific sub-strand only -- the AI-system application is treated as an advanced extension rather than core content, consistent with the phased, cautious approach to frontier interdisciplinary territory.'::text))
WHERE id = '5d938d91-e81b-516c-ba58-a234b6d5559f'; -- Agency and Niche Construction Across Biological and Technological Systems

UPDATE lpm_data_objects SET content = jsonb_set(content, '{description}', to_jsonb(
  'This strand exists only because OE-INTERDISCIPLINARY defines Analogical Reasoning and Metacognition as first-class concepts -- BIO-CORE has no equivalent, so LPM A (bio-core-k12) has no counterpart strand, the same reason Strand 2 (Agency/Niche Construction) has none either. A strand about how minds, cultures, and science itself come up with better ideas: not by searching everything at once, but by starting from whatever known case is most similar to the new problem, trying a small change, and keeping what works. Reinforces Strand 1''s Selection/Variation/Evolutionary Process vocabulary and Strand 3''s Innovation/Culture vocabulary throughout. Unlike Strands 1-3, this strand''s youngest bands are grounded directly in validated developmental-psychology task batteries (Pillow & Pearson''s controllability studies) -- a stronger evidentiary basis than the age-plausible design judgment the other strands'' youngest bands rely on.'::text))
WHERE id = '06af1b7b-19bb-5d77-87ac-52f34650f556'; -- Discovering and Testing Ideas: Analogy, Search, and the Growth of Understanding

-- curriculum_repository_links.rationale
UPDATE curriculum_repository_links SET rationale =
  'Sachsen''s real Biologie Lehrplan assigns content per individual Klassenstufe (5-10) rather than combined bands -- a direct structural contrast with this strand''s combined K-2/3-5/6-8/9-12 bands, worth surfacing rather than glossing over.'
WHERE id = '4803ed5c-521f-41aa-bb29-074a6610b303';

UPDATE curriculum_repository_links SET rationale =
  'Real-world sequencing varies by school track in Sachsen (Oberschule teaches human evolution a full grade earlier than Gymnasium) -- a concrete illustration of how the single synthetic K-12 progression here compresses a track-dependent variation.'
WHERE id = '9a2ed7f5-de3d-479d-b83a-c213462bbe01';

UPDATE curriculum_repository_links SET rationale =
  'Thüringen leaves sequencing within a combined Klassen-/Doppelklassenstufe entirely to the teacher -- a flexible counterpart to this strand''s fixed synthetic grade-band sequence.'
WHERE id = 'ea7c08d0-f413-4880-9b2e-35d3276195f6';

UPDATE curriculum_repository_links SET rationale =
  'Thüringen''s curriculum teaches population-thinking earlier than any other state checked -- a concrete real-world data point for how early this strand''s K-2/3-5 population concepts can be introduced.'
WHERE id = '93baafd9-f41e-496c-9fd3-55b13900aad9';

UPDATE curriculum_repository_links SET rationale =
  'This is itself a named "DCR-Consonant" curriculum redesign proposal for Thüringen -- the same Dichotomized Causal Reasoning framing this strand structurally instantiates, applied to a real curriculum document rather than a synthetic one.'
WHERE id = 'f1892742-e08b-4545-bbdc-16d28c3d7086';

UPDATE curriculum_repository_links SET rationale =
  'NYSSLS HS-LS4 is New York''s real biological-evolution standard. Its repository record marks its crosswalk to this kind of LPM content as "not yet attempted" -- linked here as an open gap rather than a completed comparison.'
WHERE id = 'd287f2fb-3799-4fb7-b7a3-82c2aff60636';

UPDATE curriculum_repository_links SET rationale =
  'California''s 2013 NGSS adoption is the standards mandate under which evolution/natural selection is taught statewide; starter-depth record, see california-curriculum-repository''s description.'
WHERE id = 'c798c464-69cf-413d-b48b-2c526873bd09';

UPDATE curriculum_repository_links SET rationale =
  'California''s anti-dogmatism policy is the explicit governing principle protecting evolution instruction in this exact strand''s subject matter; starter-depth record.'
WHERE id = '41c4b97e-5bcd-4757-8990-65837dfffea3';

UPDATE curriculum_repository_links SET rationale =
  'Sachsen''s 2026-2030 Lehrplan revision makes faecherverbindendes Lernen (cross-subject teaching) equally binding to single-subject Fachunterricht by 2030 -- real-world institutional backing for exactly the cross-subject design this strand represents.'
WHERE id = 'f49d8371-224c-4175-8504-3c7f2bdd0710';

UPDATE curriculum_repository_links SET rationale =
  'G/R/W''s foundational categories (Macht, Institutionen, Recht) are a curriculum anchor for this strand''s claim that institutions stabilize large-scale non-kin cooperation.'
WHERE id = '691ca558-6058-418f-9544-6b656d02d71f';

UPDATE curriculum_repository_links SET rationale =
  'Internationale Politik''s (Jgst. 11) curriculum content on intergroup dynamics is a concrete real-world anchor for this strand''s collective/institutional-systems content.'
WHERE id = '0a93c840-1035-4d1d-9d83-4f72bb0e749b';

UPDATE curriculum_repository_links SET rationale =
  'Wirtschaft und Wirtschaftsordnung''s homo-oeconomicus model is a direct, named contrast case for this strand''s agency/behavior framing.'
WHERE id = 'bfb7d527-774e-4406-8f77-9b733ece8538';

UPDATE curriculum_repository_links SET rationale =
  'A named Biologie/Informatik bridge proposal for Thüringen (modeling the hormone system as an information-processing system) -- a concrete real-world instance of the cross-subject bridging this strand represents.'
WHERE id = '738a81e2-fb0c-4db4-a173-a73378f6eb61';

UPDATE curriculum_repository_links SET rationale =
  'Thüringen''s Sozialkunde and Ethik curricula both ask overlapping nature-vs-nurture questions at the same grade, currently unlinked -- a direct real-world case this strand''s agency/development framing speaks to.'
WHERE id = 'fc824007-58ca-4786-a0ae-ae338cd8e162';

UPDATE curriculum_repository_links SET rationale =
  'Thüringen''s fachuebergreifend/faecherverbindend/faecherintegrierend typology is institutional vocabulary for exactly the kind of cross-domain organizing device this foundational strand uses.'
WHERE id = 'b9b51d85-afa6-4f8b-9ea5-8a467b436b51';

UPDATE curriculum_repository_links SET rationale =
  'The NYS Portrait of a Graduate''s "Global Citizen" attribute is a state-adopted framework naming evolved cooperation and institutional trust as a graduation-relevant competency -- a direct real-world anchor for this strand.'
WHERE id = 'f2bb1c89-b4d9-437a-86e0-1480dc6b7942';

UPDATE curriculum_repository_links SET rationale =
  '"What does it mean to be human?" is explicitly named in New York''s policy material as a jurisdiction-independent integrating question -- the same cross-domain organizing move this foundational strand makes.'
WHERE id = 'f9f208f8-d05c-44a3-b46d-5387e69db273';

UPDATE curriculum_repository_links SET rationale =
  'NGSS''s cross-cutting-concepts design (patterns, systems, structure/function) is a standards-level precedent for this strand''s cross-domain organizing device; starter-depth record.'
WHERE id = 'd9093ca2-ad8f-4017-a371-b432ae61150e';

-- theories.description
UPDATE theories SET description =
  'The Modern Synthesis explanatory structure (random heritable variation + differential reproduction through natural selection) is treated as complete and sufficient; organism agency is excluded from the explanatory structure to avoid reinforcing agential misconceptions. This is the theoretical position bio-core-lpm-synth structurally instantiates: its strands contain no organism-agency concepts by design. That design choice reflects a deliberate theoretical commitment, built in from the start rather than a simplification layered onto richer content. Reconstructed by OpenEvo from Kampourakis (2020) and Nehm & Kampourakis (2022); neither author has confirmed this as an accurate characterization of their position.'
WHERE id = '5fcfee96-9768-5fa8-a34b-635c354e84ec'; -- Dichotomized Causal Reasoning (DCR)

UPDATE theories SET description =
  'Evolution should be introduced early and revisited iteratively across the K-12 learning trajectory. The appropriate unit of curriculum design and analysis is the multi-year trajectory rather than a bounded two-topic sequence within a single school year. bio-core-lpm-synth''s K-12, grade-banded strand structure is a direct instantiation of this claim.'
WHERE id = '8d7964f4-6e52-5ddc-98de-5e67b2f62f2b'; -- Evolution as a Multi-Year Learning Trajectory

UPDATE theories SET description =
  'Learning Progression Models are the right scientific-model format for curriculum, doing more than organizing content conveniently -- functioning simultaneously as an explanatory model, a predictive model, a design tool, and a coordination mechanism. TheoryBase''s record for this theory names bio-core-k12 and interdisciplinary-k12 directly as its reconciled instantiation.'
WHERE id = 'e0ede4b4-4186-5da6-beeb-9e2854a965a2'; -- Learning Progressions as Scientific Models (bio-core copy)

UPDATE theories SET description =
  'The German biology-education tradition behind the KMK Bildungsstandards Biologie''s "Basiskonzept" framework. TheoryBase carries this record as a deliberate, unsourced placeholder (its provisional.blocked_on: no Crossref-verified primary source for Kattmann/Gropengießer''s published work has been located yet) -- linked here so the Sachsen/Thüringen custom view can show this gap rather than citing only English-language OpenEvo research for German-curriculum content.'
WHERE id = '459b2041-e2b1-5fe3-b34a-3bfd379f68ca'; -- German "Basiskonzept" tradition (bio-core copy)

UPDATE theories SET description =
  'Agential intuitions are assets rather than obstacles to be suppressed -- contextual flexibility (knowing when agency framing is and isn''t appropriate) is itself the competency worth building, across biological evolution, human evolution, cultural evolution, and machine-culture coevolution. This is OpenEvo''s native position (Hanisch, Eirdosh, González Galli, Hartelt, Pérez & Cupo, 2025), and the theoretical position interdisciplinary-lpm-synth instantiates.'
WHERE id = '9dd2d658-bbbe-50c9-9a5f-a43ea7ca418b'; -- Integrated / Contextually Flexible Causal Reasoning (ICR/CFCR)

UPDATE theories SET description =
  'Evolutionary literacy requires encountering evolutionary thinking across biology, social science, computer science, and the humanities. A biological-only framing produces biological-only understanding rather than evolutionary literacy as such. interdisciplinary-lpm-synth''s cross-subject strand design (each strand tagged across two subject areas) is a direct instantiation of this claim.'
WHERE id = '458390b8-4dff-5d20-aaa5-24e6fd2ab8b8'; -- Interdisciplinary Evolutionary Literacy

UPDATE theories SET description =
  'Learning Progression Models are the right scientific-model format for curriculum, doing more than organizing content conveniently. TheoryBase''s record for this theory names bio-core-k12 and interdisciplinary-k12 directly as its reconciled instantiation.'
WHERE id = '8a8737c9-76a6-5e89-b553-6a8f708e4223'; -- Learning Progressions as Scientific Models (interdisciplinary copy)

UPDATE theories SET description =
  'Representational infrastructure changes what''s learnable: adopting a new representational form (e.g. agent-based/multi-agent computational modeling) can restructure decentralized and evolutionary causal reasoning specifically. Relevant to interdisciplinary-lpm-synth''s Culture, Technology, and Collective Systems strand and its ICR transfer claim, which this theory is cited as partly grounding.'
WHERE id = '754564f3-c0a4-5f23-8eed-f0c4e86fec6a'; -- Restructuration Theory (Wilensky & Papert)

UPDATE theories SET description =
  'The German biology-education tradition behind the KMK Bildungsstandards Biologie''s "Basiskonzept" framework. Carried here as the same unsourced TheoryBase placeholder as bio-core-lpm-synth''s copy, for the same reason: so the Sachsen/Thüringen custom view can show this gap rather than silently citing only English-language research.'
WHERE id = '2d97f80a-fc5f-5e54-8467-0e6780932a84'; -- German "Basiskonzept" tradition (interdisciplinary copy)

-- lpm_comparative_links.commentary
UPDATE lpm_comparative_links SET commentary =
  'Bio-Core''s Natural Selection and Adaptation strand treats organism behavior as structurally out of scope. That''s by design: the strand''s description states it is "structurally incapable of invoking behavioral niche selection or agential framing." Interdisciplinary''s Agency, Development, and Niche Construction strand exists specifically because its theory (ICR) treats organism agency -- niche selection, niche construction, behavioral plasticity -- as a legitimate, often necessary, causal factor. This is the headline divergence the other named disagreements largely follow from: whether agential mechanisms exist isn''t in question; whether K-12 curriculum design should treat them as in-scope is.'
WHERE id = 'a1f3a0a0-0000-5000-9000-000000000001';

UPDATE lpm_comparative_links SET commentary =
  'The operational form of the agency divergence: KAEVO 2.0''s correct item for cheetah running speed ("Some cheetahs randomly were faster and were able to catch more prey...") abstracts organism behavior out entirely -- the Natural Selection and Adaptation strand''s assessment lineage. EvoFlex''s correct item for the same case ("The ancestors of cheetahs engaged in running as fast as possible in order to catch their fast-running prey...") keeps the behavioral/niche-selection context as part of a complete explanation -- the Agency, Development, and Niche Construction strand''s assessment lineage. Both instruments agree the same four responses are wrong; they disagree about whether behavioral context is a necessary part of a correct one.'
WHERE id = 'a1f3a0a0-0000-5000-9000-000000000002';

UPDATE lpm_comparative_links SET commentary =
  'The single most concrete illustration of this strand pair''s disagreement: the real student response "organism behavior played no role in the evolution of this trait" is scored CORRECT by KAEVO 2.0 (the assessment lineage behind Natural Selection and Adaptation) and INCORRECT by EvoFlex (the assessment lineage behind Agency, Development, and Niche Construction) for the same cheetah case. This isn''t an assessment-design inconsistency. It''s the direct operational consequence of the two strands'' differing theoretical commitments.'
WHERE id = 'a1f3a0a0-0000-5000-9000-000000000003';

UPDATE lpm_comparative_links SET commentary =
  'Natural Selection and Adaptation implicitly relies on a sharp organism/artifact dichotomy (evolved vs. designed) as part of DCR''s pedagogical strategy for addressing the design stance. Interdisciplinary''s Culture, Technology, and Collective Systems strand -- its "Collective Intelligence, Distributed Cognition, and Coevolving Technology" sub-strand especially -- treats that same boundary as a gradient: even artifacts (e.g. aircraft design) are shaped by decentralized cultural-evolutionary dynamics rather than purely intentional design. Neither position is globally superior; the dichotomy sacrifices accuracy for clarity, the gradient sacrifices initial clarity for broader transferability.'
WHERE id = 'a1f3a0a0-0000-5000-9000-000000000004';

-- curriculum_repository_records -- only the 4 whose title (the one field
-- these custom views actually render, as a connection card's heading) had
-- the same issue; this table's many other content.* research fields belong
-- to a separate, larger research corpus (deutsche_lp / Susan Hanisch's
-- comparative Lehrplananalyse data) shared across many projects beyond
-- these 2 LPMs, and are out of this pass's real scope.
UPDATE curriculum_repository_records SET title = 'Thüringen: within a combined Klassen-/Doppelklassenstufe, sequencing is left entirely to the teacher''s decision', content = jsonb_set(content, '{label}', to_jsonb('Thüringen: within a combined Klassen-/Doppelklassenstufe, sequencing is left entirely to the teacher''s decision'::text))
WHERE id = 'f4071389-bd83-4d8d-a7e8-03def51f8d60';

UPDATE curriculum_repository_records SET title = 'Sachsen: Oberschule teaches human evolution a full grade earlier than Gymnasium', content = jsonb_set(content, '{label}', to_jsonb('Sachsen: Oberschule teaches human evolution a full grade earlier than Gymnasium'::text))
WHERE id = '661e3269-c5e4-4419-87a0-a4519bce60f0';

UPDATE curriculum_repository_records SET title = 'Thüringen: Sozialkunde and Ethik ask overlapping nature-vs-nurture questions at the same grade level, unlinked, despite a working cross-reference mechanism', content = jsonb_set(content, '{label}', to_jsonb('Thüringen: Sozialkunde and Ethik ask overlapping nature-vs-nurture questions at the same grade level, unlinked, despite a working cross-reference mechanism'::text))
WHERE id = 'e85b56a9-74ee-4333-83a4-5c2152458eb3';

UPDATE curriculum_repository_records SET title = 'G/R/W''s foundational categories (Macht, Institutionen, Recht...) <-> evolved reliance on institutions for large-scale non-kin cooperation', content = jsonb_set(content, '{label}', to_jsonb('G/R/W''s foundational categories (Macht, Institutionen, Recht...) <-> evolved reliance on institutions for large-scale non-kin cooperation'::text))
WHERE id = '5074bf81-5e69-43b6-ba0e-618a5a00b45c';
