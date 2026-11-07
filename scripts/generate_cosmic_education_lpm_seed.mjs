#!/usr/bin/env node
/**
 * Generates supabase/migrations/<N>_cosmic_education_lpm_project_space_seed.sql.
 *
 * Moves the Cosmic Education LPM out of the standalone cosmic-education-k12 folder into
 * OpenLPM as three project spaces, following the Bee LPM pattern (migration 128): a parent
 * container "Cosmic Education LPM" and two independent child spaces, English and Deutsch,
 * linked only by parent_project_id.
 *
 * What goes where (see docs in the migration header):
 *   10 local concepts + 4 imported ConceptBase concepts -> lpm_schema_elements
 *   5 strands -> lpm_data_objects (strand)
 *   35 substrands (7 grade bands each) -> lpm_data_objects (substrand), crosswalk rows ride in content
 *   50 performance indicators -> lpm_data_objects (performance_indicator), one per row so each can be
 *     reviewed and commented on alone in OpenLPM
 *   isChildOf / foundationalTo / parallel -> lpm_connections
 *   substrand -> concept tags -> lpm_object_tags
 *   7 crosswalk systems -> project_source_declarations (provenance) + per-substrand content.crosswalks
 *   base-repo links -> project_base_links, theories (TheoryBase), literature_references (LiteratureBase)
 *
 * German: the draft carries German labels, descriptions, essential questions and crosswalk notes, but
 * its performance indicators and concept definitions are English only. scripts/data/cosmic_education_de.json
 * holds a German wording of those, drafted by Claude, flagged as unreviewed in every row that uses it.
 *
 * Run:
 *   NODE_PATH=D:/dev/openevo-ccs-lab/openlpm/node_modules node scripts/generate_cosmic_education_lpm_seed.mjs \
 *     > supabase/migrations/233_cosmic_education_lpm_project_space_seed.sql
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const SRC = "D:/dev/openevo-ccs-lab/cosmic-education-k12";
const CONCEPTBASE_VOCAB = "D:/dev/openevo-ccs-lab/conceptbase/vocabularies/OE-INTERDISCIPLINARY-v1.0.0.yaml";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DE = JSON.parse(fs.readFileSync(path.join(HERE, "data", "cosmic_education_de.json"), "utf8"));

const NS = uuidv5("https://openevo.net/openlpm/cosmic-education-lpm-seed", "00000000-0000-0000-0000-000000000000");
function uuidv5(name, namespace) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, Buffer.from(name, "utf8")])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
const uid = (k) => uuidv5(k, NS);
const load = (rel) => yaml.load(fs.readFileSync(path.join(SRC, rel), "utf8"));
const J = (s) => {
  s = s == null ? "" : String(s);
  if (s.includes("$J$")) throw new Error("literal contains $J$: " + s.slice(0, 60));
  return `$J$${s}$J$`;
};
const JN = (s) => (s == null ? "NULL" : J(s));
const JSB = (o) => {
  const s = JSON.stringify(o);
  if (s.includes("$J$")) throw new Error("json contains $J$");
  return `$J$${s}$J$::jsonb`;
};
const clean = (s) => (s == null ? s : String(s).replace(/\s+\n/g, "\n").trim());

// ---------------------------------------------------------------- source
const gradeBands = load("lpm/grade-bands.yaml").gradeBands;
const anchors = load("lpm/content-anchors.yaml").contentAnchors;
const tools = load("lpm/thinking-tools.yaml").thinkingTools;
const vocab = load("lpm/vocabulary/COSMIC-K12-v0.1.0.yaml").concepts;
const strandFiles = [1, 2, 3, 4, 5].map((n) => {
  const f = fs.readdirSync(path.join(SRC, "lpm/strands")).find((x) => x.startsWith(`strand-${n}-`));
  return { file: f, doc: load(`lpm/strands/${f}`), n };
});
const crosswalks = fs.readdirSync(path.join(SRC, "crosswalks")).filter((f) => f.endsWith(".yaml")).map((f) => ({ file: f, doc: load(`crosswalks/${f}`) }));
const connections = load("resources/ecosystem-connections.yaml");
const anchorById = new Map(anchors.map((a) => [a.id, a]));
const toolById = new Map(tools.map((t) => [t.id, t]));
const gbById = new Map(gradeBands.map((g) => [g.id, g]));
const localConcept = new Map(vocab.map((c) => [c.id, c]));

// ConceptBase concepts the strands point at (OE-INTERDISCIPLINARY vocabulary). Imported into each space
// so the tags work and each one carries its real ConceptBase id.
const cb = yaml.load(fs.readFileSync(CONCEPTBASE_VOCAB, "utf8")).concepts;
const cbById = new Map(cb.map((c) => [c.id, c]));
const CB_DE_LABEL = {
  "OE-CONCEPT-oe-interdisciplinary-evolutionary-process": "Evolutionärer Prozess",
  "OE-CONCEPT-oe-interdisciplinary-culture": "Kultur",
  "OE-CONCEPT-oe-interdisciplinary-transmission": "Weitergabe (Transmission)",
  "OE-CONCEPT-oe-interdisciplinary-innovation": "Innovation",
};
const externalIds = new Set();
for (const { doc } of strandFiles) for (const s of doc.subStrands) for (const c of s.concepts || []) if (!localConcept.has(c.id)) externalIds.add(c.id);
for (const id of externalIds) if (!cbById.has(id)) throw new Error("concept not in ConceptBase vocabulary: " + id);
for (const id of externalIds) if (!CB_DE_LABEL[id]) throw new Error("no German label for " + id);

const DRAFT_FLAG_DE = "Deutscher Wortlaut von Claude entworfen (2026-11-07), noch von keiner deutschsprachigen Fachperson geprüft.";
const DRAFT_FLAG_EN = "Draft; no human expert has reviewed it yet.";

function shortStrandKey(id) {
  return id.replace("OE-STRAND-cosmic-education-k12-", "");
}

// ---------------------------------------------------------------- per language
function build(lang) {
  const L = lang;
  const elements = [];
  const objects = [];
  const conns = [];
  const tags = [];

  const conceptEid = new Map();
  for (const c of vocab) {
    const eid = uid(`${L}:concept:${c.id}`);
    conceptEid.set(c.id, eid);
    const label = c.labels?.[L] || c.labels?.en;
    let definition, examples, nonExamples, translated = false;
    if (L === "en") {
      const defs = c.definitions.en;
      const parts = Object.entries(defs);
      definition = parts.length === 1 ? clean(parts[0][1]) : parts.map(([k, v]) => `${k === "montessori-pedagogy" ? "Montessori pedagogy" : k === "evolutionary-biology-caveat" ? "Evolutionary-biology caveat" : k === "evolutionary-anthropology" ? "Evolutionary anthropology" : k}: ${clean(v)}`).join("\n\n");
      examples = c.examples || [];
      nonExamples = c.nonExamples || [];
    } else {
      const t = DE.concepts[c.id];
      if (!t) throw new Error("missing German concept " + c.id);
      definition = t.definition;
      examples = t.examples || [];
      nonExamples = t.nonExamples || [];
      translated = true;
    }
    elements.push({
      id: eid, label, definition,
      metadata: {
        source_id: c.id, vocabulary: "COSMIC-K12-v0.1.0", origin: "local-to-cosmic-education",
        definition_parts: Object.keys(c.definitions.en),
        examples, nonExamples,
        relations: c.relations || null,
        review: { state: "unreviewed", note: translated ? DRAFT_FLAG_DE : DRAFT_FLAG_EN },
        _source: { repo: "cosmic-education-k12", path: "lpm/vocabulary/COSMIC-K12-v0.1.0.yaml" },
      },
      status: "proposed",
    });
  }
  for (const id of externalIds) {
    const c = cbById.get(id);
    const eid = uid(`${L}:concept:${id}`);
    conceptEid.set(id, eid);
    const en = c.definitions.en.general || Object.values(c.definitions.en)[0];
    elements.push({
      id: eid,
      label: L === "de" ? CB_DE_LABEL[id] : c.labels.en,
      definition: clean(en),
      metadata: {
        conceptbase_id: id, source_vocabulary: "OE-INTERDISCIPLINARY-v1.0.0", origin: "conceptbase-import",
        definition_language: "en",
        note: L === "de" ? "Definition aus ConceptBase, englisch. Die deutsche Bezeichnung ist ein Entwurf." : "Imported by id from ConceptBase; wording is ConceptBase's.",
      },
      status: "accepted",
    });
  }

  // crosswalk lookup: (strandNumber|'all', gb) -> entries
  function crosswalkFor(strandN, gb) {
    const out = [];
    for (const { doc } of crosswalks) {
      for (const m of doc.mappings) {
        if (m.gradeBand !== gb) continue;
        if (m.strand != null && String(m.strand) !== String(strandN)) continue;
        out.push({
          system: doc.system,
          systemName: doc.displayName?.[L] || doc.displayName?.en,
          systemType: doc.type,
          code: m.code,
          note: m.note?.[L] || m.note?.en,
          noteLanguage: m.note?.[L] ? L : "en",
          confidence: m.confidence,
          concepts: m.concepts || [],
          appliesToAllStrands: m.strand == null,
        });
      }
    }
    return out;
  }

  const strandObj = new Map();
  for (const { doc, file, n } of strandFiles) {
    const sid = uid(`${L}:strand:${doc.id}`);
    strandObj.set(doc.id, sid);
    const ext = doc.extensions;
    const homeAnchors = (ext["cosmic-k12:homeAnchors"] || []).map((a) => ({ id: a, label: anchorById.get(a)?.label?.[L], description: anchorById.get(a)?.description?.[L] }));
    const toolId = ext["cosmic-k12:thinkingTool"];
    const tool = toolId ? toolById.get(toolId) : null;
    const eq = ext["cosmic-k12:essentialQuestion"];
    const eco = (connections || []).filter((c) => c.relatedStrand === `strand-${n}`).map((c) => ({
      id: c.id, repo: c.repo, kind: c.kind, title: c.title?.[L] || c.title?.en, description: c.description?.[L] || c.description?.en,
    }));
    objects.push({
      id: sid, type: "strand",
      title: doc.labels[L], description: clean(doc.description[L]),
      grade_band: null, subject_area: (doc.associatedDomains || [])[0] || null,
      content: {
        source_id: doc.id, sequence: n, typicalGradeBand: doc.typicalGradeBand, associatedDomains: doc.associatedDomains,
        relations: doc.relations || {}, homeAnchors,
        thinkingTool: tool ? { id: toolId, label: tool.label?.[L], description: tool.description?.[L] } : null,
        essentialQuestion: eq ? { broad: eq.broad?.[L], worked: eq.worked?.[L] } : null,
        ecosystemConnections: eco,
        review: { state: "unreviewed", note: L === "de" ? "Beschreibung und Leitfragen stammen aus dem zweisprachigen Entwurf." : DRAFT_FLAG_EN },
        _source: { repo: "cosmic-education-k12", path: `lpm/strands/${file}` },
      },
    });

    for (const sub of doc.subStrands) {
      const subId = uid(`${L}:substrand:${sub.id}`);
      const gbm = sub.id.match(/-gb(\d)$/);
      const gb = `GB-${gbm[1]}`;
      const gbInfo = gbById.get(gb);
      const subKey = shortStrandKey(sub.id);
      const cwx = crosswalkFor(n, gb);
      const conceptLabels = (sub.concepts || []).map((c) => elements.find((e) => e.id === conceptEid.get(c.id))?.label).filter(Boolean);
      objects.push({
        id: subId, type: "substrand",
        title: sub.labels[L] || sub.labels.en,
        description: conceptLabels.length ? (L === "en" ? "Key concepts: " : "Schlüsselkonzepte: ") + conceptLabels.join(", ") : null,
        grade_band: gb, subject_area: (doc.associatedDomains || [])[0] || null,
        content: {
          source_id: sub.id, typicalGradeBand: sub.typicalGradeBand, gradeBandId: gb,
          gradeBandLabel: gbInfo?.label?.[L], approxAge: gbInfo?.approxAge,
          required: !!sub.required,
          concepts: (sub.concepts || []).map((c) => ({ id: c.id, emphasis: c.emphasis })),
          montessoriScope: ["GB-1", "GB-2", "GB-3"].includes(gb) ? "inside" : gb === "GB-0" ? "informal-precursor" : "handoff-or-bridge",
          crosswalks: cwx,
          review: { state: "unreviewed", note: L === "de" ? "Bezeichnung aus dem Entwurf; Zuordnungen zu Lehrplänen tragen jeweils ihre eigene Sicherheitsangabe." : DRAFT_FLAG_EN },
          _source: { repo: "cosmic-education-k12", path: `lpm/strands/${file}` },
        },
      });
      conns.push({ from: subId, to: sid, rel: "isChildOf" });
      for (const c of sub.concepts || []) tags.push({ obj: subId, el: conceptEid.get(c.id), role: c.emphasis });

      (sub.performanceIndicators || []).forEach((p, i) => {
        const key = `${subKey}#${i}`;
        const text = L === "en" ? p : DE.pis[key];
        if (!text) throw new Error("missing German PI " + key);
        const piId = uid(`${L}:pi:${key}`);
        objects.push({
          id: piId, type: "performance_indicator",
          title: `${strandShort(doc, L)} · ${gb}.${i + 1}`,
          description: text,
          grade_band: gb, subject_area: (doc.associatedDomains || [])[0] || null,
          content: {
            source_id: `${sub.id}#pi${i + 1}`, ordinal: i + 1,
            // Montessori's own scope stops at about age 12. A PI that only explains where to hand off is marked so.
            kind: /^(This (band|LPM)|Dieses Modell|Diese Stufe)/.test(text) ? "handoff-note" : /^(Not covered|Auf dieser Stufe nicht)/.test(text) ? "scope-note" : "observable-performance",
            review: { state: "unreviewed", note: L === "de" ? DRAFT_FLAG_DE : DRAFT_FLAG_EN },
            _source: { repo: "cosmic-education-k12", path: `lpm/strands/${file}` },
          },
        });
        conns.push({ from: piId, to: subId, rel: "isChildOf" });
      });
    }
  }

  const seen = new Set();
  for (const { doc } of strandFiles) {
    for (const [rel, targets] of Object.entries(doc.relations || {})) {
      for (const t of targets) {
        const a = strandObj.get(doc.id), b = strandObj.get(t);
        if (!b) continue;
        const key = rel === "parallel" ? [a, b].sort().join("|") + rel : a + "|" + b + rel;
        if (seen.has(key)) continue;
        seen.add(key);
        conns.push({ from: a, to: b, rel });
      }
    }
  }
  return { elements, objects, conns, tags };
}

function strandShort(doc, L) {
  const t = doc.labels[L].replace(/^(The Story of|Die Geschichte (des|der))\s+/i, "").replace(/^\w/, (c) => c.toUpperCase());
  return L === "de" ? { Universums: "Universum", Lebens: "Leben", Menschen: "Mensch" }[t] || t : t;
}

const EN = build("en");
const DEU = build("de");

// ---------------------------------------------------------------- SQL
const PARENT = uid("project:cosmic-education-lpm");
const EN_ID = uid("project:cosmic-education-lpm-en");
const DE_ID = uid("project:cosmic-education-lpm-de");
const out = [];
const w = (s = "") => out.push(s);

w(`-- 233: Cosmic Education LPM moves into OpenLPM as a human-curated project space with an English and a German space (Dustin, 2026-11-07).`);
w(`--`);
w(`-- Source: the standalone cosmic-education-k12 folder (a draft LPM on Montessori's Five Great Lessons, drafted 2026-09-11 for a`);
w(`-- doctoral project at Martin-Luther-Universitaet Halle-Wittenberg). Same shape as the Bee LPM move (migration 128): a parent container plus two`);
w(`-- independent child spaces linked only by parent_project_id, so each language can be curated on its own.`);
w(`--`);
w(`-- Label: epistemic_status = 'in-development' (shows as Human-Curated). That states the aim of the space. It does not say a person has reviewed`);
w(`-- the content. Nobody has. The draft itself says the Cosmic Education progression is a designed thought experiment that has not been tested`);
w(`-- against children's reasoning. Every strand, stage and indicator row carries content.review.state = 'unreviewed'. Both child spaces are private, maturity draft.`);
w(`--`);
w(`-- Contents per language space: ${EN.elements.length} concepts (10 Cosmic Education concepts + 4 imported by id from ConceptBase), 5 strands, 35 stages (7 age bands each),`);
w(`-- ${EN.objects.filter((o) => o.type === "performance_indicator").length} performance indicators as separate rows (so each can be reviewed and commented on alone), ${EN.conns.length} connections, ${EN.tags.length} concept tags.`);
w(`-- The 41 curriculum crosswalk entries (Sachsen, Sachsen-Anhalt, Thueringen, GDSU Perspektivrahmen, Montessori tradition, IB PYP, Big History Project) sit in`);
w(`-- each matching stage's content.crosswalks, each with its own confirmed / uncertain mark. The seven systems are listed under Sources.`);
w(`-- Base-repo links: ConceptBase (4 concepts by id), TheoryBase (selection-teleology proposition, learning progressions as scientific models),`);
w(`-- LiteratureBase (Kelemen & Rosset 2009, Kampourakis 2020). Links to the Thueringen curriculum structure overview are NOT made here; they would be a`);
w(`-- separate proposal pass like migration 225.`);
w(`--`);
w(`-- German wording: the draft had German labels, descriptions, essential questions and crosswalk notes, but English-only indicators and concept`);
w(`-- definitions. The German space uses a German wording of those written by Claude (scripts/data/cosmic_education_de.json), marked unreviewed.`);
w(`-- The 4 imported ConceptBase definitions stay English (ConceptBase has no German wording).`);
w(`--`);
w(`-- Idempotent: uuid5 ids, ON CONFLICT DO NOTHING. Generated by scripts/generate_cosmic_education_lpm_seed.mjs; do not hand-edit.`);
w(`-- Rollback: DELETE FROM projects WHERE slug IN ('cosmic-education-lpm-en','cosmic-education-lpm-de','cosmic-education-lpm'); (children cascade).`);
w(`SET search_path = public, extensions;`);
w("");
w("DO $MIGRATION$");
w("DECLARE");
w(`  v_parent UUID := '${PARENT}';`);
w(`  v_en UUID := '${EN_ID}';`);
w(`  v_de UUID := '${DE_ID}';`);
w("  v_user UUID;");
w("BEGIN");
w("  SELECT id INTO v_user FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';");
w("");

const THEMES = "ARRAY['montessori','cosmic-education','interdisciplinary']::TEXT[]";
const PARENT_DESC = "A five-strand learning progression built on Maria Montessori's Cosmic Education (the Five Great Lessons): the Story of the Universe, of Life, of Humans, of Language and of Numbers. Montessori's own scope is ages 6 to 12; the space also holds an informal early-childhood stage and hand-off stages for older learners. Organizational home only: the content lives in the English and German child spaces.";
w(`  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)`);
w(`  VALUES (v_parent, 'cosmic-education-lpm', ${J("Cosmic Education LPM")}, ${J(PARENT_DESC)}, 'active', 'in-development',`);
w(`    ${J("Human-curated by aim. Moved from the standalone cosmic-education-k12 draft. No expert has reviewed the content yet, and the progression has not been tested against children's reasoning.")},`);
w(`    'hosted', TRUE, 'draft', NULL, 'thematic', '{}'::TEXT[], ${THEMES}, ARRAY['en','de']::TEXT[])`);
w(`  ON CONFLICT (slug) DO NOTHING;`);
w(`  IF v_user IS NOT NULL THEN`);
w(`    INSERT INTO project_members (project_id, user_id, role) VALUES (v_parent, v_user, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;`);
w(`    UPDATE projects SET created_by = v_user WHERE id = v_parent AND created_by IS NULL;`);
w(`  END IF;`);
w("");

const srcNames = crosswalks.map(({ doc }) => doc);

function child(varName, slug, name, lang, desc, data) {
  w(`  -- ====================================================================`);
  w(`  -- ${name}`);
  w(`  -- ====================================================================`);
  w(`  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)`);
  w(`  VALUES (${varName}, '${slug}', ${J(name)}, ${J(desc)}, 'active', 'in-development',`);
  w(`    ${J(lang === "en"
    ? "Human-curated by aim; to be reviewed and curated in OpenLPM. Moved from the cosmic-education-k12 draft on 2026-11-07. No expert has reviewed it, and the progression has not been tested against children's reasoning."
    : "Von Menschen kuratiert (Ziel); wird in OpenLPM geprüft und weiterentwickelt. Am 07.11.2026 aus dem Entwurf cosmic-education-k12 übernommen. Keine Fachperson hat den Inhalt geprüft. Die deutschen Indikatoren und Begriffsdefinitionen sind ein Entwurf von Claude.")},`);
  w(`    'hosted', TRUE, 'draft', v_parent, 'thematic', '{}'::TEXT[], ${THEMES}, ARRAY['${lang}']::TEXT[])`);
  w(`  ON CONFLICT (slug) DO NOTHING;`);
  w("");
  for (const repo of ["conceptbase", "theorybase", "literaturebase"]) {
    w(`  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr) VALUES (${varName}, '${repo}', TRUE, FALSE) ON CONFLICT (project_id, base_repo) DO NOTHING;`);
  }
  w("");
  // sources
  const srcRows = [
    ["cosmic-education-k12 (draft folder, moved into this space)", "YAML (ConceptBase oe:LPM / oe:Strand shape)", "CC-BY-NC-SA-4.0 (the draft's own LICENSE). Structurally imported by this migration.", null],
    ...srcNames.map((d) => [
      `Crosswalk: ${d.displayName?.[lang] || d.displayName?.en}`, `Crosswalk table (${d.type})`,
      (d.sourceNote?.[lang] || d.sourceNote?.en || "").replace(/\s+/g, " ").trim(),
      (d.sourceNote?.en || "").match(/\(?((?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/[^\s),;]+)/i)?.[1] || null,
    ]),
  ];
  for (const [name_, fmt, note, url] of srcRows) {
    const urlSql = url ? J(url.startsWith("http") ? url : "https://" + url) : "NULL";
    w(`  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)`);
    w(`  SELECT ${varName}, ${J(name_)}, ${J(fmt)}, ${J(note)}, ${urlSql}`);
    w(`  WHERE NOT EXISTS (SELECT 1 FROM project_source_declarations WHERE project_id = ${varName} AND source_name = ${J(name_)});`);
  }
  w("");
  w(`  IF v_user IS NOT NULL THEN`);
  w(`    INSERT INTO project_members (project_id, user_id, role) VALUES (${varName}, v_user, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;`);
  w(`    UPDATE projects SET created_by = v_user WHERE id = ${varName} AND created_by IS NULL;`);
  w(`  END IF;`);
  w("");

  w(`  INSERT INTO lpm_schema_elements (id, project_id, element_type, label, definition, parent_id, metadata, status) VALUES`);
  w(data.elements.map((e) => `  ('${e.id}', ${varName}, 'concept', ${J(e.label)}, ${J(e.definition)}, NULL, ${JSB(e.metadata)}, ${J(e.status)})`).join(",\n"));
  w(`  ON CONFLICT (id) DO NOTHING;`);
  w("");
  w(`  INSERT INTO lpm_data_objects (id, project_id, object_type, title, description, grade_band, subject_area, content, status) VALUES`);
  w(data.objects.map((o) => `  ('${o.id}', ${varName}, ${J(o.type)}, ${J(o.title)}, ${JN(o.description)}, ${JN(o.grade_band)}, ${JN(o.subject_area)}, ${JSB(o.content)}, 'draft')`).join(",\n"));
  w(`  ON CONFLICT (id) DO NOTHING;`);
  w("");
  w(`  INSERT INTO lpm_connections (project_id, from_object_id, to_object_id, relation_type, kind, rationale, status) VALUES`);
  w(data.conns.map((c) => `  (${varName}, '${c.from}', '${c.to}', ${J(c.rel)}, 'asserted', NULL, 'accepted')`).join(",\n"));
  w(`  ON CONFLICT (from_object_id, to_object_id, relation_type) DO NOTHING;`);
  w("");
  w(`  INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role) VALUES`);
  w(data.tags.map((t) => `  (${varName}, '${t.obj}', '${t.el}', ${J(t.role)})`).join(",\n"));
  w(`  ON CONFLICT (data_object_id, schema_element_id) DO NOTHING;`);
  w("");
}

const TITLES = {
  en: "The English space of the Cosmic Education LPM: five strands, one per Great Lesson (Universe, Life, Humans, Language, Numbers), each over seven age bands from early childhood to upper secondary. Montessori's own scope is ages 6 to 12 (bands GB-1 to GB-3); the other bands are an informal early stage and hand-offs to other models. Crosswalks to Sachsen, Sachsen-Anhalt and Thueringen primary curricula, the GDSU Perspektivrahmen, Montessori's own tradition, IB PYP and the Big History Project are stored with each stage.",
  de: "Der deutsche Raum des Cosmic-Education-LPM: fünf Stränge, je einer pro Große Erzählung (Universum, Leben, Mensch, Sprache, Zahlen), jeweils über sieben Altersbänder von früher Kindheit bis Oberstufe. Montessoris eigener Geltungsbereich sind die Altersstufen 6 bis 12 (Bänder GB-1 bis GB-3); die übrigen Bänder sind ein informeller Vorläufer und Übergaben an andere Modelle. Zuordnungen zu den Grundschullehrplänen von Sachsen, Sachsen-Anhalt und Thüringen, zum GDSU-Perspektivrahmen, zu Montessoris eigener Tradition, zum IB PYP und zum Big History Project hängen an den einzelnen Stufen.",
};

// theories + literature are per child space
function baseContent(varName, lang) {
  const t1 = uid(`${lang}:theory:selection-teleology`);
  const t2 = uid(`${lang}:theory:lp-as-scientific-models`);
  const l1 = uid(`${lang}:lit:kelemen-2009`);
  const l2 = uid(`${lang}:lit:kampourakis-2020`);
  w(`  -- TheoryBase and LiteratureBase links`);
  w(`  INSERT INTO theories (id, project_id, label, description, evidentiary_maturity, evidentiary_maturity_note, base_repo, base_repo_ref) VALUES`);
  w(`  ('${t1}', ${varName}, ${J(lang === "en" ? "Selection teleology is the legitimate form of purposive explanation" : "Selektions-Teleologie ist die berechtigte Form zweckgerichteter Erklärung")},`);
  w(`   ${J(lang === "en"
    ? "TheoryBase proposition: the problem in evolution teaching is not purposive language as such but whether a trait is explained by design (an agent or a need) or by selection (differential survival and reproduction). Strand 2, stage GB-3 puts Montessori's Cosmic Task idea next to this claim and asks how the Cosmic Task wording actually lands in children's reasoning. Nobody has studied that."
    : "TheoryBase-Aussage: Das Problem im Evolutionsunterricht ist nicht zweckgerichtete Sprache an sich, sondern ob ein Merkmal durch Absicht oder Bedarf (Design) oder durch Selektion (unterschiedliches Überleben und Fortpflanzen) erklärt wird. Strang 2, Stufe GB-3, stellt Montessoris Idee der Kosmischen Aufgabe neben diese Aussage und fragt, wie die Wortwahl der Kosmischen Aufgabe im Denken von Kindern ankommt. Das hat noch niemand untersucht.")},`);
  w(`   NULL, ${J(lang === "en" ? "TheoryBase carries this record as an author draft (review_status author-draft). No maturity level is claimed here." : "TheoryBase führt diesen Eintrag als Autorenentwurf. Hier wird keine Reifestufe behauptet.")}, 'theorybase', 'OE-PROPOSITION-selection-teleology-legitimate'),`);
  w(`  ('${t2}', ${varName}, ${J(lang === "en" ? "Learning Progressions as Scientific Models" : "Lernprogressionen als wissenschaftliche Modelle")},`);
  w(`   ${J(lang === "en"
    ? "A learning progression is treated as a scientific model that can be checked against evidence. The Cosmic Education LPM writes a century-old pedagogy down precisely enough (age bands, concepts, observable indicators) to be checked this way. It has not been checked yet."
    : "Eine Lernprogression gilt als wissenschaftliches Modell, das an Belegen geprüft werden kann. Das Cosmic-Education-LPM schreibt eine hundert Jahre alte Pädagogik so genau auf (Altersbänder, Konzepte, beobachtbare Indikatoren), dass sie sich so prüfen lässt. Das ist bisher nicht geschehen.")},`);
  w(`   'theoretically-developed', NULL, 'theorybase', 'OE-THEORY-learning-progressions-as-scientific-models')`);
  w(`  ON CONFLICT (id) DO NOTHING;`);
  w("");
  w(`  INSERT INTO literature_references (id, project_id, doi, title, authors, year, venue, type, literaturebase_id, status, submitted_by) VALUES`);
  w(`  ('${l1}', ${varName}, '10.1016/j.cognition.2009.01.001', 'The Human Function Compunction: Teleological explanation in adults', '["Kelemen, Deborah", "Rosset, Evelyn"]'::jsonb, 2009, 'Cognition', 'article',`);
  w(`   (SELECT id FROM literaturebase_snapshot WHERE id = 'OE-LITERATURE-kelemen-2009'), 'draft', NULL),`);
  w(`  ('${l2}', ${varName}, '10.1186/s12052-019-0116-z', 'Students'' "teleological misconceptions" in evolution education: why the underlying design stance, not teleology per se, is the problem', '["Kampourakis, Kostas"]'::jsonb, 2020, 'Evolution: Education and Outreach', 'article',`);
  w(`   (SELECT id FROM literaturebase_snapshot WHERE id = 'OE-LITERATURE-kampourakis-2020'), 'draft', NULL)`);
  w(`  ON CONFLICT (id) DO NOTHING;`);
  w("");
  w(`  INSERT INTO theory_literature_links (theory_id, reference_id, relation_type, note) VALUES`);
  w(`  ('${t1}', '${l2}', 'theoretical-clarification', ${J(lang === "en" ? "Primary source named in the TheoryBase proposition." : "In der TheoryBase-Aussage genannte Hauptquelle.")}),`);
  w(`  ('${t1}', '${l1}', 'empirical-support', ${J(lang === "en" ? "Adults still fall back on purpose-based explanations under time pressure. Added from the draft's own citation; the draft attributed the term 'promiscuous teleology' to this paper, which is Kelemen's earlier work, so check that before quoting it." : "Auch Erwachsene greifen unter Zeitdruck auf zweckbezogene Erklärungen zurück. Aus der Quellenangabe des Entwurfs übernommen; der Entwurf ordnet den Begriff „promiscuous teleology“ diesem Aufsatz zu, er stammt aber aus früheren Arbeiten von Kelemen. Vor einem Zitat bitte prüfen.")})`);
  w(`  ON CONFLICT (theory_id, reference_id, relation_type) DO NOTHING;`);
  w("");
}

child("v_en", "cosmic-education-lpm-en", "Cosmic Education LPM (English)", "en", TITLES.en, EN);
baseContent("v_en", "en");
child("v_de", "cosmic-education-lpm-de", "Cosmic Education LPM (Deutsch)", "de", TITLES.de, DEU);
baseContent("v_de", "de");

w("END $MIGRATION$;");
process.stdout.write(out.join("\n") + "\n");
process.stderr.write(
  `EN: ${EN.elements.length} concepts, ${EN.objects.length} objects (${EN.objects.filter((o) => o.type === "performance_indicator").length} PI), ${EN.conns.length} connections, ${EN.tags.length} tags\n` +
    `DE: ${DEU.elements.length} concepts, ${DEU.objects.length} objects, ${DEU.conns.length} connections, ${DEU.tags.length} tags\n`
);
