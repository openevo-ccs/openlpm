# Second thread: the evolution of information-processing systems. Executed by build_technology_arc_thread_json.py (names S, b3, LB are provided).
# Every claim is tagged [observed], [inferred] or [proposed]. Each station ends with the limit of what it compares. AI-drafted, no expert review.

thread2 = {
    "slug": "information-processing-systems-evolution",
    "title": "How information-processing systems evolve: from cells to cultures to computers",
    "thread_type": "vertical_horizontal",
    "connectingIdea": "Systems that take in, store and use information come in three forms: natural systems such as cells, nervous systems and animal signals; the human mind with its limits and the cultural systems built around it, such as language and schools; and cultural and computational systems such as networks and language models. Each form has its own sense of information, and the thread names where the senses differ.",
    "narrative": (
        "Three forms in one thread, each carried by stages this space already has. Claims are tagged. [Observed] means a source reports an experiment or a simulation. [Inferred] means the thread or a review draws it from studies. [Proposed] means an author offers it as an argument or a framework. "
        "Natural systems. Animals pick up and use patterns, and living things pass on information by genes and by learning. Szathmáry and Maynard Smith (1995) argue that major evolutionary transitions changed how information is stored and transmitted [proposed]. Walker and Davies (2013) propose that life began when information gained causal power over the matter that carries it [proposed]. "
        "Human information architecture. John Sweller's cognitive load theory starts from the finding that working memory is limited and that novices learn less from open problem solving than from tasks that leave room to build schemas (Sweller 1988) [observed in experiments]. "
        "Castro-Alonso, Hidalgo and Sweller (2024) argue that biological evolution and human cognition follow the same five principles of natural information-processing systems: randomness as genesis, borrowing and reorganizing, narrow limits of change, an information store, and environmental organizing and linking [proposed]. "
        "For biologically secondary knowledge, the kind taught in schools, they say instructional prescriptions follow [proposed]. Geary (2008) separates what children pick up easily from what needs deliberate teaching, which bears on how methods fit age. "
        "Csibra and Gergely (2009) describe human communication as adapted to pass on general knowledge, with infants responding to signals that show they are being addressed [proposed]. Kirschner, Sweller and Clark (2006) argue that guided instruction fits this architecture better than minimal guidance. That argument is contested in the field. "
        "Cultural and computational systems. Agüera y Arcas (2025) argues that life is computation and that prediction is basic to intelligence [proposed, the author's argument]. Agüera y Arcas and colleagues (2024) report that self-replicating programs tend to emerge when random programs interact in simple simulated worlds [observed in simulations, a preprint]. "
        "Skulmowski (2023) reviews how offloading memory to digital tools can harm learning [inferred from studies]. Qian and colleagues (2026) review 39 studies of generative AI and cognitive load and find mostly university samples, so the evidence cannot yet guide school-age methods [inferred]. "
        "Each form keeps its own sense of information. Computational-Core counts bits against a stated set of messages, Bio-Core keeps the narrow view without meaning, Social-Core follows records and trust, and this space bridges them (Eirdosh and Hanisch 2026). The thread never says information works the same in every system. It describes machines by their rules, data and ranking and gives them no wishes."
    ),
    "teachingPrompt": "Choose one system that takes in information: a cell, an animal, a child, a school, a network or a language model. Say what it takes in, what it keeps, what limits how much it can handle at once, and who or what shaped those limits. Mark each answer observed, inferred or proposed, and say which sense of information you used.",
    "evidenceNote": "AI-drafted on 2026-11-03 from the Interdisciplinary stages listed, the LiteratureBase records cited here, and the information design of the four synthetic spaces (Eirdosh and Hanisch 2026). Every source record was read at abstract level only, and the 2003 chapter by Sweller was not seen at all (it is described secondhand through later papers). No expert in cognitive load theory, evolutionary biology, computer science or teaching has reviewed any of it.",
    "gaps": [
        "The abstract of Sweller (2003), the chapter that set out the evolutionary account, was not seen. The five principles come from Castro-Alonso et al. (2024) and Kalyuga (2023).",
        "No source on culturally relevant teaching with a cultural-evolution frame has been found yet. The search returned Samuelsson (2023) and Caldwell and colleagues (2017) only.",
        "What Is Life? and What Is Intelligence? are the author's argument. The publisher pages were not seen.",
        "The evidence on generative AI and cognitive load is mostly from university students.",
        "Bio-Core, Social-Core and Computational-Core each have their own thread on information. This thread belongs to the Interdisciplinary space and keeps their senses of the word apart.",
    ],
    "introduction": "Information-processing thread. A second thread, How information-processing systems evolve, follows natural systems, the human mind with its limits and the cultures built around it, and computers and language models through ten existing stages. It uses cognitive load theory and work on life as computation, with each claim tagged observed, inferred or proposed. It is a draft written by an AI. No expert has reviewed it.",
    "stations": [
        {"stage": S["who_show"], "step": 1, "label": "Human architecture, K-2: showing and being shown", "concept": "Teaching",
         "role": "Young children watch how people show them things. Csibra and Gergely (2009) describe human communication as adapted to pass on general knowledge, with infants responding to signals that show they are being addressed [proposed]. Method point: direct showing and naming matches how very young children are described as learning. Limit: one account built from infant studies. Teaching cues differ between communities, so a teacher checks the fit with the children's own community.",
         "next": "Leads into how other living things pick up and use information."},
        {"stage": S["living_things"], "step": 2, "label": "Natural systems, grades 3 to 5: what a living thing can take in", "concept": "Information",
         "role": "Students compare what a bee, a dog, an insect-eating bat, a child and a camera can pick up. Each takes in some patterns and not others. Limit: a camera records a pattern and does not use it the way a receiver that responds does, so the senses of the word differ and the stage names where.",
         "next": "Leads into how people learn in many settings."},
        {"stage": S["many_places"], "step": 3, "label": "Human architecture, grades 3 to 5: many places to learn", "concept": "Learning",
         "role": "Learning at home, at work and in school, with apprenticeship and guided participation. Geary (2008) separates what children pick up easily from what needs deliberate teaching [proposed]. Samuelsson (2023) synthesizes work on children's learning biases in play and exploration and argues early education should use them [proposed, a single-author synthesis]. Method point: for the youngest grades, play and exploration. Later, deliberate teaching of school knowledge. Limit: the sources are mostly about children's evolved biases and say less about how communities differ.",
         "next": "Leads into two ways of keeping and passing on information."},
        {"stage": S["bio_cultural"], "step": 4, "label": "Natural and cultural stores, grades 3 to 5: genes and shared rules", "concept": "Transmission",
         "role": "Eye colour passed from parent to child and the rules of a game passed from player to player are set side by side. Szathmáry and Maynard Smith (1995) argue that major evolutionary transitions changed how information is stored and transmitted [proposed]. Limit: genes are copied with a low error rate by a molecular process, and rules are copied with many changes by people who can choose.",
         "next": "Leads into information as an answer to questions."},
        {"stage": S["general_pattern"], "step": 5, "label": "Information as a count, grades 6 to 8", "concept": "Information",
         "role": "Students find a hidden pick among 2, 4 and 8 equally likely options with yes-or-no questions and see that each question halves the options. This is the Computational-Core sense: bits count against a stated set of messages (Shannon 1948). Limit: the count says nothing about meaning or truth, and the Bio-Core and Social-Core senses differ.",
         "next": "Leads into the limits on how much a system can change at once."},
        {"stage": S["search_ideas"], "step": 6, "label": "Narrow limits of change, grades 6 to 8", "concept": "Metacognition",
         "role": "How minds and cultures search for better ideas by small steps. Castro-Alonso et al. (2024) list narrow limits of change among five principles shared by biological evolution and human cognition [proposed]. Limit: the five principles are an analogy argued by cognitive load researchers. They are not one tested model of both systems.",
         "next": "Leads into schools as built information systems."},
        {"stage": S["schools"], "step": 7, "label": "Human architecture, grades 6 to 8: why societies build schools", "concept": "Institutions",
         "role": "Schools as cultural systems that carry knowledge a child would not pick up alone. Sweller (1988) found in experiments that open problem solving uses up the working memory that novices need to build schemas [observed]. Kirschner, Sweller and Clark (2006) argue from this for guided instruction [proposed, contested]. Method point: teachers weigh guidance against exploration by age and by topic. Limit: the experiments are mostly with adults and short tasks, and communities differ in what they ask schools to do.",
         "next": "Leads into decentralized information processing."},
        {"stage": S["collective"], "step": 8, "label": "Cultural and computational systems, grades 9 to 12: decentralized dynamics", "concept": "Collective Intelligence",
         "role": "Group results with no one steering. Agüera y Arcas and colleagues (2024) report that self-replicating programs tend to emerge when random programs interact in simple simulated worlds [observed in simulations, a preprint]. Evans, Bratton and Agüera y Arcas (2026) argue that intelligence is plural and social [proposed, a preprint]. Limit: a simulation of programs is an analogy for life and for culture, and the authors' framing is an argument.",
         "next": "Leads into machines as part of the loop."},
        {"stage": S["machine"], "step": 9, "label": "Cultural and computational systems, grades 9 to 12: machines in the loop", "concept": "Technology",
         "role": "Optional bridge case. Agüera y Arcas (2025) argues in What Is Life? that life is computation and in What Is Intelligence? that prediction is basic to intelligence [proposed, the author's argument]. Brinkmann et al. (2023) propose how machines change what varies, spreads and is chosen [proposed]. Students keep each source's claim apart from observed results. Limit: a book argument is not an experiment, and the thread describes machines by rules, data and ranking.",
         "next": "Leads into what AI tools change for learners."},
        {"stage": S["education"], "step": 10, "label": "Human architecture meets computation, grades 9 to 12: tools and cognitive load", "concept": "Innovation",
         "role": "What an AI tool changes about what a learner must keep in mind. Skulmowski (2023) reviews how offloading memory to digital tools can harm learning when it replaces storing knowledge [inferred from studies]. Qian and colleagues (2026) review 39 studies of generative AI and cognitive load, mostly with university students, and find mixed results [inferred]. Method point: say what must be stored in the student's own memory. Limit: the evidence base cannot yet guide school-age choices.",
         "next": None},
    ],
    "sources": [
        ("sweller1988", "Cognitive load during problem solving."),
        ("sweller2003", "Evolution of human cognitive architecture (abstract not seen)."),
        ("sweller2011", "The book-length statement of cognitive load theory."),
        ("castro2024", "Biological evolution and human cognition as analogous information-processing systems."),
        ("kalyuga2023", "Evolutionary perspective on human cognitive architecture."),
        ("geary2008", "Biologically primary and secondary knowledge and school learning."),
        ("life2025", "What Is Life? Evolution as Computation."),
        ("intelligence2025", "What Is Intelligence?"),
        ("complife2024", "Self-replicating programs emerging from simple interaction (preprint)."),
        ("evans2026", "Intelligence as plural and social (preprint)."),
        ("szathmary1995", "Major evolutionary transitions and the storage of information."),
        ("walker2013", "The algorithmic origins of life."),
        ("samuelsson2023", "Play, learning and cultural-evolutionary insights for early education."),
        ("skulmowski2023", "Digital externalization and learning."),
        ("qian2026", "Generative AI and cognitive load: a review of 39 studies."),
        ("kirschner2006", "Guidance during instruction (contested)."),
        ("csibra2009", "Natural pedagogy."),
        ("eirdosh2026", "Information as an interdisciplinary concept."),
    ],
}
# name the dimension of information (after Eirdosh and Hanisch 2026) that each station uses: 1 a pattern without a sender, 2 systems that use information, 3 decentralized dynamics
_DIM = {1: "2", 2: "1 and 2", 3: "2", 4: "1 and 2", 5: "1", 6: "2", 7: "2", 8: "3", 9: "2 and 3", 10: "2"}
for _st in thread2["stations"]:
    _st["role"] = _st["role"].replace(" Limit:", f" Information: dimension {_DIM[_st['step']]}. Limit:", 1)
# resolve the source keys to LiteratureBase slugs
thread2["sources"] = [(B3[k], v) for k, v in thread2["sources"] if k in B3]
