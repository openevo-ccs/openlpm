#!/usr/bin/env node
/**
 * Generates supabase/migrations/<N>_bee_lpm_project_space_seed.sql.
 *
 * Creates three new Project Spaces -- a pure-container parent "Bee LPM" plus
 * two fully independent, fully-content-bearing children "Bee LPM (English)"
 * and "Bee LPM (Deutsch)" -- following the real, already-proven OpenLPM
 * pattern for "one topic, two languages": EvoMentor / EvoMentor-Thuringia
 * resolved that as two separate project rows linked only by parent_project_id
 * (see 015_project_hierarchy.sql, 074_rename_synthetic_pair_projects.sql),
 * never shared bilingual fields on one record (that design,
 * proposals/0005-multi-language-content.md's content_translations table,
 * was never actually built -- see 074's own comment).
 *
 * Source: the bee-k12 GitHub repo's /lpm/ tree (its current working-tree
 * state) -- lpm.yaml, grade-bands.yaml, content-anchors.yaml,
 * thinking-tools.yaml, vocabulary/BEE-K12-v0.1.0.yaml, strands/strand-{a..f}.yaml.
 * Every strand there already carries parallel en/de fields; this script's
 * real job is splitting that single bilingual source into two independently
 * addressable, same-depth project spaces -- not inventing new content.
 *
 * Mirrors the generator pattern already proven for
 * 092_bio_core_interdisciplinary_lpm_content_seed.sql (scripts/
 * generate_bio_core_interdisciplinary_lpm_seed.py): uuid5-derived stable ids
 * (safe to re-run), ON CONFLICT (id) DO NOTHING on every schema_elements/
 * data_objects insert.
 *
 * Run:
 *   NODE_PATH=../openlpm/node_modules node scripts/generate_bee_lpm_seed.mjs \
 *     > supabase/migrations/128_bee_lpm_project_space_seed.sql
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";

const BEE_K12 = "D:/dev/openevo-ccs-lab/bee-k12/lpm";
const NAMESPACE = uuidv5("https://openevo.net/openlpm/bee-lpm-seed", NIL_NAMESPACE());

function NIL_NAMESPACE() {
  return "00000000-0000-0000-0000-000000000000";
}

function uuidv5(name, namespace) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, nameBytes])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uid(key) {
  return uuidv5(key, NAMESPACE);
}

function loadYaml(relPath) {
  return yaml.load(fs.readFileSync(path.join(BEE_K12, relPath), "utf8"));
}

function J(s) {
  s = s == null ? "" : String(s);
  if (s.includes("$J$")) throw new Error(`literal text contains $J$ delimiter: ${s.slice(0, 80)}`);
  return `$J$${s}$J$`;
}

function JSB(obj) {
  const s = JSON.stringify(obj);
  if (s.includes("$J$")) throw new Error("generated JSON contains $J$ delimiter");
  return `$J$${s}$J$::jsonb`;
}

// ============================================================================
// Load source content
// ============================================================================

const gradeBandsDoc = loadYaml("grade-bands.yaml").gradeBands;
const contentAnchorsDoc = loadYaml("content-anchors.yaml").contentAnchors;
const thinkingToolsDoc = loadYaml("thinking-tools.yaml").thinkingTools;
const vocabDoc = loadYaml("vocabulary/BEE-K12-v0.1.0.yaml").concepts;
const strandFiles = ["strand-a", "strand-b", "strand-c", "strand-d", "strand-e", "strand-f"].map(
  (f) => loadYaml(`strands/${f}.yaml`)
);

const gradeBandById = new Map(gradeBandsDoc.map((gb) => [gb.id, gb]));
const anchorById = new Map(contentAnchorsDoc.map((a) => [a.id, a]));
const toolById = new Map(thinkingToolsDoc.map((t) => [t.id, t]));
const conceptById = new Map(vocabDoc.map((c) => [c.id, c]));

// Interdisciplinary/sandbox concept ids referenced by bee-k12 but defined in
// OTHER (not-yet-migrated) ConceptBase vocabularies -- kept as plain string
// references in content JSON (matches 092's own precedent of referencing
// concepts it doesn't locally define), never fabricated as local elements.
function isLocalConcept(conceptId) {
  return conceptById.has(conceptId);
}

function splitBilingualList(arr) {
  // bee-k12's own convention throughout /lpm/strands/: performanceIndicators
  // is a flat array of alternating [en, de, en, de, ...] pairs. Verified by
  // direct inspection of all six strand files before relying on it here.
  const en = [];
  const de = [];
  for (let i = 0; i < arr.length; i += 2) {
    en.push(arr[i]);
    de.push(arr[i + 1]);
  }
  return { en, de };
}

// ============================================================================
// Per-language build
// ============================================================================

function buildLanguageProject(lang, projectSlug) {
  const schemaElementRows = [];
  const dataObjectRows = [];
  const connectionRows = [];
  const tagRows = [];

  // -- Concepts (BEE-K12-v0.1.0 vocabulary, ~29 entries) --
  const conceptElementId = new Map();
  for (const c of vocabDoc) {
    const eid = uid(`${lang}:concept:${c.id}`);
    conceptElementId.set(c.id, eid);
    const label = c.labels?.[lang] || c.labels?.en;
    const defs = c.definitions?.[lang] || c.definitions?.en || {};
    const definition = defs.general || Object.values(defs)[0] || "";
    const meta = {
      source_id: c.id,
      vocabulary: "BEE-K12-v0.1.0",
      _source: { repo: "bee-k12", path: "lpm/vocabulary/BEE-K12-v0.1.0.yaml" },
    };
    schemaElementRows.push({
      id: eid,
      element_type: "concept",
      label,
      definition,
      parent_id: null,
      metadata: meta,
      status: c.status === "proposed" ? "proposed" : c.status,
    });
  }

  // -- Strands + substrands --
  const strandObjectId = new Map();
  for (const strand of strandFiles) {
    const sid = uid(`${lang}:strand:${strand.id}`);
    strandObjectId.set(strand.id, sid);

    const homeAnchorIds = strand.extensions?.["bee-k12:homeAnchors"] || [];
    const homeAnchors = homeAnchorIds.map((aid) => {
      const a = anchorById.get(aid);
      return { id: aid, label: a?.label?.[lang], description: a?.description?.[lang] };
    });
    const toolId = strand.extensions?.["bee-k12:thinkingTool"];
    const tool = toolId ? toolById.get(toolId) : null;
    const essentialQuestion = strand.extensions?.["bee-k12:essentialQuestion"];

    const content = {
      source_id: strand.id,
      description: strand.description?.[lang],
      associatedDomains: strand.associatedDomains || [],
      typicalGradeBand: strand.typicalGradeBand,
      relations: strand.relations || {},
      homeAnchors,
      thinkingTool: tool
        ? { id: toolId, label: tool.label?.[lang], description: tool.description?.[lang], status: tool.status }
        : null,
      essentialQuestion: essentialQuestion
        ? { broad: essentialQuestion.broad?.[lang], worked: essentialQuestion.worked?.[lang] }
        : null,
      epistemicStatus: "designed-thought-experiment",
      _source: { repo: "bee-k12", path: `lpm/strands/${strand.id.replace("OE-STRAND-bee-k12-", "strand-")}.yaml` },
    };

    dataObjectRows.push({
      id: sid,
      object_type: "strand",
      title: strand.labels?.[lang] || strand.labels?.en,
      description: strand.description?.[lang],
      grade_band: null,
      subject_area: (strand.associatedDomains || [])[0] || null,
      content,
      status: "draft",
    });

    for (const sub of strand.subStrands) {
      const subId = uid(`${lang}:substrand:${sub.id}`);
      const gbMatch = sub.id.match(/-(gb)(\d)$/i);
      const gbId = gbMatch ? `GB-${gbMatch[2]}` : null;
      const { en: piEn, de: piDe } = splitBilingualList(sub.performanceIndicators || []);
      const pis = lang === "en" ? piEn : piDe;

      const subConcepts = (sub.concepts || []).map((c) => ({ id: c.id, emphasis: c.emphasis }));
      const keyConceptLabels = subConcepts
        .map((c) => conceptById.get(c.id)?.labels?.[lang] || conceptById.get(c.id)?.labels?.en)
        .filter(Boolean);
      const description = keyConceptLabels.length
        ? (lang === "en" ? "Key concepts: " : "Schlüsselkonzepte: ") + keyConceptLabels.join(", ")
        : null;

      const subContent = {
        source_id: sub.id,
        performanceIndicators: pis,
        concepts: subConcepts,
        required: !!sub.required,
        typicalGradeBand: sub.typicalGradeBand,
        gradeBandId: gbId,
        _source: { repo: "bee-k12", path: `lpm/strands/${strand.id.replace("OE-STRAND-bee-k12-", "strand-")}.yaml` },
      };

      dataObjectRows.push({
        id: subId,
        object_type: "substrand",
        title: sub.labels?.[lang] || sub.labels?.en,
        description,
        grade_band: gbId,
        subject_area: (strand.associatedDomains || [])[0] || null,
        content: subContent,
        status: "draft",
      });

      connectionRows.push({ from: subId, to: sid, relation_type: "isChildOf" });

      for (const c of sub.concepts || []) {
        if (!isLocalConcept(c.id)) continue; // external-vocabulary refs: not tagged, not fabricated locally
        tagRows.push({ dataObjectId: subId, schemaElementId: conceptElementId.get(c.id), role: c.emphasis });
      }
    }
  }

  // Strand-to-strand relations (foundationalTo / parallel), declared once per
  // strand file -- de-duplicated since several are mutually declared on both sides.
  const seenStrandRel = new Set();
  for (const strand of strandFiles) {
    const fromId = strandObjectId.get(strand.id);
    for (const [relType, targets] of Object.entries(strand.relations || {})) {
      for (const targetStrandId of targets) {
        const toId = strandObjectId.get(targetStrandId);
        if (!toId) continue;
        const key = [fromId, toId, relType].sort().join("|") + `|${relType}`;
        if (seenStrandRel.has(key)) continue;
        seenStrandRel.add(key);
        connectionRows.push({ from: fromId, to: toId, relation_type: relType });
      }
    }
  }

  return { schemaElementRows, dataObjectRows, connectionRows, tagRows };
}

const EN = buildLanguageProject("en", "bee-lpm-en");
const DE = buildLanguageProject("de", "bee-lpm-de");

// ============================================================================
// Emit SQL
// ============================================================================

const PARENT_ID = uid("project:bee-lpm");
const EN_ID = uid("project:bee-lpm-en");
const DE_ID = uid("project:bee-lpm-de");

let out = [];
out.push(`-- bee-lpm-project-space-seed: creates "Bee LPM" as a real OpenLPM home, following the`);
out.push(`-- same pattern already proven for "one topic, two languages" in this app (EvoMentor /`);
out.push(`-- EvoMentor-Thuringia, migration 015/074): a pure-container parent project plus two`);
out.push(`-- fully independent, fully-content-bearing child projects, linked only by`);
out.push(`-- parent_project_id (never forced governance or vocabulary coupling, same RFC-0010-`);
out.push(`-- derived precedent). No shared bilingual-field mechanism is used (content_translations`);
out.push(`-- was designed in proposals/0005-multi-language-content.md but never actually built --`);
out.push(`-- see 074's own comment -- so this migration does not depend on it).`);
out.push(`--`);
out.push(`-- Content is transcribed from the bee-k12 GitHub repo's /lpm/ tree (six strands, ~29`);
out.push(`-- BEE-K12-v0.1.0 vocabulary concepts, seven age-based grade bands GB-0..GB-6), already`);
out.push(`-- bilingual at the source -- this migration's real job is splitting that single`);
out.push(`-- bilingual source into two independently addressable project spaces of equal depth,`);
out.push(`-- not inventing new content. Generated by scripts/generate_bee_lpm_seed.mjs, not`);
out.push(`-- hand-typed. Both child projects seeded is_private = TRUE / maturity = 'draft': this is`);
out.push(`-- AI-transcribed, not yet human-expert-reviewed content (bee-k12's own epistemicStatus:`);
out.push(`-- designed-thought-experiment, unchanged here), same default every other early-stage`);
out.push(`-- OpenLPM project uses until a real review gate is cleared.`);
out.push(`--`);
out.push(`-- Idempotency: all ids are uuid5-derived (stable across re-runs); lpm_schema_elements`);
out.push(`-- and lpm_data_objects inserts use ON CONFLICT (id) DO NOTHING, lpm_connections/`);
out.push(`-- lpm_object_tags use their own real unique constraints -- safe to re-apply.`);
out.push("");
out.push("DO $MIGRATION$");
out.push("DECLARE");
out.push(`  v_parent_id UUID := '${PARENT_ID}';`);
out.push(`  v_en_id UUID := '${EN_ID}';`);
out.push(`  v_de_id UUID := '${DE_ID}';`);
out.push("  v_user_id UUID;");
out.push("BEGIN");
out.push("");
out.push("  SELECT id INTO v_user_id FROM users WHERE email = 'dustin.eirdosh@eva.mpg.de';");
out.push("");

// --- Parent container project ---
out.push("  -- ==========================================================================");
out.push("  -- Parent: Bee LPM (pure container, no own content -- see header note)");
out.push("  -- ==========================================================================");
out.push(
  `  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)`
);
out.push("  VALUES (");
out.push(`    v_parent_id, 'bee-lpm', ${J("Bee LPM")},`);
out.push(
  `    ${J(
    "A six-strand K-12 learning progression built around bees -- cooperation and division of labor in the hive, ecological interdependence through pollination, the economics and law of a managed resource, bee cognition and swarm intelligence, the evolutionary origins of cooperation, and apiculture as craft and management philosophy. Organizational home only: this project holds no content of its own. Each language has its own fully independent, independently-authored project space -- see bee-lpm-en / bee-lpm-de -- following the same pattern already proven for EvoMentor / EvoMentor-Thuringia (migration 015/074), not a shared bilingual-field design."
  )},`
);
out.push(`    'active', 'designed-thought-experiment',`);
out.push(
  `    ${J(
    "Migrated from the standalone bee-k12 GitHub repo (a real work-draft report for one pilot site -- a Waldorf school in Sachsen with a school apiary -- not an arbitrary synthetic construction, but not yet field-tested or formally reviewed, per RFC-0019). Status carried over unchanged from that repo's own lpm.yaml."
  )},`
);
out.push(`    'hosted', TRUE, 'draft', NULL, 'thematic', '{}'::TEXT[], ARRAY['bees','interdisciplinary']::TEXT[], ARRAY['en','de']::TEXT[]`);
out.push("  )");
out.push("  ON CONFLICT (slug) DO NOTHING;");
out.push("");
out.push("  IF v_user_id IS NOT NULL THEN");
out.push("    INSERT INTO project_members (project_id, user_id, role) VALUES (v_parent_id, v_user_id, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;");
out.push("    UPDATE projects SET created_by = v_user_id WHERE id = v_parent_id AND created_by IS NULL;");
out.push("  END IF;");
out.push("");

function emitChildProject(varName, idLit, slug, name, lang, description) {
  out.push(`  INSERT INTO projects (id, slug, name, description, status, epistemic_status, epistemic_status_note, hosting_mode, is_private, maturity, parent_project_id, focus_type, region_tags, theme_tags, working_languages)`);
  out.push("  VALUES (");
  out.push(`    ${varName}, '${slug}', ${J(name)},`);
  out.push(`    ${J(description)},`);
  out.push(`    'active', 'designed-thought-experiment',`);
  out.push(
    `    ${J(
      "Migrated from the standalone bee-k12 GitHub repo's bilingual /lpm/ tree, this language's fields only. Not field-tested or formally reviewed as curriculum -- designed-thought-experiment per RFC-0019, unchanged from the source repo's own status."
    )},`
  );
  out.push(`    'hosted', TRUE, 'draft', v_parent_id, 'thematic', '{}'::TEXT[], ARRAY['bees','interdisciplinary']::TEXT[], ARRAY['${lang}']::TEXT[]`);
  out.push("  )");
  out.push("  ON CONFLICT (slug) DO NOTHING;");
  out.push("");
  out.push(`  INSERT INTO project_base_links (project_id, base_repo, can_import, can_propose_pr) VALUES (${varName}, 'conceptbase', TRUE, FALSE) ON CONFLICT (project_id, base_repo) DO NOTHING;`);
  out.push("");
  out.push(`  INSERT INTO project_source_declarations (project_id, source_name, format, license_or_rights_note, url)`);
  out.push(`  SELECT ${varName}, ${J("bee-k12 (GitHub repo, retired after this migration -- moved to the new bee-lpm GitHub repo for non-LPM content)")}, ${J("YAML (ConceptBase oe:LPM / oe:Strand schema)")}, ${J("CC-BY-4.0 (bee-k12's own license, LICENSE-CONTENT). Migrated from the standalone bee-k12 GitHub repo into this Project Space, preserving its content and provenance; structurally imported into lpm_data_objects/lpm_connections/lpm_object_tags by this migration, not merely declared.")}, ${J("https://github.com/openevo-ccs/bee-lpm")}`);
  out.push(`  WHERE NOT EXISTS (SELECT 1 FROM project_source_declarations WHERE project_id = ${varName} AND source_name = ${J("bee-k12 (GitHub repo, retired after this migration -- moved to the new bee-lpm GitHub repo for non-LPM content)")});`);
  out.push("");
  out.push(`  IF v_user_id IS NOT NULL THEN`);
  out.push(`    INSERT INTO project_members (project_id, user_id, role) VALUES (${varName}, v_user_id, 'owner') ON CONFLICT (project_id, user_id) DO NOTHING;`);
  out.push(`    UPDATE projects SET created_by = v_user_id WHERE id = ${varName} AND created_by IS NULL;`);
  out.push(`  END IF;`);
  out.push("");
}

function emitContent(varName, data) {
  out.push("  -- Concept vocabulary (BEE-K12-v0.1.0)");
  out.push("  INSERT INTO lpm_schema_elements (id, project_id, element_type, label, definition, parent_id, metadata, status)");
  out.push("  VALUES");
  out.push(
    data.schemaElementRows
      .map(
        (r) =>
          `  ('${r.id}', ${varName}, 'concept', ${J(r.label)}, ${J(r.definition)}, NULL, ${JSB(r.metadata)}, ${J(r.status)})`
      )
      .join(",\n")
  );
  out.push("  ON CONFLICT (id) DO NOTHING;");
  out.push("");

  out.push("  -- Strands and sub-strands");
  out.push("  INSERT INTO lpm_data_objects (id, project_id, object_type, title, description, grade_band, subject_area, content, status)");
  out.push("  VALUES");
  out.push(
    data.dataObjectRows
      .map(
        (r) =>
          `  ('${r.id}', ${varName}, ${J(r.object_type)}, ${J(r.title)}, ${J(r.description)}, ${J(r.grade_band)}, ${J(r.subject_area)}, ${JSB(r.content)}, ${J(r.status)})`
      )
      .join(",\n")
  );
  out.push("  ON CONFLICT (id) DO NOTHING;");
  out.push("");

  out.push("  -- Connections: substrand isChildOf strand, plus strand-to-strand relations");
  out.push("  INSERT INTO lpm_connections (project_id, from_object_id, to_object_id, relation_type, kind, rationale, status)");
  out.push("  VALUES");
  out.push(
    data.connectionRows
      .map((r) => `  (${varName}, '${r.from}', '${r.to}', ${J(r.relation_type)}, 'asserted', NULL, 'accepted')`)
      .join(",\n")
  );
  out.push("  ON CONFLICT (from_object_id, to_object_id, relation_type) DO NOTHING;");
  out.push("");

  out.push("  -- Object tags: substrand -> concept, role = source's own emphasis value");
  out.push("  INSERT INTO lpm_object_tags (project_id, data_object_id, schema_element_id, role)");
  out.push("  VALUES");
  out.push(
    data.tagRows
      .map((r) => `  (${varName}, '${r.dataObjectId}', '${r.schemaElementId}', ${J(r.role)})`)
      .join(",\n")
  );
  out.push("  ON CONFLICT (data_object_id, schema_element_id) DO NOTHING;");
  out.push("");
}

out.push("  -- ==========================================================================");
out.push("  -- Child: Bee LPM (English)");
out.push("  -- ==========================================================================");
emitChildProject(
  "v_en_id",
  EN_ID,
  "bee-lpm-en",
  "Bee LPM (English)",
  "en",
  "The English-language Bee LPM: six strands (The Hive as Superorganism; Bees & Ecological Interdependence; The Economics & Law of a Managed Resource; Bee Cognition & Swarm Intelligence; Bees Through Deep Time; Apiculture as Craft & Management Philosophy), each spanning seven age-based grade bands (GB-0 early childhood through GB-6 upper secondary). Standards-neutral by design -- no grade-numbering or standards-system language is baked into the content itself; a crosswalk layer mapping onto specific school systems lives in the bee-lpm GitHub repo, not here."
);
emitContent("v_en_id", EN);

out.push("  -- ==========================================================================");
out.push("  -- Child: Bee LPM (Deutsch)");
out.push("  -- ==========================================================================");
emitChildProject(
  "v_de_id",
  DE_ID,
  "bee-lpm-de",
  "Bee LPM (Deutsch)",
  "de",
  "Die deutschsprachige Bee LPM: sechs Stränge (Das Bienenvolk als Überorganismus; Bienen und ökologische Vernetzung; Wirtschaft und Recht einer Ressource; Bienen-Kognition & Schwarmintelligenz; Bienen durch die Tiefenzeit; Imkerei als Handwerk & Haltung), jeweils über sieben altersbasierte Klassenstufenbänder (GB-0 frühe Kindheit bis GB-6 gymnasiale Oberstufe). Standards-neutral konzipiert -- keine Klassenstufen- oder Standards-spezifische Sprache ist im Inhalt selbst verankert; eine Zuordnungsebene zu konkreten Schulsystemen lebt im bee-lpm-GitHub-Repository, nicht hier."
);
emitContent("v_de_id", DE);

out.push("END $MIGRATION$;");

process.stdout.write(out.join("\n") + "\n");

process.stderr.write(
  `\n-- stats: EN ${EN.schemaElementRows.length} concepts, ${EN.dataObjectRows.length} data objects, ${EN.connectionRows.length} connections, ${EN.tagRows.length} tags\n` +
    `-- stats: DE ${DE.schemaElementRows.length} concepts, ${DE.dataObjectRows.length} data objects, ${DE.connectionRows.length} connections, ${DE.tagRows.length} tags\n`
);
