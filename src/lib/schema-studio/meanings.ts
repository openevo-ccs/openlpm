// Plain-language explanations for the Schema Studio. Written for people who use the repositories and never read a schema file.
// Anything not covered here (a new record type, a new field) gets an automatic explanation built from its name, type and the
// description in the schema file, so the Studio never shows a blank where something was added.

import type { FieldDef } from './types'
import type { FlatField, Model, TypeNode } from './model'

export interface RepoMeaning { what: string; forWhom: string; question: string; source?: string }

export const REPO_MEANING: Record<string, RepoMeaning> = {
  concept: { what: 'The shared dictionary of curriculum ideas. It holds concepts (one idea, defined in one vocabulary), learning progression models (maps of how understanding of a set of ideas grows across grades), strands, learning goals, and statements of how outside frameworks line up with each other.', forWhom: 'Curriculum designers, researchers comparing frameworks, and every tool that needs to say which idea a lesson or goal is about.', question: 'Which frameworks talk about "adaptation", and how do their meanings relate?' },
  competency: { what: 'The abilities learners are expected to build, taken from frameworks such as DigComp, UNESCO and KMK. Each competency has a stable id, its own wording, a level, and links to the concepts, theories and methods around it.', forWhom: 'Teacher educators, assessment designers and anyone mapping a curriculum to a competency framework.', question: 'Which competencies from different frameworks ask for the same thing?' },
  teaching: { what: 'Teaching materials such as lesson plans, computer models and assessment tools, with the parts inside each one, their images and files, and what rights apply.', forWhom: 'Teachers looking for material, and developers connecting material to concepts and goals.', question: 'Which resources teach this concept at this grade?' },
  project: { what: 'Research and development projects: who takes part, what they read, which theories guide them, who funds them, and which curriculum material they produce.', forWhom: 'Project leads and funders who need to see how a project connects to the rest of the knowledge base.', question: 'Which projects built on this theory?' },
  theory: { what: 'What experts believe and argue. Theories are broken into claims (propositions) and assumptions, compared where they disagree, and turned into design principles and curriculum decisions.', forWhom: 'Researchers and curriculum designers who need to say which theory a design choice rests on.', question: 'Which claims do two theories disagree about, and what follows for teaching?' },
  question: { what: 'Open questions: what is still unknown or disputed, how a study could answer it, and which theories, methods and sources it touches.', forWhom: 'Researchers planning studies and teams deciding what to look into next.', question: 'Which open questions need a longitudinal study?' },
  methods: { what: 'Ways of teaching and ways of doing research, such as inquiry-based learning or design-based research, with their steps and advice on when to use them.', forWhom: 'Teachers choosing an approach and researchers describing how a study was done.', question: 'Which method suits a first encounter with a new idea?' },
  literature: { what: 'Who wrote what, where and when. This is the one place for citation facts. Other repositories link to a record here and never copy the citation.', forWhom: 'Everyone who cites a source.', question: 'Which sources support this claim?' },
  quote: { what: 'Verified quotations with their source and the setting they come from, tagged to the ideas, theories and questions they illustrate.', forWhom: 'Authors of teaching material and reports who want an exact, checked wording.', question: 'Which verified quotations illustrate cooperation?' },
  species: { what: 'A comparative biology knowledge base: species and groups, their features, and layered explanations of why a feature exists (cause, development, history, function).', forWhom: 'Biology educators and anyone building cross-species comparisons.', question: 'Which species show this feature, and how is it explained?' },
  ccsgraph: { what: 'A map of Computational Curriculum Studies as a research field: its measures, curriculum theories, people and literature, and how they relate.', forWhom: 'Researchers entering the field.', question: 'Which measure fits which curriculum question?' },
  deutschelp: { what: 'A working layer for German curriculum policy: official mandates, the institutions involved, timelines, coherence findings and proposed redesigns.', forWhom: 'Policy analysts and curriculum developers working with German Länder curricula.', question: 'Which Länder require cross-subject work, and since when?' },
}

export const CORE_MEANING = { what: 'The shared foundation under every base repository. It holds the common vocabulary (the classes that every record type belongs to), the id scheme (OE-TYPE-slug), the status lifecycle (proposed, accepted, stable, deprecated, superseded, retracted) and the rules for changing schemas. It holds no records.', forWhom: 'Anyone proposing a new record type or a change that touches more than one repository.' }

export interface TypeMeaning { one: string; example?: string }
export const TYPE_MEANING: Record<string, TypeMeaning> = {
  'concept/concept': { one: 'One curriculum idea, with its labels, definitions, examples and non-examples, defined inside one vocabulary.', example: '"Natural selection" as defined in the BIO-CORE vocabulary.' },
  'concept/lpm': { one: 'A learning progression model: a map of how understanding of a set of ideas grows from grade to grade.', example: 'A K-12 model of how evolution is understood.' },
  'concept/strand': { one: 'One thread of an LPM: a big idea followed across grade bands, with its concepts and performance indicators.', example: 'The strand "Variation and inheritance".' },
  'concept/learningObject': { one: 'A teachable unit, such as a learning goal or activity, attached to strands and concepts.', example: 'A goal for grades 3-5 about family resemblance.' },
  'concept/alignment': { one: 'A statement that two concepts from different frameworks mean the same thing or a close thing, with who said so and why.', example: '"Adaptation" in one framework matches "adaptation (biology)" here.' },
  'concept/frameworkRelation': { one: 'A relation between two items of an outside framework, such as "is part of" or "builds on".' },
  'concept/competency': { one: 'A competency as the concept dictionary holds it, with its statement, level and relations. CompetencyBase is the governed home for competencies.' },
  'competency/competency-record': { one: 'One competency: what a learner should be able to do, taken from a named framework, with its level, indicators and links to related concepts, theories and methods.', example: 'A digital competence for teachers at level 3.' },
  'teaching/resource-record': { one: 'One teaching material, described by what it teaches, for whom, in which languages, and where it came from.', example: 'A lesson plan on food webs for grades 5-6.' },
  'teaching/graph-record': { one: 'What is inside one teaching resource: its reusable parts, media and files, links to concepts, and the rights that apply to each.' },
  'project/project-record': { one: 'One project: its people, funding, timeline, theoretical framing, the literature it uses and produces, and the curriculum material it creates.', example: 'A teacher-education project on coherence.' },
  'theory/theory-record': { one: 'One theory: its claims, assumptions, scope and the people who hold it.', example: 'A theory of cultural evolution.' },
  'theory/theory-bundle-record': { one: 'A reusable set of theories (and assumptions) that together make up a curriculum philosophy.' },
  'theory/proposition-record': { one: 'One claim inside a theory, with a note on the quality of the evidence. The same record shape also holds assumptions (premises taken as given) and competing claims.', example: '"Cumulative culture needs high-fidelity social learning."' },
  'theory/divergence-record': { one: 'A side-by-side comparison of two theories on one point where they disagree, with a note on what the disagreement is really about.' },
  'theory/hypothesis-record': { one: 'A claim that a study could test and show wrong, with the evidence gathered so far.' },
  'theory/mechanism-record': { one: 'A cause-and-effect link between two constructs, with its strength and a note on who it depends on.' },
  'theory/cross-domain-construct-record': { one: 'An idea that shows up in several fields (biology, culture, computing, language), with each field\'s version of it.', example: 'Selection in biology, culture and machine learning.' },
  'theory/misconception-record': { one: 'A documented pattern of wrong thinking among learners, with an example statement, the claims it affects and the grade bands where it shows up.', example: '"Giraffes grew long necks because they needed to reach leaves."' },
  'theory/learning-dependency-record': { one: 'A claim that one concept needs another first, or strengthens it, according to a named theory.' },
  'theory/design-principle-record': { one: 'A recommendation for teaching that follows from one or more theories. It links what a theory says to what a curriculum does.' },
  'theory/curriculum-decision-record': { one: 'A concrete design choice in a curriculum, with the principle that justifies it, the theory it grounds in, and the strand where it appears.' },
  'question/question-record': { one: 'One open question: what is uncertain or disputed, how it could be studied, and what it depends on.', example: 'Does returning to an idea at higher levels improve transfer?' },
  'methods/method-record': { one: 'One method of teaching or research, with its steps, when to use it, and the theory and sources behind it.', example: 'Inquiry-based learning.' },
  'literature/literature-record': { one: 'One work (article, book, report): authors, year, venue, identifiers, licence, a plain-language summary, and typed links to related works.' },
  'quote/quote-record': { one: 'One verified quotation: the exact words, who said them, the source and setting, and the ideas it illustrates.' },
  'species/taxon': { one: 'A stable handle for one lineage of living things, with no scientific name attached. Names live in separate records so they can change.' },
  'species/taxonomic_concept': { one: 'One authority\'s view of what a taxon includes: rank, parent and an external record.' },
  'species/lexical_form': { one: 'A name for a taxon, either a scientific name or an everyday name, in one language.' },
  'species/language': { one: 'A language entry in the controlled list used for names and labels.' },
  'species/cultural_category': { one: 'A category people use in daily life or in school ("fish", "Säugetier") mapped to taxa.' },
  'species/feature': { one: 'An abstract characteristic, process, capacity or behaviour, in English and German.', example: 'Cooperative breeding.' },
  'species/feature_expression': { one: 'How a feature shows up in one taxon, with the evidence.' },
  'species/context': { one: 'A reusable setting (ecological, social, developmental or population) in which a feature is found.' },
  'species/explanation': { one: 'A layered explanation of why a feature exists, covering causes, development, history and function.' },
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------------------------------------------------------------
const FIELD_MEANING: Record<string, string> = {
  id: 'The permanent name of this record. Other records use it to point here, so it never changes.',
  slug: 'A short, readable name used in file names and addresses.',
  label: 'The name people see for this record.',
  title: 'The title of the item.',
  description: 'A short explanation of the record in everyday words.',
  statement: 'The wording of the record itself: the claim, goal, question or statement it stands for.',
  status: 'Where the record is in its life: proposed, accepted, stable, or retired.',
  version: 'The version number of the record, so changes can be traced.',
  provenance: 'Who wrote the record, when, how (a person, an AI, or both), and how far it has been reviewed.',
  provisional: 'Marks a record that still carries a temporary name or id and is waiting for a permanent one.',
  supersededby: 'Points to the record that replaces this one.',
  primarysources: 'The sources this record rests on, each with the exact place in the source.',
  relatedliterature: 'Links to works in LiteratureBase that support or discuss this record.',
  relatedquestions: 'Links to open questions in QuestionBase that this record raises or answers.',
  relatedcompetencies: 'Links to competencies in CompetencyBase that this record connects to.',
  relatedconcepts: 'Links to concepts in ConceptBase that this record is about.',
  relatedmethods: 'Links to methods in MethodsBase that apply here.',
  relatedtheory: 'Links to theories in TheoryBase behind this record.',
  relatedtheories: 'Links to theories in TheoryBase behind this record.',
  domains: 'The fields of knowledge this record belongs to.',
  language: 'The language the text is written in.',
  tags: 'Free labels that help people find the record.',
  aliases: 'Other names that people use for the same thing.',
  notes: 'Free notes from the person who wrote the record.',
  citation: 'The bibliographic facts of the work: authors, title, year, venue and identifiers.',
  license: 'The licence that says how the content may be reused.',
  review_status: 'How far a person has checked the record: author draft, peer nominated, community reviewed, or expert validated.',
  extracted_by: 'Who produced the record: a person, an AI, or both together.',
  date: 'The date the record was written or last changed.',
  members: 'The people or items that belong to this group.',
  heldby: 'The people or groups who hold this theory.',
  scope: 'What the theory covers and what it leaves out.',
  propositions: 'The individual claims that make up this theory.',
  assumptions: 'The premises the theory takes as given.',
  humancodingscheme: 'The official code of this item in its source framework, as people write it.',
  educationlevel: 'The school level or grade band the record is meant for.',
  broader: 'Points to a more general item above this one.',
  narrower: 'Points to more specific items below this one.',
  indicators: 'Observable signs that a learner has reached the goal.',
  measuredby: 'The methods or tools that can measure it.',
  pedagogicalapproaches: 'The teaching approaches that suit it.',
}

export function friendlyType(f: FieldDef): string {
  const t = f.type
  const map: Record<string, string> = {
    text: 'text', 'list of text': 'a list of text items', choice: 'one choice from a fixed list', 'list of choice': 'a list of choices from a fixed list', 'group of fields': 'a group of sub-fields', 'list of group of fields': 'a list of sub-field groups',
    date: 'a date', 'date and time': 'a date and time', 'web address': 'a web address', 'whole number': 'a whole number', number: 'a number', 'yes / no': 'yes or no', 'fixed value': 'one fixed value', any: 'any value',
  }
  return map[t] ?? t
}

export interface FieldExplanation { plain: string; source: 'curated' | 'schema' | 'auto' }

export function explainField(f: FlatField, m: Model): FieldExplanation {
  const name = f.field.name
  const key = f.key
  const curated = FIELD_MEANING[key]
  const targets = [...new Set(f.links.map((e) => (e.to.repo ? m.repoByKey.get(e.to.repo)?.name ?? (e.to.repo === 'humanbase' ? 'HumanBase (retired)' : e.to.repo) : null)).filter(Boolean))] as string[]
  let plain = ''
  if (curated) plain = curated
  else if (f.field.description) plain = f.field.description.length > 220 ? f.field.description.slice(0, 217).replace(/\s+\S*$/, '') + '...' : f.field.description
  const src: FieldExplanation['source'] = curated ? 'curated' : f.field.description ? 'schema' : 'auto'
  if (!plain) {
    const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
    if (targets.length) plain = `Links to ${targets.join(' or ')} records (${words}).`
    else if (f.field.enum?.length) plain = `One choice about the record's ${words}.`
    else if (f.field.children?.length) plain = `A group of details about the record's ${words}.`
    else plain = `The record's ${words}.`
  }
  if (targets.length && !/link|point/i.test(plain)) plain += ` Points at ${targets.join(' or ')}.`
  return { plain, source: src }
}

export function explainType(t: TypeNode, m: Model): { one: string; example?: string; curated: boolean } {
  const c = TYPE_MEANING[t.id]
  if (c) return { ...c, curated: true }
  const core = m.snap.core?.ontology?.classes.find((x) => x.label.toLowerCase().replace(/[^a-z]/g, '') === t.def.name.toLowerCase().replace(/[^a-z]/g, '').replace(/record$/, ''))
  const d = (core?.definition || t.def.description || '').replace(/\s+/g, ' ')
  const one = d ? (d.length > 260 ? d.slice(0, 257).replace(/\s+\S*$/, '') + '...' : d) : `A record in ${t.repo.name} with ${t.fieldCount} fields.`
  return { one, curated: false }
}

export function ontologyFor(t: TypeNode, m: Model) {
  const want = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const names = [want(t.def.name).replace(/record$/, ''), want(t.title)]
  return m.snap.core?.ontology?.classes.find((c) => names.includes(want(c.label)))
}

// Terms the Studio uses, for the Guide panel.
export const GLOSSARY: { term: string; plain: string }[] = [
  { term: 'Base repository', plain: 'A shared, governed collection of one kind of record (theories, literature, competencies and so on). Other repositories point to its records instead of copying them.' },
  { term: 'Schema', plain: 'The blueprint for one kind of record: which fields it has, what each may hold, and which are required.' },
  { term: 'Record type', plain: 'One kind of record in a repository. TheoryBase has eleven, for example Theory, Proposition and Misconception.' },
  { term: 'Field', plain: 'One piece of information in a record, such as its label or its list of sources.' },
  { term: 'PK (permanent id)', plain: 'The field that names the record for good. Links from other records use it.' },
  { term: 'FK (link)', plain: 'A field that holds the id of a record somewhere else. The coloured tag shows which repository it points into.' },
  { term: 'Required', plain: 'Every record must fill this field in.' },
  { term: 'Controlled values', plain: 'A fixed list of allowed answers for a field, such as the status values.' },
  { term: 'Provenance', plain: 'The record of who wrote an entry, when and how far it has been reviewed.' },
  { term: 'Shared kernel', plain: 'openevo-core: the common vocabulary, id scheme and rules that every repository follows.' },
  { term: 'Snapshot', plain: 'A copy of all schema files taken at one moment. The Studio refreshes it whenever a schema changes.' },
]
