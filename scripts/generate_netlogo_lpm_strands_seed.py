#!/usr/bin/env python3
"""
Generates supabase/migrations/069_netlogo_lpm_strands_seed.sql from the real
LPM strand drafts in the sibling `netlogo` repo's lpm-strands/*.md (the
2026-08-29 pass, 8 evolution-themed NetLogo agent-based models). Content
below is transcribed directly from those files, not paraphrased or
fabricated -- this script's job is deterministic SQL generation (stable
UUIDs, correct escaping/dollar-quoting), not content authoring.

Mirrors the generator pattern used for 053_eva_lpm_seed.sql (lab_manager,
2026-10-01): UUIDs are uuid5-derived from a fixed namespace + a stable key
string, so re-running this script produces byte-identical ids -- safe to
re-run during drafting without ever producing a different id for the same
logical object.

Run:
  python scripts/generate_netlogo_lpm_strands_seed.py > supabase/migrations/069_netlogo_lpm_strands_seed.sql
"""
import json
import uuid

NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://openevo.net/openlpm/netlogo-lpm-strands")


def uid(key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, key))


def J(s: str) -> str:
    """Dollar-quote a plain-text SQL string literal ($J$...$J$, matching 053's convention)."""
    s = s if s is not None else ""
    assert "$J$" not in s, f"literal text unexpectedly contains the $J$ delimiter: {s[:80]!r}"
    return f"$J${s}$J$"


def JSB(obj) -> str:
    """Dollar-quote a JSON value for an ::jsonb cast."""
    s = json.dumps(obj, ensure_ascii=False)
    assert "$J$" not in s, "generated JSON unexpectedly contains the $J$ delimiter"
    return f"$J${s}$J$::jsonb"


# ============================================================================
# OpenEvo's real, canonical content-anchor / thinking-tool vocabulary (from
# content-anchor-mapper / thinking-tools-kit) -- shared schema_elements this
# project's strands tag into, not invented per-strand.
# ============================================================================

CONTENT_ANCHORS = [
    "Cross-Species Comparisons", "Child Development", "Ancient Ancestors",
    "Cultural Diversity", "Cooperation Games", "Governing the Commons",
    "Computer Models", "Our Mind", "Global Sustainability Goals",
]

THINKING_TOOLS = [
    "Tinbergen's Questions", "Causal Mapping", "Payoff Matrices",
    "The Noticing Tool", "Analogies & Analogy Mapping",
    "Structure of Knowledge Diagrams",
]

QUALITY_REVIEW_NOTE = (
    "Spot-checked 2026-10-01 (ConceptBase competency IDs, 3 DOI citations verified against "
    "Crossref, NetLogo model interface parameter names) -- all checked out as real, not "
    "fabricated. This is a first-pass quality review, not a substitute for human subject-matter-"
    "expert review, which has not yet happened for any of the 8 strands."
)

# ============================================================================
# The 8 models. Each dict's text fields are transcribed directly from
# netlogo/lpm-strands/<slug>.md (2026-08-29 pass) -- full section text
# preserved as single blocks (not hand-decomposed further) to keep this
# generator a faithful transcription, not a re-authoring.
# ============================================================================

MODELS = [
    {
        "slug": "bug-evolution",
        "title": "Bug Evolution",
        "overview": (
            "This strand explores natural selection through a simple, intuitive model: beetles "
            "evolving running speed to escape bird predators. Students investigate how variation, "
            "differential survival, and inheritance lead to evolutionary change -- authoring or "
            "manipulating the model's agent-level rules directly, rather than only being told the "
            "population-level outcome."
        ),
        "theoretical_rationale": (
            "Restructuration Theory (Wilensky & Papert 2010, theory:restructuration-theory, "
            "TheoryBase): a representational infrastructure change can restructure what is "
            "learnable in a domain, not merely make existing content easier to teach. Authoring or "
            "manipulating this model's individual beetle/predator rules directly, and observing "
            "population-level speed change emerge across generations, is hypothesized to revise a "
            "learner's hyperprior-level belief about causal structure -- from centralized/single-"
            "controller (\"beetles evolved to be fast\") toward decentralized/emergent-from-local-"
            "rules -- rather than only adding a new domain-specific fact. This is a candidate "
            "mechanism, not proven fact: proposition:restructuration-grounds-icr-transfer "
            "(TheoryBase) states explicitly what it does and doesn't establish. See "
            "rel:agent-based-modeling-netlogo--integrated-causal-reasoning--meso--001 (ccs-graph) "
            "for the full cross-linking this rationale draws on."
        ),
        "grade_bands": [
            {
                "band": "6-8", "heading": "Grades 6-8: Introduction to Natural Selection",
                "learning_objectives": (
                    "- Understand that traits vary in a population\n"
                    "- Observe how some traits lead to higher survival\n"
                    "- Recognize that traits can change over generations\n"
                    "- Avoid teleological thinking (\"evolved to\")"
                ),
                "key_concepts": "Trait variation, differential survival, inheritance, natural selection, adaptation",
                "activities": (
                    "1. Run the model with different predation pressures\n"
                    "2. Observe how speed changes over generations\n"
                    "3. Record observations about which beetles survive\n"
                    "4. Discuss: why do faster beetles become more common -- and notice that no "
                    "single beetle, predator, or the model itself \"decided\" this outcome; it "
                    "emerged from many individual survival/reproduction events"
                ),
                "assessment_indicators": (
                    "Can describe how natural selection works; recognizes traits vary and change "
                    "over time; avoids \"evolved to\" language; understands not all beetles survive; "
                    "can distinguish what the model's designer set up (the rules) from what the "
                    "model's designer did not directly set (the population-level outcome)."
                ),
            },
            {
                "band": "9-12", "heading": "Grades 9-12: Mechanisms of Natural Selection",
                "learning_objectives": (
                    "- Explain the four components of natural selection (variation, differential "
                    "survival, inheritance, time)\n"
                    "- Analyze how trade-offs affect evolution\n"
                    "- Understand context-dependence of adaptation\n"
                    "- Avoid genetic determinism and teleological thinking"
                ),
                "key_concepts": (
                    "Variation, differential survival, inheritance, time; trade-offs (speed vs. "
                    "energy cost); context-dependence; fitness and reproductive success; "
                    "population-level vs. individual-level change."
                ),
                "activities": (
                    "1. Systematically explore predation pressure and energy cost\n"
                    "2. Compare outcomes with different food availability\n"
                    "3. Use Tinbergen's questions to analyze beetle speed\n"
                    "4. Discuss real-world examples of natural selection"
                ),
                "assessment_indicators": (
                    "Explains natural selection using proper terminology; recognizes trade-offs and "
                    "context-dependence; avoids teleological and genetic-determinist thinking; "
                    "distinguishes individual vs. population-level change."
                ),
            },
            {
                "band": "Undergraduate", "heading": "Undergraduate: Advanced Analysis",
                "learning_objectives": (
                    "- Design and test hypotheses about natural selection\n"
                    "- Analyze model behavior using quantitative methods\n"
                    "- Connect model findings to empirical research\n"
                    "- Evaluate model assumptions and limitations, including what kind of thing a "
                    "computational model *is* (see theory:computational-models-as-theory-mediators, "
                    "TheoryBase -- a model as a protected theoretical mediator, not a fitted-to-data "
                    "artifact judged by outcome match alone)"
                ),
                "key_concepts": (
                    "Evolutionary game theory; quantitative analysis of selection; model validation "
                    "and limitations; applications to medicine, agriculture, conservation."
                ),
                "activities": (
                    "1. Design original BehaviorSpace experiments (see "
                    "experiments/bug-evolution-predation-speed.xml)\n"
                    "2. Analyze model data statistically\n"
                    "3. Compare model predictions with empirical studies (antibiotic resistance, "
                    "pesticide resistance)\n"
                    "4. Write research reports connecting model findings to the restructuration-"
                    "theory rationale above"
                ),
                "assessment_indicators": None,
            },
        ],
        "content_anchors": {
            "primary": ["Computer Models", "Cross-Species Comparisons", "Ancient Ancestors"],
            "secondary": ["Our Mind", "Global Sustainability Goals"],
        },
        "thinking_tools": [
            "Tinbergen's Questions", "Causal Mapping", "The Noticing Tool",
            "Analogies & Analogy Mapping", "Payoff Matrices", "Structure of Knowledge Diagrams",
        ],
        "international_curriculum_grounding": (
            "US NGSS: MS-LS4-4 (trait variation and differential survival/reproduction in a "
            "specific environment -- direct match to the predation-pressure slider and "
            "speed-frequency plot); MS-LS4-6 (mathematical representations of trait-frequency "
            "change over time); HS-LS4-2 (the four-factor account of evolution, all four literally "
            "the model's mechanism); HS-LS4-3 (statistics/probability support for advantageous-"
            "trait spread, matching the Undergraduate BehaviorSpace activities); HS-LS2-1 "
            "(predator-prey population dynamics / carrying capacity, for the bird-vs-spider "
            "predator choice). Germany (Sachsen Gymnasium Biologie, from EvoMentor/importers/"
            "fwu_sn_fine_grained_candidates.json, coverage status fine-grained-content-staged-"
            "untagged, grade band unspecified in the staged data): lernziel-lerninhalt-7649-1/-2 "
            "(mutation, recombination, selection, isolation as Synthetic Theory factors); "
            "-7646-1/-2 (principles of evolution); -126030-1 and -126103-1 (Koevolution -- a "
            "stronger-than-generic match, since the model is explicitly predator-prey, a framing "
            "the strand text doesn't yet name explicitly -- flagged as a discussion/extension "
            "prompt and a candidate for a future netlogo-modeler revision adding evolving "
            "predators); -7660-1/-2 and -7854-1/-2 (evidence for evolution). Gap flagged: no "
            "\"Coevolution\" or \"Predator-Prey Coevolution\" concept exists in ConceptBase main or "
            "the pending extend-bio-core-evolution-mechanisms branch -- only the German Sachsen "
            "data names it."
        ),
        "competency_alignment": (
            "OE-CONCEPT-bio-core-natural-selection (Natural Selection, BIO-CORE-v1.0.0); "
            "OE-CONCEPT-bio-core-adaptation (Adaptation, BIO-CORE-v1.0.0); "
            "OE-CONCEPT-oe-interdisciplinary-agency (Agency, OE-INTERDISCIPLINARY-v1.0.0); "
            "OE-SANDBOX-CONCEPT-000007 (Restructuration, OE-INTERDISCIPLINARY-v1.0.0); "
            "OE-SANDBOX-CONCEPT-000008 (Decentralized Causal Reasoning, OE-INTERDISCIPLINARY-v1.0.0); "
            "OE-SANDBOX-CONCEPT-000009 (Agent-Based Modeling, OE-INTERDISCIPLINARY-v1.0.0) -- all "
            "verified against the real ConceptBase registry, 2026-08-29. Gap: the pending, unmerged "
            "extend-bio-core-evolution-mechanisms branch (BIO-CORE-v1.2.0, 16 to 43 concepts) "
            "proposes Trade-offs (OE-CONCEPT-000128), a direct match for this strand's "
            "speed-vs-energy-cost activity, once/if it merges; Coevolution is absent from both main "
            "and that branch."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-bio-core-natural-selection", "OE-CONCEPT-bio-core-adaptation",
            "OE-CONCEPT-oe-interdisciplinary-agency", "OE-SANDBOX-CONCEPT-000007",
            "OE-SANDBOX-CONCEPT-000008", "OE-SANDBOX-CONCEPT-000009",
        ],
        "assessment": (
            "Existing item bank: assessments/bug-evolution.json, OE-ASSESS-BUGEVOLUTION-001 -- a "
            "real, already-built 5-item integrated-causal-reasoning assessment, based on the "
            "EvoFlex assessment pattern (Hanisch, Eirdosh, Gonzalez Galli, Hartelt, Perez & Cupo, "
            "2026), diagnosing integrated vs. dichotomized reasoning about teleology, Lamarckism, "
            "progressionism, individual- vs. population-level thinking, and trade-offs/context-"
            "dependence. No changes needed -- already schema-consistent and directly usable."
        ),
        "common_misconceptions": (
            "1. \"Beetles evolved to be fast\" -- teleological language. "
            "2. \"Beetles choose to be fast\" -- evolution is population-level, not individual "
            "choice. 3. \"Faster is always better\" -- ignores trade-offs and context-dependence. "
            "4. \"Evolution has a goal\" -- no direction or purpose. 5. \"Individual beetles evolve\" "
            "-- evolution happens to populations, not individuals."
        ),
        "connections_to_other_models": [
            {"model": "swarming", "note": "pure leaderless-emergence model (no evolution content); the natural second candidate for the Decentralized Self thread.", "in_scope": False},
            {"model": "island-world", "note": "compare selection in different environments.", "in_scope": True},
            {"model": "evolution-competition-forest-resources", "note": "add resource competition.", "in_scope": True},
            {"model": "wolves-sheep-grass", "note": "compare predator-prey dynamics.", "in_scope": False},
        ],
        "references": (
            "Wilensky, U., & Papert, S. (2010). Restructurations: Reformulations of knowledge "
            "disciplines through new representational forms. Proceedings of the Constructionism "
            "2010 Conference. Goldstone, R. L., & Wilensky, U. (2008). Promoting transfer by "
            "grounding complex systems principles. Journal of the Learning Sciences, 17(4), "
            "465-516. Aslan, U., & Wilensky, U. (2016). Restructuration in practice: Challenging a "
            "pop-culture evolutionary theory through agent based modeling. Proceedings of "
            "Constructionism 2016, 230-238. Hanisch, S., Eirdosh, D., Gonzalez Galli, L., Hartelt, "
            "T., Perez, G., & Cupo, B. (2026). Understanding agency in evolutionary explanations: "
            "an assessment tool for biology education. Journal of Biological Education, 60(3), "
            "341-370. Darwin, C. (1859). On the Origin of Species."
        ),
        "caveats": [
            "This strand's theoretical grounding (Restructuration Theory) cites TheoryBase/"
            "QuestionBase records (proposition:restructuration-grounds-icr-transfer, "
            "question:computational-representation-of-lpm-moderator-space, "
            "question:ct-transfer-to-evolutionary-reasoning) that are themselves tagged "
            "review_status: author-draft (unreviewed) as of the 2026-10-01 quality-review pass -- "
            "this strand's theoretical backbone rests on other unreviewed content, not an "
            "independently validated theory.",
            "This strand's Competency Alignment cites OE-SANDBOX-CONCEPT-000007/8/9 (Restructuration, "
            "Decentralized Causal Reasoning, Agent-Based Modeling) without flagging in the strand "
            "text itself that these are provisional sandbox concepts with a 12-month TTL, expiring "
            "2027-08-06. Flagged explicitly here (2026-10-01 quality-review pass) since the source "
            "strand text does not carry this caveat.",
        ],
    },
    {
        "slug": "island-world",
        "title": "Island World",
        "overview": (
            "Foragers move between spatially separated resource areas (\"islands\" of food-rich "
            "patches surrounded by empty space), harvest, reproduce, and die. Offspring inherit a "
            "harvest-type trait (sustainable/green vs. greedy/red) with a chance of mutation "
            "(Mutation-rate). Because agents can only sense resources within a 2-patch radius and "
            "migrate when their local area is depleted, the population splits into semi-isolated "
            "subgroups whose trait frequencies can diverge -- this is multilevel selection made "
            "observable: greedy agents out-compete sustainable ones within a subgroup, but "
            "subgroups of exclusively sustainable agents persist longer and can recolonize "
            "depleted areas, so the between-group selection pressure runs the opposite direction "
            "from the within-group one. Distance-Resource-Areas and Size-Resource-Areas directly "
            "control how isolated the islands are, letting students manipulate the isolation "
            "variable rather than just be told what isolation does."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "9-12", "heading": "Grades 9-12: Migration, Isolation, and Multilevel Selection",
                "learning_objectives": (
                    "- Describe how spatial structure (separate resource \"islands\") changes which "
                    "individuals compete with which others.\n"
                    "- Distinguish within-group selection (greedy beats sustainable locally) from "
                    "between-group selection (sustainable subgroups persist, greedy subgroups can "
                    "deplete their area and collapse).\n"
                    "- Explain founder effects: a new island colonized by a small group can end up "
                    "with a different trait frequency than the source population, by chance alone.\n"
                    "- Avoid the misconception that isolation always leads to \"better adapted\" or "
                    "\"improved\" traits -- it leads to divergence, not improvement."
                ),
                "key_concepts": (
                    "Trait variation, differential survival, migration, founder effect, isolation, "
                    "multilevel/group selection, carrying capacity."
                ),
                "activities": (
                    "1. Run the model with Distance-Resource-Areas low (islands close together, "
                    "high migration) vs. high (islands far apart, low migration) and compare how "
                    "much trait frequencies diverge between islands over time.\n"
                    "2. Set Percent-Sustainables low (e.g. 10%) and run multiple times -- observe "
                    "that some runs the sustainable trait dies out everywhere, others it survives "
                    "on one island by chance. This is the founder-effect/stochasticity lesson, not "
                    "a deterministic outcome.\n"
                    "3. Use the \"Trait frequencies (global, %)\" and \"Average Energy of Agents\" "
                    "plots to distinguish what's happening within the population from what the "
                    "aggregate looks like.\n"
                    "4. Discuss: why does a locally-disadvantageous trait (sustainable harvesting: "
                    "50% harvest vs. greedy's 99%) ever spread in the total population?"
                ),
                "assessment_indicators": (
                    "Distinguishes within-group from between-group selection; explains founder "
                    "effects as chance-driven, not merit-driven; connects Distance-Resource-Areas "
                    "to observed divergence; avoids \"isolation makes organisms better\" framing."
                ),
            },
            {
                "band": "Undergraduate", "heading": "Undergraduate: Multilevel Selection Theory and Its Applications",
                "learning_objectives": (
                    "- State multilevel selection theory formally: selection can act at multiple "
                    "levels of organization (individual, subgroup, population) simultaneously and "
                    "in different directions.\n"
                    "- Analyze the model's own explanation of how altruistic/cooperative traits "
                    "(like sustainable harvesting) can spread despite an individual fitness cost, "
                    "and connect this to Pepper & Smuts (2001, 2002), the model's cited source.\n"
                    "- Evaluate the model's assumptions: no active dispersal strategy, no kin "
                    "recognition, migration is reactive (only when local resources are depleted) "
                    "rather than anticipatory.\n"
                    "- Connect to human evolutionary history (population structure, migration, and "
                    "isolation in human dispersal out of Africa) and to pathogen virulence "
                    "evolution, without overclaiming this abstract resource model as a literal "
                    "simulation of either."
                ),
                "key_concepts": (
                    "Multilevel selection theory; positive assortment; group extinction/"
                    "recolonization; model validation and scope limits."
                ),
                "activities": (
                    "1. Design a BehaviorSpace experiment varying Distance-Resource-Areas x "
                    "Percent-Sustainables x Mutation-rate and test whether global sustainable-"
                    "trait frequency is predictable from isolation distance alone, or whether "
                    "stochastic founder effects dominate at low sample sizes.\n"
                    "2. Read Pepper & Smuts (2001, 2002) alongside the model and identify which of "
                    "the paper's mechanisms the model implements vs. simplifies away.\n"
                    "3. Write a short evaluation of what this model can and cannot tell us about "
                    "human migration history or virulence evolution, given what it actually "
                    "simulates vs. what those real phenomena involve."
                ),
                "assessment_indicators": (
                    "States multilevel selection formally and correctly; connects model mechanics "
                    "to Pepper & Smuts; identifies specific model simplifications rather than "
                    "treating the model as a literal proxy for human history or virulence "
                    "evolution."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Computer Models", "Cross-Species Comparisons"],
            "secondary": ["Ancient Ancestors", "Global Sustainability Goals"],
        },
        "thinking_tools": ["Causal Mapping", "Structure of Knowledge Diagrams", "Analogies & Analogy Mapping"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS4-2 (four-factor evolution, all explicit model mechanics via "
            "Reproduction?, Mutation-rate, shared food patches, differential energy accumulation); "
            "HS-LS4-5 / LS4.C (environmental-condition changes and species-distribution changes -- "
            "Distance-Resource-Areas / Size-Resource-Areas are exactly the manipulable "
            "environmental-condition variables); HS-LS2-1 / LS2.A (carrying capacity at different "
            "scales -- within-island vs. total-population scales); HS-LS4-6 / LS4.D (simulation to "
            "test a solution mitigating adverse human-activity effects on biodiversity -- this "
            "model is directly such a simulation). Germany (Sachsen Gymnasium Biologie, coverage "
            "fine-grained-content-staged-untagged, grade band unspecified): lernziel-lerninhalt-"
            "7649-1/-2 (mutation, recombination, selection, ISOLATION as Synthetic Theory factors "
            "-- this model's single strongest curriculum match of the whole eight-model set, since "
            "Isolation is named explicitly and is exactly what Distance-Resource-Areas/Size-"
            "Resource-Areas let a student manipulate); -7646-1/-2 (principles of evolution); "
            "-7970-1/-2 (population growth parameters, matching the logistic carrying-capacity "
            "mechanic); -7648-1/-2 (species/population concept). Gap flagged: Multilevel Selection "
            "and Founder Effect are both named explicitly in the model's own documentation but "
            "neither exists in ConceptBase main -- both exist as proposed, unmerged entries "
            "(OE-CONCEPT-000125, OE-CONCEPT-000124, BIO-CORE-v1.2.0) in the pending "
            "extend-bio-core-evolution-mechanisms branch; treat as pending, not citable."
        ),
        "competency_alignment": (
            "OE-CONCEPT-bio-core-natural-selection (within-island selection of greedy over "
            "sustainable agents); OE-CONCEPT-bio-core-population (the model's subgroup structure); "
            "OE-CONCEPT-bio-core-adaptation (sustainable harvesting as context-dependent "
            "adaptation); OE-CONCEPT-oe-interdisciplinary-selection (selection spanning biology "
            "and culture); OE-SANDBOX-CONCEPT-000009 (Agent-Based Modeling) -- all BIO-CORE-"
            "v1.0.0/OE-INTERDISCIPLINARY-v1.0.0, verified 2026-08-29. Not yet in ConceptBase: "
            "Multilevel Selection, Founder Effect, Isolation-as-evolutionary-factor."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-bio-core-natural-selection", "OE-CONCEPT-bio-core-population",
            "OE-CONCEPT-bio-core-adaptation", "OE-CONCEPT-oe-interdisciplinary-selection",
            "OE-SANDBOX-CONCEPT-000009",
        ],
        "assessment": (
            "Existing item bank: assessments/island-world.json, OE-ASSESS-ISLANDWORLD-001 -- a "
            "real, already-built 5-item integrated-causal-reasoning assessment using an "
            "\"Archipelago\" vignette (island mammals, migration, founder effects), scored against "
            "verified real competencies. Noted gap, not fixed this pass: the vignette is a generic "
            "archipelago scenario, not grounded in an actual run/configuration of this model -- "
            "strengthening it this way is flagged as a next step."
        ),
        "common_misconceptions": (
            "1. \"Isolated populations evolve to be better\" -- isolation causes divergence, not "
            "improvement. 2. \"A trait that's locally disadvantageous can't spread in the total "
            "population\" -- ignores between-group selection and group extinction/recolonization. "
            "3. \"Founder effects always predict the outcome\" -- founder effects are stochastic. "
            "4. \"Migration always homogenizes populations\" -- ignores the balance between "
            "migration rate and local selection strength."
        ),
        "connections_to_other_models": [
            {"model": "bug-evolution", "note": "compare simple single-population selection to island-world's spatially structured, multilevel version.", "in_scope": True},
            {"model": "evolution-resource-use-social-behavior", "note": "both invoke multilevel/kin selection explicitly; compare a spatial-isolation mechanism to a direct-monitoring/punishment mechanism as two different routes to the same cooperation-can-spread outcome.", "in_scope": True},
            {"model": "evolution-competition-forest-resources", "note": "same sustainable-vs-greedy harvest-type trait, without the spatial-isolation structure.", "in_scope": True},
            {"model": "evolution-competition-resources-abstract", "note": "same sustainable-vs-greedy harvest-type trait, without the spatial-isolation structure.", "in_scope": True},
            {"model": "evolution-ethnocentrism", "note": "a third route to positive assortment (per evolution-ethnocentrism's own strand text), via ethnic-marker-based assortment rather than spatial isolation.", "in_scope": True},
        ],
        "references": (
            "Pepper, J. W., & Smuts, B. (2001). Agent-based modeling of multilevel selection: The "
            "evolution of feeding restraint as a case study. Natural Resources and Environmental "
            "Issues, 8, 57-68. Pepper, J. W., & Smuts, B. B. (2002). A mechanism for the evolution "
            "of altruism among nonkin: Positive assortment through environmental feedback. "
            "American Naturalist, 160(2), 205-213. https://doi.org/10.1086/341018. Hanisch, S. "
            "(2022). Evolution island world. OpenEvo NetLogo Models. "
            "https://openevo.eva.mpg.de/teachingbase/netlogo/"
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-competition-forest-resources",
        "title": "Evolution and Competition for Forest Resources",
        "overview": (
            "Foresters harvest a shared, regrowing resource (trees, logistic growth) at one of two "
            "rates: modest (Percent-cut-modest) or greedy (Percent-cut-greedy). Foresters that "
            "accumulate more wealth reproduce more; offspring inherit their parent's harvest type, "
            "with a chance of mutation. The model's own documentation names the resource "
            "explicitly as a common-pool resource (accessible to all, depletable by use) -- this "
            "is a natural-selection model built directly on top of a commons-governance scenario, "
            "not a separate topic bolted on. Because greedy foresters out-harvest (and so, other "
            "things equal, out-earn and out-reproduce) modest ones in the short run, the model "
            "lets a class watch -- parameter by parameter -- how a population can evolve toward "
            "resource overuse even without any forester \"deciding\" to overexploit the forest."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "6-8", "heading": "Grades 6-8: Selection Pressure on Resource-Use Strategies",
                "learning_objectives": (
                    "- Observe that foresters vary in how much of a tree they harvest, and that "
                    "this variation is heritable (offspring usually match the parent's type).\n"
                    "- Recognize that harvest rate affects both individual wealth and the shared "
                    "forest stock.\n"
                    "- Notice the pattern: with Reproduction? on and Mutation-rate at 0%, whichever "
                    "type starts more common tends to become more common still -- and connect this "
                    "to differential reproduction, not to foresters \"wanting\" more trees."
                ),
                "key_concepts": (
                    "Trait variation (modest/greedy), differential reproduction, common-pool "
                    "resource, forest stock as a shared, depletable resource."
                ),
                "activities": (
                    "1. Run the model with Number-Modest set to different starting fractions and "
                    "observe whether the final trait frequency depends on the starting frequency.\n"
                    "2. Watch the \"Forest stock (% of maximum)\" plot alongside \"Trait Frequencies "
                    "(%)\" and describe, in words, the relationship between the two.\n"
                    "3. Discuss: does any individual forester decide to overharvest the forest, or "
                    "does forest decline emerge from many individual harvest choices plus "
                    "differential reproduction?"
                ),
                "assessment_indicators": (
                    "Describes harvest type as a heritable trait; connects trait-frequency change "
                    "to differential reproduction, not intention; distinguishes individual harvest "
                    "choice from population-level forest decline."
                ),
            },
            {
                "band": "9-12", "heading": "Grades 9-12: Evolutionary Dynamics of a Commons Dilemma",
                "learning_objectives": (
                    "- Explain why greedy harvesting can be individually advantageous (more "
                    "wealth, more offspring) even as it collectively depletes the shared resource "
                    "-- i.e. why natural selection does not automatically select for sustainable "
                    "outcomes.\n"
                    "- Analyze how Growth-rate, Max-Treeheight, Living-costs, and Mutation-rate "
                    "each shift the balance between forest stock and forester population.\n"
                    "- Connect the model's mechanism explicitly to real common-pool-resource "
                    "problems (e.g. overfishing, deforestation) and to Ostrom's work on commons "
                    "governance, while being precise about what the model does and doesn't "
                    "simulate (it has no institutions, monitoring, or communication between "
                    "foresters -- compare to evolution-resource-use-social-behavior, which adds "
                    "exactly that)."
                ),
                "key_concepts": (
                    "Common-pool resources; carrying capacity; logistic growth; natural selection "
                    "under resource competition; trade-offs between individual fitness and "
                    "collective sustainability."
                ),
                "activities": (
                    "1. Systematically vary Percent-cut-greedy while holding other parameters "
                    "fixed and record the long-run forest stock and total forester population -- "
                    "build a causal map of the relationship.\n"
                    "2. Set Mutation-rate above 0 and observe whether a stable sustainable "
                    "population can persist against continual reintroduction of greedy mutants, or "
                    "whether it eventually collapses.\n"
                    "3. Compare this model's outcome space to evolution-resource-use-social-"
                    "behavior (same modest/greedy trait, but with an added punishment mechanism) "
                    "and discuss what's missing here that changes the outcome there."
                ),
                "assessment_indicators": (
                    "Explains the individual-fitness-vs-collective-outcome tension without "
                    "resorting to \"foresters are greedy people\" moralizing; connects specific "
                    "sliders to specific outcome changes; identifies what mechanism (monitoring/"
                    "punishment/institutions) this model lacks relative to the social-behavior "
                    "model."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Governing the Commons", "Computer Models"],
            "secondary": ["Global Sustainability Goals"],
        },
        "thinking_tools": ["Causal Mapping", "Structure of Knowledge Diagrams", "Analogies & Analogy Mapping"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS2-1 / LS2.A (carrying capacity at different scales -- Growth-rate and "
            "Max-Treeheight are the model's explicit carrying-capacity parameters); MS-LS2-1 / "
            "LS2.A (resource availability effects on organisms/populations, via the Forest Stock "
            "and Forester Population plots); HS-LS4-2 / LS4.B (four-factor evolution, mapping "
            "precisely onto this model's mechanism); HS-LS4-6 / LS4.D (simulation to mitigate "
            "adverse human-activity effects on biodiversity -- directly usable for a forestry-"
            "sustainability unit, not only an evolution unit). Germany (Sachsen Gymnasium Biologie, "
            "coverage fine-grained-content-staged-untagged, grade band unspecified): lernziel-"
            "lerninhalt-7649-1/-2 (mutation, selection as the model's two evolutionary "
            "mechanisms); -7646-1/-2 (principles of evolution); -120087-1 and -7561-1/-2, "
            "-7566-1/-2 (intraspecific competition -- direct match for the modest-vs-greedy "
            "competition mechanic); -8011-1/-2 (ecosystem self-regulation, matching the logistic "
            "regrowth dynamic); -120096-1, -125117-1 (ecosystem management, matching the forestry-"
            "sustainability framing of the whole model). Gap flagged: no ConceptBase concept "
            "(main or the pending branch) directly names \"common-pool resource\" or \"commons "
            "governance\" as a biology/evolution concept -- that framing currently lives only in "
            "OE-CONCEPT-oe-interdisciplinary-institutions (general, not commons-specific) and in "
            "the model's own documentation."
        ),
        "competency_alignment": (
            "OE-CONCEPT-bio-core-natural-selection (differential reproduction of modest vs. greedy "
            "foresters); OE-CONCEPT-bio-core-fitness (wealth as the model's fitness proxy); "
            "OE-CONCEPT-bio-core-mutation (Mutation-rate as the source of new trait variants); "
            "OE-CONCEPT-oe-interdisciplinary-institutions (used carefully: this model has NO "
            "institutions -- performance indicator is to articulate what an institution would need "
            "to add to change its outcome, a bridge to evolution-resource-use-social-behavior); "
            "OE-CONCEPT-oe-interdisciplinary-selection -- all verified 2026-08-29. Not yet in "
            "ConceptBase: a commons-specific evolutionary/institutional concept."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-bio-core-natural-selection", "OE-CONCEPT-bio-core-fitness",
            "OE-CONCEPT-bio-core-mutation", "OE-CONCEPT-oe-interdisciplinary-institutions",
            "OE-CONCEPT-oe-interdisciplinary-selection",
        ],
        "assessment": (
            "No assessment file exists yet (assessments/evolution-competition-forest-resources.json "
            "is not present) -- needs building, following the integrated-causal-reasoning-"
            "assessment pattern. Vignette sketch, grounded in the actual model: \"You set "
            "Number-Modest to 40 out of 50 foresters (80% modest), Growth-rate to 0.2, and "
            "Mutation-rate to 0%, then ran the model. By tick 300, greedy foresters made up 95% of "
            "the population and forest stock had fallen from 100% to 12% of maximum. A classmate "
            "says 'the foresters decided to become greedy because the forest was running out.' "
            "What's wrong with that explanation, and what actually happened, tick by tick?\" -- a "
            "starting point for a future item bank, not a built assessment."
        ),
        "common_misconceptions": (
            "1. \"Foresters decide to become greedy\" -- teleological/intentional-agent framing of "
            "a population-level, differential-reproduction process. 2. \"Natural selection favors "
            "sustainability\" -- natural selection favors whatever increases relative reproduction "
            "right now, frequently the opposite of long-run sustainability in a commons without "
            "added institutions. 3. \"The forest declining and foresters becoming greedy are two "
            "separate facts\" -- missing the causal loop between them. 4. \"Mutation rate doesn't "
            "matter once a population is established\" -- ignores the ongoing reintroduction of "
            "greedy variants even after a sustainable equilibrium is reached."
        ),
        "connections_to_other_models": [
            {"model": "evolution-competition-resources-abstract", "note": "the same modest/greedy competition mechanic, generalized away from the forestry framing.", "in_scope": True},
            {"model": "evolution-resource-use-harvest-efficiency", "note": "replaces the binary modest/greedy trait with a continuous harvest-rate trait and adds diminishing-returns harvesting costs.", "in_scope": True},
            {"model": "evolution-resource-use-social-behavior", "note": "adds monitoring and punishment to essentially the same commons dilemma; the strongest direct A/B comparison in this set.", "in_scope": True},
            {"model": "two-communities", "note": "commons framing without the evolutionary/reproduction mechanism (out of scope for this pass, already an \"in progress\" strand).", "in_scope": False},
        ],
        "references": (
            "Hanisch, S. (2022). Evolution and forest resource use. OpenEvo NetLogo Models. "
            "https://openevo.eva.mpg.de/teachingbase/netlogo/. Ostrom, E. (1990). Governing the "
            "Commons: The Evolution of Institutions for Collective Action. Cambridge University "
            "Press (real, DOI/ISBN-verifiable classic; not yet a LiteratureBase lit: record as of "
            "this pass)."
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-competition-resources-abstract",
        "title": "Evolution and Competition for Resources (Abstract)",
        "overview": (
            "The abstracted sibling of evolution-competition-forest-resources: agents (default "
            "appearance \"Bacteria\") harvest a fixed amount of resource per iteration -- "
            "Harvest-sustainables vs. Harvest-greedy -- from patches that regrow logistically. "
            "There's no forestry framing here; the model's own documentation states its purpose "
            "plainly: \"we can also observe predator-prey-dynamics between the resource and its "
            "user population.\" That reframing is the strand's hook -- the same mechanism "
            "(differential harvest -> differential fitness -> trait-frequency change -> resource-"
            "stock feedback) that plays out as commons overuse in the forestry version plays out "
            "here as an oscillating predator-prey-style population cycle, because this version "
            "adds a Death-rate (independent of energy) that the forestry version doesn't have."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "6-8", "heading": "Grades 6-8: Resource Competition Without a Cover Story",
                "learning_objectives": (
                    "- Describe the resource-harvest-reproduction cycle without needing a forestry "
                    "or any other real-world frame -- i.e. reason about the mechanism itself, "
                    "abstractly.\n"
                    "- Observe that the resource level and the agent population level both "
                    "fluctuate, and notice whether they move together or in opposite directions "
                    "over time.\n"
                    "- Distinguish \"sustainable\" and \"greedy\" as labels for a harvest-amount "
                    "trait, not as moral categories."
                ),
                "key_concepts": "Trait variation, resource regrowth, differential reproduction, population fluctuation.",
                "activities": (
                    "1. Run the model with Reproduction on and watch \"Populations (% of carrying "
                    "capacity)\" -- record whether Resource and Agents plot lines move together, "
                    "oppositely, or with a lag.\n"
                    "2. Switch Agents-Appearance between \"Bacteria,\" \"Persons,\" and \"Circles\" "
                    "and discuss: does changing what the agents look like change what the model is "
                    "actually simulating? (It shouldn't -- a lesson in distinguishing a model's "
                    "surface representation from its underlying mechanism.)\n"
                    "3. Compare this model side-by-side with evolution-competition-forest-resources "
                    "and list what's the same mechanism underneath the different presentation."
                ),
                "assessment_indicators": (
                    "Describes the harvest-reproduction cycle without relying on a forestry "
                    "metaphor; notices the lag/oscillation pattern between resource and population; "
                    "explicitly identifies the forest-resources model as \"the same mechanism, "
                    "different presentation.\""
                ),
            },
            {
                "band": "9-12", "heading": "Grades 9-12: Predator-Prey Dynamics as a General Pattern",
                "learning_objectives": (
                    "- Explain why a harvester population and its resource can oscillate -- the "
                    "resource depletes when harvester population/greediness is high, harvesters "
                    "then decline (via Death-rate and reduced reproduction) once resource is "
                    "scarce, allowing the resource to recover, which then allows the harvester "
                    "population to grow again.\n"
                    "- Connect this pattern explicitly to classical predator-prey (Lotka-Volterra-"
                    "style) dynamics, while being precise about what's different (trait-frequency "
                    "evolution within one interacting resource-harvester system, not two separate "
                    "species with independent population dynamics).\n"
                    "- Analyze how Death-rate (independent of energy) changes the qualitative "
                    "dynamics compared to the forest-resources model, which has no such independent "
                    "death term."
                ),
                "key_concepts": (
                    "Population oscillation; carrying capacity; density-dependent regulation; "
                    "natural selection under fluctuating resource availability; model abstraction."
                ),
                "activities": (
                    "1. Run BehaviorSpace-style repeated trials varying Death-rate from 0% to 10% "
                    "and characterize how oscillation amplitude/period changes.\n"
                    "2. Build a causal map of the full feedback loop (resource level -> harvest "
                    "success -> energy -> reproduction/death -> agent population -> total harvest "
                    "pressure -> resource level) and identify where the delays are.\n"
                    "3. Compare to a real predator-prey system (e.g. lynx-hare population cycles) "
                    "via Analogy Mapping, explicitly naming where the analogy holds and where it "
                    "breaks."
                ),
                "assessment_indicators": (
                    "Explains the oscillation mechanistically, not just descriptively; correctly "
                    "attributes the qualitative behavior to specific parameters (Death-rate "
                    "especially); uses the predator-prey analogy precisely, naming its limits."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Computer Models", "Governing the Commons"],
            "secondary": ["Cross-Species Comparisons", "Global Sustainability Goals"],
        },
        "thinking_tools": ["Causal Mapping", "Analogies & Analogy Mapping", "Structure of Knowledge Diagrams"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS2-2 / LS2.A (mathematical representations supporting explanations of "
            "factors affecting biodiversity/populations -- direct match for the oscillation-"
            "pattern activity); HS-LS2-1 / LS2.A (carrying-capacity factors); HS-LS4-2 / LS4.B "
            "(four-factor evolution, as in the forest-resources model); MS-LS2-1 / LS2.A (resource-"
            "availability effects on populations). Germany (Sachsen Gymnasium Biologie, coverage "
            "fine-grained-content-staged-untagged, grade band unspecified): lernziel-lerninhalt-"
            "7649-1/-2 and -7646-1/-2 (mutation/selection/isolation; principles of evolution); this "
            "model's strongest German match -- -120088-1 and -7969-1 (\"interspezifische "
            "Beziehungen - Konkurrenz, Symbiose, Parasitismus, Rauber-Beute-Beziehung\" / "
            "interspecific relationships including predator-prey relationship -- a direct citation "
            "match to this model's own self-description); -7970-1/-2 (population growth "
            "parameters, matching the logistic-growth/carrying-capacity mechanic directly). Gap "
            "flagged: no ConceptBase concept for \"predator-prey dynamics\" or \"population "
            "oscillation\" specifically exists; closest is the general OE-CONCEPT-bio-core-"
            "population."
        ),
        "competency_alignment": (
            "OE-CONCEPT-bio-core-natural-selection; OE-CONCEPT-bio-core-population (the "
            "oscillating resource/agent population as the direct object of study); "
            "OE-CONCEPT-bio-core-fitness; OE-SANDBOX-CONCEPT-000009 (Agent-Based Modeling -- "
            "performance indicator: explain why changing Agents-Appearance doesn't change the "
            "underlying simulated mechanism) -- all verified 2026-08-29. Not yet in ConceptBase: "
            "predator-prey dynamics / population oscillation as a named concept."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-bio-core-natural-selection", "OE-CONCEPT-bio-core-population",
            "OE-CONCEPT-bio-core-fitness", "OE-SANDBOX-CONCEPT-000009",
        ],
        "assessment": (
            "No assessment file exists yet -- needs building. Vignette sketch, grounded in the "
            "actual model: \"You ran the model with Harvest-sustainables at 7, Harvest-greedy at "
            "15, Death-rate at 3%, and Reproduction on. Over 1000 ticks, you observed the resource "
            "level and agent population rise and fall in a repeating cycle, with the population "
            "peak always arriving about 50-80 ticks after the resource peak. A classmate says 'the "
            "agents are causing the cycle by getting greedier over time.' Using the model's actual "
            "mechanism, explain what's really driving the cycle and why there's a delay between "
            "the resource peak and the population peak.\""
        ),
        "common_misconceptions": (
            "1. \"Agents get greedier over time and that causes the cycle\" -- the cycle is driven "
            "by the resource-population feedback loop, not by a trend in average greediness. "
            "2. \"The model simulates real predator-prey species\" -- it simulates one population "
            "and one resource, which happens to produce a formally similar oscillation. "
            "3. \"Changing the agents' appearance changes what's being simulated\" -- surface "
            "representation vs. underlying mechanism. 4. \"A stable-looking average conceals a "
            "stable population\" -- oscillating systems can have a roughly constant long-run "
            "average while never actually being at that average."
        ),
        "connections_to_other_models": [
            {"model": "evolution-competition-forest-resources", "note": "same underlying mechanism with a concrete forestry framing and no independent Death-rate; the primary surface-vs-mechanism comparison.", "in_scope": True},
            {"model": "evolution-resource-use-harvest-efficiency", "note": "replaces the binary trait with a continuous harvest-amount trait and adds harvesting-cost diminishing returns.", "in_scope": True},
            {"model": "wolves-sheep-grass", "note": "the NetLogo Models Library's canonical predator-prey model; a natural cross-reference for the Undergraduate band's Lotka-Volterra comparison (out of scope for this pass).", "in_scope": False},
        ],
        "references": (
            "Hanisch, S. (2022). Evolution and competition for resources. OpenEvo NetLogo Models. "
            "https://openevo.eva.mpg.de/teachingbase/netlogo/"
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-resource-use-harvest-efficiency",
        "title": "Evolution of Resource Use with Harvest Efficiency",
        "overview": (
            "Agents each carry a continuous harvest-amount trait (not a binary sustainable/greedy "
            "choice) that starts randomly distributed between 0.5 and 99.5 and evolves via "
            "mutation and differential reproduction. What makes this model distinct from its "
            "siblings is harvest-costs-factor: energy actually received is Harvest amount - "
            "Harvest costs x (1.2 ^ harvest amount) -- an explicit diminishing-returns function. "
            "At harvest-costs-factor = 0, harvesting is free regardless of amount and the "
            "population evolves toward maximal harvest (and resource depletion); as the factor "
            "rises, high-harvest strategies become actively costly, and the population's evolved "
            "harvest-rate distribution shifts downward. This is the strand's central lesson: "
            "whether \"greed evolves\" is not a fixed biological fact about resource users, it's "
            "conditional on the cost structure of harvesting itself. This model already has real "
            "teaching materials linked from metadata.json (a slide deck and a lesson-plan "
            "document); this strand does not duplicate those, it builds the LPM layer around them."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "9-12", "heading": "Grades 9-12: Harvest Efficiency as an Evolutionary Trade-off",
                "learning_objectives": (
                    "- Read the histogram of agents by harvest amount and describe how the "
                    "distribution's shape (not just its mean) changes as harvest-costs-factor "
                    "changes.\n"
                    "- Explain diminishing returns as a real functional relationship (not just "
                    "\"high harvest is bad\") -- connect the formula Harvest amount - Harvest "
                    "costs x (1.2^harvest amount) to the model's observed outcomes.\n"
                    "- Predict, before running the model, what happens to the evolved harvest-rate "
                    "distribution as harvest-costs-factor increases from 0 to 1, then check the "
                    "prediction.\n"
                    "- Distinguish this model's continuous-trait evolution from the binary "
                    "sustainable/greedy trait in evolution-competition-forest-resources and "
                    "evolution-competition-resources-abstract."
                ),
                "key_concepts": (
                    "Continuous trait variation; diminishing returns; trade-offs; natural selection "
                    "on a quantitative trait; carrying capacity."
                ),
                "activities": (
                    "1. Run the model at harvest-costs-factor = 0, record the final harvest-amount "
                    "distribution (histogram), then repeat at 0.3, 0.6, and 1.0 -- build a table of "
                    "how the distribution's center and spread change.\n"
                    "2. Graph the diminishing-returns formula by hand (or spreadsheet) for a few "
                    "harvest-costs-factor values and connect the shape of that curve to the "
                    "model's evolved outcome.\n"
                    "3. Compare this model's outcome logic to evolution-competition-forest-"
                    "resources's binary modest/greedy trait: what does a continuous trait let you "
                    "observe that a binary one can't?\n"
                    "4. Use the existing lesson plan and slide deck alongside this strand's "
                    "grade-band framing."
                ),
                "assessment_indicators": (
                    "Connects the diminishing-returns formula to the observed shift in harvest-rate "
                    "distribution; predicts direction of change correctly before running the model; "
                    "articulates what a continuous trait adds over a binary one."
                ),
            },
            {
                "band": "9-12 extension / Undergraduate",
                "heading": "Grades 9-12 (extension) / Undergraduate: Optimal Foraging and Real-World Harvest Economics",
                "learning_objectives": (
                    "- Connect the model's harvest-cost mechanic to optimal foraging theory (an "
                    "established framework in behavioral ecology and human evolutionary "
                    "anthropology) and to real resource-economics concepts like marginal cost of "
                    "extraction.\n"
                    "- Analyze how Death-rate (independent of energy) interacts with harvest-costs-"
                    "factor to shape the population's long-run size and harvest-rate distribution.\n"
                    "- Evaluate the model's abstraction: it has no technology, no learning, and no "
                    "social transmission of harvesting technique -- all of that would need to enter "
                    "as a cost-factor change, not as a new mechanism, since the model has none. "
                    "Compare to evolution-resource-use-behavior-imitation, which adds exactly the "
                    "missing social-learning mechanism."
                ),
                "key_concepts": (
                    "Optimal foraging theory; marginal cost/return; model scope and limitations; "
                    "quantitative-trait evolution."
                ),
                "activities": (
                    "1. Design a BehaviorSpace experiment sweeping harvest-costs-factor x "
                    "Death-rate and analyze the resulting harvest-rate distributions statistically.\n"
                    "2. Read a short optimal-foraging-theory summary (e.g. from human behavioral "
                    "ecology) and identify which of its core ideas (patch choice, marginal value, "
                    "diminishing returns) this model implements vs. omits.\n"
                    "3. Write a short comparison of this model to evolution-resource-use-behavior-"
                    "imitation: what would have to be added here to let harvesting behavior change "
                    "within an agent's lifetime, rather than only across generations?"
                ),
                "assessment_indicators": (
                    "Connects model mechanics to optimal foraging theory with specific, correct "
                    "correspondences (not just a vague \"it's related to economics\" claim); "
                    "designs a methodologically sound BehaviorSpace sweep; identifies the model's "
                    "missing mechanisms precisely."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Computer Models", "Global Sustainability Goals"],
            "secondary": ["Ancient Ancestors"],
        },
        "thinking_tools": ["Causal Mapping", "Structure of Knowledge Diagrams", "Tinbergen's Questions"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS4-2 / LS4.B (four-factor evolution, here on a continuous trait); "
            "HS-LS4-4 (explanation based on evidence for how natural selection leads to "
            "adaptation, matching the harvest-rate-distribution-shift activity); HS-LS2-1 / LS2.A "
            "(carrying capacity). Note: NGSS has no DCI specifically for \"diminishing returns\" or "
            "\"marginal cost\" as an evolutionary mechanism -- best grounded in optimal foraging "
            "theory rather than forcing an NGSS code. Germany (Sachsen Gymnasium Biologie, "
            "coverage fine-grained-content-staged-untagged, grade band unspecified): lernziel-"
            "lerninhalt-7649-1/-2 (mutation, selection, isolation); this model's strongest German "
            "match -- -8153-1 and -8153-2 (\"Anwenden der Kenntnisse uber den Stoff- und "
            "Energiewechsel auf die Evolution der Ernahrungsweisen\" / applying metabolism/energy-"
            "exchange knowledge to the evolution of feeding modes -- a direct, specific match: the "
            "model's entire mechanic is an energy-accounting function applied to the evolution of "
            "feeding/harvesting behavior); -7646-1/-2 (principles of evolution). Gap flagged: "
            "\"diminishing returns,\" \"marginal cost,\" and \"optimal foraging\" have no ConceptBase "
            "concept; closest existing concept is OE-CONCEPT-bio-core-fitness, which doesn't "
            "capture the cost-function-shape idea specifically."
        ),
        "competency_alignment": (
            "OE-CONCEPT-bio-core-fitness (net energy, not gross harvest, determines fitness); "
            "OE-CONCEPT-bio-core-natural-selection; OE-CONCEPT-bio-core-selection-pressure "
            "(harvest-costs-factor as a directly manipulable selection-pressure parameter); "
            "OE-CONCEPT-bio-core-mutation -- all BIO-CORE-v1.0.0, verified 2026-08-29. Not yet in "
            "ConceptBase: diminishing returns / marginal-cost-of-harvest as a named concept."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-bio-core-fitness", "OE-CONCEPT-bio-core-natural-selection",
            "OE-CONCEPT-bio-core-selection-pressure", "OE-CONCEPT-bio-core-mutation",
        ],
        "assessment": (
            "No assessment file exists yet -- needs building. Vignette sketch, grounded in the "
            "actual model: \"You ran the model twice, both times with Number-agents at 50 and "
            "Mutation-rate at 0.5%. In Run 1, harvest-costs-factor was 0, and by tick 500 the "
            "histogram showed most agents harvesting near 90-99.5 units. In Run 2, harvest-costs-"
            "factor was 0.8, and by tick 500 most agents harvested near 5-15 units. Nothing else "
            "changed between the runs. Using the model's actual harvest-cost formula, explain why "
            "the same starting population evolved toward such different harvest rates.\""
        ),
        "common_misconceptions": (
            "1. \"Some populations are just greedier than others\" -- harvest rate is not a fixed "
            "population character, it's an evolved response to the specific cost structure. "
            "2. \"More harvesting is always better for the harvester\" -- ignores diminishing "
            "returns. 3. \"The continuous trait model and the binary sustainable/greedy models are "
            "testing different biology\" -- they're the same underlying mechanism; the trait's "
            "structure (binary vs. continuous) is a modeling choice, not a difference in what "
            "evolution is doing."
        ),
        "connections_to_other_models": [
            {"model": "evolution-competition-forest-resources", "note": "same resource-competition mechanism with a binary rather than continuous harvest trait.", "in_scope": True},
            {"model": "evolution-competition-resources-abstract", "note": "same resource-competition mechanism with a binary rather than continuous harvest trait.", "in_scope": True},
            {"model": "evolution-resource-use-behavior-imitation", "note": "adds social learning (imitation) on top of a similar harvest-trait-evolution mechanism, letting harvest behavior change within a lifetime, not only across generations.", "in_scope": True},
        ],
        "references": (
            "Hanisch, S. (2022). Evolution of harvest rate with influence of harvesting cost. "
            "OpenEvo NetLogo Models. https://openevo.eva.mpg.de/teachingbase/netlogo/. Existing "
            "lesson plan and slide deck (linked in the model's metadata.json) -- real, already-"
            "built teaching materials for this specific model, predating this strand."
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-resource-use-social-behavior",
        "title": "Evolution of Resource Use and Social Behavior (Monitoring and Punishment)",
        "overview": (
            "This model layers a second evolving trait on top of the familiar sustainable/greedy "
            "harvest trait: whether an agent is a punisher -- able to perceive greedy neighbors "
            "(Perception-accuracy) and impose a cost on them (Punishment: kill / suspend harvest "
            "once / pay a shared fine). Both perceiving and punishing cost the punisher energy "
            "(Costs-perception, Costs-punishment), so punishing is itself an altruistic trait: it "
            "benefits the group (by suppressing greedy harvesting) at a direct cost to the "
            "individual punisher. The model's own info_sections text names the mechanism "
            "explicitly: \"Concepts like kin selection, frequency-dependent selection, multi-level "
            "selection play a role in the outcomes that are observed.\" Because agents place "
            "offspring on neighboring patches and rarely move unless local resources are gone, "
            "clusters of related agents form -- this spatial clustering is what lets altruistic "
            "punishment persist against the individual cost of paying it (the same positive-"
            "assortment logic as island-world, via a completely different mechanism: direct "
            "sanctioning rather than spatial isolation). This model already has real teaching "
            "materials in preparation per metadata.json; this strand builds the LPM layer, not a "
            "replacement."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "9-12", "heading": "Grades 9-12: Monitoring, Punishment, and the Evolution of Altruism",
                "learning_objectives": (
                    "- Identify the two independently evolving traits (harvest preference, "
                    "punisher ability) and explain why the model tracks four combined types "
                    "(sustainable-punisher, sustainable-non-punisher, greedy-punisher, greedy-"
                    "non-punisher) rather than just two.\n"
                    "- Explain why punishing is a genuinely costly (altruistic) behavior in this "
                    "model, using the actual parameters (Costs-perception, Costs-punishment) -- "
                    "not just asserting \"punishment is good for the group\" without the cost side.\n"
                    "- Analyze how Minimum-punishers (the coordination threshold before punishers "
                    "will act) changes outcomes -- this is the model's built-in test of whether "
                    "punishment needs to be coordinated to be viable.\n"
                    "- Connect the persistence of altruistic punishment to spatial clustering "
                    "(offspring placed on neighboring patches), and compare this mechanism to "
                    "island-world's founder-effect/isolation route to the same kind of outcome."
                ),
                "key_concepts": (
                    "Altruism; monitoring and sanctioning; kin selection; multilevel selection; "
                    "frequency-dependent selection; common-pool resource governance (Ostrom-style "
                    "institutions, made concrete and manipulable)."
                ),
                "activities": (
                    "1. Run the model with Percent-Punishers at 0% (no punishment possible) vs. 20% "
                    "and compare final trait frequencies and forest-stock-equivalent (resource) "
                    "outcomes.\n"
                    "2. Vary Punishment between \"kill,\" \"suspend harvest once,\" and \"pay fine\" "
                    "holding other parameters fixed, and compare how harsh vs. mild sanctions "
                    "change the population's evolved composition.\n"
                    "3. Vary Minimum-punishers from 1 to 9 and observe whether coordinated "
                    "punishment (higher threshold) changes outcomes compared to unilateral "
                    "punishment (threshold of 1).\n"
                    "4. Use Payoff Matrices to lay out, for a single interaction, the energy cost/"
                    "benefit to a punisher who does vs. doesn't act on a detected greedy neighbor."
                ),
                "assessment_indicators": (
                    "Correctly names all four evolving type-combinations and explains why punishing "
                    "is costly using the model's actual cost parameters; connects Minimum-punishers "
                    "to coordination requirements for altruism to persist; distinguishes this "
                    "model's clustering-based mechanism from island-world's isolation-based one."
                ),
            },
            {
                "band": "Undergraduate",
                "heading": "Undergraduate: Multilevel Selection Theory Applied to Institutional Design",
                "learning_objectives": (
                    "- State formally how kin selection, frequency-dependent selection, and "
                    "multilevel selection each contribute to this model's outcome, using the "
                    "model's own stated mechanism as a starting text.\n"
                    "- Evaluate the three punishment types (kill, suspend, fine) as different "
                    "institutional designs with different real-world analogues (exclusion, "
                    "temporary suspension of rights, monetary sanction) and discuss real-world "
                    "common-pool-resource governance systems (Ostrom's design principles) that use "
                    "analogous mechanisms.\n"
                    "- Critically evaluate the model's assumptions: perception is imperfect but not "
                    "strategic; punishment costs are shared among punishers but not adjusted for "
                    "free-riding among punishers themselves (a second-order cooperation problem the "
                    "model does not model explicitly)."
                ),
                "key_concepts": (
                    "Multilevel selection theory; Ostrom's commons-governance design principles; "
                    "second-order free-riding (the problem of who punishes the non-punishers); "
                    "model scope and limits."
                ),
                "activities": (
                    "1. Design a BehaviorSpace experiment varying Percent-Punishers x Minimum-"
                    "punishers and test whether there's a minimum coordination threshold below "
                    "which altruistic punishment cannot invade a greedy-dominated population.\n"
                    "2. Read a short summary of Ostrom's design principles for commons governance "
                    "and map each of this model's mechanisms (harvest limits, monitoring, graduated "
                    "sanctions) onto the corresponding principle.\n"
                    "3. Discuss the second-order free-rider problem explicitly: this model doesn't "
                    "let agents evolve a trait for \"punish non-punishers\" -- what would need to be "
                    "added, and would you predict it changes the outcome?"
                ),
                "assessment_indicators": (
                    "Uses kin selection / frequency-dependent selection / multilevel selection "
                    "correctly and distinctly (not as interchangeable synonyms); maps model "
                    "mechanisms to real institutional-design principles with specific "
                    "correspondences; identifies the second-order free-rider gap as a genuine model "
                    "limitation, not a flaw to paper over."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Governing the Commons", "Cooperation Games"],
            "secondary": ["Computer Models", "Global Sustainability Goals"],
        },
        "thinking_tools": ["Payoff Matrices", "Causal Mapping", "Structure of Knowledge Diagrams"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS2-8 / LS2.D (group behavior and survival/reproduction evidence -- the "
            "single best-fitting NGSS performance expectation across this entire eight-model set: "
            "punishing and being punished are literally group-behavior mechanisms whose fitness "
            "consequences the model makes directly observable); HS-LS4-2 / LS4.B (four-factor "
            "selection, here a two-trait system); HS-LS2-1 / LS2.A (carrying capacity / resource-"
            "population dynamics). Germany (Sachsen Gymnasium Biologie, coverage fine-grained-"
            "content-staged-untagged, grade band unspecified): lernziel-lerninhalt-7649-1/-2 "
            "(mutation, selection, isolation); -8099-1/-7838-1/-8099-2 (methods and significance of "
            "behavioral biology); -7839-1 (proximate causes of behavior) and -7845-1 (ultimate "
            "causes of behavior) -- the proximate/ultimate distinction maps directly onto this "
            "model's two levels of explanation; -7256-1/-7256-2 (the animal state as a social "
            "union, honeybee example -- a real, if imperfect, analogue for this model's cost-"
            "sharing, group-benefiting altruistic behavior). Gap flagged, directly relevant here: "
            "this model's own documentation names kin selection, multi-level selection, and "
            "frequency-dependent selection as the mechanisms behind its outcomes, but none of the "
            "three exist as concepts in ConceptBase main -- all three exist as proposed, unmerged "
            "entries (OE-CONCEPT-000126, OE-CONCEPT-000125, OE-CONCEPT-000121, all BIO-CORE-"
            "v1.2.0) in the pending extend-bio-core-evolution-mechanisms branch. This is the "
            "strand in this set where that gap matters most, since the model literally cannot be "
            "fully competency-tagged against ConceptBase main without them."
        ),
        "competency_alignment": (
            "OE-CONCEPT-oe-interdisciplinary-cooperation (how a costly individual behavior can "
            "produce a group benefit); OE-CONCEPT-bio-core-natural-selection; "
            "OE-CONCEPT-bio-core-fitness (energy cost of perception/punishment as a direct fitness "
            "cost); OE-CONCEPT-oe-interdisciplinary-institutions (the punishment mechanism as an "
            "evolving informal institution); OE-CONCEPT-oe-interdisciplinary-norms (sustainable "
            "harvesting as an enforced behavioral norm once punishers are common enough) -- all "
            "verified 2026-08-29. Not yet in ConceptBase: Kin Selection, Multilevel Selection, "
            "Frequency-Dependent Selection -- all named directly by this model's own "
            "documentation."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-oe-interdisciplinary-cooperation", "OE-CONCEPT-bio-core-natural-selection",
            "OE-CONCEPT-bio-core-fitness", "OE-CONCEPT-oe-interdisciplinary-institutions",
            "OE-CONCEPT-oe-interdisciplinary-norms",
        ],
        "assessment": (
            "No assessment file exists yet -- needs building. Vignette sketch, grounded in the "
            "actual model: \"You ran the model with Percent-Punishers at 20%, Punishment set to "
            "'suspend harvest once,' and Minimum-punishers at 1 (unilateral punishment allowed). "
            "Sustainable-punisher agents spread to dominate the population by tick 800. You then "
            "reran with everything the same except Minimum-punishers at 5 (punishers must "
            "coordinate), and greedy agents dominated instead. A classmate says 'punishment either "
            "works or it doesn't -- the second run just shows punishment doesn't work.' Using the "
            "model's actual mechanism, explain what Minimum-punishers controls and why raising it "
            "could flip the outcome.\""
        ),
        "common_misconceptions": (
            "1. \"Punishment is automatically good for the group, so it should always spread\" -- "
            "punishing is individually costly; whether it spreads depends on spatial clustering, "
            "coordination threshold, and punishment type. 2. \"Kin selection, multilevel selection, "
            "and frequency-dependent selection are the same thing\" -- related but distinct "
            "mechanisms. 3. \"Agents choose to punish because it's the right thing to do\" -- "
            "punisher status is an inherited, mutating trait, not a moral choice. 4. \"A model with "
            "no punishers proves punishment doesn't matter\" -- compare directly to the "
            "Percent-Punishers = 0 control run rather than assuming."
        ),
        "connections_to_other_models": [
            {"model": "island-world", "note": "a completely different route (spatial isolation/founder effects, not direct sanctioning) to the same kind of altruism-can-persist outcome; the strongest same-mechanism-different-route comparison in this set.", "in_scope": True},
            {"model": "evolution-competition-forest-resources", "note": "the same commons dilemma with the punishment/monitoring mechanism entirely absent.", "in_scope": True},
            {"model": "evolution-ethnocentrism", "note": "also invokes kin selection and frequency-dependent selection explicitly, via a different mechanism (ethnic-marker-based assortment rather than resource-monitoring).", "in_scope": True},
            {"model": "two-communities", "note": "commons cooperation without the evolutionary/reproduction mechanism (out of scope for this pass).", "in_scope": False},
        ],
        "references": (
            "Hanisch, S. (2022). Evolution, resources, monitoring and punishment. OpenEvo NetLogo "
            "Models. https://openevo.eva.mpg.de/teachingbase/netlogo/. Ostrom, E. (1990). "
            "Governing the Commons: The Evolution of Institutions for Collective Action. Cambridge "
            "University Press (not yet a LiteratureBase lit: record as of this pass)."
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-resource-use-behavior-imitation",
        "title": "Evolution of Resource Use Through Behavior Imitation",
        "overview": (
            "This model takes the familiar sustainable/greedy harvest trait and adds a second "
            "inheritance channel: alongside biological reproduction (offspring inherit a parent's "
            "trait, subject to behavior-innovation-rate), agents can also imitate neighbors during "
            "their lifetime, according to an Imitation-bias chooser with five real options -- most "
            "successful, majority, minority, most experienced, or parents. This is the strand's "
            "central pedagogical opportunity: it is the only model in this set that makes "
            "biological and cultural evolution run side by side, as two distinct, separately-"
            "controllable mechanisms acting on the same trait. Setting Imitation-bias to \"parents\" "
            "effectively disables cultural transmission (behavior tracks biological inheritance "
            "only); every other setting introduces within-lifetime behavior change, which the "
            "model's own documentation explicitly calls \"cultural selection\" and connects to the "
            "emergence of \"norms and traditions.\" This model already has two real linked teaching "
            "materials in metadata.json (a cultural-evolution-vs-gene-focused-evolution lesson "
            "plan, and \"what motivates people to save energy\"); this strand builds the LPM layer "
            "around them, not a replacement."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "9-12", "heading": "Grades 9-12: Two Channels of Inheritance",
                "learning_objectives": (
                    "- Distinguish biological inheritance (offspring resembling parents via "
                    "reproduction) from cultural transmission (agents changing behavior within "
                    "their lifetime via imitation) as two separate mechanisms this model "
                    "implements explicitly and separately.\n"
                    "- Explain each of the five Imitation-bias options in the model's own terms "
                    "(success bias, conformist/majority bias, anti-conformist/minority bias, "
                    "prestige-by-experience bias, vertical/parental transmission) and predict how "
                    "each would shape the spread of sustainable vs. greedy behavior differently.\n"
                    "- Observe how quickly trait frequencies shift under imitation (within a few "
                    "dozen ticks) compared to under biological inheritance alone (many "
                    "generations) -- a directly observable difference in the speed of cultural vs. "
                    "biological change."
                ),
                "key_concepts": (
                    "Biological vs. cultural evolution; imitation bias (success, conformist, "
                    "anti-conformist, prestige, vertical); norms and traditions; behavioral "
                    "innovation."
                ),
                "activities": (
                    "1. Set Imitation-bias to \"parents\" (biological inheritance only) and run the "
                    "model; then set it to \"majority\" (conformist cultural transmission) with "
                    "everything else unchanged, and compare how fast and how completely the "
                    "sustainable/greedy trait frequency shifts.\n"
                    "2. Compare \"most successful\" (success bias) to \"most experienced\" "
                    "(prestige-by-age bias) -- do they converge on the same outcome, or can they "
                    "diverge? Under what resource conditions?\n"
                    "3. Use behavior-innovation-rate (a within-lifetime \"cultural mutation\") "
                    "alongside Mutation-rate-equivalent biological variation and discuss: are these "
                    "the same kind of variation-generating process, or meaningfully different ones?\n"
                    "4. Connect to the linked \"what motivates people to save energy\" material: "
                    "which of the five imitation biases best matches a specific real energy-"
                    "conservation behavior-change campaign you can think of?"
                ),
                "assessment_indicators": (
                    "Correctly distinguishes biological from cultural transmission using this "
                    "model's actual mechanism, not a generic definition; predicts differential "
                    "outcomes across imitation-bias settings and explains why; connects at least "
                    "one imitation bias to a real behavior-change intervention."
                ),
            },
            {
                "band": "Undergraduate", "heading": "Undergraduate: Dual Inheritance Theory and Norm Formation",
                "learning_objectives": (
                    "- Situate this model's mechanism within dual inheritance theory / gene-"
                    "culture coevolution (Boyd & Richerson; Henrich) as a real, established "
                    "theoretical framework, using the linked \"cultural evolution vs. gene-focused "
                    "evolution\" lesson plan as a starting text.\n"
                    "- Analyze how spatial structure (chance-agents-move) interacts with imitation "
                    "bias to produce clustered \"traditions\" -- regions of the world that settle on "
                    "different norms -- versus a single global norm.\n"
                    "- Critically evaluate the model's simplifications: agents imitate based on "
                    "perfect information about neighbors' harvest type, energy, and age within a "
                    "fixed radius; real cultural transmission involves imperfect, costly, and "
                    "strategically filtered information."
                ),
                "key_concepts": (
                    "Dual inheritance theory; gene-culture coevolution; conformist/anti-conformist/"
                    "success/prestige transmission biases (Henrich & Boyd's taxonomy); spatial "
                    "clustering of norms; model scope and limitations."
                ),
                "activities": (
                    "1. Read the linked cultural-evolution-vs-gene-focused-evolution lesson plan "
                    "and map its terminology onto this model's actual chooser options and "
                    "mechanisms.\n"
                    "2. Design a BehaviorSpace experiment varying Imitation-bias x chance-agents-"
                    "move and test whether low mobility produces spatially clustered \"traditions\" "
                    "while high mobility produces a single global norm.\n"
                    "3. Write a short critique of what this model's imitation mechanism omits "
                    "relative to real human cultural transmission and what adding one of those "
                    "would likely change."
                ),
                "assessment_indicators": (
                    "Uses dual inheritance theory terminology correctly and connects it to specific "
                    "model mechanisms; designs and interprets the mobility x imitation-bias "
                    "experiment correctly; identifies specific, non-generic model limitations."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Cultural Diversity", "Computer Models"],
            "secondary": ["Governing the Commons", "Global Sustainability Goals"],
        },
        "thinking_tools": ["Analogies & Analogy Mapping", "Structure of Knowledge Diagrams", "Causal Mapping"],
        "international_curriculum_grounding": (
            "US NGSS: no Disciplinary Core Idea for cultural evolution or social learning "
            "specifically -- LS4 (evolution) is genetic/biological, and the closest DCI, LS2.D "
            "(Social Interactions and Group Behavior), addresses behavior's role in survival/"
            "reproduction but not cultural transmission mechanisms as such. Rather than force a "
            "weak match, this strand names that gap directly: the biological-inheritance half of "
            "this model is still gettable via HS-LS4-2 (four-factor natural selection, applying to "
            "the behavior-innovation-rate/reproduction channel) and HS-LS2-8 (group behavior and "
            "survival/reproduction, applying loosely to the imitation channel's fitness "
            "consequences), but the cultural-transmission mechanism itself is not NGSS-covered "
            "content -- the German Sachsen data is this model's primary, better-fitting curriculum "
            "citation for that half. Germany (Sachsen Gymnasium Biologie, coverage fine-grained-"
            "content-staged-untagged, grade band unspecified): this model's single most direct "
            "match in the whole eight-model set -- lernziel-lerninhalt-126109-1 (\"kulturelle "
            "Evolution\" / cultural evolution, a named Lernziel precisely matching this model's "
            "subject matter, not a loose thematic connection like most of this set's other "
            "citations); -7649-1/-2 (mutation, recombination, selection, isolation -- grounds the "
            "biological-inheritance channel specifically); -8099-1/-7838-1/-8099-2 (methods and "
            "significance of behavioral biology -- grounds the imitation/behavior-observation "
            "mechanism generally). Gap flagged: ConceptBase does have real concepts for the "
            "general mechanism (Culture, Transmission, Learning, Norms, Innovation -- see "
            "Competency Alignment) but is missing a concept for the specific transmission-bias "
            "taxonomy (success, conformist, anti-conformist, prestige/experience bias) this model "
            "implements as five distinct chooser options -- no such concept exists in ConceptBase "
            "main or the pending branch (which is BIO-CORE-scoped and doesn't cover cultural "
            "evolution at all)."
        ),
        "competency_alignment": (
            "OE-CONCEPT-oe-interdisciplinary-culture; OE-CONCEPT-oe-interdisciplinary-transmission "
            "(distinguishing vertical from oblique/horizontal transmission using the model's own "
            "Imitation-bias options); OE-CONCEPT-oe-interdisciplinary-learning (the only model in "
            "this set where agents \"adapt their behavior over their lifetimes\" -- every sibling "
            "resource model explicitly states agents do not learn); OE-CONCEPT-oe-interdisciplinary"
            "-norms (direct match to the model's own \"norms and traditions\" language); "
            "OE-CONCEPT-oe-interdisciplinary-innovation (direct match to behavior-innovation-rate); "
            "OE-CONCEPT-oe-interdisciplinary-selection (this concept's own definition set "
            "explicitly includes a culture sense, making it a genuinely dual-purpose citation for "
            "this model specifically) -- all OE-INTERDISCIPLINARY-v1.0.0, verified 2026-08-29. Not "
            "yet in ConceptBase: the specific transmission-bias taxonomy."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-oe-interdisciplinary-culture", "OE-CONCEPT-oe-interdisciplinary-transmission",
            "OE-CONCEPT-oe-interdisciplinary-learning", "OE-CONCEPT-oe-interdisciplinary-norms",
            "OE-CONCEPT-oe-interdisciplinary-innovation", "OE-CONCEPT-oe-interdisciplinary-selection",
        ],
        "assessment": (
            "No assessment file exists yet -- needs building. Vignette sketch, grounded in the "
            "actual model: \"You ran the model twice with identical starting conditions "
            "(Sustainables = 1 out of 50 agents, everything else default) except for Imitation-"
            "bias. In Run 1 (Imitation-bias = 'parents'), the sustainable trait spread slowly, only "
            "reaching 40% of the population by tick 2000. In Run 2 (Imitation-bias = 'majority'), "
            "it spread much faster after crossing roughly 50% frequency, reaching 90% by tick 800 "
            "-- but it also nearly died out early on, when it was still rare. Using the model's "
            "actual mechanism, explain both observations: why is majority-bias imitation slower "
            "than biological inheritance when a trait is rare, and faster once the trait is "
            "common?\""
        ),
        "common_misconceptions": (
            "1. \"Cultural evolution and biological evolution are the same process with different "
            "content\" -- this model makes the mechanisms genuinely different and lets students "
            "observe the speed difference directly. 2. \"Imitating the majority always makes "
            "change slower\" -- majority/conformist bias can actually accelerate change once a "
            "trait crosses a threshold frequency, while making it harder for a rare trait to "
            "establish. 3. \"All imitation biases produce the same long-run outcome\" -- success, "
            "majority, minority, and experience biases can diverge. 4. \"Culture is separate from "
            "evolution\" -- this model is explicit evidence against treating culture as outside the "
            "domain of evolutionary/selective processes."
        ),
        "connections_to_other_models": [
            {"model": "evolution-resource-use-harvest-efficiency", "note": "same resource-competition base without any social-learning mechanism; the direct \"what does adding imitation change\" comparison.", "in_scope": True},
            {"model": "evolution-competition-forest-resources", "note": "same binary sustainable/greedy trait, biological inheritance only.", "in_scope": True},
            {"model": "evolution-competition-resources-abstract", "note": "same binary sustainable/greedy trait, biological inheritance only.", "in_scope": True},
            {"model": "evolution-resource-use-social-behavior", "note": "a different social mechanism (monitoring/punishment) layered on the same base trait; useful contrast between cultural transmission and direct sanctioning as two distinct routes to norm stabilization.", "in_scope": True},
        ],
        "references": (
            "Hanisch, S. (2022). Evolution of resource use through behavior imitation. OpenEvo "
            "NetLogo Models. https://openevo.eva.mpg.de/teachingbase/netlogo/. Existing linked "
            "lesson plan: Cultural evolution vs. gene-focused evolution (OpenEvo TeachingBase). "
            "Boyd, R., & Richerson, P. J. (1985). Culture and the Evolutionary Process. University "
            "of Chicago Press (not yet a LiteratureBase lit: record). Henrich, J., & Boyd, R. "
            "(1998). The evolution of conformist transmission and the emergence of between-group "
            "differences. Evolution and Human Behavior, 19(4), 215-241 (not yet a LiteratureBase "
            "lit: record)."
        ),
        "caveats": [],
    },
    {
        "slug": "evolution-ethnocentrism",
        "title": "Evolution of Ethnocentrism",
        "overview": (
            "Agents carry an ethnicity marker (one of Number-ethnicities shapes) plus two "
            "independent cooperation traits -- cooperate-with-same? and cooperate-with-different? "
            "-- whose four combinations produce four named strategies: altruist (cooperates with "
            "everyone), ethnocentrist (cooperates only with own ethnicity), cosmopolitan "
            "(cooperates only with other ethnicities), and selfish (cooperates with no one). "
            "Interactions use a fully student-editable payoff matrix (inputs A, B, C, D), and "
            "interaction/offspring-placement choosers switch between local (neighbor-only) and "
            "global (anywhere) versions of both processes. Based directly on Axelrod & Hammond's "
            "(2003, 2006) published ethnocentrism model, the model's own documentation states its "
            "core finding plainly: local interaction and local offspring placement are what let "
            "ethnocentric strategies outcompete both purely selfish and purely altruistic ones, "
            "because they create the positive assortment (kin selection, frequency-dependent "
            "selection) that lets a costly cooperative strategy defend itself from exploitation by "
            "selfish agents without incurring the same cost against strangers."
        ),
        "theoretical_rationale": None,
        "grade_bands": [
            {
                "band": "9-12", "heading": "Grades 9-12: Cooperation Strategies and Positive Assortment",
                "learning_objectives": (
                    "- Correctly name and distinguish the four emergent strategies (altruist, "
                    "ethnocentrist, cosmopolitan, selfish) from their two underlying binary "
                    "traits.\n"
                    "- Explain, using the model's own payoff matrix inputs, why the local/local "
                    "(interaction = local, offspring-placement = local) setting favors "
                    "ethnocentrism over the global/global setting.\n"
                    "- Recognize ethnocentrism as an evolved strategy, not a fixed biological "
                    "destiny or a moral choice made by individual agents in the model.\n"
                    "- Avoid genetic-determinist and teleological framings (\"ethnocentrism evolved "
                    "because it's good for the group\") in favor of a differential-fitness account "
                    "tied to the model's actual mechanism."
                ),
                "key_concepts": (
                    "Positive assortment; kin selection; frequency-dependent selection; payoff "
                    "matrices; local vs. global interaction/reproduction; natural selection."
                ),
                "activities": (
                    "1. Run the model at interaction = local / offspring-placement = local, then "
                    "at anywhere/anywhere, holding the payoff matrix and Number-ethnicities fixed "
                    "-- compare which strategy dominates in each case.\n"
                    "2. Systematically vary the payoff matrix (A, B, C, D) and map out under which "
                    "payoff structures ethnocentrism, cosmopolitanism, altruism, or selfishness "
                    "each wins -- build this as an explicit Payoff Matrix analysis, not just "
                    "observation.\n"
                    "3. Vary Number-ethnicities from 1 (no ethnic distinction possible) up to 6 and "
                    "discuss what changes about the dynamic as more distinguishable groups are "
                    "added.\n"
                    "4. Apply Tinbergen's Questions to ethnocentrism: Function, Mechanism, "
                    "Development (not modeled here -- flag as a real limitation), Phylogeny."
                ),
                "assessment_indicators": (
                    "Names all four strategies correctly from their trait combinations; explains "
                    "the local-vs-global outcome difference using positive assortment, not vague "
                    "appeals to \"tribalism\"; avoids teleological and genetic-determinist framing; "
                    "can read a payoff matrix and predict qualitative outcome direction."
                ),
            },
            {
                "band": "Undergraduate", "heading": "Undergraduate: Multilevel Selection Theory and Human Applications",
                "learning_objectives": (
                    "- State kin selection, frequency-dependent selection, and multilevel "
                    "selection formally and distinctly, and identify which is doing the "
                    "explanatory work under which of the model's settings.\n"
                    "- Read Axelrod & Hammond (2003, 2006) -- the model's direct source -- and "
                    "identify what the model implements faithfully vs. simplifies.\n"
                    "- Critically and carefully evaluate what this model can and cannot tell us "
                    "about real human intergroup dynamics: it has no learning, no reputation, no "
                    "communication, no institutions, and models \"ethnicity\" as an arbitrary, "
                    "costless-to-detect marker rather than anything socially or historically "
                    "constructed -- a significant simplification that should be named explicitly "
                    "before any real-world application is drawn.\n"
                    "- Distinguish descriptive claims (ethnocentrism can be evolutionarily favored "
                    "under these conditions) from normative ones (therefore ethnocentrism is good, "
                    "or inevitable, or excusable) -- the naturalistic-fallacy distinction, made "
                    "concrete with this specific model."
                ),
                "key_concepts": (
                    "Multilevel selection theory; evolutionary game theory; model validation and "
                    "scope limits; the naturalistic fallacy; applications to human social "
                    "psychology (with explicit caution about overreach)."
                ),
                "activities": (
                    "1. Read Axelrod & Hammond (2003, 2006) alongside the model and write a short "
                    "comparison of what the paper's model adds or omits relative to this NetLogo "
                    "implementation.\n"
                    "2. Design a BehaviorSpace experiment testing whether ethnocentrism's advantage "
                    "over cosmopolitanism shrinks as Number-ethnicities increases or as interaction "
                    "moves toward \"anywhere.\"\n"
                    "3. Write a short argument distinguishing what this model shows from what it "
                    "doesn't show -- explicitly naming the naturalistic fallacy."
                ),
                "assessment_indicators": (
                    "Distinguishes the three selection mechanisms with correct, specific "
                    "attribution to model settings; identifies concrete model simplifications when "
                    "evaluating real-world relevance; explicitly separates descriptive "
                    "evolutionary claims from normative ones."
                ),
            },
        ],
        "content_anchors": {
            "primary": ["Cooperation Games", "Cultural Diversity"],
            "secondary": ["Our Mind", "Cross-Species Comparisons"],
        },
        "thinking_tools": ["Payoff Matrices", "Tinbergen's Questions", "Structure of Knowledge Diagrams"],
        "international_curriculum_grounding": (
            "US NGSS: HS-LS2-8 / LS2.D (group behavior and survival/reproduction -- direct match: "
            "the four cooperation strategies and their differential fitness under local vs. global "
            "interaction are exactly this performance expectation's subject matter); HS-LS4-2 / "
            "LS4.B (four-factor evolution, here applied to a behavioral/strategic trait); HS-LS4-3 "
            "(statistics/probability for advantageous-trait spread, matching the payoff-matrix-"
            "sweep activity). Note on scope: NGSS's LS4 strand does not name \"ethnocentrism\" or "
            "\"intergroup cooperation\" specifically -- the fit is at the level of the underlying "
            "selection/group-behavior mechanism, real and direct, not a claim that NGSS addresses "
            "this specific social-science topic. Germany (Sachsen Gymnasium Biologie, coverage "
            "fine-grained-content-staged-untagged, grade band unspecified): lernziel-lerninhalt-"
            "7649-1/-2 (mutation, selection, isolation); -8134-1/-8134-2 (\"Ubertragen "
            "evolutionsbiologischer Kenntnisse auf die Stammesentwicklung des Menschen\" / "
            "transferring evolutionary-biology knowledge to human phylogeny -- used carefully: "
            "about human phylogenetic history, not directly about the evolution of a behavioral "
            "strategy; the honest connection is that this model's Undergraduate band applies "
            "evolutionary reasoning to human social behavior, the same general move this Lernziel "
            "names, not a literal common-descent content match); -7676-1/-7676-2 (human social "
            "behavior -- a direct, strong match for this model's real-world application layer); "
            "-7839-1 and -7845-1 (proximate/ultimate causes of behavior -- maps directly onto this "
            "strand's Mechanism-vs-Function distinction). Gap flagged, directly relevant here: "
            "exactly as with evolution-resource-use-social-behavior, this model's own "
            "documentation names kin selection, multilevel selection, and frequency-dependent "
            "selection as the mechanisms behind its outcomes, and none of the three exist as "
            "concepts in ConceptBase main -- all three exist as proposed, unmerged entries "
            "(OE-CONCEPT-000126, OE-CONCEPT-000125, OE-CONCEPT-000121, all BIO-CORE-v1.2.0) in the "
            "pending extend-bio-core-evolution-mechanisms branch. There is also no ConceptBase "
            "concept for \"ethnocentrism\" or \"in-group/out-group bias\" specifically, in either "
            "main or the pending branch."
        ),
        "competency_alignment": (
            "OE-CONCEPT-oe-interdisciplinary-cooperation (the conditions that favor cooperation "
            "over defection in this model); OE-CONCEPT-oe-interdisciplinary-agency (distinguishing "
            "the model's agent-level rule from population-level strategy-frequency outcomes; "
            "avoiding treating the trait as a conscious choice); OE-CONCEPT-bio-core-natural-"
            "selection (variation, differential fitness, inheritance of strategy); "
            "OE-CONCEPT-bio-core-adaptation (why ethnocentrism can be adaptive under specific "
            "structural conditions, without asserting universal adaptiveness or that \"adaptive\" "
            "means \"good\") -- competency IDs carried over from evolution-ethnocentrism-"
            "complete.md and independently re-checked 2026-08-29; all four resolve to real, "
            "current registry entries. Not yet in ConceptBase: Kin Selection, Multilevel "
            "Selection, Frequency-Dependent Selection (shared gap with evolution-resource-use-"
            "social-behavior); no concept for ethnocentrism/in-group bias specifically."
        ),
        "competency_ids_cited": [
            "OE-CONCEPT-oe-interdisciplinary-cooperation", "OE-CONCEPT-oe-interdisciplinary-agency",
            "OE-CONCEPT-bio-core-natural-selection", "OE-CONCEPT-bio-core-adaptation",
        ],
        "assessment": (
            "Existing item bank: assessments/evolution-ethnocentrism.json, "
            "OE-ASSESS-ETHNOCENTRISM-001 -- a real, already-built integrated-causal-reasoning "
            "assessment using a \"Two Communities of River Valley\" vignette (Red/Blue ethnic "
            "groups, differing cooperation traditions, a town-council policy change), scored "
            "against verified real competencies (re-verified above). Noted gap, not fixed this "
            "pass: like island-world.json, this vignette is a realistic narrative scenario rather "
            "than one grounded in an actual run/configuration of this model -- flagged as a next "
            "step for strengthening this existing assessment, not a missing item bank."
        ),
        "common_misconceptions": (
            "1. \"Ethnocentrism is genetic and can't be changed\" -- the model shows strategy "
            "frequencies shift with structural conditions, not that the trait is immutable; real "
            "human ethnocentrism additionally involves cultural transmission this model doesn't "
            "model at all (contrast with evolution-resource-use-behavior-imitation). "
            "2. \"Ethnocentrism evolved to help groups survive\" -- teleological framing. 3. \"If a "
            "trait evolved, it must be good, or at least excusable\" -- the naturalistic fallacy. "
            "4. \"The model shows ethnocentrism is universal to social species\" -- the model shows "
            "ethnocentrism can be favored under specific structural conditions, not that this is "
            "the only possible or universally realized outcome. 5. \"Individual agents are choosing "
            "to be ethnocentric\" -- trait is inherited/mutated, not chosen within an agent's "
            "lifetime."
        ),
        "connections_to_other_models": [
            {"model": "evolution-resource-use-social-behavior", "note": "the strongest same-mechanism comparison in this entire set: both models' own documentation names kin selection, multilevel selection, and frequency-dependent selection explicitly, via two different concrete mechanisms.", "in_scope": True},
            {"model": "island-world", "note": "a third route to positive assortment (spatial isolation/founder effects rather than ethnic marking or direct sanctioning); useful three-way comparison across this set.", "in_scope": True},
            {"model": "evolution-resource-use-behavior-imitation", "note": "adds the cultural-transmission mechanism this model explicitly lacks.", "in_scope": True},
            {"model": "two-communities", "note": "literal \"communities\" framing without ethnicity markers or an evolutionary mechanism; worth writing up as extended-learning material (out of scope for this pass).", "in_scope": False},
        ],
        "references": (
            "Axelrod, R., & Hammond, R. A. (2003). The evolution of ethnocentric behavior. "
            "Midwest Political Science Convention, April 3-6, 2003, Chicago, USA. Hammond, R. A., "
            "& Axelrod, R. (2006). The evolution of ethnocentrism. Journal of Conflict Resolution, "
            "50(6), 926-936. https://doi.org/10.1177/0022002706293470. Hamilton, W. D. (1964). "
            "The genetical evolution of social behaviour. Journal of Theoretical Biology, 7(1), "
            "1-16 (not yet a LiteratureBase lit: record). Wilson, D. S., & Wilson, E. O. (2007). "
            "Rethinking the theoretical foundation of sociobiology. The Quarterly Review of "
            "Biology, 82(4), 327-348 (not yet a LiteratureBase lit: record). Hanisch, S. (2022). "
            "Ethnocentrism with customizable payoff matrix. OpenEvo NetLogo Models, adapted from "
            "Wilensky, U. (2003). NetLogo Ethnocentrism model. "
            "http://ccl.northwestern.edu/netlogo/models/Ethnocentrism."
        ),
        "caveats": [],
    },
]

MODEL_BY_SLUG = {m["slug"]: m for m in MODELS}


def model_links(slug: str) -> dict:
    return {
        "run": f"models/{slug}/app.html",
        "metadata": f"models/{slug}/metadata.json",
        "nlogo_download": f"models/{slug}/model.nlogo",
    }


# Undirected cross-model "Connections to Other Models" pairs, materialized as
# lpm_connections only where BOTH endpoints are one of the 8 strands in this
# migration (two-foresters/two-communities/wolves-sheep-grass/swarming are
# real models in the netlogo repo but out of scope for this pass, so no
# lpm_data_objects row exists here to link to). Each pair is transcribed
# directly from at least one of the two strands' own "Connections to Other
# Models" section text -- not inferred.
CROSS_MODEL_PAIRS = [
    ("bug-evolution", "island-world"),
    ("bug-evolution", "evolution-competition-forest-resources"),
    ("island-world", "evolution-resource-use-social-behavior"),
    ("island-world", "evolution-competition-forest-resources"),
    ("island-world", "evolution-competition-resources-abstract"),
    ("island-world", "evolution-ethnocentrism"),
    ("evolution-competition-forest-resources", "evolution-competition-resources-abstract"),
    ("evolution-competition-forest-resources", "evolution-resource-use-harvest-efficiency"),
    ("evolution-competition-forest-resources", "evolution-resource-use-social-behavior"),
    ("evolution-competition-resources-abstract", "evolution-resource-use-harvest-efficiency"),
    ("evolution-resource-use-harvest-efficiency", "evolution-resource-use-behavior-imitation"),
    ("evolution-resource-use-social-behavior", "evolution-ethnocentrism"),
    ("evolution-resource-use-social-behavior", "evolution-resource-use-behavior-imitation"),
    ("evolution-resource-use-behavior-imitation", "evolution-ethnocentrism"),
]

PROJECT_SLUG = "netlogo-lpm-strands"
PROJECT_ID = uid(f"project:{PROJECT_SLUG}")

PROJECT_DESCRIPTION = (
    "Learning Progression Map strands for 8 of the evolution-themed agent-based models in the "
    "sibling netlogo repo's teaching collection (the 2026-08-29 pass -- bug-evolution, "
    "island-world, evolution-competition-forest-resources, evolution-competition-resources-"
    "abstract, evolution-resource-use-harvest-efficiency, evolution-resource-use-social-behavior, "
    "evolution-resource-use-behavior-imitation, evolution-ethnocentrism). Each strand follows the "
    "5-step process in netlogo/lpm-strands/README.md: grade-band progression, content-anchor/"
    "thinking-tool alignment, international curriculum grounding (real US NGSS codes and Sachsen "
    "Gymnasium Biologie Lernziele from EvoMentor's FWU MEM dataset), ConceptBase competency "
    "alignment, and an integrated-causal-reasoning assessment (existing item banks for 3 of the 8; "
    "vignette sketches, not yet built item banks, for the other 5). Step 5 of that process -- a "
    "formal, schema-validated contribution back to ConceptBase -- is what this project space is "
    "itself meant to make possible: real structured strand/grade-band objects, tagged against "
    "OpenEvo's content-anchor and thinking-tool vocabulary and cross-linked where the strands' own "
    "text draws real comparisons between models, rather than 8 free-standing prose files. "
    + QUALITY_REVIEW_NOTE
)

PROJECT_EPISTEMIC_NOTE = (
    "Synthesized by an LLM across ConceptBase, each model's own metadata.json/model-card data, and "
    "(for international grounding) EvoMentor's real FWU MEM Sachsen dataset -- not validated by "
    "expert review or empirical classroom testing for any of the 8 strands. " + QUALITY_REVIEW_NOTE +
    " Two specific caveats carried forward from that review, not silently dropped: (1) "
    "bug-evolution's theoretical-rationale section cites TheoryBase/QuestionBase records "
    "(proposition:restructuration-grounds-icr-transfer and two question: records) that are "
    "themselves tagged review_status: author-draft (unreviewed) -- its theoretical backbone rests "
    "on other unreviewed content, not an independently validated theory. (2) bug-evolution also "
    "cites OE-SANDBOX-CONCEPT-000007/8/9 (Restructuration, Decentralized Causal Reasoning, "
    "Agent-Based Modeling) without flagging in the strand's own text that these are provisional "
    "sandbox concepts with a 12-month TTL, expiring 2027-08-06 -- flagged here since the source "
    "text doesn't carry the caveat itself. Both caveats are also recorded directly on "
    "bug-evolution's own lpm_data_objects row (content.caveats) for anyone querying that object "
    "alone."
)

# ============================================================================
# SQL emission
# ============================================================================

lines = []


def emit(s: str = "") -> None:
    lines.append(s)


emit("-- netlogo-lpm-strands: 8 real NetLogo-model-anchored LPM strand drafts (the 2026-08-29")
emit("-- pass in netlogo/lpm-strands/*.md) migrated into their own private OpenLPM Project Space,")
emit("-- per Dustin's 2026-10-01 direction that OpenLPM -- not ConceptBase, not the netlogo repo --")
emit("-- is now where LPM content lives and where subject-matter-expert review happens. Pattern")
emit("-- follows 053_eva_lpm_seed.sql: deterministic UUIDs (generated by")
emit("-- scripts/generate_netlogo_lpm_strands_seed.py, not hand-typed), is_private = TRUE,")
emit("-- epistemic_status = 'in-development', maturity = 'draft', a real epistemic_status_note")
emit("-- stating plainly that zero human subject-matter-expert review has happened yet.")
emit("--")
emit("-- A first-pass quality review (2026-10-01, not expert review) spot-checked ConceptBase")
emit("-- competency IDs, 3 DOI citations against Crossref, and NetLogo model interface parameter")
emit("-- names -- all checked out as real, not fabricated. Two caveats from that review are carried")
emit("-- forward explicitly below (project epistemic_status_note and bug-evolution's own content),")
emit("-- not silently dropped: bug-evolution's theoretical grounding cites author-draft TheoryBase/")
emit("-- QuestionBase records, and cites 3 provisional (12-month-TTL, expiring 2027-08-06)")
emit("-- OE-SANDBOX-CONCEPT ids without flagging their provisional status in its own text.")
emit("--")
emit("-- Scope: 8 of the netlogo repo's 15 models (the 2026-08-29 'evolution-themed' pass). The")
emit("-- other 6 in-progress/complete strands (two-foresters, two-communities,")
emit("-- population-size-living-costs, beesmart-hive-finding) and the 3 not-started stubs")
emit("-- (swarming, virus-epidemic, wolves-sheep-grass) are not part of this migration.")

emit()
emit("DO $MIGRATION$")
emit("DECLARE")
emit(f"  v_project_id UUID := '{PROJECT_ID}';")
emit("  v_user_id UUID;")
emit("BEGIN")
emit()

# --- project ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Project Space")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)")
emit("  VALUES (")
emit(f"    v_project_id, {J(PROJECT_SLUG)}, {J('NetLogo LPM Strands')},")
emit(f"    {J(PROJECT_DESCRIPTION)},")
emit("    'active', 'in-development',")
emit(f"    {J(PROJECT_EPISTEMIC_NOTE)},")
emit("    'hosted', TRUE, 'draft', NULL, 'general', '{}'::TEXT[],")
emit("    ARRAY['evolution','natural-selection','agent-based-modeling','netlogo','commons-dilemma','cooperation','cultural-evolution']::TEXT[],")
emit("    ARRAY['en']::TEXT[]")
emit("  )")
emit("  ON CONFLICT (slug) DO NOTHING;")
emit()

# --- base link ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Base link: competency alignment throughout cites real ConceptBase concept ids")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr)")
emit(f"  VALUES (v_project_id, 'conceptbase', TRUE, FALSE)")
emit("  ON CONFLICT (project_id, base_repo) DO NOTHING;")
emit()

# --- source declarations ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Source declarations: one per strand markdown file, all structurally")
emit("  -- imported below (not merely declared-but-unimported).")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)")
emit("  VALUES")
src_rows = []
for i, m in enumerate(MODELS):
    src_rows.append(
        f"  (v_project_id, {J('netlogo/lpm-strands/' + m['slug'] + '.md (' + m['title'] + ')')}, "
        f"{J('Markdown (LPM strand draft, 2026-08-29 pass)')}, "
        f"{J('Lab-authored, LLM-synthesized content across ConceptBase/model-card data and the EvoMentor FWU MEM Sachsen dataset; zero human subject-matter-expert review. Structurally imported into lpm_data_objects/lpm_connections/lpm_object_tags by this migration.')}, "
        f"NULL)"
    )
emit(",\n".join(src_rows) + ";")
emit()

# --- schema elements: content anchors + thinking tools vocabulary ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Schema elements: OpenEvo's real, canonical content-anchor (9) and")
emit("  -- thinking-tool (6) vocabulary, shared across all 8 strands below.")
emit("  -- ------------------------------------------------------------------------")
anchor_root_id = uid("schema:content-anchors-root")
tool_root_id = uid("schema:thinking-tools-root")
anchor_ids = {name: uid(f"schema:content-anchor:{name}") for name in CONTENT_ANCHORS}
tool_ids = {name: uid(f"schema:thinking-tool:{name}") for name in THINKING_TOOLS}

emit("  INSERT INTO lpm_schema_elements (id, project_id, element_type, label, parent_id, metadata, status)")
emit("  VALUES")
se_rows = []
se_rows.append(
    f"  ('{anchor_root_id}', v_project_id, 'concept', {J('OpenEvo Content Anchors')}, NULL, "
    f"{JSB({'note': 'OpenEvo design-concept content-anchor vocabulary (content-anchor-mapper skill); shared across all 8 strands in this project, not strand-specific.'})}, 'accepted')"
)
se_rows.append(
    f"  ('{tool_root_id}', v_project_id, 'concept', {J('OpenEvo Thinking Tools')}, NULL, "
    f"{JSB({'note': 'OpenEvo design-concept thinking-tool vocabulary (thinking-tools-kit skill); shared across all 8 strands in this project, not strand-specific.'})}, 'accepted')"
)
for name in CONTENT_ANCHORS:
    se_rows.append(
        f"  ('{anchor_ids[name]}', v_project_id, 'concept', {J(name)}, '{anchor_root_id}', "
        f"{JSB({'kind': 'content-anchor'})}, 'accepted')"
    )
for name in THINKING_TOOLS:
    se_rows.append(
        f"  ('{tool_ids[name]}', v_project_id, 'concept', {J(name)}, '{tool_root_id}', "
        f"{JSB({'kind': 'thinking-tool'})}, 'accepted')"
    )
emit(",\n".join(se_rows) + ";")
emit()

# --- data objects: 8 strands + grade-band performance_indicators ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Data objects: 8 strands + their grade-band sections (performance_indicator)")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO lpm_data_objects (id, project_id, object_type, title, description, grade_band, subject_area, content, status)")
emit("  VALUES")

strand_ids = {m["slug"]: uid(f"strand:{m['slug']}") for m in MODELS}
band_ids = {}  # (slug, band) -> id

do_rows = []
for m in MODELS:
    slug = m["slug"]
    sid = strand_ids[slug]
    all_bands = ", ".join(b["band"] for b in m["grade_bands"])
    strand_content = {
        "overview": m["overview"],
        "theoretical_rationale": m["theoretical_rationale"],
        "grade_bands_covered": [b["band"] for b in m["grade_bands"]],
        "content_anchors": m["content_anchors"],
        "thinking_tools": m["thinking_tools"],
        "international_curriculum_grounding": m["international_curriculum_grounding"],
        "competency_alignment": m["competency_alignment"],
        "competency_ids_cited": m["competency_ids_cited"],
        "assessment": m["assessment"],
        "common_misconceptions": m["common_misconceptions"],
        "connections_to_other_models": m["connections_to_other_models"],
        "references": m["references"],
        "caveats": m["caveats"],
        "schema_contribution_status": (
            "not done -- step 5 of the 5-step process (netlogo/lpm-strands/README.md) not yet "
            "completed for any of the 8 strands in this migration"
        ),
        "model_links": model_links(slug),
        "_source": {"repo": "netlogo", "path": f"lpm-strands/{slug}.md", "pass": "2026-08-29"},
        "_quality_review_note": QUALITY_REVIEW_NOTE,
    }
    do_rows.append(
        f"  ('{sid}', v_project_id, 'strand', {J(m['title'])}, {J(m['overview'][:400])}, "
        f"{J(all_bands)}, {J(slug)}, {JSB(strand_content)}, 'draft')"
    )
    for b in m["grade_bands"]:
        bid = uid(f"gradeband:{slug}:{b['band']}")
        band_ids[(slug, b["band"])] = bid
        band_content = {
            "heading": b["heading"],
            "learning_objectives": b["learning_objectives"],
            "key_concepts": b["key_concepts"],
            "activities": b["activities"],
            "assessment_indicators": b["assessment_indicators"],
            "_source": {"repo": "netlogo", "path": f"lpm-strands/{slug}.md", "section": f"Grade-Band Progression > {b['heading']}"},
        }
        do_rows.append(
            f"  ('{bid}', v_project_id, 'performance_indicator', {J(b['heading'])}, "
            f"{J(b['key_concepts'])}, {J(b['band'])}, {J(slug)}, {JSB(band_content)}, 'draft')"
        )
emit(",\n".join(do_rows) + ";")
emit()

# --- connections ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Connections: grade-band -> strand (isChildOf, structural fact, asserted/")
emit("  -- accepted) and real cross-model comparisons drawn directly from the")
emit("  -- strands' own 'Connections to Other Models' text (relates_to, suggested/")
emit("  -- proposed -- the strand authors' own unreviewed pedagogical suggestions,")
emit("  -- not a verified curriculum sequence).")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO lpm_connections (project_id, from_object_id, to_object_id, relation_type, kind, rationale, status)")
emit("  VALUES")
conn_rows = []
for m in MODELS:
    slug = m["slug"]
    sid = strand_ids[slug]
    for b in m["grade_bands"]:
        bid = band_ids[(slug, b["band"])]
        conn_rows.append(f"  (v_project_id, '{bid}', '{sid}', 'isChildOf', 'asserted', NULL, 'accepted')")
for a, b in CROSS_MODEL_PAIRS:
    rationale = None
    for c in MODEL_BY_SLUG[a]["connections_to_other_models"]:
        if c["model"] == b:
            rationale = c["note"]
            break
    if rationale is None:
        for c in MODEL_BY_SLUG[b]["connections_to_other_models"]:
            if c["model"] == a:
                rationale = c["note"]
                break
    conn_rows.append(
        f"  (v_project_id, '{strand_ids[a]}', '{strand_ids[b]}', 'relates_to', 'suggested', "
        f"{J(rationale or '')}, 'proposed')"
    )
emit(",\n".join(conn_rows) + ";")
emit()

# --- object tags: strand -> content anchors (primary/secondary) + thinking tools ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Object tags: each strand -> the content anchors (primary/secondary) and")
emit("  -- thinking tools its own Content Anchor Alignment / Thinking Tool")
emit("  -- Integration sections name.")
emit("  -- ------------------------------------------------------------------------")
emit("  INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role)")
emit("  VALUES")
tag_rows = []
for m in MODELS:
    sid = strand_ids[m["slug"]]
    for name in m["content_anchors"]["primary"]:
        tag_rows.append(f"  (v_project_id, '{sid}', '{anchor_ids[name]}', 'primary')")
    for name in m["content_anchors"]["secondary"]:
        tag_rows.append(f"  (v_project_id, '{sid}', '{anchor_ids[name]}', 'secondary')")
    for name in m["thinking_tools"]:
        tag_rows.append(f"  (v_project_id, '{sid}', '{tool_ids[name]}', 'thinking_tool')")
emit(",\n".join(tag_rows) + ";")
emit()

# --- owner membership (fold in the 055 fix directly, per 056's precedent) ---
emit("  -- ------------------------------------------------------------------------")
emit("  -- Ownership: folded in directly (per 056_openevo_lpm_seed.sql's precedent,")
emit("  -- after 053_eva_lpm_seed.sql shipped without this and needed a same-day")
emit("  -- follow-up fix in 055 -- is_private = TRUE + no owner leaves a project")
emit("  -- invisible to everyone, including its own author).")
emit("  -- ------------------------------------------------------------------------")
emit("  SELECT id INTO v_user_id FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';")
emit()
emit("  IF v_user_id IS NULL THEN")
emit("    RAISE NOTICE 'No users row found for dustin.eirdosh@eva.mpg.de -- netlogo-lpm-strands was seeded without an owner. Add one manually (project_members + projects.created_by) once that account exists.';")
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

