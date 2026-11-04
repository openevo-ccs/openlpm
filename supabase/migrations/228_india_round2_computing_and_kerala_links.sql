-- India round 2: proposed links from the four synthetic spaces to India records that round 1 left unreached.
-- 21 proposed links (11 computational-core, 4 interdisciplinary, 4 bio-core, 2 social-core) onto 8 existing India records:
-- computing and AI records (national curriculum, Ganita Prakash, Kerala KITE clubs, UP Board Computer syllabus) and Kerala science and social science textbook records.
-- All of it is AI-drafted and unreviewed by an Indian curriculum expert. The relation type starts with proposed_, which the views show as "AI-drafted, unconfirmed".
-- A person confirms, edits or removes each one. No record, view, role or repository link is created or changed here.
--
-- To undo: delete the rows with these (part, record) pairs from curriculum_repository_links (only rows whose relation_type starts with proposed_):
--   7d846794-560b-58b9-a9f0-267a680c308d  IN-KL-MANDATE-national-ct-ai-curriculum-classes-3-8-and-kerala-status
--   e6374470-9533-570e-8d98-0e5b24060f4d  IN-KL-MANDATE-national-ct-ai-curriculum-classes-3-8-and-kerala-status
--   f95b2dff-2e43-597e-b8c6-a1857c0f60c7  IN-MANDATE-ncert-ganita-prakash-grades-6-8-ct-through-puzzles
--   31f4c2e2-f909-5cf1-ae61-ca82e22bda0e  IN-MANDATE-ncert-ganita-prakash-grades-6-8-ct-through-puzzles
--   7d846794-560b-58b9-a9f0-267a680c308d  IN-KL-MANDATE-kite-little-kites-and-hi-tech-school-lab-programmes
--   f63a89a8-8a27-5cd6-acdf-7ed9f179442b  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   06ca57c6-f90e-5354-84b4-ee88dd292147  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   e6374470-9533-570e-8d98-0e5b24060f4d  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   8c7bc083-021f-5891-b502-de2f708a1e09  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   45c484c9-e753-5bb3-86af-086bc28fce31  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   71bc5265-fbcd-5e5a-b093-399a24bce44d  IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27
--   a64224d1-ac36-5b1c-b475-3c5af3aa4656  IN-KL-MANDATE-kcf-2023-science-aims-and-methods
--   ba60a3be-0135-5b53-b88f-a7aecfe0ed96  IN-KL-MANDATE-kcf-2023-science-aims-and-methods
--   a64224d1-ac36-5b1c-b475-3c5af3aa4656  IN-KL-MANDATE-scert-kerala-basic-science-classes-5-8-guess-test-record-and-science-diary
--   ad0173a4-5c64-5d05-96ac-2b61810c4153  IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements
--   aac5e307-a98f-50c6-ba5d-5cc6bcd7ebdf  IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024
--   76c205d2-33d4-5532-ba5a-cab715380b5e  IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024
--   a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259  IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024
--   4a5998c8-7e4d-5508-b00b-a02527021ac5  IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024
--   56eb4828-57c2-589b-92ba-180f901b2443  IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements
--   504c7645-bc71-5a81-a114-cd2d598d1621  IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements

SET search_path = public, extensions;

-- Rows are skipped when the part or the record is missing, or when the pair is already linked in any way.

-- computational-core-lpm-synth: 11 proposals
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('7d846794-560b-58b9-a9f0-267a680c308d', 'IN-KL-MANDATE-national-ct-ai-curriculum-classes-3-8-and-kerala-status', 'proposed_relates_to', 'Both deal with computational thinking taught across the primary and middle years: India''s Classes 3 to 8 curriculum and this strand, which runs from following steps to writing and testing programs. The record lists no topics, so how far the content overlaps is unchecked.'),
  ('e6374470-9533-570e-8d98-0e5b24060f4d', 'IN-KL-MANDATE-national-ct-ai-curriculum-classes-3-8-and-kerala-status', 'proposed_contrasts_with', 'India brings AI into the curriculum from Class 3, while this part places machine learning and search at grades 9 to 12. The record does not say what AI content the younger classes meet, so it may be awareness only. A reader of the Class 3 handbook can settle whether the sequencing really differs.'),
  ('f95b2dff-2e43-597e-b8c6-a1857c0f60c7', 'IN-MANDATE-ncert-ganita-prakash-grades-6-8-ct-through-puzzles', 'proposed_relates_to', 'The Class 6 mathematics book has a chapter on collecting and presenting data, which matches this part''s recording of measurements in tables and charting them. India meets it in Class 6, one band later than the grades 3 to 5 given here.'),
  ('31f4c2e2-f909-5cf1-ae61-ca82e22bda0e', 'IN-MANDATE-ncert-ganita-prakash-grades-6-8-ct-through-puzzles', 'proposed_relates_to', 'The books present puzzles, games and cryptarithms as an early path into computational thinking at Classes 6 to 8, the same band as this part on breaking problems into steps and testing them. Only the front matter of the books was read, so whether any chapter teaches decomposition or testing is unchecked.'),
  ('7d846794-560b-58b9-a9f0-267a680c308d', 'IN-KL-MANDATE-kite-little-kites-and-hi-tech-school-lab-programmes', 'proposed_relates_to', 'Kerala''s Little KITEs clubs teach block programming, animation, mobile apps and robotics to students in Classes 8 to 10, which belongs to the program-building side of this strand. The record gives the training areas without the concepts taught, so the overlap is a topic area only. Clubs are out-of-class activities, which differs from a curriculum stage.'),
  ('f63a89a8-8a27-5cd6-acdf-7ed9f179442b', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_relates_to', 'The Class 9 Computer syllabus covers number systems, and its topic tags include binary numbers, which is the numbers part of this part on encoding. Nothing in the record shows encoding of text or images. The UP Board meets it in Class 9, later than the grades 6 to 8 given here.'),
  ('06ca57c6-f90e-5354-84b4-ee88dd292147', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_relates_to', 'The Class 10 syllabus lists searching and sorting (linear and binary search, bubble and selection sort), the usual material for judging whether an algorithm is correct and efficient. The record does not say whether pupils compare efficiency or argue for correctness.'),
  ('e6374470-9533-570e-8d98-0e5b24060f4d', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_relates_to', 'The Class 11 syllabus has an introductory AI unit naming agents, natural language processing, robotics, expert systems, and classification and regression. Classification and regression are machine learning, which this part compares with search at grades 9 to 12.'),
  ('8c7bc083-021f-5891-b502-de2f708a1e09', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_contrasts_with', 'This part places sequences, loops and conditions at grades 3 to 5. The UP Board syllabus meets loops, arrays, strings and functions in C programming in Class 10. The gap may come from the syllabus being a Board subject with its own entry point, while earlier steps sit in other India documents.'),
  ('45c484c9-e753-5bb3-86af-086bc28fce31', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_contrasts_with', 'This part has agent-based and feedback models at grades 6 to 8. The record notes that the UP Computer syllabus lists no modelling or simulation topic. Only the first page of each class''s syllabus was read, so the absence is not established.'),
  ('71bc5265-fbcd-5e5a-b093-399a24bce44d', 'IN-UP-MANDATE-upmsp-computer-syllabus-classes-9-12-2026-27', 'proposed_contrasts_with', 'This part has models and simulations of everyday systems at grades 3 to 5. The record notes that the UP Computer syllabus lists no modelling or simulation topic. Only the first page of each class''s syllabus was read, so the absence is not established.')
) AS v(object_id, source_record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.source_repo = 'openlpm-starter-draft' AND r.source_record_id = v.source_record_id
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);

-- interdisciplinary-lpm-synth: 4 proposals
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('a64224d1-ac36-5b1c-b475-3c5af3aa4656', 'IN-KL-MANDATE-kcf-2023-science-aims-and-methods', 'proposed_relates_to', 'The Kerala framework wants pupils to re-examine what is known and to tell science from pseudo-science, which is close to this part''s work on testing ideas and keeping the better ones. This part is about how ideas get kept or dropped over rounds, while the framework sets aims for scientific method, so the overlap is partial.'),
  ('ba60a3be-0135-5b53-b88f-a7aecfe0ed96', 'IN-KL-MANDATE-kcf-2023-science-aims-and-methods', 'proposed_relates_to', 'The Kerala framework asks for textbooks that give weight to the history of science and for a scientific attitude of re-examining what is known. This part uses Darwin''s notebooks as a case of how discovery works and teaches how bias keeps people from revising ideas. The framework sets aims for all classes without outcomes by stage.'),
  ('a64224d1-ac36-5b1c-b475-3c5af3aa4656', 'IN-KL-MANDATE-scert-kerala-basic-science-classes-5-8-guess-test-record-and-science-diary', 'proposed_relates_to', 'Kerala''s Basic Science books ask pupils to make a guess, test it with a simple experiment and record the result. This part, for grades 3 to 5, is about making a guess and keeping the better one. Its text centres on how ideas are kept or dropped over rounds, while the Kerala books centre on a single experimental check, so the match is partial. Only a sample of the books was read.'),
  ('ad0173a4-5c64-5d05-96ac-2b61810c4153', 'IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements', 'proposed_relates_to', 'The Kerala Class 8 to 10 social science books teach how the Constitution divides power and how institutions such as the Election Commission keep a democracy in shape. This part for grades 6 to 8 treats institutions as structures that keep a culture stable. The books describe institutions in civics terms, without the idea of cultural transmission.')
) AS v(object_id, source_record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.source_repo = 'openlpm-starter-draft' AND r.source_record_id = v.source_record_id
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);

-- bio-core-lpm-synth: 4 proposals
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('aac5e307-a98f-50c6-ba5d-5cc6bcd7ebdf', 'IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024', 'proposed_relates_to', 'The Class 5 chapter Diverse Organisms shows how fish and tadpoles are adapted to water. This part asks the child to describe features that help a familiar organism survive in its habitat. Kerala meets the idea in Class 5, three years after the K-2 band given here.'),
  ('76c205d2-33d4-5532-ba5a-cab715380b5e', 'IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024', 'proposed_relates_to', 'The Class 5 chapter sorts animals into groups by body features and covers creatures that have become extinct. This part has the child sort organisms by shared features and learn that some kinds lived long ago and are gone. The content is close. Kerala meets it in Class 5, later than the K-2 band given here.'),
  ('a4cd9b9e-d3a1-52bd-b76f-eb6173ab7259', 'IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024', 'proposed_relates_to', 'The Class 5 chapter gives causes of extinction, and this part asks the child to explain that extinction means a species is permanently gone. The chapter does not mention common ancestors, which this part also covers.'),
  ('4a5998c8-7e4d-5508-b00b-a02527021ac5', 'IN-KL-UNIT-scert-kerala-class5-and-class7-basic-science-diverse-organisms-and-hybridization-2024', 'proposed_relates_to', 'The Class 7 chapter teaches grafting and hybridization, where two varieties are crossed by hand pollination to produce seeds with chosen qualities. This draft part is about people choosing which animals and plants breed. The Class 7 text does not use the words gene, heredity or selection for hybrids, so it covers the practice without the explanation.')
) AS v(object_id, source_record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.source_repo = 'openlpm-starter-draft' AND r.source_record_id = v.source_record_id
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);

-- social-core-lpm-synth: 2 proposals
INSERT INTO curriculum_repository_links (project_id, data_object_id, repository_record_id, relation_type, rationale)
SELECT o.project_id, o.id, r.id, v.relation_type, v.rationale
FROM (VALUES
  ('56eb4828-57c2-589b-92ba-180f901b2443', 'IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements', 'proposed_relates_to', 'The Class 9 chapters cover how the Constitution distributes power and how bodies such as the Election Commission extend democracy, which is the formal-institution half of this part. The record shows no teaching about informal norms, the other half.'),
  ('504c7645-bc71-5a81-a114-cd2d598d1621', 'IN-KL-UNIT-scert-classes8-10-social-science-rights-democracy-institutions-and-movements', 'proposed_relates_to', 'The Class 10 books cover politics in India after independence, including the Emergency, and movements by backward-class, Dalit and women''s groups. These are cases of large-scale change driven by power and group action, which this part asks pupils to explain. This part teaches comparing two explanations of one change against evidence. The record does not show pupils doing that.')
) AS v(object_id, source_record_id, relation_type, rationale)
JOIN lpm_data_objects o ON o.id = v.object_id::uuid
JOIN curriculum_repository_records r ON r.source_repo = 'openlpm-starter-draft' AND r.source_record_id = v.source_record_id
WHERE NOT EXISTS (SELECT 1 FROM curriculum_repository_links x WHERE x.data_object_id = o.id AND x.repository_record_id = r.id);
