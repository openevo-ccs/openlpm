#!/usr/bin/env python3
"""Writes technology-arc-thread-2026-11-03.json, the input of generate_technology_arc_thread_migration.mjs.

The text of both threads lives here as plain strings so that quotes and apostrophes cannot break a shell command. Run:  python scripts/data/build_technology_arc_thread_json.py
Everything is AI-drafted and unreviewed by a subject expert. Claims are tagged [observed], [inferred] or [proposed].
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "technology-arc-thread-2026-11-03.json"
LB = "OE-LITERATURE-"
# stage ids of the Interdisciplinary space
S = {
    "cumulative": "2f6dd553-7732-5ebf-8810-e756d39587ee",
    "tool_copied": "c561b517-c4e9-58df-a2d0-e04cc1b85443",
    "communities": "a1bc92d8-3730-53b8-a059-f3999e4387cf",
    "niche": "5d938d91-e81b-516c-ba58-a234b6d5559f",
    "collective": "e820dc2d-9317-57d1-8475-22a701fc486a",
    "selection": "396e3dd9-4f22-5160-b6c7-3752caefa1b8",
    "culture_inst": "ad0173a4-5c64-5d05-96ac-2b61810c4153",
    "machine": "9d77ef6f-8eea-5427-84e4-72ded6b1bba5",
    "education": "a9c1777a-a159-534d-b927-ad30da661ce6",
    "who_show": "bffa8eae-478f-52ae-a5fd-b7ff43840af0",
    "living_things": "31b2be29-7a8c-5f98-a447-55ecf57f1ff9",
    "many_places": "495058e6-87bd-59ae-a20d-bc2d291fff41",
    "bio_cultural": "db1fca08-0dcf-5910-a3df-2de902e8630a",
    "general_pattern": "6315aad7-35b7-52dc-9dd2-1b82d707a768",
    "search_ideas": "d2dc3119-7af8-55d8-8bfe-b63a4ec56acb",
    "schools": "712e4748-73c1-5809-8cbe-8fa0528b138b",
}

# slugs of the LiteratureBase records of the information-processing sources (batch 3). Fill in after the records are minted.
B3 = json.loads(Path(__file__).with_name("batch3_ids.json").read_text(encoding="utf-8")) if Path(__file__).with_name("batch3_ids.json").exists() else {}


def b3(key):
    return LB + B3[key] if key in B3 else None


thread1 = {
    "slug": "stone-tools-to-ai-technology-arc",
    "title": "From stone tools to AI: a tool changes as people copy it",
    "thread_type": "vertical_horizontal",
    "connectingIdea": "A tool changes as people copy it, and the people change as they use it. The same pattern of variation, copying and selection can be followed from the first stone tools through electronics to language models. It is an analogy with limits, and each station ends with its limit.",
    "narrative": (
        "Five steps, each carried by stages this space already has. Every claim is tagged. [Observed] means a source reports a measurement or an experiment. [Inferred] means the thread draws it from sources. [Proposed] means a framework offers it as a conjecture. "
        "Step 1, tools shape the maker and get copied: stone tools across species and across hominin species. Researchers disagree about how early teaching of toolmaking began. Morgan et al. (2015) report an experiment in which teaching and spoken language improved the transmission of Oldowan toolmaking [observed]. "
        "Tennie et al. (2017) argue that the earliest stone tools may have been reinvented one by one [proposed]. Students weigh both. "
        "Step 2, a tool changes as people copy it: designs drift, improve and split as they pass between makers. Basalla (1988) and Arthur (2009) describe technologies as built from earlier ones, so borrowing and recombination matter as much as descent, and a plain family tree can mislead [inferred]. "
        "Step 3, tools build science and science builds tools: electronics and sensors, from crystals and transistors to the chip in a classroom device, followed in the oSci project. "
        "Step 4, people and tools change together: niche construction and shared thinking, where tools reshape what people can do and learn. "
        "Step 5, machines join the loop. The machine culture framework (Brinkmann et al. 2023) proposes that machines change what varies, what spreads and what is chosen [proposed; the paper labels its own table tentative conjectures]. "
        "Three methods place language models in a family tree: by name (Gao and Gao 2023), by how similar their answers are (Yax et al. 2025) and by hand in a survey (Yang et al. 2024). "
        "A name tree shows resemblance of names. It does not show who was trained from whom. An output tree shows resemblance of answers. None of the three shows by itself that models descend from each other as organisms do [inferred]. "
        "The thread uses variation, transmission and selection as an analogy with named break points. It does not treat them as one shared mathematical model. "
        "It describes machines by their rules, data and ranking. It does not say that a machine wants, understands or intends anything. "
        "Every station also names the process it exercises (variation, transmission or selection) and the dimension of information it uses (1 a pattern without a sender, 2 systems that use information, 3 decentralized dynamics, after Eirdosh and Hanisch 2026). A second thread in this space, How information-processing systems evolve, follows information itself from cells to cultures to computers."
    ),
    "teachingPrompt": "Pick one tool you can hold or one language model you have used. Write down what it was copied from, what changed, who chose what stayed, and one way the picture of a branching tree would mislead. Mark each answer as checked in a source, believed, or unknown, and as observed, inferred or proposed.",
    "evidenceNote": "AI-drafted on 2026-11-03 from the Interdisciplinary stages listed, the oSci project (strands S5 and S6 and the pointers held in its file lpm/cross-space-bridges.yaml), the Teacher's Guide chapter on computer models, and the LiteratureBase records cited here. Every source record was read at abstract level only. The Guide's tree of language models comes from Yang et al., whose figure was not opened. No historian of technology, engineer, evolutionary anthropologist or teacher has reviewed any of it.",
    "gaps": [
        "No stage yet covers sensors in devices as a topic of its own. oSci sub-strand osci-s5-35 uses instruments and measurement.",
        "Step 1 has no counterpart in oSci, which starts at electricity.",
        "oSci's 13 to 16 band (osci-s5-1316, osci-s6-1316) has no matching stage in the Interdisciplinary model, which stops at 9 to 12.",
        "All source records were read at abstract level only. The record for Muthukrishna and Henrich (2016) says in its notes that a machine pipeline drafted it and that it is unreviewed.",
        "oSci has a draft concept lineage and borrowing. The Interdisciplinary space has no concept of that name, so there is nothing to compare yet. If one is added, compare the two definitions first.",
    ],
    "introduction": "Technology thread. One thread, From stone tools to AI, follows a tool that changes as people copy it through nine existing stages, from stone tools to language models. It is linked to the oSci project, whose strands on electronics and on machine culture hold the detail for steps 3 and 5. Every claim in it is tagged observed, inferred or proposed. The thread is a draft written by an AI. No expert has reviewed it.",
    "stations": [
        {"stage": S["cumulative"], "step": 1, "label": "Step 1, tools shape the maker and get copied", "concept": "Transmission",
         "role": "Stone tools across species and hominin species: what a tool asks of its maker, how toolmaking is taught and copied, and how small changes build up over generations. Two sources disagree on how early teaching began, and students weigh them: Morgan et al. (2015) [observed, an experiment with adults] and Tennie et al. (2017) [proposed]. Paige and Perreault (2024) compare the complexity of stone tool manufacturing sequences over 3.3 million years with what apes and naive toolmakers reach alone and conclude that hominins relied on cumulative culture by about 600,000 years ago [inferred]. Harmand et al. (2015) report stone artefacts from a site dated to 3.3 million years ago, and the dating and attribution have been questioned in print [observed, disputed]. Records that carry it: SpeciesBase feature stone-tool-technology, four TeachingBase resources, and the archaeology sources Shott (2011), Morgan et al. (2015), Tennie et al. (2017), Paige and Perreault (2024) and Harmand et al. (2015). Process: variation and transmission. Information: dimension 1, a flake pattern is a pattern without a sender. Limit of the analogy: a tool is copied by watching and teaching with many errors, and a gene is copied by a molecular process with a low error rate. Intention plays a part in one and none in the other.",
         "next": "Leads into the question of how a design drifts and splits once many makers copy it."},
        {"stage": S["tool_copied"], "step": 2, "label": "Step 2, a tool changes as people copy it", "concept": "Innovation",
         "role": "How a design changes as it passes between makers: improvements, mistakes, borrowing from other tools, replacement. Students find where a family tree fits and where a network of borrowing fits better [inferred from Basalla (1988) and Arthur (2009)]. In oSci this is the draft concept lineage and borrowing in sub-strand osci-s5-68. Process: variation and transmission. Information: dimension 2, a design carries what a maker can use. Limit of the analogy: designs are copied with intent and can be borrowed sideways between lines, so ancestry is a network.",
         "next": "Leads into tools that depend on science, and science that depends on tools."},
        {"stage": S["communities"], "step": 3, "label": "Step 3, tools build science and science builds tools (early)", "concept": "Technology",
         "role": "Grades 3 to 5: comparing communities and the tools they use, and how a tool changes over time. oSci builds on this stage from sub-strand osci-s5-35, Measuring With New Tools, which uses instruments and measurement. Process: selection of which things get measured. Information: dimension 1, a reading is a pattern read from nature. Limit of the analogy: a measuring tool reads a pattern and does not choose what is worth measuring.",
         "next": "Leads into the older-student treatment of technology and niche construction."},
        {"stage": S["culture_inst"], "step": 3, "label": "Step 3, tools build science and science builds tools (middle grades)", "concept": "Institutions",
         "role": "Grades 6 to 8: culture as transmitted and institutions as structures that keep practices going. oSci builds on it from sub-strand osci-s5-68, From Switch to Chip, where standards, integration and the chain from relay to chip show how a shared standard keeps a design in use. Process: selection by standards. Information: dimension 2, a standard is a code that both ends share. Limit of the analogy: standards are agreed by people and organizations on purpose, and no biological process agrees anything.",
         "next": "Leads into the older-student treatment of technology and niche construction."},
        {"stage": S["niche"], "step": 3, "label": "Step 3, tools build science and science builds tools (older students)", "concept": "Niche Construction",
         "role": "Grades 9 to 12, elective: biological and technological niche construction side by side. The oSci strand Tools That Change What We Can Know relates to it from sub-strand osci-s5-912, The Science-Technology Loop, where students trace a device such as a transistor or a camera sensor chip back to the science it applied and forward to the science it made possible. Sources: Moore (1965), Farmer and Lafond (2016) on rates of cost change, and Bloom et al. (2020) on the rising effort needed to keep Moore's law going. Sevilla et al. (2022) report that the training compute of 123 landmark machine learning systems doubled about every six months in the deep learning era [observed, from their list of systems], and Hooker (2021) argues that research ideas often win because they suit the hardware and software available [proposed]. Process: variation and selection by standards and markets. Information: dimension 2, signals and codes that devices share. Limit of the analogy: patents and standards shape what is copied, which has no counterpart in biological inheritance.",
         "next": "Leads into shared thinking and tools that change what groups can do."},
        {"stage": S["collective"], "step": 4, "label": "Step 4, people and tools change together", "concept": "Collective Intelligence",
         "role": "Grades 9 to 12, required: collective intelligence, distributed cognition and technology that coevolves with the people who use it. A student on the required track reaches this stage. Derex et al. (2013) report that larger groups kept more complex skills in a laboratory game [observed]. oSci relates to it from sub-strand osci-s6-912. Process: transmission and selection among many agents. Information: dimension 3, group results with no one steering. Limit of the analogy: tools and people change together, but only people hold goals.",
         "next": "Leads into the general pattern of selection across biology, culture, education and AI."},
        {"stage": S["selection"], "step": 5, "label": "Step 5, machines join the loop (selection)", "concept": "Selection",
         "role": "Grades 9 to 12: selection compared across biology, culture, education and AI. The oSci machine culture sub-strand osci-s6-912 contrasts with it on purpose, because it describes machines by rules, data and ranking. Process: selection. Information: dimension 2, a receiver, a code and what the receiver makes of a pattern. Limit of the analogy: selection in culture can work by choice, by a ranking rule or by chance, and the stage names where the sameness ends.",
         "next": "Leads into the machine culture bridge case."},
        {"stage": S["machine"], "step": 5, "label": "Step 5, machines join the loop (machine culture)", "concept": "Technology",
         "role": "Optional bridge case. AI systems are shaped by human-made data and goals and in turn shape what people learn and copy [proposed by Brinkmann et al. (2023), whose table is labelled tentative conjectures]. Three ways to place language models in a family tree are compared: by name (Gao and Gao 2023), by outputs (Yax et al. 2025) and by hand as in the survey tree the Teacher's Guide reproduces (Yang et al., journal version 2024, arXiv version 2023, which is the one the Guide cites). None shows by itself who was trained from whom [inferred]. Perez et al. (2024) offer a tool that simulates cultural change in groups of language-model agents [proposed, a preprint describing a framework]. Ren et al. (2024) propose from a theory of iterated learning that small biases grow when models learn from model-made text and test the prediction on several models [proposed and tested]. Acerbi and Stubbersfield (2023) report that a chat model favoured the same content types that people favour in retelling chains [observed]. oSci sub-strand osci-s6-912 refines it and the nested Machine Culture capstone project continues it. Process: variation, transmission and selection. Information: dimensions 2 and 3, models learn from text that people and other models wrote, and group results appear with no one steering. Limit of the analogy: a model can be merged from several parents or trained on text that other models wrote, so a branching tree can mislead.",
         "next": "Leads into what AI tools change in schools."},
        {"stage": S["education"], "step": 5, "label": "Step 5, machines join the loop (education)", "concept": "Innovation",
         "role": "What an AI writing or translation tool changes about what must be taught, what can be copied and who decides, with one benefit and one risk named. It closes the thread where it began, with tools that shape the people who use them. Doshi and Hauser (2024) report that writers given AI story ideas wrote stories judged more creative that were also more alike [observed, one experiment]. Process: selection by purpose and policy. Information: dimension 2, what a learner must hold in mind and what a tool holds for them (see the second thread). Limit of the analogy: a school decides what to teach on purpose, and no biological process does.",
         "next": None},
    ],
}

thread2 = None  # filled in by thread2_info.py after the information-processing sources exist
if (Path(__file__).with_name("thread2_info.py")).exists():
    ns = {"S": S, "b3": b3, "LB": LB, "B3": B3}
    exec(Path(__file__).with_name("thread2_info.py").read_text(encoding="utf-8"), ns)
    thread2 = ns["thread2"]

sources = [
    ("shott-2011", "Stone tools analysed with the tools of evolutionary biology."),
    ("basalla-1988", "The history of technology as variation and selection of artifacts."),
    ("arthur-2009-nature-of-technology", "Technologies as combinations of earlier technologies."),
    ("moore-1965-cramming-components", "The rate of change in integrated circuits."),
    ("brinkmann-2023", "Machine culture: how machines change variation, transmission and selection."),
    ("rahwan-2019-machine-behaviour", "Studying machine behaviour as a scientific object."),
    ("yang-et-al-2024", "The survey whose tree of language models the Teacher's Guide reproduces."),
    ("gao-gao-2023", "A tree of nearly 16,000 language models built from model names."),
    ("yax-oudeyer-palminteri-2025", "Trees of language models inferred from their outputs."),
    ("perez-et-al-2024", "Simulating cultural evolution among language-model agents."),
    ("morgan-et-al-2015", "An experiment on teaching, language and the transmission of stone toolmaking."),
    ("tennie-et-al-2017", "The case that early stone tools may have been reinvented one by one."),
    ("paige-perreault-2024", "Stone tool complexity over 3.3 million years and the start of cumulative culture."),
    ("harmand-et-al-2015", "Stone artefacts dated to 3.3 million years ago, with a disputed dating."),
    ("sevilla-et-al-2022", "Training compute of landmark machine learning systems over time."),
    ("hooker-2021", "Research ideas that win because they suit the available hardware."),
    ("derex-et-al-2013", "An experiment on group size and the complexity of skills kept."),
    ("farmer-lafond-2016", "Rates of fall in the cost of technologies."),
    ("bloom-et-al-2020", "The rising research effort behind Moore's law."),
    ("acerbi-stubbersfield-2023", "A chat model shows the content biases people show in retelling chains."),
    ("ren-et-al-2024", "Bias growth when models learn from model-made text."),
    ("doshi-hauser-2024", "AI story ideas raised creativity of single stories and lowered variety."),
    ("muthukrishna-2016", "Innovation in the collective brain."),
]
if thread2:
    sources += [(k, v) for k, v in thread2.get("sources", [])]

data = {"project_slug": "interdisciplinary-lpm-synth", "threads": [t for t in (thread1, thread2) if t],
        "sources": [{"id": LB + k if not k.startswith(LB) else k, "supports": v} for k, v in sources]}
if thread2:
    thread2.pop("sources", None)
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"wrote {OUT.name}: {len(data['threads'])} thread(s), {len(data['sources'])} sources")
