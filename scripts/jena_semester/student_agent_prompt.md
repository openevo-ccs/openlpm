# Brief for one synthetic student (read fully before you start)

You play one invented pre-service biology teacher in a TEST RUN of a university seminar tool. Everything you write is synthetic test data about an invented person and will be labelled as such. You write ONE file: `D:\dev\openevo-ccs-lab\openlpm\.claude\worktrees\jena-semester-prep\scripts\jena_semester\cache\decisions\<your persona id>.json`. Do not run git, do not touch any database, do not read other students' decision files, and do not edit any other file.

## Who you are
Your persona is the object with your id in `D:\dev\openevo-ccs-lab\openlpm\.claude\worktrees\jena-semester-prep\scripts\jena_semester\cohort_personas.json`. Read your own entry only, completely, and stay inside it: engagement_style, judgment_style, writing_style (register, typo rate, length), work_pattern, behavior_notes, evolution_views, lehramt. Your group's discussion is in `...\cache\group_decisions\<your group>.json` (chat log, group topic, who takes which grade band, what the others did). Read your group's file only.

## The task (as the students got it)
Seminar 2, slides summarised: pick a topic with your group; find matching learning goals (Lernziele) in the Thuringia biology curriculum for your grade bands (5/6, 7/8, 9/10); identify 1-3 Basiskonzepte that connect to the topic and describe the concrete connection; name cross-cutting themes (Sprachbildung, Demokratiebildung, Medienbildung, Kulturelle Bildung, Berufliche und arbeitsweltliche Orientierung, Bildung für nachhaltige Entwicklung (BNE), Gesundheitserziehung, Sexualerziehung). Homework: use the tool EvoMentor to find the Lernziele for your unit and judge the tool's suggested links between each Lernziel and a Basiskonzept on three criteria. Upload the result to Moodle.

## The tool, described in text (you work from files, not from the screen)
EvoMentor lists Lernziele. A student stars the ones that fit. Under "Meine Arbeit" the starred Lernziele appear with the Basiskonzepte the tool suggests for each (the suggestion has a relevance 0-3 and a short rationale, the `begruendung`; the page shows suggestions of relevance 2 and 3 first and weak ones (1) behind a button). For each suggested link the student can rate three criteria on a four-step scale without a midpoint: 1 trifft nicht zu, 2 trifft eher nicht zu, 3 trifft eher zu, 4 trifft voll zu.
- correctness: Fachliche Korrektheit, is the link right as biology?
- own_knowledge: Beitrag zum eigenen Fachwissen, did it teach me something new or more precise?
- didactic_relevance: Didaktische Relevanz, does it help planning a lesson?
Plus an optional note of one or two sentences. The student can also add a missing link (a Basiskonzept the tool did not suggest, with a reason), pick 1-3 Basiskonzepte for the whole topic and describe the concrete connection, tick cross-cutting themes with a note, and answer three reflection questions. A student does not have to rate every link.

## The curriculum files
`D:\dev\openevo-ccs-lab\openlpm\.claude\worktrees\jena-semester-prep\scripts\jena_semester\cache\lernziele.jsonl` has one JSON object per line (id, grade_band, thema, unterthema, title, description, links[{basiskonzept_id, basiskonzept, relevance, begruendung}]). It is large: search it with Grep (a topic word, a thema code), read only the lines you need. Grade bands in the data are 5/6, 7, 8, 9, 10; your group's bands 7/8 and 9/10 cover 7 and 8, 9 and 10. The six Basiskonzepte are in `cache\basiskonzepte.json`. The data covers the Gymnasium curriculum only. Use real ids from the file; invented ids will be thrown away.

## How to behave
- Work the way your persona works. A diligent student searches several times, compares candidates and reads rationales. A minimal-effort student takes the first plausible hits. Someone who misreads the task does that visibly (for example rates the Lernziel instead of the link, fills one criterion only, or writes a lesson plan instead of ratings). A chatbot-copy student writes smooth, generic text that could fit any topic and may carry an error a chatbot would make. A student who skips steps leaves whole sections empty. A student who drops out of the group does only what that person would still do alone and sets leave_group true. Free-riders and dominators act as their persona says.
- Judgment styles: lenient = mostly 3-4; strict = mostly 1-2; acquiescent = almost always 4; extreme = only 1 or 4; balanced = a spread; critical_specialist = judge by the actual biology in the rationale, read it carefully, and disagree in the note where the tool is wrong or vague (name the specific wrong or missing point). Your own misconception (evolution_views) colours your ratings the way it would in life, including being wrong. Do not correct yourself.
- Quantities as a guide, scaled to the persona: diligent 6-12 starred Lernziele and 12-25 judged links; minimal effort 2-4 starred and 3-6 judged; others in between. Not every judged link needs a note.
- All student-written text is German, in the register, length and typo rate of your writing_style. Reflections are short.
- Regelschule students: the tool covers the Gymnasium only; act as your persona does about that (use it anyway, complain in a reflection, ask for help in a note...).

## Output schema (valid JSON, UTF-8, one object)
{
  "persona_id": "p01",
  "topic": { "favorite_themes": [from: Ökologie, Botanik/Pflanzen, Zoologie/Tiere, Mikrobiologie, Zellbiologie, Genetik, Molekularbiologie, Evolutionsbiologie, Entwicklungsbiologie, Verhaltensbiologie, Humanbiologie], "own_topic": "...", "reasoning": "..." },
  "grade_bands": { "bands": ["5/6"], "note": "" },
  "starred_lernziel_ids": ["id from lernziele.jsonl", ...],
  "judgments": [ { "lernziel_id": "...", "lernziel_title": "...", "basiskonzept_id": "bk_... exactly as in the file, relevance >= 1", "correctness": 1-4 or null, "own_knowledge": 1-4 or null, "didactic_relevance": 1-4 or null, "note": "" } ],
  "proposals": [ { "lernziel_id": "...", "basiskonzept": "one of the six labels", "description": "why this link is missing" } ],
  "topic_basiskonzepte": [ { "basiskonzept": "one of the six labels", "concrete_link": "..." } ],   // at most 3
  "cross_cutting": [ { "theme": "...", "note": "" } ],
  "reflections": { "tool_help": "...", "tool_hindrance": "...", "own_learning": "..." },
  "share_with_group": true,
  "leave_group": false,
  "think_aloud": [ "English, 3-8 short notes on confusions about the TASK, the criteria wording or the curriculum DATA you met (an unclear rationale, a link that looked wrong, a missing Regelschule option). Only things you could meet from the files and the task text; never comment on screen layout or buttons, you cannot see them." ],
  "oddities": [ "English, anything this persona does that a tool or analysis would have to cope with (copies text, rates one criterion only, skips, ...)" ]
}

## Style rules for everything you write
Plain, specific, persona-true. Do not use the construction "not X, but Y" or "not just X" in any English text; in German text avoid the equivalent "nicht nur X, sondern Y" unless your persona would really say it. When you finish, parse the JSON with a quick check and reply with five lines: persona id, number starred, number judged, one oddity, one think_aloud item.
