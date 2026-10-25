#!/usr/bin/env python3
"""Generates supabase/migrations/173_bio_core_interdisciplinary_intro_literature_human_examples.sql.

Source of every choice below: lab_manager/docs/design-notes/
bio-core-interdisciplinary-modelling-literature-human-examples-and-time-budget-2026-10-25.md
(sections 3, 4 and 6), with Dustin's 2026-10-25 decisions applied: the 2020
Eirdosh & Hanisch paper is never cited, Evolutionary Mismatch stays out of
Bio-Core, and the proposed human cases are loaded as drafts.

Everything here is AI-drafted and unreviewed by a subject-matter expert. Stages
load with status 'draft', threads with status 'proposed', new concepts with
status 'proposed', and literature links with status 'draft'.

Run:  python scripts/generate_bio_interdisciplinary_enrichment_seed.py > supabase/migrations/173_....sql
Ids are uuid5-derived, so re-running yields identical SQL.
"""
import json
import sys
import uuid

NS = uuid.uuid5(uuid.NAMESPACE_URL, 'https://openevo-ccs.github.io/openlpm/bio-interdisciplinary-human-examples-2026-10-25')


def uid(*parts):
    return str(uuid.uuid5(NS, '/'.join(parts)))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def jq(obj):
    return q(json.dumps(obj, ensure_ascii=False)) + '::jsonb'


BIO = '28997544-0d87-4b05-9ee2-7c474513c108'
INT = '371fce26-d1f3-439b-95df-0a0e38b8a824'
BIO_BRANCH = '489efe08-9c39-4601-8f31-fa40dccc8d5b'
INT_BRANCH = '6d484dde-6529-4bc6-a486-05521ddc76c8'
SRC_REPO = 'openlpm-human-examples-draft-2026-10-25'
NOTE = ('AI-drafted proposal (2026-10-25) from the design note on the Bio-Core and Interdisciplinary '
        'human examples. Accepted by Dustin as a draft for review. No subject-matter expert has reviewed it.')

# ---- cited papers (id -> citation fields), copied from LiteratureBase records on main, 2026-10-25 ----
LIT = json.loads(r'''{
"grether-2021a": {
"id": "OE-LITERATURE-grether-2021a",
"title": "Teaching Evolutionary Concepts in Elementary School",
"authors": [
"Grether, Gregory F.",
"Chock, Rachel Y.",
"Cowen, Madeline C.",
"De La Cruz-Sevilla, Josue S.",
"Drake, Taylor N.",
"Lum, Krista S.",
"Ovakimyan, Andrew",
"Sood, Sheela R.",
"Tang, Wei",
"Whitney, Katherine A.",
"Yang, Mike Z."
],
"year": 2021,
"doi": "10.1525/abt.2021.83.2.118",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"brown-ronfard-kelemen-2020": {
"id": "OE-LITERATURE-brown-ronfard-kelemen-2020",
"title": "Teaching natural selection in early elementary classrooms: can a storybook intervention reduce teleological misunderstandings?",
"authors": [
"Brown, Sarah A.",
"Ronfard, Samuel",
"Kelemen, Deborah"
],
"year": 2020,
"doi": "10.1186/s12052-020-00127-7",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"emmons-lees-kelemen-2018": {
"id": "OE-LITERATURE-emmons-lees-kelemen-2018",
"title": "Young children's near and far transfer of the basic theory of natural selection: An analogical storybook intervention",
"authors": [
"Emmons, Natalie",
"Lees, Kristin",
"Kelemen, Deborah"
],
"year": 2018,
"doi": "10.1002/tea.21421",
"venue": "Journal of Research in Science Teaching",
"type": "article",
"lbtype": "journal-article"
},
"adler-fiedler-harms-2024": {
"id": "OE-LITERATURE-adler-fiedler-harms-2024",
"title": "About Birds and Bees, Snails and Trees: Children's Ideas on Animal and Plant Evolution",
"authors": [
"Adler, Isabell K.",
"Fiedler, Daniela",
"Harms, Ute"
],
"year": 2024,
"doi": "10.1002/sce.21873",
"venue": "Science Education",
"type": "article",
"lbtype": "journal-article"
},
"adler-et-al-2025": {
"id": "OE-LITERATURE-adler-et-al-2025",
"title": "Introducing CACIE: Development of the first Conceptual Assessment of Children's Ideas about Evolution",
"authors": [
"Adler, Isabell K.",
"Fiedler, Daniela",
"Shtulman, Andrew",
"Harms, Ute"
],
"year": 2025,
"doi": "10.1371/journal.pone.0331380",
"venue": "PLOS One",
"type": "article",
"lbtype": "journal-article"
},
"lehrer-schauble-2012": {
"id": "OE-LITERATURE-lehrer-schauble-2012",
"title": "Seeding evolutionary thinking by engaging children in modeling its foundations",
"authors": [
"Lehrer, Richard",
"Schauble, Leona"
],
"year": 2012,
"doi": "10.1002/sce.20475",
"venue": "Science Education",
"type": "article",
"lbtype": "journal-article"
},
"lehrer-schauble-2015": {
"id": "OE-LITERATURE-lehrer-schauble-2015",
"title": "Learning Progressions: The Whole World is NOT a Stage",
"authors": [
"Lehrer, Rich",
"Schauble, Leona"
],
"year": 2015,
"doi": "10.1002/sce.21168",
"venue": "Science Education",
"type": "article",
"lbtype": "journal-article"
},
"fensham-2022-chimera": {
"id": "OE-LITERATURE-fensham-2022-chimera",
"title": "Progression in School Science Curriculum: a Rational Prospect or a Chimera?",
"authors": [
"Fensham, Peter J."
],
"year": 2022,
"doi": "10.1007/s11165-022-10092-4",
"venue": "Research in Science Education",
"type": "article",
"lbtype": "journal-article"
},
"furtak-2012": {
"id": "OE-LITERATURE-furtak-2012",
"title": "Linking a learning progression for natural selection to teachers' enactment of formative assessment",
"authors": [
"Furtak, Erin Marie"
],
"year": 2012,
"doi": "10.1002/tea.21054",
"venue": "Journal of Research in Science Teaching",
"type": "article",
"lbtype": "journal-article"
},
"beggrow-nehm-2012": {
"id": "OE-LITERATURE-beggrow-nehm-2012",
"title": "Students' Mental Models of Evolutionary Causation: Natural Selection and Genetic Drift",
"authors": [
"Beggrow, Elizabeth P.",
"Nehm, Ross H."
],
"year": 2012,
"doi": "10.1007/s12052-012-0432-z",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"fiedler-trobst-harms-2017": {
"id": "OE-LITERATURE-fiedler-trobst-harms-2017",
"title": "University Students’ Conceptual Knowledge of Randomness and Probability in the Contexts of Evolution and Mathematics",
"authors": [
"Fiedler, Daniela",
"Tröbst, Steffen",
"Harms, Ute"
],
"year": 2017,
"doi": "10.1187/cbe.16-07-0230",
"venue": "CBE-Life Sciences Education",
"type": "article",
"lbtype": "journal-article"
},
"price-et-al-2014": {
"id": "OE-LITERATURE-price-et-al-2014",
"title": "The Genetic Drift Inventory: A Tool for Measuring What Advanced Undergraduates Have Mastered about Genetic Drift",
"authors": [
"Price, Rebecca M.",
"Andrews, Tessa C.",
"McElhinny, Teresa L.",
"Mead, Louise S.",
"Abraham, Joel K.",
"Thanukos, Anna",
"Perez, Kathryn E."
],
"year": 2014,
"doi": "10.1187/cbe.13-08-0159",
"venue": "CBE-Life Sciences Education",
"type": "article",
"lbtype": "journal-article"
},
"price-et-al-2016": {
"id": "OE-LITERATURE-price-et-al-2016",
"title": "Observing populations and testing predictions about genetic drift in a computer simulation improves college students’ conceptual understanding",
"authors": [
"Price, Rebecca M.",
"Pope, Denise S.",
"Abraham, Joel K.",
"Maruca, Susan",
"Meir, Eli"
],
"year": 2016,
"doi": "10.1186/s12052-016-0059-6",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"tornabene-lavington-nehm-2018": {
"id": "OE-LITERATURE-tornabene-lavington-nehm-2018",
"title": "Testing validity inferences for Genetic Drift Inventory scores using Rasch modeling and item order analyses",
"authors": [
"Tornabene, Robyn E.",
"Lavington, Erik",
"Nehm, Ross H."
],
"year": 2018,
"doi": "10.1186/s12052-018-0082-x",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"todd-romine-2016": {
"id": "OE-LITERATURE-todd-romine-2016",
"title": "Validation of the Learning Progression-based Assessment of Modern Genetics in a college context",
"authors": [
"Todd, Amber",
"Romine, William L."
],
"year": 2016,
"doi": "10.1080/09500693.2016.1212425",
"venue": "International Journal of Science Education",
"type": "article",
"lbtype": "journal-article"
},
"drits-esser-hardcastle-bass-homburger-malone-pompei-deboer-stark-2021": {
"id": "OE-LITERATURE-drits-esser-hardcastle-bass-homburger-malone-pompei-deboer-stark-2021",
"title": "Randomized Controlled Trial of a Cohesive Eight-Week Evolution Unit That Incorporates Molecular Genetics and Principles of the <i>Next Generation Science Standards</i>",
"authors": [
"Drits-Esser, D.",
"Hardcastle, J.",
"Bass, K. M.",
"Homburger, S.",
"Malone, M.",
"Pompei, K.",
"DeBoer, G. E.",
"Stark, L. A."
],
"year": 2021,
"doi": "10.1187/cbe.20-01-0008",
"venue": "CBE-Life Sciences Education",
"type": "article",
"lbtype": "journal-article"
},
"daniel-ferguson-leone-bucklin-2024": {
"id": "OE-LITERATURE-daniel-ferguson-leone-bucklin-2024",
"title": "A Comparison of Measured Outcomes across Tree-Thinking Interventions",
"authors": [
"Daniel, Kristy L.",
"Ferguson, Daniel",
"Leone, E. Austin",
"Bucklin, Carrie J."
],
"year": 2024,
"doi": "10.1525/abt.2024.86.2.71",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"catley-novick-shade-2010": {
"id": "OE-LITERATURE-catley-novick-shade-2010",
"title": "Interpreting evolutionary diagrams: When topology and process conflict",
"authors": [
"Catley, Kefyn M.",
"Novick, Laura R.",
"Shade, Courtney K."
],
"year": 2010,
"doi": "10.1002/tea.20384",
"venue": "Journal of Research in Science Teaching",
"type": "article",
"lbtype": "journal-article"
},
"misheva-coburn-wiles-2026": {
"id": "OE-LITERATURE-misheva-coburn-wiles-2026",
"title": "Are They Cousins? Exploring University Students' Acceptance of Common Ancestry in Evolution",
"authors": [
"Misheva, Taya",
"Coburn, Kaitlyn N.",
"Wiles, Jason R."
],
"year": 2026,
"doi": "10.1187/cbe.25-07-0155",
"venue": "CBE-Life Sciences Education",
"type": "article",
"lbtype": "journal-article"
},
"gomes-et-al-2022": {
"id": "OE-LITERATURE-gomes-et-al-2022",
"title": "Using copepods to develop a didactic strategy for teaching species concepts in the classroom",
"authors": [
"Gomes, Camila Moraes",
"Sodré, Davidson",
"da Costa, Rauquírio Marinho",
"Magalhães, André",
"do Rosário, Renata Furtado",
"Ferrari, Stephen Francis",
"Gomes, Grazielle Fernanda Evangelista",
"Sampaio, Iracilda",
"Vallinoto, Marcelo"
],
"year": 2022,
"doi": "10.1186/s12052-022-00159-1",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"delgado-2014": {
"id": "OE-LITERATURE-delgado-2014",
"title": "Collective landmarks for deep time: a new tool for evolution education",
"authors": [
"Delgado, Cesar"
],
"year": 2014,
"doi": "10.1080/00219266.2013.849280",
"venue": "Journal of Biological Education",
"type": "article",
"lbtype": "journal-article"
},
"cheek-2013": {
"id": "OE-LITERATURE-cheek-2013",
"title": "Exploring the Relationship between Students' Understanding of Conventional Time and Deep (Geologic) Time",
"authors": [
"Cheek, Kim A."
],
"year": 2013,
"doi": "10.1080/09500693.2011.587032",
"venue": "International Journal of Science Education",
"type": "article",
"lbtype": "journal-article"
},
"dugatkin-2018": {
"id": "OE-LITERATURE-dugatkin-2018",
"title": "The silver fox domestication experiment",
"authors": [
"Dugatkin, Lee Alan"
],
"year": 2018,
"doi": "10.1186/s12052-018-0090-x",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"gregory-2009a": {
"id": "OE-LITERATURE-gregory-2009a",
"title": "Artificial Selection and Domestication: Modern Lessons from Darwin’s Enduring Analogy",
"authors": [
"Gregory, T. Ryan"
],
"year": 2009,
"doi": "10.1007/s12052-008-0114-z",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"gomezgalindo-et-al-2021": {
"id": "OE-LITERATURE-gomezgalindo-et-al-2021",
"title": "Artificial selection of maize as a bridging case to teach natural selection: a simulation proposal",
"authors": [
"Gómez Galindo, Alma Adrianna",
"González Galli, Leonardo",
"García Franco, Alejandra"
],
"year": 2021,
"doi": "10.1080/00219266.2019.1707262",
"venue": "Journal of Biological Education",
"type": "article",
"lbtype": "journal-article"
},
"spier-dauer-2023": {
"id": "OE-LITERATURE-spier-dauer-2023",
"title": "Sexual Selection as a Tool to Improve Student Reasoning of Evolution",
"authors": [
"Spier, Sarah K.",
"Dauer, Joseph T."
],
"year": 2023,
"doi": "10.1525/abt.2023.85.2.91",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"jackson-fuselier-eason-2024": {
"id": "OE-LITERATURE-jackson-fuselier-eason-2024",
"title": "Automated content analysis as a tool to compare content in sexual selection research with examples of sexual selection in evolutionary biology textbooks: implications for teaching the nature of science",
"authors": [
"Jackson, J. Kasi",
"Fuselier, Linda",
"Eason, Perri"
],
"year": 2024,
"doi": "10.1186/s12052-024-00198-w",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"sa-pinto-cardia-campos-2017": {
"id": "OE-LITERATURE-sa-pinto-cardia-campos-2017",
"title": "Sexual Selection: A Short Review on Its Causes and Outcomes, and Activities to Teach Evolution and the Nature of Science",
"authors": [
"Sá-Pinto, Xana",
"Cardia, Pedro",
"Campos, Rita"
],
"year": 2017,
"doi": "10.1525/abt.2017.79.2.135",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"siani-yarden-2022": {
"id": "OE-LITERATURE-siani-yarden-2022",
"title": "Introducing Evolution of the Human Lactase Gene using an Online Interactive Activity",
"authors": [
"Siani, Merav",
"Yarden, Anat"
],
"year": 2022,
"doi": "10.1525/abt.2022.84.1.16",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"pobiner-2017": {
"id": "OE-LITERATURE-pobiner-2017",
"title": "The Quest to Understand Human Evolution: A Magical Mystery Tour",
"authors": [
"Pobiner, Briana L."
],
"year": 2017,
"doi": "10.1525/abt.2017.79.2.77",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"alles-stevenson-2003": {
"id": "OE-LITERATURE-alles-stevenson-2003",
"title": "Teaching Human Evolution",
"authors": [
"Alles, David L.",
"Stevenson, Joan C."
],
"year": 2003,
"doi": "10.1662/0002-7685(2003)065[0333:the]2.0.co;2",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"harcourt-smith-2010": {
"id": "OE-LITERATURE-harcourt-smith-2010",
"title": "On Human Evolution",
"authors": [
"Harcourt-Smith, William E. H."
],
"year": 2010,
"doi": "10.1007/s12052-010-0265-6",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"leonard-2012": {
"id": "OE-LITERATURE-leonard-2012",
"title": "A Short Review of the Chronology for Human Evolution",
"authors": [
"Leonard, William H."
],
"year": 2012,
"doi": "10.1525/abt.2012.74.3.3",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"norton-et-al-2019": {
"id": "OE-LITERATURE-norton-et-al-2019",
"title": "Human races are not like dog breeds: refuting a racist analogy",
"authors": [
"Norton, Heather L.",
"Quillen, Ellen E.",
"Bigham, Abigail W.",
"Pearson, Laurel N.",
"Dunsworth, Holly"
],
"year": 2019,
"doi": "10.1186/s12052-019-0109-y",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"chisango-et-al-2023": {
"id": "OE-LITERATURE-chisango-et-al-2023",
"title": "Racial misconceptions of the theory of evolution predict opposition to the theory and science in general among a sample of Zimbabwean university students",
"authors": [
"Chisango, Tadios",
"Maunganidze, Langtone",
"Maseko, Mpikelelo",
"Muchena, Brian",
"Ncube, Spiwe",
"Hombarume, Lissa",
"Matanga, Anesu Aggrey"
],
"year": 2023,
"doi": "10.1016/j.heliyon.2023.e16783",
"venue": "Heliyon",
"type": "article",
"lbtype": "journal-article"
},
"richerson-2005": {
"id": "OE-LITERATURE-richerson-2005",
"title": "Not by genes alone: How culture transformed human evolution",
"authors": [
"Richerson, Peter J.",
"Boyd, Robert"
],
"year": 2005,
"doi": null,
"venue": null,
"type": "book",
"lbtype": "book"
},
"brand-mesoudi-smaldino-2021": {
"id": "OE-LITERATURE-brand-mesoudi-smaldino-2021",
"title": "Analogy as a Catalyst for Cumulative Cultural Evolution",
"authors": [
"Brand, Charlotte O.",
"Mesoudi, Alex",
"Smaldino, Paul E."
],
"year": 2021,
"doi": "10.1016/j.tics.2021.03.002",
"venue": "Trends in Cognitive Sciences",
"type": "article",
"lbtype": "journal-article"
},
"holding-smaldino-brand-2026": {
"id": "OE-LITERATURE-holding-smaldino-brand-2026",
"title": "Analogies evolve by increasing transmission fidelity in the communication of complex information",
"authors": [
"Holding, Thomas",
"Smaldino, Paul E.",
"Brand, Charlotte O."
],
"year": 2026,
"doi": "10.1017/ehs.2026.10063",
"venue": "Evolutionary Human Sciences",
"type": "article",
"lbtype": "journal-article"
},
"cultural-evolution-society-2023": {
"id": "OE-LITERATURE-cultural-evolution-society-2023",
"title": "What Is Cultural Evolution?",
"authors": [
"Cultural Evolution Society"
],
"year": 2023,
"doi": null,
"venue": "culturalevolutionsociety.org",
"type": null,
"lbtype": "website"
},
"arnon-kirby-2024": {
"id": "OE-LITERATURE-arnon-kirby-2024",
"title": "Cultural evolution creates the statistical structure of language",
"authors": [
"Arnon, Inbal",
"Kirby, Simon"
],
"year": 2024,
"doi": "10.1038/s41598-024-56152-9",
"venue": "Scientific Reports",
"type": "article",
"lbtype": "journal-article"
},
"hanisch-eirdosh-2021": {
"id": "OE-LITERATURE-hanisch-eirdosh-2021",
"title": "Are Humans a Cooperative Species? Challenges & Opportunities for Teaching the Evolution of Human Prosociality",
"authors": [
"Hanisch, Susan",
"Eirdosh, Dustin"
],
"year": 2021,
"doi": "10.1525/abt.2021.83.6.356",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"hanisch-eirdosh-2024": {
"id": "OE-LITERATURE-hanisch-eirdosh-2024",
"title": "Cooperation as a causal factor in human evolution: a scientific clarification and analysis of German high school biology textbooks",
"authors": [
"Hanisch, Susan",
"Eirdosh, Dustin"
],
"year": 2024,
"doi": "10.1080/00219266.2021.2020875",
"venue": "Journal of Biological Education",
"type": "article",
"lbtype": "journal-article"
},
"koomen-herrmann-2018": {
"id": "OE-LITERATURE-koomen-herrmann-2018",
"title": "An investigation of children's strategies for overcoming the tragedy of the commons",
"authors": [
"Koomen, Rebecca",
"Herrmann, Esther"
],
"year": 2018,
"doi": "10.1038/s41562-018-0327-2",
"venue": "Nature Human Behaviour",
"type": "article",
"lbtype": "journal-article"
},
"halls-ainsworth-oliver-2018": {
"id": "OE-LITERATURE-halls-ainsworth-oliver-2018",
"title": "Young children’s impressionable use of teleology: the influence of question wording and questioned topic on teleological explanations for natural phenomena",
"authors": [
"Halls, Jonathan Grant",
"Ainsworth, Shaaron Elizabeth",
"Oliver, Mary Collette"
],
"year": 2018,
"doi": "10.1080/09500693.2018.1451008",
"venue": "International Journal of Science Education",
"type": "article",
"lbtype": "journal-article"
},
"halls-ainsworth-oliver-2021": {
"id": "OE-LITERATURE-halls-ainsworth-oliver-2021",
"title": "Using dialogic interventions to decrease children’s use of inappropriate teleological explanations",
"authors": [
"Halls, Jonathan Grant",
"Ainsworth, Shaaron Elizabeth",
"Oliver, Mary Colette"
],
"year": 2021,
"doi": "10.1080/09500693.2021.1936271",
"venue": "International Journal of Science Education",
"type": "article",
"lbtype": "journal-article"
},
"trommler-hammann-2020": {
"id": "OE-LITERATURE-trommler-hammann-2020",
"title": "The relationship between biological function and teleology: Implications for biology education",
"authors": [
"Trommler, Friederike",
"Hammann, Marcus"
],
"year": 2020,
"doi": "10.1186/s12052-020-00122-y",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"ronfard-brown-pitt-kelemen-2023": {
"id": "OE-LITERATURE-ronfard-brown-pitt-kelemen-2023",
"title": "Is book reading always best? Children learn and transfer complex scientific explanations from books or animations",
"authors": [
"Ronfard, Samuel",
"Brown, Sarah A.",
"Pitt, Emma",
"Kelemen, Deborah"
],
"year": 2023,
"doi": "10.1186/s12052-023-00189-3",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"rahwan-2019-machine-behaviour": {
"id": "OE-LITERATURE-rahwan-2019-machine-behaviour",
"title": "Machine Behaviour",
"authors": [
"Rahwan, Iyad",
"Cebrian, Manuel",
"Obradovich, Nick",
"Bongard, Josh",
"Bonnefon, Jean-François",
"Breazeal, Cynthia",
"Crandall, Jacob W.",
"Christakis, Nicholas A.",
"Couzin, Iain D.",
"Jackson, Matthew O.",
"Jennings, Nicholas R.",
"Kamar, Ece",
"Kloumann, Isabel M.",
"Larochelle, Hugo",
"Lazer, David",
"McElreath, Richard",
"Mislove, Alan",
"Parkes, David C.",
"Pentland, Alex \"Sandy\"",
"Roberts, Margaret E.",
"Shariff, Azim",
"Tenenbaum, Joshua B.",
"Wellman, Michael"
],
"year": 2019,
"doi": "10.1038/s41586-019-1138-y",
"venue": "Nature",
"type": "article",
"lbtype": "journal-article"
},
"peel-sadler-friedrichsen-2019": {
"id": "OE-LITERATURE-peel-sadler-friedrichsen-2019",
"title": "Learning natural selection through computational thinking: Unplugged design of algorithmic explanations",
"authors": [
"Peel, Amanda",
"Sadler, Troy D.",
"Friedrichsen, Patricia"
],
"year": 2019,
"doi": "10.1002/tea.21545",
"venue": "Journal of Research in Science Teaching",
"type": "article",
"lbtype": "journal-article"
},
"peel-sadler-friedrichsen-2025": {
"id": "OE-LITERATURE-peel-sadler-friedrichsen-2025",
"title": "Learning Computational Thinking Through Unplugged Algorithmic Explanations of Natural Selection",
"authors": [
"Peel, Amanda",
"Sadler, Troy D.",
"Friedrichsen, Patricia"
],
"year": 2025,
"doi": "10.1002/tea.22026",
"venue": "Journal of Research in Science Teaching",
"type": "article",
"lbtype": "journal-article"
},
"guest-suarez-vanrooij-2025-cail": {
"id": "OE-LITERATURE-guest-suarez-vanrooij-2025-cail",
"title": "Towards Critical Artificial Intelligence Literacies",
"authors": [
"Guest, Olivia",
"Suarez, Marcela",
"van Rooij, Iris"
],
"year": 2025,
"doi": "10.5281/zenodo.17786243",
"venue": "Zenodo",
"type": null,
"lbtype": "preprint"
},
"hartelt-martens-2025a": {
"id": "OE-LITERATURE-hartelt-martens-2025a",
"title": "Promoting Metacognitive Awareness and Self-Regulation of Intuitive Thinking in Evolution Education",
"authors": [
"Hartelt, Tim",
"Martens, Helge"
],
"year": 2025,
"doi": "10.1525/abt.2025.87.2.113",
"venue": "The American Biology Teacher",
"type": "article",
"lbtype": "journal-article"
},
"nelson-scharmann-beard-flammer-2019": {
"id": "OE-LITERATURE-nelson-scharmann-beard-flammer-2019",
"title": "The nature of science as a foundation for fostering a better understanding of evolution",
"authors": [
"Nelson, Craig E.",
"Scharmann, Lawrence C.",
"Beard, Jean",
"Flammer, Lawrence I."
],
"year": 2019,
"doi": "10.1186/s12052-019-0100-7",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"pessoa-et-al-2024": {
"id": "OE-LITERATURE-pessoa-et-al-2024",
"title": "Evolutionary literacy as a catalyst for sustainable futures: connecting biological evolution education and education for sustainability",
"authors": [
"Pessoa, Patrícia",
"Lopes, J. Bernardino",
"de Lima, Joelyn",
"Pinto, Alexandre",
"Søgaard Jørgensen, Peter",
"Sá-Pinto, Xana"
],
"year": 2024,
"doi": "10.1186/s12052-024-00213-0",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
},
"kreher-mcmanus-2023": {
"id": "OE-LITERATURE-kreher-mcmanus-2023",
"title": "An interdisciplinary course on evolution and sustainability increases acceptance of evolutionary theory and increases understanding of interdisciplinary application of evolutionary theory",
"authors": [
"Kreher, Scott A.",
"McManus, Ellen"
],
"year": 2023,
"doi": "10.1186/s12052-023-00188-4",
"venue": "Evolution: Education and Outreach",
"type": "article",
"lbtype": "journal-article"
}
}''')
assert 'eirdosh-hanisch-2020' not in LIT, 'standing exclusion: never cite Eirdosh & Hanisch 2020'

# ---- existing strand/stage ids (read from the live database, 2026-10-25) ----
BIO_PATH = {
    'vi': 'strands/strand-101-variation-inheritance.yaml',
    'ns': 'strands/strand-102-natural-selection-adaptation.yaml',
    'sp': 'strands/strand-103-speciation-diversity.yaml',
}
BIO_THREAD_EXISTING = {'vi': 'ba5f146c-213f-559d-90be-120b177f5dcb', 'ns': '698860a1-3a2f-5a18-bdc6-959b49c8cb58', 'sp': '255b48be-ede2-551e-a9ab-027b11d82c94'}
INT_PATH = {
    'inh': 'strands/strand-201-inheritance-variation-selection.yaml',
    'agn': 'strands/strand-202-agency-development-niche.yaml',
    'cul': 'strands/strand-203-culture-technology-collective.yaml',
}
# Existing accepted stages used as host stations in the bridge-case threads.
HOST = {
    'agn-35': ('31b2be29-7a8c-5f98-a447-55ecf57f1ff9', '3-5, Comparing How Different Living Things Act, Learn, and Teach'),
    'agn-68': ('3a112595-4435-5db0-950d-ca7c6da5160d', '6-8, Agency, Niche Construction, and Selection'),
    'cul-k2': ('9fc65a59-5de1-51ad-ad30-a9c0faca177a', 'K-2, Groups, Rules, and Tools'),
    'cul-35': ('a1bc92d8-3730-53b8-a059-f3999e4387cf', '3-5, Comparing Communities and Changing Tools Over Time'),
    'cul-68': ('ad0173a4-5c64-5d05-96ac-2b61810c4153', '6-8, Culture as Transmitted, Institutions as Stabilizing Structures'),
    'cul-912': ('e820dc2d-9317-57d1-8475-22a701fc486a', '9-12, Collective Intelligence, Distributed Cognition, and Coevolving Technology'),
    'inh-912': ('396e3dd9-4f22-5160-b6c7-3752caefa1b8', '9-12, Selection Across Biology, Culture, Education, and AI'),
}


def bc(name):
    return 'OE-CONCEPT-bio-core-' + name


def ic(name):
    return 'OE-CONCEPT-oe-interdisciplinary-' + name


# ---- new concepts (status 'proposed'; not yet in ConceptBase) ----
NEW_CONCEPTS = [
    (BIO, 'Domestication', 'BIO-CORE-v1.0.0', 'OE-CONCEPT-bio-core-domestication',
     'The process by which people breed another species over many generations by choosing which individuals reproduce, changing the traits of the population. In Bio-Core terms: a selection pressure set by human choice (artificial selection).'),
    (BIO, 'Sexual Selection', 'BIO-CORE-v1.0.0', 'OE-CONCEPT-bio-core-sexual-selection',
     'Differential mating success among heritable variants within a population. It can favour traits that raise mating success even when they do not raise survival.'),
    (INT, 'Domestication', 'OE-INTERDISCIPLINARY-v1.0.0', 'OE-CONCEPT-oe-interdisciplinary-domestication',
     "A long-running two-way relationship in which people shape another species' breeding and that species shapes human food, work and settlement. A case of niche construction and coevolution."),
]

# ---- Bio-Core human-example stages: (key, strand, band, title, concepts, PIs, guardrails, literature) ----
BIO_STAGES = [
    ('vi-k2', 'vi', 'K-2', 'Human Example: Who Looks Like Whom in a Family',
     [(bc('population'), 'primary'), (bc('inheritance'), 'primary')],
     ['Describes ways children in a family resemble their parents and ways they differ, using people as the example.',
      'States that people within any one group differ from one another in many traits.'],
     ['Treat differences among individuals as the point. Do not sort people into groups by appearance.'],
     ['grether-2021a']),
    ('vi-35', 'vi', '3-5', 'Human Example: Traits We Inherit and Traits We Gain',
     [(bc('inheritance'), 'primary'), (bc('population'), 'reinforcing')],
     ['Sorts human traits into those passed from parents (eye colour) and those that come from life experience (a scar, a learned skill).',
      'Explains that a trait gained during one lifetime is not passed to children through inheritance.'],
     ['Keeps within-lifetime change and population-level change as separate processes.'],
     ['adler-et-al-2025']),
    ('vi-68', 'vi', '6-8', 'Human Example: Lactase Persistence as a Gene Variant',
     [(bc('gene'), 'primary'), (bc('allele'), 'primary'), (bc('mutation'), 'primary')],
     ['Describes lactase persistence as a trait tied to specific variants of one gene, present in some people and absent in others.',
      'Explains that the same trait arose through different mutations in different parts of the world.'],
     ['Say that lactase persistence is common in some populations and rare in others because of history. Do not suggest that populations differ in worth or ability.'],
     ['siani-yarden-2022']),
    ('vi-912', 'vi', '9-12', 'Human Example: Lactase Persistence Across Populations',
     [(bc('allele'), 'primary'), (bc('population'), 'primary'), (bc('drift'), 'reinforcing'), (bc('selection-pressure'), 'reinforcing')],
     ['Reads a map of lactase-persistence allele frequencies and proposes how migration, drift and selection could each contribute.',
      'Evaluates the claim that selection alone explains the pattern.'],
     ['Frequencies describe populations. They say nothing about any individual person.'],
     ['siani-yarden-2022', 'price-et-al-2016']),
    ('ns-35', 'ns', '3-5', 'Human Example: People Choosing Which Animals and Plants Breed',
     [(bc('domestication'), 'primary'), (bc('inheritance'), 'reinforcing'), (bc('population'), 'reinforcing')],
     ['Describes how people changed dogs or crops over many generations by choosing which individuals breed.',
      'Compares this with change in a wild population and names what does the choosing in each case.'],
     ['Domestic breeding concerns other species. Human groups are not breeds (Norton et al. 2019).'],
     ['gregory-2009a', 'gomezgalindo-et-al-2021', 'norton-et-al-2019']),
    ('ns-68', 'ns', '6-8', 'Human Example: Controlled Selection in Foxes, and Dairying with Lactase',
     [(bc('natural-selection'), 'primary'), (bc('fitness'), 'primary'), (bc('selection-pressure'), 'primary'), (bc('domestication'), 'reinforcing')],
     ['Uses the silver fox experiment to show that choosing on one trait changes other traits as byproducts.',
      'Explains how the spread of dairying changed which lactase variant left more offspring, with nobody aiming for that outcome.'],
     ['Describe the lactase case without anyone wanting or trying to evolve. This keeps the stage inside the no-agency vocabulary.'],
     ['dugatkin-2018', 'siani-yarden-2022']),
    ('ns-912', 'ns', '9-12', 'Human Example: Testing Claims About Human Traits',
     [(bc('adaptation'), 'primary'), (bc('sexual-selection'), 'primary'), (bc('fitness'), 'reinforcing')],
     ['Tests a claim that a human trait was favoured by selection by listing the evidence that would support it, the evidence that would count against it, and the other explanations left open.',
      'Distinguishes selection for survival from selection for mating success within the claim.'],
     ['Use traits shared across the species. Claims about differences between groups of people are outside this stage.'],
     ['spier-dauer-2023', 'jackson-fuselier-eason-2024', 'sa-pinto-cardia-campos-2017']),
    ('sp-35', 'sp', '3-5', 'Human Example: People as One Species Among Many',
     [(bc('species'), 'primary'), (bc('common-ancestor'), 'primary')],
     ['States that all living people belong to one species.',
      "Places humans on a family tree with other apes and explains 'shared ancestor' without saying humans came from apes alive today."],
     ['Check for the misconception that humans descend from living apes.'],
     ['pobiner-2017', 'alles-stevenson-2003']),
    ('sp-68', 'sp', '6-8', 'Human Example: Dog Breeds Show Divergence Without New Species',
     [(bc('speciation'), 'reinforcing'), (bc('species'), 'reinforcing'), (bc('population'), 'reinforcing'), (bc('domestication'), 'reinforcing')],
     ['Explains why dog breeds, though very different in appearance, count as one species.',
      'Names what further conditions would be needed for breeds to become separate species.'],
     ['Do not extend this comparison to human populations (Norton et al. 2019).'],
     ['gregory-2009a', 'norton-et-al-2019', 'gomes-et-al-2022']),
    ('sp-912', 'sp', '9-12', 'Human Example: Other Human Species and Extinction',
     [(bc('speciation'), 'primary'), (bc('extinction'), 'primary'), (bc('phylogeny'), 'reinforcing'), (bc('common-ancestor'), 'reinforcing')],
     ['Reads a fossil-based timeline showing several human species living at overlapping times and states what it shows about branching and extinction.',
      "Explains why 'a line of progress toward modern humans' misreads a branching pattern."],
     ['This stage brings Speciation back at 9-12, which closes the gap where the concept appeared once and never returned.'],
     ['harcourt-smith-2010', 'leonard-2012', 'delgado-2014']),
]
BIO_THREADS = [
    ('vi', 'human-examples-variation-and-inheritance', 'Human Examples: Variation and Inheritance',
     'People as worked cases of variation and inheritance, from family resemblance to lactase persistence.'),
    ('ns', 'human-examples-natural-selection-and-adaptation', 'Human Examples: Natural Selection and Adaptation',
     'Human choice as a selection pressure on other species, a controlled selection experiment, and tests of claims about human traits.'),
    ('sp', 'human-examples-speciation-and-diversity', 'Human Examples: Speciation and Diversity of Life',
     'Humans within the tree of life, breeds compared with species, and extinction among human species.'),
]

# ---- Interdisciplinary bridge-case stages ----
# (key, case, host strand key, also-joins, band, title, subject_area, concepts, PIs, guardrails, literature, required)
INT_STAGES = [
    ('b1-35', 'B1', 'agn', ['inh', 'cul'], '3-5', 'Bridge Case: Learning from and Teaching Others', 'Biology, Social Studies',
     [(ic('teaching'), 'primary'), (ic('learning'), 'primary'), (ic('agency'), 'reinforcing'), (ic('scaffolding'), 'reinforcing'), (ic('transmission'), 'reinforcing')],
     ['Gives examples of how people teach one another (showing, telling, correcting) and compares them with how some other animals pass on behaviour.',
      'Explains how teaching can keep a useful practice in a group across many generations.'],
     ['Corpus gap: no record in LiteratureBase addresses teaching as an evolved human capacity directly. Source before expert review.'],
     [], True),
    ('b2-35', 'B2', 'cul', ['inh'], '3-5', 'Bridge Case: A Tool Changes as People Copy It', 'Social Studies, Computer Science',
     [(ic('innovation'), 'primary'), (ic('technology'), 'primary'), (ic('cooperation'), 'reinforcing'), (ic('conflict'), 'reinforcing'), (ic('transmission'), 'reinforcing')],
     ['Describes how a tool changed over time as people copied it and made small changes.',
      'Explains why a good idea can spread through a group when people share and copy it, and what can stop that spread.'],
     ['Makes Innovation the main idea of the 3-5 culture stage and gives Cooperation and Conflict a stage that anchors them.'],
     ['brand-mesoudi-smaldino-2021', 'richerson-2005'], True),
    ('b2-68', 'B2', 'cul', ['inh'], '6-8', 'Bridge Case: Cumulative Change in Tools and Traits', 'Social Studies, Biology',
     [(ic('innovation'), 'primary'), (ic('transmission'), 'primary'), (ic('selection'), 'reinforcing'), (ic('culture'), 'reinforcing'), (ic('information'), 'reinforcing')],
     ['Compares how a tool design changes through copying with how a trait changes through inheritance, naming one similarity and one difference.',
      'Explains how small improvements add up when each generation builds on the last.'],
     [], ['brand-mesoudi-smaldino-2021', 'arnon-kirby-2024', 'cultural-evolution-society-2023'], True),
    ('b3-68', 'B3', 'agn', ['inh', 'cul'], '6-8', 'Bridge Case: Domestication, People and Other Species Changing Together', 'Biology, Social Studies',
     [(ic('niche-construction'), 'primary'), (ic('selection'), 'primary'), (ic('domestication'), 'primary'), (ic('culture'), 'reinforcing'), (ic('agency'), 'reinforcing')],
     ["Describes how people's farming or herding changed the conditions other species lived in and how those species changed in response.",
      'Explains how living with domesticated species changed human societies in turn.'],
     ['Domestic breeding concerns other species. Human groups are not breeds (Norton et al. 2019).'],
     ['gregory-2009a', 'dugatkin-2018', 'norton-et-al-2019'], True),
    ('b4-912', 'B4', 'inh', ['agn', 'cul'], '9-12', 'Bridge Case: Lactase Persistence, Genes and Culture Changing Together', 'Biology, Social Studies',
     [(ic('selection'), 'primary'), (ic('niche-construction'), 'primary'), (ic('culture'), 'primary'), (ic('variation'), 'reinforcing'), (ic('transmission'), 'reinforcing')],
     ['Explains how a cultural practice (dairying) changed which gene variant was favoured and how the spread of the variant made the practice more useful.',
      'Compares this account with one that uses genes alone and states what each leaves out.'],
     ['Say that lactase persistence arose several times in different places. Populations are not ranked by it (Chisango et al. 2023 documents racial misconceptions about evolution).'],
     ['siani-yarden-2022', 'richerson-2005', 'chisango-et-al-2023'], True),
    ('b5-k2', 'B5', 'cul', ['agn'], 'K-2', 'Bridge Case: Sharing a Space and Following Rules', 'Social Studies',
     [(ic('cooperation'), 'primary'), (ic('conflict'), 'reinforcing'), (ic('norms'), 'reinforcing'), (ic('communication'), 'reinforcing')],
     ['Gives examples of people sharing a resource such as a play space and says what happens when everyone follows, or breaks, a sharing rule.'],
     ['Revives Cooperation, which is currently used in one stage with no links.'],
     ['koomen-herrmann-2018'], True),
    ('b5-912', 'B5', 'cul', ['agn'], '9-12', 'Bridge Case: Cooperation and Shared Resources in Human Evolution', 'Social Studies, Biology',
     [(ic('cooperation'), 'primary'), (ic('institutions'), 'primary'), (ic('norms'), 'reinforcing'), (ic('conflict'), 'reinforcing'), (ic('agency'), 'reinforcing')],
     ['Analyses a shared-resource problem by naming the incentives facing individuals, the rules or institutions that change them, and the evidence on what has worked.',
      'Evaluates the claim that humans are cooperative by nature using evidence from human evolution.'],
     [], ['hanisch-eirdosh-2021', 'hanisch-eirdosh-2024', 'koomen-herrmann-2018'], True),
    ('b6-912', 'B6', 'cul', ['agn'], '9-12', 'Bridge Case: Machine Culture and AI', 'Computer Science, Social Studies',
     [(ic('technology'), 'primary'), (ic('information'), 'reinforcing'), (ic('selection'), 'reinforcing'), (ic('agency'), 'reinforcing'), (ic('innovation'), 'reinforcing')],
     ['Describes how AI systems are shaped by selection on human-made data and goals, and how they in turn shape what people learn and copy.',
      "Evaluates a claim that an AI system 'wants' something by separating how it was built from how it behaves."],
     ['Optional extension. Brings Technology back after its gap at 3-5 and 6-8.'],
     ['rahwan-2019-machine-behaviour', 'peel-sadler-friedrichsen-2025', 'guest-suarez-vanrooij-2025-cail'], False),
]
# thread: slug, title, connecting idea, [ordered station keys]; host keys come from HOST
INT_THREADS = [
    ('b1', 'bridge-learning-from-and-teaching-others', 'Bridge Case B1: Learning from and Teaching Others',
     'Teaching and learning link Agency, cultural transmission and the Culture strand at 3-5.', ['host:agn-35', 'b1-35']),
    ('b2', 'bridge-tool-innovation-and-cumulative-culture', 'Bridge Case B2: Tool Innovation and Cumulative Culture',
     'Innovation and copying link the Culture strand to Inheritance, Variation and Selection.', ['host:cul-35', 'b2-35', 'host:cul-68', 'b2-68']),
    ('b3', 'bridge-domestication-shared-change', 'Bridge Case B3: Domestication',
     'Domestication joins Niche Construction, Selection and Culture around one familiar case.', ['host:agn-68', 'b3-68']),
    ('b4', 'bridge-lactase-gene-culture', 'Bridge Case B4: Lactase Persistence',
     'Lactase persistence joins Selection, Niche Construction and Culture in one worked human case.', ['host:inh-912', 'b4-912']),
    ('b5', 'bridge-cooperation-and-shared-resources', 'Bridge Case B5: Cooperation and Shared Resources',
     'Cooperation, norms and institutions link the Culture and Agency strands from K-2 to 9-12.', ['host:cul-k2', 'b5-k2', 'host:cul-912', 'b5-912']),
    ('b6', 'bridge-machine-culture-and-ai', 'Bridge Case B6: Machine Culture and AI',
     'Technology, information and agency meet in the question of what AI systems do and why.', ['host:cul-912', 'b6-912']),
]

COLLECTIONS_BIO = ['conceptual-change', 'misconceptions', 'learning-progressions', 'assessment-instruments-subject', 'teaching-methods', 'international-and-comparative']
COLLECTIONS_INT = COLLECTIONS_BIO + ['computational-modeling']

INTRO_BIO = """Status: synthetic. Nobody has taught from this space, AI drafted it from published research, and no subject-matter expert has reviewed it. Use it to compare designs and test ideas. Do not use it to plan lessons.

Bio-Core is a thought experiment about the narrowest useful way to teach evolution. It contains biology only, and only the ideas that explain evolution as variation, inheritance and selection acting on populations. It has no concepts about what organisms want or try to do. That omission is the design. The question it asks is how far a strictly population-level vocabulary can carry a student from kindergarten to grade 12.

Its partner space, Interdisciplinary, starts from the opposite assumption. The two were built to disagree so that their differences can be studied. Open them side by side in the Comparison view.

What is here: 3 strands (Variation and Inheritance, Natural Selection and Adaptation, Speciation and Diversity of Life), 12 stages across four grade bands, 35 learning outcomes and 15 concepts. Ten draft stages add human examples, one thread per strand. They are proposals that wait for expert review. Time is left open on purpose: nothing here assumes a number of hours."""

INTRO_INT = """Status: synthetic. Nobody has taught from this space, AI drafted it from published research, and no subject-matter expert has reviewed it. Its central claim, that an agency-inclusive progression supports better reasoning about causes, has less published testing behind it than Bio-Core's. Use it to compare designs and test ideas. Do not use it to plan lessons.

Interdisciplinary is a thought experiment about the widest useful way to teach evolution. It treats evolution as one general pattern (variation, selection, transmission) that shows up in living things, human culture, learning and technology, and it spreads that pattern across biology, social studies and computer science. It includes ideas about agency, teaching, niche construction and cooperation, and asks students to judge when thinking in terms of goals and choices explains something and when it misleads. The question it asks is whether meeting one pattern in several subjects builds flexible reasoning about causes.

Its partner space, Bio-Core, starts from the opposite assumption. The two were built to disagree so that their differences can be studied. Open them side by side in the Comparison view.

What is here: 4 strands (Inheritance, Variation and Selection Across Systems; Agency, Development and Niche Construction; Culture, Technology and Collective Systems; Discovering and Testing Ideas), 16 stages across four grade bands, 54 learning outcomes and 28 concepts. Eight draft stages add six cross-strand human-example bridge cases, one thread per case. They are proposals that wait for expert review. Time is left open on purpose: nothing here assumes a number of hours."""

LIT_ROLE = {  # literature id -> (project key, short reason)
    'grether-2021a': ('B', 'elementary-grade evolution curricula; closest published match to Bio-Core K-5'),
    'brown-ronfard-kelemen-2020': ('B', 'storybook intervention on natural selection in early elementary classrooms'),
    'emmons-lees-kelemen-2018': ('BI', 'young children transfer the basic theory of natural selection by analogy'),
    'adler-fiedler-harms-2024': ('B', "children's ideas about animal and plant evolution"),
    'adler-et-al-2025': ('B', "CACIE, a conceptual assessment of children's ideas about evolution"),
    'lehrer-schauble-2012': ('B', 'seeding evolutionary thinking in children by modelling its foundations'),
    'lehrer-schauble-2015': ('BI', 'argues that a learning progression is not one staircase; supports keeping the LPM free of time and stage order'),
    'fensham-2022-chimera': ('BI', 'asks whether progression in school science curricula is a rational prospect or a chimera'),
    'furtak-2012': ('B', 'links a natural-selection learning progression to how teachers enact formative assessment'),
    'beggrow-nehm-2012': ('B', "students' mental models of natural selection and genetic drift"),
    'fiedler-trobst-harms-2017': ('B', 'conceptual knowledge of randomness and probability in evolution contexts'),
    'price-et-al-2014': ('B', 'the Genetic Drift Inventory'),
    'price-et-al-2016': ('B', 'a computer simulation that improves understanding of genetic drift'),
    'tornabene-lavington-nehm-2018': ('B', 'validity evidence for Genetic Drift Inventory scores'),
    'todd-romine-2016': ('B', 'validation of a genetics learning-progression assessment'),
    'drits-esser-hardcastle-bass-homburger-malone-pompei-deboer-stark-2021': ('B', 'randomized trial of an eight-week evolution unit; a rare datum on unit length'),
    'daniel-ferguson-leone-bucklin-2024': ('B', 'compares tree-thinking interventions'),
    'catley-novick-shade-2010': ('B', 'students interpret evolutionary diagrams when topology and process conflict'),
    'misheva-coburn-wiles-2026': ('B', 'acceptance of common ancestry'),
    'gomes-et-al-2022': ('B', 'a teaching strategy for species concepts'),
    'delgado-2014': ('B', 'collective landmarks for deep time'),
    'cheek-2013': ('B', 'relation between conventional time and deep time understanding'),
    'dugatkin-2018': ('BI', 'the silver fox domestication experiment'),
    'gregory-2009a': ('BI', "artificial selection and domestication, Darwin's own entry point to natural selection"),
    'gomezgalindo-et-al-2021': ('B', 'maize artificial selection as a bridging case to teach natural selection'),
    'spier-dauer-2023': ('B', 'sexual selection used to improve student reasoning about evolution'),
    'jackson-fuselier-eason-2024': ('B', 'compares sexual-selection research with how textbooks present it'),
    'sa-pinto-cardia-campos-2017': ('B', 'sexual selection review with teaching activities'),
    'siani-yarden-2022': ('BI', 'online interactive activity on the evolution of the human lactase gene'),
    'pobiner-2017': ('B', 'teaching human evolution to address misconceptions'),
    'alles-stevenson-2003': ('B', 'teaching human evolution'),
    'harcourt-smith-2010': ('B', 'overview of human evolution for teachers'),
    'leonard-2012': ('B', 'short review of the chronology of human evolution'),
    'norton-et-al-2019': ('BI', 'refutes the analogy between human races and dog breeds; guardrail for the domestication cases'),
    'chisango-et-al-2023': ('BI', 'racial misconceptions about evolution predict opposition to evolution; guardrail for human cases'),
    'richerson-2005': ('I', 'how culture transformed human evolution'),
    'brand-mesoudi-smaldino-2021': ('I', 'analogy as a catalyst for cumulative cultural evolution'),
    'holding-smaldino-brand-2026': ('I', 'analogies evolve by increasing transmission fidelity'),
    'cultural-evolution-society-2023': ('I', 'a short statement of what cultural evolution is'),
    'arnon-kirby-2024': ('I', 'cultural evolution creates the statistical structure of language'),
    'hanisch-eirdosh-2021': ('I', 'challenges and opportunities in teaching the evolution of human prosociality'),
    'hanisch-eirdosh-2024': ('I', 'cooperation as a causal factor in human evolution, with German high-school data'),
    'koomen-herrmann-2018': ('I', "children's strategies for overcoming the tragedy of the commons"),
    'halls-ainsworth-oliver-2018': ('I', "young children's use of teleology depends on question wording"),
    'halls-ainsworth-oliver-2021': ('I', 'dialogic interventions that reduce inappropriate teleological explanations'),
    'trommler-hammann-2020': ('I', 'biological function and teleology: implications for biology education'),
    'ronfard-brown-pitt-kelemen-2023': ('I', 'children learn and transfer complex scientific explanations from books'),
    'rahwan-2019-machine-behaviour': ('I', 'machine behaviour as a field of study'),
    'peel-sadler-friedrichsen-2019': ('I', 'unplugged algorithmic explanations of natural selection'),
    'peel-sadler-friedrichsen-2025': ('I', 'computational thinking through unplugged algorithmic explanations of selection'),
    'guest-suarez-vanrooij-2025-cail': ('I', 'critical AI literacies'),
    'hartelt-martens-2025a': ('I', 'metacognitive awareness and self-regulation of intuitive thinking in evolution education'),
    'nelson-scharmann-beard-flammer-2019': ('I', 'nature of science as a foundation for understanding evolution'),
    'pessoa-et-al-2024': ('I', 'evolutionary literacy and sustainable futures'),
    'kreher-mcmanus-2023': ('I', 'an interdisciplinary evolution and sustainability course raises acceptance'),
}


def main():
    out = []
    w = out.append
    w('-- Introductions, shared literature collections, 63 proposed paper links (35 Bio-Core, 28 Interdisciplinary), three proposed concepts,')
    w('-- and the human-example draft stages for bio-core-lpm-synth and interdisciplinary-lpm-synth.')
    w('-- Generated by scripts/generate_bio_interdisciplinary_enrichment_seed.py; do not hand-edit.')
    w('--')
    w('-- Source: lab_manager/docs/design-notes/bio-core-interdisciplinary-modelling-literature-')
    w('-- human-examples-and-time-budget-2026-10-25.md (sections 3, 4 and 6). Decisions applied from')
    w('-- Dustin, 2026-10-25: never cite the 2020 Eirdosh & Hanisch paper; leave Evolutionary Mismatch')
    w('-- out of Bio-Core; load the proposed human cases as drafts.')
    w('--')
    w('-- Everything below is AI-drafted and has not been reviewed by a subject-matter expert. Stages')
    w("-- load as 'draft', threads and concepts as 'proposed', paper links as 'draft'. Every statement")
    w('-- is idempotent (fixed uuid5 ids, ON CONFLICT or WHERE NOT EXISTS).')
    w('')
    w('-- 0. Keep the comparison profile accurate: scope and depth count accepted content only, so proposed')
    w('-- threads and draft stages do not inflate either space. Draft and proposed counts are added as')
    w('-- trailing columns (CREATE OR REPLACE VIEW allows new columns at the end only).')
    w('CREATE OR REPLACE VIEW lpm_data_object_richness AS')
    w('SELECT')
    w('  o.id AS data_object_id,')
    w('  o.project_id,')
    w('  o.object_type,')
    w('  o.title,')
    w('  o.grade_band,')
    w("  length(coalesce(o.description, '')) AS description_length,")
    w("  jsonb_array_length(CASE WHEN jsonb_typeof(o.content -> 'performanceIndicators') = 'array' THEN o.content -> 'performanceIndicators' ELSE '[]'::jsonb END) AS performance_indicator_count,")
    w("  jsonb_array_length(CASE WHEN jsonb_typeof(o.content -> 'concepts') = 'array' THEN o.content -> 'concepts' ELSE '[]'::jsonb END) AS concept_link_count,")
    w('  (SELECT count(*) FROM curriculum_repository_links l WHERE l.data_object_id = o.id) AS curriculum_repository_link_count,')
    w('  (SELECT count(*) FROM lpm_comparative_links c WHERE c.from_data_object_id = o.id OR c.to_data_object_id = o.id) AS comparative_link_count,')
    w("  (SELECT count(*) FROM evidence_links e WHERE e.target_type = 'data_object' AND e.target_id = o.id) AS evidence_link_count,")
    w('  o.status AS status')
    w('FROM lpm_data_objects o;')
    w('')
    w('CREATE OR REPLACE VIEW lpm_project_comparison_profile AS')
    w('SELECT')
    w('  p.id AS project_id,')
    w('  p.slug,')
    w('  p.name,')
    w("  (SELECT count(*) FROM lpm_threads th WHERE th.project_id = p.id AND th.status = 'accepted') AS strand_count,")
    w("  (SELECT count(*) FROM lpm_data_objects o WHERE o.project_id = p.id AND o.object_type = 'substrand' AND o.status = 'accepted') AS substrand_count,")
    w("  (SELECT count(DISTINCT o.grade_band) FROM lpm_data_objects o WHERE o.project_id = p.id AND o.status = 'accepted' AND o.grade_band IS NOT NULL) AS grade_bands_covered,")
    w('  (SELECT count(DISTINCT d) FROM lpm_data_objects o, jsonb_array_elements_text(')
    w("      CASE WHEN jsonb_typeof(o.content -> 'associatedDomains') = 'array' THEN o.content -> 'associatedDomains' ELSE '[]'::jsonb END")
    w("    ) AS d WHERE o.project_id = p.id AND o.status = 'accepted') AS subject_domain_count,")
    w("  (SELECT round(avg(r.description_length), 0) FROM lpm_data_object_richness r WHERE r.project_id = p.id AND r.status = 'accepted') AS avg_description_length,")
    w("  (SELECT round(avg(r.performance_indicator_count), 1) FROM lpm_data_object_richness r WHERE r.project_id = p.id AND r.status = 'accepted') AS avg_performance_indicators,")
    w("  (SELECT round(avg(r.curriculum_repository_link_count), 1) FROM lpm_data_object_richness r WHERE r.project_id = p.id AND r.status = 'accepted') AS avg_real_world_links,")
    w('  (SELECT count(*) FROM theories th WHERE th.project_id = p.id) AS theory_count,')
    w('  (SELECT count(*) FROM literature_references lr WHERE lr.project_id = p.id) AS literature_count,')
    w('  (SELECT count(*) FROM curriculum_repository_links l WHERE l.project_id = p.id) AS curriculum_repository_link_count,')
    w('  (SELECT count(*) FROM lpm_comparative_links c')
    w('     JOIN lpm_data_objects o ON o.id = c.from_data_object_id OR o.id = c.to_data_object_id')
    w('     WHERE o.project_id = p.id) AS comparative_link_count,')
    w('  (SELECT count(*) FROM lpm_divergence_reviews r WHERE r.project_id = p.id) AS divergences_reviewed,')
    w('  (SELECT count(*) FROM lpm_divergence_coverage c WHERE c.project_id = p.id AND c.is_stale) AS divergences_stale,')
    w("  (SELECT count(*) FROM lpm_data_objects o WHERE o.project_id = p.id AND o.object_type = 'substrand' AND o.status = 'draft') AS draft_substrand_count,")
    w("  (SELECT count(*) FROM lpm_threads th WHERE th.project_id = p.id AND th.status = 'proposed') AS proposed_strand_count")
    w('FROM projects p;')
    w('')
    w('-- 1. Introduction text, shown on the project Dashboard. Plain TEXT; paragraphs split on blank lines.')
    w('ALTER TABLE projects ADD COLUMN IF NOT EXISTS introduction TEXT;')
    w("COMMENT ON COLUMN projects.introduction IS 'Editable introduction shown at the top of the project Dashboard. Opens with status, then aim. Paragraphs are separated by blank lines.';")
    w(f"UPDATE projects SET introduction = $J${INTRO_BIO}$J$ WHERE id = {q(BIO)} AND introduction IS NULL;")
    w(f"UPDATE projects SET introduction = $J${INTRO_INT}$J$ WHERE id = {q(INT)} AND introduction IS NULL;")
    w('')

    w('-- 2. Proposed concepts (not yet in ConceptBase).')
    for pid, label, vocab, cb_id, definition in NEW_CONCEPTS:
        eid = uid('concept', pid, label)
        meta = {'definition': definition, 'vocabulary': vocab, 'conceptbase_id': cb_id,
                'proposed_not_in_conceptbase': True, 'proposed_on': '2026-10-25',
                'grounding': 'Design note 2026-10-25 section 1 and 2; AI-drafted, unreviewed.'}
        w('INSERT INTO lpm_schema_elements (id, project_id, element_type, label, parent_id, metadata, status)')
        w(f"VALUES ({q(eid)}, {q(pid)}, 'concept', {q(label)}, NULL, {jq(meta)}, 'proposed')")
        w('ON CONFLICT (id) DO NOTHING;')
    w('')

    def stage_row(pid, branch, key, title, band, subject, content, desc):
        sid = uid('stage', pid, key)
        w('INSERT INTO lpm_data_objects (id, project_id, branch_id, object_type, title, description, grade_band, subject_area, content, status)')
        w(f"VALUES ({q(sid)}, {q(pid)}, {q(branch)}, 'substrand', {q(title)}, {q(desc)}, {q(band)}, {q(subject)}, {jq(content)}, 'draft')")
        w('ON CONFLICT (id) DO NOTHING;')
        return sid

    sids = {}
    w('-- 3. Bio-Core human-example stages (draft).')
    for key, strand, band, title, concepts, pis, guards, lits in BIO_STAGES:
        content = {'_source': {'path': BIO_PATH[strand], 'repo': SRC_REPO}, 'source_id': 'OE-STRAND-bio-core-k12-human-examples-' + key,
                   'track': 'human-examples', 'required': False,
                   'concepts': [{'id': c, 'emphasis': e} for c, e in concepts],
                   'performanceIndicators': pis, 'guardrails': guards, 'literature_ids': ['OE-LITERATURE-' + l for l in lits],
                   'draft_note': NOTE}
        desc = 'Key concepts: ' + ', '.join(c.replace('OE-CONCEPT-bio-core-', '').replace('-', ' ').title() for c, _ in concepts)
        sids[('bio', key)] = stage_row(BIO, BIO_BRANCH, key, title, band, 'Biology', content, desc)
    w('')
    w('-- 4. Interdisciplinary bridge-case stages (draft).')
    for key, case, host, also, band, title, subject, concepts, pis, guards, lits, required in INT_STAGES:
        content = {'_source': {'path': INT_PATH[host], 'repo': SRC_REPO}, 'source_id': 'OE-STRAND-oe-interdisciplinary-k12-bridge-' + key,
                   'track': 'human-examples', 'case_id': case, 'also_joins_strands': [INT_PATH[a] for a in also], 'required': required,
                   'concepts': [{'id': c, 'emphasis': e} for c, e in concepts],
                   'performanceIndicators': pis, 'guardrails': guards, 'literature_ids': ['OE-LITERATURE-' + l for l in lits],
                   'draft_note': NOTE}
        desc = 'Key concepts: ' + ', '.join(c.replace('OE-CONCEPT-oe-interdisciplinary-', '').replace('-', ' ').title() for c, _ in concepts)
        sids[('int', key)] = stage_row(INT, INT_BRANCH, key, title, band, subject, content, desc)
    w('')

    w('-- 5. Threads (status proposed) and their stations.')
    for strand, slug, title, idea in BIO_THREADS:
        tid = uid('thread', BIO, slug)
        w('INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, connecting_idea, narrative, status)')
        w(f"VALUES ({q(tid)}, {q(BIO)}, {q(BIO_BRANCH)}, {q(slug)}, {q(title)}, 'vertical', {q(idea)}, {q(idea + ' ' + NOTE)}, 'proposed')")
        w('ON CONFLICT (project_id, slug) DO NOTHING;')
        stages = [s for s in BIO_STAGES if s[1] == strand]
        for i, s in enumerate(stages, 1):
            nxt = 'Leads into the next grade band.' if i < len(stages) else None
            w('INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, relation_to_next)')
            w(f"VALUES ({q(uid('station', tid, str(i)))}, {q(tid)}, {q(sids[('bio', s[0])])}, {i}, {q(s[2] + ', ' + s[3])}, {q(nxt) if nxt else 'NULL'})")
            w('ON CONFLICT (thread_id, sequence) DO NOTHING;')
    for case, slug, title, idea, order in INT_THREADS:
        tid = uid('thread', INT, slug)
        w('INSERT INTO lpm_threads (id, project_id, branch_id, slug, title, thread_type, connecting_idea, narrative, status)')
        w(f"VALUES ({q(tid)}, {q(INT)}, {q(INT_BRANCH)}, {q(slug)}, {q(title)}, 'vertical_horizontal', {q(idea)}, {q(idea + ' ' + NOTE)}, 'proposed')")
        w('ON CONFLICT (project_id, slug) DO NOTHING;')
        for i, item in enumerate(order, 1):
            if item.startswith('host:'):
                did, label = HOST[item[5:]]
                note = 'Host stage (accepted content), ' + label
            else:
                st = next(s for s in INT_STAGES if s[0] == item)
                did = sids[('int', item)]
                note = 'Draft bridge stage, ' + st[4] + ', ' + st[5]
            nxt = 'Leads into' if i < len(order) else None
            w('INSERT INTO lpm_thread_stations (id, thread_id, data_object_id, sequence, role_note, relation_to_next)')
            w(f"VALUES ({q(uid('station', tid, str(i)))}, {q(tid)}, {q(did)}, {i}, {q(note)}, {q(nxt) if nxt else 'NULL'})")
            w('ON CONFLICT (thread_id, sequence) DO NOTHING;')
    w('')

    w('-- 6. Comparative links between matching cases (relation_type distinct per pair).')
    links = [
        (sids[('bio', 'vi-912')], sids[('int', 'b4-912')], 'contrasting_treatment',
         'Both spaces teach lactase persistence at 9-12. The biology is the same in both. What differs is which causes are in scope. Bio-Core treats it as an allele-frequency pattern explained by selection pressure, drift and migration, with nobody choosing anything. Interdisciplinary adds the cultural practice of dairying as a cause that changes the selection pressure, so Selection, Niche Construction and Culture are taught together in one case.'),
        (sids[('bio', 'ns-35')], sids[('int', 'b3-68')], 'contrasting_domestication',
         'Both spaces use domestication. Bio-Core treats it as a selection pressure set by human choice, the same mechanism as natural selection with a different selector. Interdisciplinary treats it as two-way change: people alter the animals and plants, and those species alter how people live. The first case teaches one mechanism cleanly. The second links three concepts across strands.'),
    ]
    w('INSERT INTO lpm_comparative_links (id, from_data_object_id, to_data_object_id, relation_type, divergence_ref, commentary)')
    w('VALUES')
    rows = []
    for a, b, rel, text in links:
        rows.append(f"({q(uid('cmp', a, b, rel))}, {q(a)}, {q(b)}, {q(rel)}, NULL, {q(text)})")
    w(',\n'.join(rows))
    w('ON CONFLICT (id) DO NOTHING;')
    w('')

    w('-- 7. Shared literature collections attached project-wide (live).')
    for pid, cols in ((BIO, COLLECTIONS_BIO), (INT, COLLECTIONS_INT)):
        for slug in cols:
            w('INSERT INTO project_literature_collection_links (project_id, collection_id, link_type)')
            w(f"SELECT {q(pid)}, c.id, 'live' FROM literature_collections c WHERE c.slug = {q(slug)}")
            w(f"AND NOT EXISTS (SELECT 1 FROM project_literature_collection_links l WHERE l.project_id = {q(pid)} AND l.collection_id = c.id AND l.lpm_thread_id IS NULL AND l.curriculum_repository_record_id IS NULL);")
    w('')

    w('-- 8. Proposed paper links. Each note says the match is at title level and the paper was not read in full.')
    for lid, (who, why) in LIT_ROLE.items():
        rec = LIT[lid]
        for pkey, pid in (('B', BIO), ('I', INT)):
            if pkey not in who:
                continue
            pname = 'Bio-Core' if pkey == 'B' else 'Interdisciplinary'
            note = (f"Proposed link for {pname} (2026-10-25). Match made on title and tags; not read in full: {why}. "
                    "Draft until a subject-matter expert reviews it.")
            doi = q(rec['doi']) if rec['doi'] else 'NULL'
            typ = q(rec['type']) if rec['type'] else 'NULL'
            venue = q(rec['venue']) if rec['venue'] else 'NULL'
            w('INSERT INTO literature_references (project_id, literaturebase_id, title, authors, year, doi, venue, type, status, notes, tags)')
            w(f"SELECT {q(pid)}, {q(rec['id'])}, {q(rec['title'])}, {jq(rec['authors'])}, {rec['year'] if rec['year'] else 'NULL'}, {doi}, {venue}, {typ}, 'draft', {q(note)}, ARRAY['proposed-link','2026-10-25-enrichment']")
            w(f"WHERE NOT EXISTS (SELECT 1 FROM literature_references WHERE project_id = {q(pid)} AND literaturebase_id = {q(rec['id'])});")
    w('')
    sys.stdout.write('\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
