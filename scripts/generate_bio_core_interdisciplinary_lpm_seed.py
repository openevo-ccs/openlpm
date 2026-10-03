#!/usr/bin/env python3
"""
Generates supabase/migrations/092_bio_core_interdisciplinary_lpm_content_seed.sql.

Populates the two already-existing, already-public "Synthetic-Theoretical" Project
Spaces (slugs bio-core-lpm-synth / interdisciplinary-lpm-synth, seeded empty by
005_seed_projects.sql, renamed by 074_rename_synthetic_pair_projects.sql) with the
real strand/substrand/concept content transcribed directly from the sibling
bio-core-k12 and oe-interdisciplinary-k12 GitHub repos' lpm.yaml + strands/*.yaml
(their current working-tree state, which includes an already-decided identifier-
scheme migration neither repo had committed yet, and oe-interdisciplinary-k12's
4th strand, analogy-search-metacognition, added 2026-09-02 and already registered
in that repo's own lpm.yaml though also not yet committed).

Deliberately excludes oe-interdisciplinary-k12's strand-205 (rhetorical-tells-
authenticity): a brand-new, uncommitted file dated 2026-10-03, not referenced by
that repo's own lpm.yaml, and explicitly flagged in its own header as proposing an
unregistered ConceptBase sandbox concept "pending confirmation" / "flagged for
Dustin's review before formal registration." Migrating it would resolve someone
else's pending review by fiat. Follow-up, once reviewed.

Mirrors the generator pattern used for 069_netlogo_lpm_strands_seed.sql: uuid5-
derived stable ids (safe to re-run; also makes every lpm_schema_elements/
lpm_data_objects INSERT safe to re-apply via ON CONFLICT (id) DO NOTHING).
Unlike 069, this migration does NOT create new projects -- both target projects
already exist, looked up live by slug, with a RAISE EXCEPTION guard if either is
missing (would mean the slugs changed again since 074 and this migration needs
re-pointing, not a silent no-op).

Concept labels/definitions are transcribed verbatim from conceptbase/registry/
concept/*.json (the real, already-published BIO-CORE-v1.0.0 / OE-INTERDISCIPLINARY-
v1.0.0 vocabulary records) -- not re-authored.

Run:
  python scripts/generate_bio_core_interdisciplinary_lpm_seed.py > supabase/migrations/092_bio_core_interdisciplinary_lpm_content_seed.sql
"""
import json
import uuid

NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://openevo.net/openlpm/bio-core-interdisciplinary-lpm-seed")


def uid(key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, key))


def J(s) -> str:
    s = s if s is not None else ""
    assert "$J$" not in s, f"literal text unexpectedly contains the $J$ delimiter: {s[:80]!r}"
    return f"$J${s}$J$"


def JSB(obj) -> str:
    s = json.dumps(obj, ensure_ascii=False)
    assert "$J$" not in s, "generated JSON unexpectedly contains the $J$ delimiter"
    return f"$J${s}$J$::jsonb"


# ============================================================================
# Concept vocabularies -- transcribed verbatim from conceptbase/registry/concept/
# *.json (label + first available definition text + real status, mapped onto
# lpm_schema_elements.status's local enum: ConceptBase 'stable' -> 'accepted',
# a sandbox concept's provisional sandboxMeta -> 'proposed').
# ============================================================================

BIO_CORE_CONCEPTS = {
    "OE-CONCEPT-bio-core-adaptation": ("Adaptation", "A heritable trait that increases an organism's fitness within a given environment, shaped by natural selection over generations.", "accepted"),
    "OE-CONCEPT-bio-core-allele": ("Allele", "One of two or more alternative forms of a gene occupying the same locus on a chromosome.", "accepted"),
    "OE-CONCEPT-bio-core-common-ancestor": ("Common Ancestor", "An organism or population from which two or more descendant lineages have diverged.", "accepted"),
    "OE-CONCEPT-bio-core-drift": ("Drift", "Random fluctuation of allele frequencies within a population from one generation to the next, independent of selective advantage.", "accepted"),
    "OE-CONCEPT-bio-core-extinction": ("Extinction", "The complete disappearance of a species or other taxonomic group, ending its lineage.", "accepted"),
    "OE-CONCEPT-bio-core-fitness": ("Fitness", "The relative reproductive success of a genotype or phenotype, typically measured as expected number of offspring contributing to the next generation.", "accepted"),
    "OE-CONCEPT-bio-core-gene": ("Gene", "A heritable unit of DNA that functions as a basic unit of inheritance, typically encoding information for a specific product or trait.", "accepted"),
    "OE-CONCEPT-bio-core-inheritance": ("Inheritance", "The transmission of genetic information from parent to offspring.", "accepted"),
    "OE-CONCEPT-bio-core-mutation": ("Mutation", "A heritable change in a DNA sequence, serving as an ultimate source of genetic variation within a population.", "accepted"),
    "OE-CONCEPT-bio-core-natural-selection": ("Natural Selection", "Differential reproductive success among heritable variants within a population, resulting from their interaction with the environment.", "accepted"),
    "OE-CONCEPT-bio-core-phylogeny": ("Phylogeny", "The evolutionary history and relatedness of a group of organisms, typically represented as a branching tree.", "accepted"),
    "OE-CONCEPT-bio-core-population": ("Population", "A group of interbreeding organisms of the same species occupying a defined geographic area at a given time.", "accepted"),
    "OE-CONCEPT-bio-core-selection-pressure": ("Selection Pressure", "An environmental or biological factor that reduces or increases reproductive success of particular variants within a population, driving the direction of selection.", "accepted"),
    "OE-CONCEPT-bio-core-speciation": ("Speciation", "The evolutionary process by which populations diverge to become distinct, reproductively isolated species.", "accepted"),
    "OE-CONCEPT-bio-core-species": ("Species", "A group of organisms capable of interbreeding and producing fertile offspring, generally reproductively isolated from other such groups.", "accepted"),
}

INTERDISCIPLINARY_CONCEPTS = {
    "OE-CONCEPT-oe-interdisciplinary-agency": ("Agency", "The capacity of an individual or system to act intentionally and make choices that influence outcomes, rather than responding passively to external forces.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-collective-intelligence": ("Collective Intelligence", "Problem-solving or knowledge-generating capability that emerges from the coordinated activity of many individuals or agents, exceeding what any one could achieve alone.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-communication": ("Communication", "The exchange of information between agents via signals, language, or other shared codes.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-conflict": ("Conflict", "Competing interests, goals, or behaviors among individuals or groups within a shared system or environment.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-cooperation": ("Cooperation", "Coordinated behavior among individuals or groups that produces a mutual benefit not achievable, or less efficiently achieved, alone.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-culture": ("Culture", "Socially transmitted knowledge, beliefs, practices, and artifacts shared within a group, persisting beyond any single individual.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-development": ("Development", "The process by which an organism grows and matures from an initial state toward greater complexity or capability; in education, the progressive growth of a learner's knowledge, skills, or competencies over time, often scaffolded by instruction.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-distributed-cognition": ("Distributed Cognition", "Cognitive processing that is spread across individuals, artifacts, and environment, rather than occurring solely within a single mind.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-evolutionary-process": ("Evolutionary Process", "Any process by which variants are generated, selected, and transmitted across iterations within a system -- applicable to genetic, cultural, technological, or cognitive systems alike.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-information": ("Information", "A pattern or signal that reduces uncertainty for a receiver, whether encoded genetically, linguistically, symbolically, or computationally.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-inheritance": ("Inheritance", "Transmission of genetic information from parent to offspring (biology); of beliefs, practices, or knowledge from one generation or individual to another via social learning (culture); or persistence of design features or code structure across successive versions of an artifact or system (technology).", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-innovation": ("Innovation", "The generation of a novel variant -- an idea, practice, technology, or trait -- that did not previously exist within a system.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-institutions": ("Institutions", "Stable, socially recognized structures or rules that organize and constrain collective behavior over time.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-knowledge": ("Knowledge", "Justified, retained information that an individual, group, or system can draw upon to act or reason.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-learning": ("Learning", "A relatively durable change in knowledge, behavior, or capability resulting from experience, instruction, or practice.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-niche-construction": ("Niche Construction", "The process by which organisms or groups modify their environment in ways that alter the selective pressures acting on themselves or others.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-norms": ("Norms", "Shared expectations or rules of behavior within a group, enforced through social sanction rather than formal law.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-representation": ("Representation", "A structure -- mental, symbolic, or computational -- that stands for and conveys meaning about something else.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-scaffolding": ("Scaffolding", "Temporary structured support provided to a learner, gradually withdrawn as competence increases.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-selection": ("Selection", "Differential reproductive success among heritable variants (biology); differential persistence or spread of cultural variants based on their fit to a social or environmental context (culture); choosing among available instructional pathways or resources (education); a search or optimization process that favors candidates scoring higher against an objective function (AI).", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-teaching": ("Teaching", "Intentional action by one individual or system to facilitate another's learning or transmission of a skill, practice, or piece of knowledge.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-technology": ("Technology", "Tools, techniques, or systems created to extend or augment biological or cognitive capability.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-transmission": ("Transmission", "The process by which information, traits, or practices move from one holder (organism, person, group, or system) to another.", "accepted"),
    "OE-CONCEPT-oe-interdisciplinary-variation": ("Variation", "The existence of differences among individuals, variants, or instances within a population or system, providing the raw material on which selection can act.", "accepted"),
}

SANDBOX_CONCEPTS = {
    "OE-SANDBOX-CONCEPT-000010": ("Theory of Mind", "The capacity to attribute mental states -- beliefs, desires, intentions, knowledge -- to oneself and others, and to use those attributions to interpret and predict behavior.", "proposed"),
    "OE-SANDBOX-CONCEPT-000011": ("Metacognition", "The capacity to monitor, evaluate, and regulate one's own cognitive processes -- knowing what one knows, tracking how one is thinking, and adjusting strategies accordingly.", "proposed"),
    "OE-SANDBOX-CONCEPT-000012": ("Intuitive Theories", "Informal, domain-specific causal frameworks -- folk physics, folk biology, folk psychology -- that people spontaneously construct to explain and predict how the world works, typically without formal instruction.", "proposed"),
    "OE-SANDBOX-CONCEPT-000013": ("Analogical Reasoning", "Generating or evaluating a new idea by mapping the structure of an already-familiar case onto an unfamiliar one -- starting a search for a solution from whichever known example is most similar to the target, rather than starting from nothing, and checking which parts of the familiar case do and do not carry over.", "proposed"),
}


def concept_elements(concepts: dict, vocabulary: str) -> list:
    rows = []
    for cid, (label, definition, status) in concepts.items():
        eid = uid(f"concept:{cid}")
        meta = {"conceptbase_id": cid, "vocabulary": vocabulary}
        rows.append((eid, cid, label, definition, status, meta))
    return rows


# ============================================================================
# bio-core-k12 -- 3 strands, transcribed from strands/strand-10{1,2,3}-*.yaml
# (current working-tree content, post RFC-0019/id-migration, not yet committed).
# ============================================================================

BIO_CORE_STRANDS = [
    {
        "id": "OE-STRAND-bio-core-k12-variation-inheritance",
        "title": "Variation and Inheritance",
        "description": "Foundational strand establishing that individuals vary and that traits are transmitted from parent to offspring -- the raw material on which Strand 2 (Natural Selection) and Strand 3 (Speciation) both depend. Concepts introduced here (Gene, Allele, Population, Inheritance) are deliberately reinforced throughout the other two strands rather than confined to this one, to maximize horizontal coherence.",
        "associatedDomains": ["Biology"],
        "relations": {"prerequisiteOf": ["OE-STRAND-bio-core-k12-speciation-diversity"], "foundationalTo": ["OE-STRAND-bio-core-k12-natural-selection-adaptation"]},
        "source_path": "strands/strand-101-variation-inheritance.yaml",
        "substrands": [
            {"id": "OE-STRAND-bio-core-k12-variation-inheritance-k2", "title": "Noticing Variation and Family Resemblance", "band": "K-2", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-population", "primary"), ("OE-CONCEPT-bio-core-inheritance", "primary")],
             "pis": ["Identifies visible differences among individuals of the same familiar species (e.g., dog coat color, leaf shape).",
                     "Describes ways offspring resemble their parents (e.g., puppies look like their parent dogs).",
                     "Sorts a group of similar organisms and notices that no two individuals are identical."]},
            {"id": "OE-STRAND-bio-core-k12-variation-inheritance-35", "title": "Heritable Traits and Simple Population Description", "band": "3-5", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-inheritance", "primary"), ("OE-CONCEPT-bio-core-population", "primary")],
             "pis": ["Distinguishes traits that are inherited (eye color) from characteristics acquired during a lifetime (a scar, a learned trick).",
                     "Describes a population as a group of the same kind of organism living in one area.",
                     "Predicts that offspring in a population will show a mix of trait variants similar to those of their parent generation."]},
            {"id": "OE-STRAND-bio-core-k12-variation-inheritance-68", "title": "Genes, Alleles, and the Origin of Variation", "band": "6-8", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-gene", "primary"), ("OE-CONCEPT-bio-core-allele", "primary"), ("OE-CONCEPT-bio-core-mutation", "primary"), ("OE-CONCEPT-bio-core-population", "reinforcing")],
             "pis": ["Explains that genes are units of inheritance and that alleles are alternate forms of a gene.",
                     "Explains that mutation is a random source of new heritable variation, not directed by an organism's needs.",
                     "Describes a population in terms of the range of allele variants present within it, not a single fixed 'type.'"]},
            {"id": "OE-STRAND-bio-core-k12-variation-inheritance-912", "title": "Population-Level Genetics and Allele Frequency", "band": "9-12", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-gene", "reinforcing"), ("OE-CONCEPT-bio-core-allele", "primary"), ("OE-CONCEPT-bio-core-population", "primary"), ("OE-CONCEPT-bio-core-mutation", "reinforcing"), ("OE-CONCEPT-bio-core-drift", "reinforcing"), ("OE-CONCEPT-bio-core-selection-pressure", "reinforcing")],
             "pis": ["Describes a population in terms of allele frequencies and explains that these frequencies can change across generations.",
                     "Distinguishes changes in allele frequency caused by selection pressure from changes caused by drift.",
                     "Uses a simple quantitative model (e.g., a bead or simulation activity) to track allele frequency change over generations."]},
        ],
    },
    {
        "id": "OE-STRAND-bio-core-k12-natural-selection-adaptation",
        "title": "Natural Selection and Adaptation",
        "description": "The central mechanistic strand. Builds the full four-component natural selection model (variation, heritability, differential reproduction, population-level change) using exclusively decentralized causal vocabulary -- BIO-CORE contains no organism-agency concepts, so this strand is structurally incapable of invoking behavioral niche selection or agential framing. This is a direct consequence of vocabulary scope, not an instructional simplification layered on top of richer content.",
        "associatedDomains": ["Biology"],
        "relations": {"prerequisiteOf": ["OE-STRAND-bio-core-k12-speciation-diversity"]},
        "disputeInstantiation": "This strand's structural incapacity to invoke organism agency genuinely instantiates the decentralized-causal-reasoning (DCR) position (TheoryBase OE-THEORY-dichotomized-causal-reasoning) in the real, published dispute with Kampourakis (2020) / Nehm & Kampourakis (2022) -- see openevo-graph's nodes/disputes/dispute-openevo-vs-kampourakis.yaml, whose instantiatesIn edge already points at this strand's id.",
        "source_path": "strands/strand-102-natural-selection-adaptation.yaml",
        "substrands": [
            {"id": "OE-STRAND-bio-core-k12-natural-selection-adaptation-k2", "title": "Organisms and Their Habitats", "band": "K-2", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-adaptation", "primary")],
             "pis": ["Describes features of a familiar organism that help it survive in its habitat (e.g., thick fur in a cold place).",
                     "Recognizes that some individuals in a group survive a challenge (like a harsh winter) while others do not."]},
            {"id": "OE-STRAND-bio-core-k12-natural-selection-adaptation-35", "title": "Trait Advantage and Simple Selection Scenarios", "band": "3-5", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-natural-selection", "primary"), ("OE-CONCEPT-bio-core-adaptation", "primary"), ("OE-CONCEPT-bio-core-inheritance", "reinforcing")],
             "pis": ["Predicts which trait variant will become more common in a population over several generations, given a simple environmental scenario.",
                     "Explains a prediction using inherited variation and differential survival, without invoking organism need or effort.",
                     "Distinguishes 'this trait helped some individuals survive better' from 'organisms grew this trait because they needed it.'"]},
            {"id": "OE-STRAND-bio-core-k12-natural-selection-adaptation-68", "title": "The Four-Component Natural Selection Mechanism", "band": "6-8", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-natural-selection", "primary"), ("OE-CONCEPT-bio-core-fitness", "primary"), ("OE-CONCEPT-bio-core-selection-pressure", "primary"), ("OE-CONCEPT-bio-core-drift", "primary"), ("OE-CONCEPT-bio-core-gene", "reinforcing"), ("OE-CONCEPT-bio-core-allele", "reinforcing"), ("OE-CONCEPT-bio-core-mutation", "reinforcing")],
             "pis": ["Articulates all four components of natural selection (variation, heritability, differential reproduction, population-level frequency change) for a given example.",
                     "Defines fitness as relative reproductive success, not individual strength or health.",
                     "Distinguishes change in trait frequency caused by selection pressure from change caused by random drift.",
                     "Applies the four-component model to at least two structurally different examples (trait gain and trait loss)."]},
            {"id": "OE-STRAND-bio-core-k12-natural-selection-adaptation-912", "title": "Evaluating Adaptationist Claims", "band": "9-12", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-adaptation", "primary"), ("OE-CONCEPT-bio-core-fitness", "reinforcing"), ("OE-CONCEPT-bio-core-drift", "reinforcing"), ("OE-CONCEPT-bio-core-selection-pressure", "reinforcing"), ("OE-CONCEPT-bio-core-mutation", "reinforcing"), ("OE-CONCEPT-bio-core-population", "reinforcing")],
             "pis": ["Evaluates a proposed adaptationist explanation for a trait against alternative hypotheses (drift, developmental constraint, correlated trait).",
                     "Applies the natural selection framework to unfamiliar organisms and trait types without being misled by surface features of the case.",
                     "Explains why not every trait present in a population needs to be an adaptation."],
             "relations": {"prerequisiteOf": ["OE-STRAND-bio-core-k12-speciation-diversity-912"]}},
        ],
    },
    {
        "id": "OE-STRAND-bio-core-k12-speciation-diversity",
        "title": "Speciation and Diversity of Life",
        "description": "Macroevolutionary strand. Depends heavily on Strand 1 (population, allele) and Strand 2 (natural selection, selection pressure, drift) as the mechanisms that drive divergence -- this strand is where horizontal coherence is most heavily exercised, since almost every performance indicator here reinforces a concept introduced in one of the other two strands rather than introducing self-contained new mechanisms.",
        "associatedDomains": ["Biology"],
        "relations": {"prerequisiteOf": []},
        "source_path": "strands/strand-103-speciation-diversity.yaml",
        "substrands": [
            {"id": "OE-STRAND-bio-core-k12-speciation-diversity-k2", "title": "Many Different Kinds of Living Things", "band": "K-2", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-species", "primary"), ("OE-CONCEPT-bio-core-extinction", "primary")],
             "pis": ["Sorts organisms into groups based on shared observable features.",
                     "Recognizes that some kinds of living things existed long ago and no longer exist today (e.g., dinosaurs)."]},
            {"id": "OE-STRAND-bio-core-k12-speciation-diversity-35", "title": "Species, Relatedness, and Extinction", "band": "3-5", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-species", "primary"), ("OE-CONCEPT-bio-core-common-ancestor", "primary"), ("OE-CONCEPT-bio-core-extinction", "reinforcing")],
             "pis": ["Describes a species as a group of organisms that can reproduce with one another.",
                     "Uses a simple diagram to show that two different species can share an ancestor further back in time.",
                     "Explains that extinction means a species is permanently gone, not temporarily hidden."]},
            {"id": "OE-STRAND-bio-core-k12-speciation-diversity-68", "title": "How Populations Become New Species", "band": "6-8", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-speciation", "primary"), ("OE-CONCEPT-bio-core-phylogeny", "primary"), ("OE-CONCEPT-bio-core-species", "reinforcing"), ("OE-CONCEPT-bio-core-population", "reinforcing"), ("OE-CONCEPT-bio-core-natural-selection", "reinforcing"), ("OE-CONCEPT-bio-core-selection-pressure", "reinforcing")],
             "pis": ["Explains speciation as the process by which populations diverge until they can no longer interbreed.",
                     "Explains that different selection pressures acting on separated populations can drive this divergence.",
                     "Reads and constructs a simple phylogenetic tree to represent relatedness among species."]},
            {"id": "OE-STRAND-bio-core-k12-speciation-diversity-912", "title": "Evidence, Deep Time, and Patterns of Extinction", "band": "9-12", "required": True,
             "concepts": [("OE-CONCEPT-bio-core-phylogeny", "primary"), ("OE-CONCEPT-bio-core-common-ancestor", "reinforcing"), ("OE-CONCEPT-bio-core-extinction", "primary"), ("OE-CONCEPT-bio-core-allele", "reinforcing"), ("OE-CONCEPT-bio-core-mutation", "reinforcing"), ("OE-CONCEPT-bio-core-drift", "reinforcing")],
             "pis": ["Constructs a phylogeny from morphological and molecular evidence and justifies the placement of a common ancestor node.",
                     "Distinguishes background extinction rate from mass extinction events using fossil record evidence.",
                     "Evaluates a claim of common ancestry using multiple independent lines of evidence (genetic, morphological, biogeographic)."]},
        ],
    },
]

# ============================================================================
# oe-interdisciplinary-k12 -- 4 strands (201-204), transcribed from
# strands/strand-20{1,2,3,4}-*.yaml (current working-tree content). Strand 205
# deliberately excluded -- see module docstring.
# ============================================================================

INTERDISCIPLINARY_STRANDS = [
    {
        "id": "OE-STRAND-oe-interdisciplinary-k12-inheritance-variation-selection",
        "title": "Inheritance, Variation, and Selection Across Systems",
        "description": "Foundational cross-domain strand. Uses the OE-INTERDISCIPLINARY Selection concept's four discipline-specific definitions (biology, culture, education, AI) as the strand's organizing device: rather than teaching biological selection first and analogizing outward, students encounter biological and cultural cases side by side from an early grade band, with full multi-disciplinary comparison reserved for 9-12.",
        "associatedDomains": ["Biology", "Social Studies"],
        "relations": {"prerequisiteOf": ["OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective"], "foundationalTo": ["OE-STRAND-oe-interdisciplinary-k12-agency-development-niche", "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition"]},
        "source_path": "strands/strand-201-inheritance-variation-selection.yaml",
        "substrands": [
            {"id": "OE-STRAND-oe-interdisciplinary-k12-inheritance-variation-selection-k2", "title": "Things That Get Passed On", "band": "K-2", "required": True, "associatedDomains": ["Biology", "Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-inheritance", "primary"), ("OE-CONCEPT-oe-interdisciplinary-variation", "primary")],
             "pis": ["Describes a trait passed from parent to child (eye color) and a story or recipe passed from grandparent to grandchild, side by side.",
                     "Notices that individuals within a family, and versions of a story told by different people, both show variation."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-inheritance-variation-selection-35", "title": "Comparing Biological and Cultural Transmission", "band": "3-5", "required": True, "associatedDomains": ["Biology", "Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-inheritance", "primary"), ("OE-CONCEPT-oe-interdisciplinary-transmission", "primary"), ("OE-CONCEPT-oe-interdisciplinary-variation", "reinforcing")],
             "pis": ["Compares how a genetic trait moves from parent to offspring with how a game's rules move from one group of kids to another.",
                     "Identifies that both processes involve a 'holder' passing something to a new 'holder,' with some change possible along the way."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-inheritance-variation-selection-68", "title": "The General Pattern: Variation, Selection, Transmission", "band": "6-8", "required": True, "associatedDomains": ["Biology", "Social Studies", "Computer Science"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-evolutionary-process", "primary"), ("OE-CONCEPT-oe-interdisciplinary-selection", "primary"), ("OE-CONCEPT-oe-interdisciplinary-variation", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-transmission", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-information", "reinforcing")],
             "pis": ["Describes the general pattern (variation -> selection -> transmission) using the Evolutionary Process concept.",
                     "Applies this general pattern in parallel to one biological case (e.g., beak shape in a bird population) and one cultural case (e.g., which version of a phone app feature gets kept).",
                     "Uses the Selection concept's biology and culture definitions side by side and identifies what is similar and different between them.",
                     "Explains that what actually gets transmitted in both the biological case (a gene) and the cultural case (an app feature's design) is information -- a pattern that reduces uncertainty for the receiver about which trait or version to expect -- not the physical material itself, using the Information concept explicitly rather than leaving 'passing something on' unanalyzed."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-inheritance-variation-selection-912", "title": "Selection Across Biology, Culture, Education, and AI", "band": "9-12", "required": True, "associatedDomains": ["Biology", "Social Studies", "Computer Science"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-selection", "primary"), ("OE-CONCEPT-oe-interdisciplinary-evolutionary-process", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-inheritance", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-variation", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-transmission", "reinforcing")],
             "pis": ["Compares all four disciplinary definitions of Selection (biology, culture, education, AI) for a single unifying feature: differential persistence of variants.",
                     "Explains what is genuinely analogous and what is genuinely different between biological selection and algorithmic selection (e.g., a genetic algorithm's fitness function).",
                     "Constructs an original example of Selection in a domain not covered by the vocabulary's existing examples and justifies its classification."]},
        ],
    },
    {
        "id": "OE-STRAND-oe-interdisciplinary-k12-agency-development-niche",
        "title": "Agency, Development, and Niche Construction",
        "description": "This strand exists only because OE-INTERDISCIPLINARY defines Agency and Niche Construction as first-class concepts -- BIO-CORE has no equivalent, so LPM A has no counterpart strand. Deliberately reinforces Strand 1's Selection concept throughout (behavior as a factor shaping what gets selected) rather than treating agency as a separate, unrelated topic.",
        "associatedDomains": ["Biology", "Social Studies"],
        "relations": {"prerequisiteOf": ["OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective"]},
        "disputeInstantiation": "This strand instantiates the integrated-causal-reasoning (ICR) position (TheoryBase OE-THEORY-integrated-causal-reasoning) in the real, published dispute with Kampourakis (2020) / Nehm & Kampourakis (2022) -- see openevo-graph's nodes/disputes/dispute-openevo-vs-kampourakis.yaml, whose instantiatesIn edge already points at this strand's id.",
        "source_path": "strands/strand-202-agency-development-niche.yaml",
        "substrands": [
            {"id": "OE-STRAND-oe-interdisciplinary-k12-agency-development-niche-k2", "title": "Living Things Act to Meet Their Needs", "band": "K-2", "required": True, "associatedDomains": ["Biology"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-agency", "primary"), ("OE-CONCEPT-oe-interdisciplinary-development", "reinforcing")],
             "pis": ["Describes what an animal does to find food, stay safe, or care for its young.",
                     "Describes ways a person or animal grows and changes as it gets older.",
                     "Recognizes that acting to meet a need does not require the same kind of thinking a person does."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-agency-development-niche-35", "title": "Comparing How Different Living Things Act, Learn, and Teach", "band": "3-5", "required": True, "associatedDomains": ["Biology", "Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-agency", "primary"), ("OE-CONCEPT-oe-interdisciplinary-learning", "primary"), ("OE-CONCEPT-oe-interdisciplinary-teaching", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-scaffolding", "reinforcing")],
             "pis": ["Compares goal-directed behavior across two different species and describes how their capacities differ.",
                     "Describes an example of an animal or person learning a behavior by watching another individual.",
                     "Describes a simple example of scaffolding (a helper providing support that is gradually reduced as skill grows)."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-agency-development-niche-68", "title": "Agency, Niche Construction, and Selection", "band": "6-8", "required": True, "associatedDomains": ["Biology"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-agency", "primary"), ("OE-CONCEPT-oe-interdisciplinary-niche-construction", "primary"), ("OE-CONCEPT-oe-interdisciplinary-development", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-selection", "reinforcing")],
             "pis": ["Defines agency as a capacity to regulate behavior toward a goal-state, without requiring conscious intention.",
                     "Explains niche construction using an example of an organism modifying its own environment (e.g., an earthworm improving soil) in a way that changes what gets selected in later generations.",
                     "Explains how a behavior (agency) and a selection process (Strand 1) can be connected without invoking evolutionary foresight."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-agency-development-niche-912", "title": "Agency and Niche Construction Across Biological and Technological Systems", "band": "9-12", "required": False, "associatedDomains": ["Biology", "Computer Science", "Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-agency", "primary"), ("OE-CONCEPT-oe-interdisciplinary-niche-construction", "primary"), ("OE-CONCEPT-oe-interdisciplinary-learning", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-teaching", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-selection", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-information", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-communication", "reinforcing")],
             "pis": ["Places several organisms (bacterium, bird, chimpanzee, human) along an agency spectrum and justifies each placement.",
                     "Compares biological niche construction (earthworms, beavers) with human-technological niche construction (cities, digital information environments).",
                     "Analyzes a case where a designed system (e.g., a recommendation algorithm) exhibits both intentional design (agency) and emergent, non-designed behavior.",
                     "Names information processing as the shared substrate across all three cases in this sub-strand -- a nervous system converting stimuli into signals, a recommendation algorithm converting user data into output, and teaching/learning (Strand 2's own Learning/Teaching concepts) as the deliberate Communication of information between individuals -- and explains what stays the same and what genuinely differs about how each system encodes, transmits, and acts on it."],
             "note": "Marked optional (elective/regional extension) at this specific sub-strand only -- the AI-system application is treated as an advanced extension, not core content, consistent with the phased, cautious approach to frontier interdisciplinary territory."},
        ],
    },
    {
        "id": "OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective",
        "title": "Culture, Technology, and Collective Systems",
        "description": "The broadest strand, drawing on OE-INTERDISCIPLINARY's social/cultural concepts. Deliberately reinforces Strand 1 (Transmission, Selection, Innovation-as-variation-generator) and Strand 2 (Agency, Niche Construction) throughout, so that by 9-12 all three strands converge on a shared explanatory vocabulary rather than remaining parallel tracks.",
        "associatedDomains": ["Social Studies", "Computer Science"],
        "relations": {"prerequisiteOf": []},
        "source_path": "strands/strand-203-culture-technology-collective.yaml",
        "substrands": [
            {"id": "OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective-k2", "title": "Groups, Rules, and Tools", "band": "K-2", "required": True, "associatedDomains": ["Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-culture", "primary"), ("OE-CONCEPT-oe-interdisciplinary-technology", "primary"), ("OE-CONCEPT-oe-interdisciplinary-communication", "reinforcing")],
             "pis": ["Describes a shared rule or custom that a family or classroom group follows.",
                     "Identifies a tool that people use and describes what it helps them do.",
                     "Describes a way people share ideas with each other (talking, drawing, signs)."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective-35", "title": "Comparing Communities and Changing Tools Over Time", "band": "3-5", "required": True, "associatedDomains": ["Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-culture", "primary"), ("OE-CONCEPT-oe-interdisciplinary-cooperation", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-conflict", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-innovation", "reinforcing")],
             "pis": ["Compares practices of two different communities and identifies at least one similarity and one difference.",
                     "Describes an example of cooperation and an example of conflict within a group working toward a goal.",
                     "Traces a simple history of a tool (e.g., writing instruments) showing how new versions built on older ones."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective-68", "title": "Culture as Transmitted, Institutions as Stabilizing Structures", "band": "6-8", "required": True, "associatedDomains": ["Social Studies"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-culture", "primary"), ("OE-CONCEPT-oe-interdisciplinary-institutions", "primary"), ("OE-CONCEPT-oe-interdisciplinary-norms", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-information", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-representation", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-transmission", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-innovation", "reinforcing")],
             "pis": ["Explains culture as socially transmitted knowledge and practice that persists beyond any one individual, using the Transmission concept from Strand 1.",
                     "Distinguishes an institution (a stable, rule-based structure) from a norm (an informal shared expectation).",
                     "Identifies an innovation (a novel cultural variant) and traces how it did or did not spread through a community."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-culture-technology-collective-912", "title": "Collective Intelligence, Distributed Cognition, and Coevolving Technology", "band": "9-12", "required": True, "associatedDomains": ["Social Studies", "Computer Science", "Biology"],
             "concepts": [("OE-CONCEPT-oe-interdisciplinary-collective-intelligence", "primary"), ("OE-CONCEPT-oe-interdisciplinary-distributed-cognition", "primary"), ("OE-CONCEPT-oe-interdisciplinary-technology", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-knowledge", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-agency", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-niche-construction", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-selection", "reinforcing")],
             "pis": ["Explains how a group-level outcome (collective intelligence) can emerge from many individual agents without any one agent designing the outcome, connecting to Strand 2's Agency concept.",
                     "Analyzes an example of distributed cognition (knowledge or processing spread across people and tools/artifacts, not held by one mind).",
                     "Explains how human technological niche construction (Strand 2) and cultural selection (Strand 1) jointly shape a contemporary information environment (e.g., a social media platform)."]},
        ],
    },
    {
        "id": "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition",
        "title": "Discovering and Testing Ideas: Analogy, Search, and the Growth of Understanding",
        "description": "This strand exists only because OE-INTERDISCIPLINARY defines Analogical Reasoning and Metacognition as first-class concepts -- BIO-CORE has no equivalent, so LPM A (bio-core-k12) has no counterpart strand, the same reason Strand 2 (Agency/Niche Construction) has none either. A strand about how minds, cultures, and science itself come up with better ideas -- not by searching everything at once, but by starting from whatever known case is most similar to the new problem, trying a small change, and keeping what works. Reinforces Strand 1's Selection/Variation/Evolutionary Process vocabulary and Strand 3's Innovation/Culture vocabulary throughout. Unlike Strands 1-3, this strand's youngest bands are grounded directly in validated developmental-psychology task batteries (Pillow & Pearson's controllability studies), not just age-plausible design judgment.",
        "associatedDomains": ["Science", "Social Studies"],
        "relations": {"prerequisiteOf": [], "foundationalTo": []},
        "source_path": "strands/strand-204-analogy-search-metacognition.yaml",
        "substrands": [
            {"id": "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition-k2", "title": "Ideas That Are Like Other Ideas", "band": "K-2", "required": True, "associatedDomains": ["Science", "Social Studies"],
             "concepts": [("OE-SANDBOX-CONCEPT-000013", "primary"), ("OE-CONCEPT-oe-interdisciplinary-variation", "reinforcing"), ("OE-SANDBOX-CONCEPT-000010", "reinforcing")],
             "pis": ["Uses something already known (a favorite story, a familiar game, a tool used before) to help figure out something new, and can say what about the new thing reminds them of the old one -- an early, informal version of the Variation concept from Strand 1 (noticing that things can be similar in some ways and different in others).",
                     "With a partner, tries a new solution to a simple problem (building blocks, a puzzle) by first asking 'what does this remind me of that I've solved before?', and describes whether it helped.",
                     "Explains a simple action in terms of what the person wanted -- 'she reached for the cup because she wanted a drink' -- as an early, natural way of noticing that people's actions make sense in light of their goals.",
                     "With adult guidance, sorts two activities into 'takes work to do' and 'just happens without trying' -- without this sorting needing to be fully consistent yet."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition-35", "title": "Good Guesses, Better Guesses: Testing Ideas", "band": "3-5", "required": True, "associatedDomains": ["Science", "Social Studies"],
             "concepts": [("OE-SANDBOX-CONCEPT-000013", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-selection", "primary"), ("OE-SANDBOX-CONCEPT-000011", "primary")],
             "pis": ["Explains, using a familiar example (e.g. a breeder choosing which animals or plants to raise the next generation from because of a trait they want), how deliberately keeping 'the best version so far' over many rounds can add up to a big change, even though each single round's change is small -- the same Selection concept from Strand 1, applied here to how ideas themselves get kept or dropped, not just to living things.",
                     "Tries a short set of real, research-based 'does this take effort?' tasks and rates how much effort and how much choice each one involved, comparing ratings with a partner (adapted directly from Pillow & Pearson's own task battery).",
                     "Plays a simple 'guess my rule' game (proposes new examples to test a hidden pattern, gets told yes or no) and afterward reflects on whether their guesses mostly tried to confirm their first idea or tried to test it in a way that could prove it wrong.",
                     "Describes a specific time their own first guess about how something worked turned out to be wrong, and what changed their mind."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition-68", "title": "How Minds and Cultures Search for Better Ideas", "band": "6-8", "required": True, "associatedDomains": ["Science", "Social Studies", "Computer Science"],
             "concepts": [("OE-SANDBOX-CONCEPT-000013", "primary"), ("OE-SANDBOX-CONCEPT-000011", "primary"), ("OE-CONCEPT-oe-interdisciplinary-innovation", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-evolutionary-process", "reinforcing")],
             "pis": ["Compares two ways of tackling an unfamiliar problem -- starting from a random guess versus starting from the closest already-known example -- and explains why starting from a good example is usually faster, even though it isn't guaranteed to work.",
                     "Explains why a person's next new idea is almost always a small change to their current idea rather than something completely different, using their own experience revising an essay, a design, or a model as the example -- connecting explicitly to the Evolutionary Process concept's variation-selection-transmission pattern from Strand 1.",
                     "Identifies a case where only looking for evidence that confirms a first guess (rather than evidence that could disprove it) led to a wrong conclusion, and explains why this can happen to careful thinkers, not only careless ones.",
                     "Explains how a shared, remembered pool of solved examples -- a class's worked-example library, a culture's stock of stories or tools -- makes each new problem faster to solve for everyone who can draw on it, using the Innovation and Culture concepts from Strand 3.",
                     "Locates their own current understanding of one specific cognitive activity on a rough progression from 'it's just a thing my brain does' toward 'a process with its own reliability that I can evaluate and sometimes deliberately control' (adapted from Zdybel's 2021 phenomenographical categories)."]},
            {"id": "OE-STRAND-oe-interdisciplinary-k12-analogy-search-metacognition-912", "title": "The Shared Structure of Discovery: Darwin's Notebooks and the History of Science", "band": "9-12", "required": True, "associatedDomains": ["Science", "Social Studies", "Computer Science"],
             "concepts": [("OE-SANDBOX-CONCEPT-000013", "primary"), ("OE-SANDBOX-CONCEPT-000011", "primary"), ("OE-SANDBOX-CONCEPT-000012", "reinforcing"), ("OE-CONCEPT-oe-interdisciplinary-selection", "reinforcing")],
             "pis": ["Traces Charles Darwin's use of the artificial-selection/natural-selection analogy across his own notebooks as a documented, historical case of analogy-driven scientific discovery, distinguishing it from Darwin's own later retrospective claim to have proceeded without any prior theory.",
                     "Takes and defends a position on the 'child-as-scientist' debate: is a young child's everyday theory-revision the same kind of process as a scientist's theory change, or is deliberate, explicit coordination of theory and evidence a categorically different, later-developing capacity?",
                     "Explains why confirmation bias is difficult to fully eliminate even for trained scientists, using the idea that any search for a solution can only test ideas that have actually been generated, not the full space of every possible idea.",
                     "Describes organized science as a cultural system that changes over historical time through the same general pattern -- new ideas proposed, then kept or dropped based on how well they work -- that shapes a language, a set of tools, or a curriculum.",
                     "Runs or interprets a simple computational demonstration (an NK-landscape hill-climbing model) comparing how starting a search from a well-matched known example versus a random starting point changes how quickly and reliably a good solution is found, and connects the quantitative result back to their own experience revising a project, essay, or design."]},
        ],
    },
]

PROJECTS = [
    {
        "slug": "bio-core-lpm-synth",
        "key": "bio-core",
        "concepts": BIO_CORE_CONCEPTS,
        "vocabulary": "BIO-CORE-v1.0.0",
        "strands": BIO_CORE_STRANDS,
        "source_repo": "bio-core-k12",
        "source_url": "https://github.com/openevo-ccs/bio-core-k12",
        "license_note": "CC-BY-NC-SA-4.0 (OpenEvo Computational Curriculum Studies Working Group). Migrated from the standalone bio-core-k12 GitHub repo into this Project Space on 2026-10-03, preserving its content and provenance after the standalone repo was retired; structurally imported into lpm_data_objects/lpm_connections/lpm_object_tags by this migration, not merely declared.",
    },
    {
        "slug": "interdisciplinary-lpm-synth",
        "key": "interdisciplinary",
        "concepts": {**INTERDISCIPLINARY_CONCEPTS, **SANDBOX_CONCEPTS},
        "vocabulary": "OE-INTERDISCIPLINARY-v1.0.0",
        "strands": INTERDISCIPLINARY_STRANDS,
        "source_repo": "oe-interdisciplinary-k12",
        "source_url": "https://github.com/openevo-ccs/interdisciplinary-k12",
        "license_note": "CC-BY-NC-SA-4.0 (OpenEvo Computational Curriculum Studies Working Group). Migrated from the standalone oe-interdisciplinary-k12 GitHub repo into this Project Space on 2026-10-03, preserving its content and provenance after the standalone repo was retired; structurally imported into lpm_data_objects/lpm_connections/lpm_object_tags by this migration, not merely declared. Scope note: that repo's working tree also contains a newer, uncommitted 5th strand (rhetorical-tells-authenticity) not yet referenced by its own lpm.yaml and explicitly flagged pending review -- deliberately not included here; a follow-up migration once reviewed.",
    },
]


def concept_vocab_for(cid: str) -> str:
    if cid.startswith("OE-SANDBOX-CONCEPT"):
        return "OE-INTERDISCIPLINARY-v1.0.0 (sandbox extension)"
    if cid.startswith("OE-CONCEPT-bio-core"):
        return "BIO-CORE-v1.0.0"
    return "OE-INTERDISCIPLINARY-v1.0.0"


# ============================================================================
# SQL emission
# ============================================================================

lines = []


def emit(s: str = "") -> None:
    lines.append(s)


emit("-- bio-core-interdisciplinary-lpm-content-seed: populates the two existing, already-public")
emit("-- \"Synthetic-Theoretical\" Project Spaces (bio-core-lpm-synth / interdisciplinary-lpm-synth --")
emit("-- seeded empty by 005_seed_projects.sql, renamed by 074_rename_synthetic_pair_projects.sql,")
emit("-- still structurally empty as of this migration per 074's own comment) with the real")
emit("-- strand/substrand/concept content transcribed directly from the sibling bio-core-k12 and")
emit("-- oe-interdisciplinary-k12 GitHub repos (their current working-tree state, including an")
emit("-- already-decided identifier-scheme migration neither repo had committed yet). Generated by")
emit("-- scripts/generate_bio_core_interdisciplinary_lpm_seed.py, not hand-typed.")
emit("--")
emit("-- Purpose: this is the real content those two standalone repos exist to hold, moved into")
emit("-- OpenLPM so work can continue natively here and the standalone repos can be retired.")
emit("-- Concept labels/definitions are transcribed verbatim from conceptbase/registry/concept/*.json")
emit("-- (the real, already-published vocabulary records), not re-authored.")
emit("--")
emit("-- Scope: bio-core-k12's 3 strands (complete) and oe-interdisciplinary-k12's first 4 strands")
emit("-- (201-204, matching that repo's own lpm.yaml). Deliberately excludes a 5th strand")
emit("-- (rhetorical-tells-authenticity) that sits uncommitted in that repo's working tree, dated")
emit("-- 2026-10-03, not referenced by its own lpm.yaml, and self-flagged as proposing an")
emit("-- unregistered ConceptBase sandbox concept pending Dustin's review -- a follow-up once that")
emit("-- review happens, not folded in here by fiat.")
emit("--")
emit("-- Every epistemicStatus/epistemicStatusNote claim in the source repos (RFC-0019: these are")
emit("-- deliberately synthetic, designed-thought-experiment comparison objects, never field-tested")
emit("-- or recommended curriculum) is already carried by the existing projects.epistemic_status /")
emit("-- epistemic_status_note set in 005 -- unchanged by this migration, since it's still accurate.")
emit("--")
emit("-- Idempotency: all ids below are uuid5-derived (stable across re-runs); lpm_schema_elements")
emit("-- and lpm_data_objects inserts use ON CONFLICT (id) DO NOTHING, lpm_connections/")
emit("-- lpm_object_tags use their own real unique constraints -- safe to re-apply.")

emit()
emit("DO $MIGRATION$")
emit("DECLARE")
emit("  v_project_id UUID;")
emit("  v_user_id UUID;")
emit("BEGIN")
emit()
emit("  SELECT id INTO v_user_id FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';")
emit()

for proj in PROJECTS:
    slug = proj["slug"]
    emit("  -- ==========================================================================")
    emit(f"  -- Project: {slug}")
    emit("  -- ==========================================================================")
    emit(f"  SELECT id INTO v_project_id FROM projects WHERE slug = {J(slug)};")
    emit("  IF v_project_id IS NULL THEN")
    emit(f"    RAISE EXCEPTION 'Project slug {slug} not found -- has it been renamed again since 074_rename_synthetic_pair_projects.sql? This migration needs re-pointing, not a silent skip.';")
    emit("  END IF;")
    emit()

    # base link
    emit("  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)")
    emit("  VALUES (v_project_id, 'conceptbase', TRUE, FALSE)")
    emit("  ON CONFLICT (project_id, base_repo) DO NOTHING;")
    emit()

    # source declaration
    emit("  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)")
    emit("  SELECT v_project_id, {}, {}, {}, {}".format(
        J(f"{proj['source_repo']} (GitHub repo, retired after this migration)"),
        J("YAML (ConceptBase oe:LPM / oe:Strand schema)"),
        J(proj["license_note"]),
        J(proj["source_url"]),
    ))
    emit("  WHERE NOT EXISTS (")
    emit("    SELECT 1 FROM project_source_declarations")
    emit(f"    WHERE project_id = v_project_id AND source_name = {J(proj['source_repo'] + ' (GitHub repo, retired after this migration)')}")
    emit("  );")
    emit()

    # schema elements
    rows = concept_elements(proj["concepts"], proj["vocabulary"])
    emit(f"  -- Concept vocabulary ({len(rows)} elements, {proj['vocabulary']})")
    emit("  INSERT INTO lpm_schema_elements (id, project_id, element_type, label, parent_id, metadata, status)")
    emit("  VALUES")
    se_rows = []
    for eid, cid, label, definition, status, meta in rows:
        full_meta = {**meta, "definition": definition}
        se_rows.append(f"  ('{eid}', v_project_id, 'concept', {J(label)}, NULL, {JSB(full_meta)}, '{status}')")
    emit(",\n".join(se_rows))
    emit("  ON CONFLICT (id) DO NOTHING;")
    emit()

    # data objects: strands + substrands
    emit("  -- Strands and sub-strands")
    emit("  INSERT INTO lpm_data_objects (id, project_id, object_type, title, description, grade_band, subject_area, content, status)")
    emit("  VALUES")
    do_rows = []
    strand_uid = {}
    substrand_uid = {}
    for strand in proj["strands"]:
        sid = uid(f"strand:{strand['id']}")
        strand_uid[strand["id"]] = sid
        strand_content = {
            "source_id": strand["id"],
            "description": strand["description"],
            "associatedDomains": strand["associatedDomains"],
            "relations": strand.get("relations", {}),
            "epistemicStatus": "designed-thought-experiment",
            "_source": {"repo": proj["source_repo"], "path": strand["source_path"]},
        }
        if "disputeInstantiation" in strand:
            strand_content["disputeInstantiation"] = strand["disputeInstantiation"]
        do_rows.append(
            f"  ('{sid}', v_project_id, 'strand', {J(strand['title'])}, {J(strand['description'][:500])}, "
            f"{J('K-12')}, {J(', '.join(strand['associatedDomains']))}, {JSB(strand_content)}, 'draft')"
        )
        for sub in strand["substrands"]:
            bid = uid(f"substrand:{sub['id']}")
            substrand_uid[sub["id"]] = bid
            concept_labels = [proj["concepts"][cid][0] for cid, _ in sub["concepts"]]
            sub_content = {
                "source_id": sub["id"],
                "performanceIndicators": sub["pis"],
                "concepts": [{"id": cid, "emphasis": emph} for cid, emph in sub["concepts"]],
                "required": sub["required"],
                "_source": {"repo": proj["source_repo"], "path": strand["source_path"]},
            }
            if "relations" in sub:
                sub_content["relations"] = sub["relations"]
            if "note" in sub:
                sub_content["note"] = sub["note"]
            domains = sub.get("associatedDomains", strand["associatedDomains"])
            do_rows.append(
                f"  ('{bid}', v_project_id, 'substrand', {J(sub['title'])}, {J('Key concepts: ' + ', '.join(concept_labels))}, "
                f"{J(sub['band'])}, {J(', '.join(domains))}, {JSB(sub_content)}, 'draft')"
            )
    emit(",\n".join(do_rows))
    emit("  ON CONFLICT (id) DO NOTHING;")
    emit()

    # connections
    emit("  -- Connections: isChildOf (substrand -> strand) + the source's own declared")
    emit("  -- strand/substrand relations (prerequisiteOf, foundationalTo), all 'asserted'/'accepted'")
    emit("  -- since these are the source authors' own stated structure, not a new suggestion.")
    emit("  INSERT INTO lpm_connections (project_id, from_object_id, to_object_id, relation_type, kind, rationale, status)")
    emit("  VALUES")
    conn_rows = []
    for strand in proj["strands"]:
        sid = strand_uid[strand["id"]]
        for sub in strand["substrands"]:
            bid = substrand_uid[sub["id"]]
            conn_rows.append(f"  (v_project_id, '{bid}', '{sid}', 'isChildOf', 'asserted', NULL, 'accepted')")
        for rel_type, targets in strand.get("relations", {}).items():
            for target in targets:
                if target not in strand_uid:
                    continue
                conn_rows.append(
                    f"  (v_project_id, '{sid}', '{strand_uid[target]}', {J(rel_type)}, 'asserted', NULL, 'accepted')"
                )
        for sub in strand["substrands"]:
            for rel_type, targets in sub.get("relations", {}).items():
                for target in targets:
                    if target not in substrand_uid:
                        continue
                    conn_rows.append(
                        f"  (v_project_id, '{substrand_uid[sub['id']]}', '{substrand_uid[target]}', {J(rel_type)}, 'asserted', NULL, 'accepted')"
                    )
    emit(",\n".join(conn_rows))
    emit("  ON CONFLICT (from_object_id, to_object_id, relation_type) DO NOTHING;")
    emit()

    # object tags
    emit("  -- Object tags: sub-strand -> concept, role = the source's own emphasis value")
    emit("  -- ('primary' / 'reinforcing'), preserved verbatim rather than remapped.")
    emit("  INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role)")
    emit("  VALUES")
    tag_rows = []
    for strand in proj["strands"]:
        for sub in strand["substrands"]:
            bid = substrand_uid[sub["id"]]
            for cid, emph in sub["concepts"]:
                eid = uid(f"concept:{cid}")
                tag_rows.append(f"  (v_project_id, '{bid}', '{eid}', {J(emph)})")
    emit(",\n".join(tag_rows))
    emit("  ON CONFLICT (data_object_id, schema_element_id) DO NOTHING;")
    emit()

    # ownership
    emit("  IF v_user_id IS NULL THEN")
    emit(f"    RAISE NOTICE 'No users row found for dustin.eirdosh@eva.mpg.de -- {slug} seeded without checking/fixing ownership.';")
    emit("  ELSE")
    emit("    INSERT INTO project_members (project_id, user_id, role)")
    emit("    VALUES (v_project_id, v_user_id, 'owner')")
    emit("    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';")
    emit()
    emit("    UPDATE projects SET created_by = v_user_id")
    emit("    WHERE id = v_project_id AND created_by IS NULL;")
    emit("  END IF;")
    emit()

emit("END $MIGRATION$;")

print("\n".join(lines))
