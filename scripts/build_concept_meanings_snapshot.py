#!/usr/bin/env python3
"""Makes the dated copy of ConceptBase (and of how the NetLogo repository uses its words) that the Concept meanings page shows.

    python scripts/build_concept_meanings_snapshot.py [--lab-root D:/dev/openevo-ccs-lab] [--out src/data/concept-meanings.json]

What goes in (all read with `git show` from the latest origin/main of each repository, so a checkout on another branch does not matter):
  conceptbase  registry/concept/*.json (every concept and sandbox entry), registry/alignment/*.json (the comparisons between word lists),
               and, when the branch still exists, the Bio-Core list drafted in the unmerged branch extend-bio-core-evolution-mechanisms.
  netlogo      models/*/metadata.json (the topic tags of each model) and lpm-strands/*.md (which ConceptBase entries each strand guide cites by id).

Read-only on every repository. Nothing is written back. A topic tag of a NetLogo model is NEVER linked to a ConceptBase entry by its name
(Dustin, 3 Nov 2026: link only the same concept with the same definition); the snapshot only lists which entries share the word, as a
reminder that the two have not been compared yet.

The "pile" of each tag is a first sort made by an AI session on 4 Nov 2026 and no expert has reviewed it (TAG_PILES below).
"""
import argparse
import datetime
import json
import os
import re
import subprocess

try:
    import yaml
except ImportError:  # the pending branch is optional
    yaml = None

PENDING_BRANCH = "extend-bio-core-evolution-mechanisms"
PENDING_FILE = "vocabularies/BIO-CORE-v1.2.0.yaml"
CITE = re.compile(r"OE-CONCEPT-[A-Za-z0-9][A-Za-z0-9._\-]*")

# First sort of the 33 tags of the NetLogo models (4 Nov 2026, AI session, unchecked). key = lower-case tag.
# pile: in-conceptbase | pending | probable-match | topic-label | no-entry
TAG_PILES = {
    "cooperation": ("in-conceptbase", None), "evolution": ("in-conceptbase", None), "natural selection": ("in-conceptbase", None), "social dilemma": ("in-conceptbase", None),
    "frequency-dependent selection": ("pending", None), "founder effect": ("pending", None), "kin selection": ("pending", None), "group selection": ("pending", None),
    "multilevel selection": ("pending", None),
    "social norms": ("probable-match", "OE-CONCEPT-oe-interdisciplinary-norms"),
    "swarm intelligence": ("probable-match", "OE-CONCEPT-oe-interdisciplinary-collective-intelligence"),
    "collective behavior": ("probable-match", "OE-CONCEPT-oe-interdisciplinary-collective-intelligence"),
    "collective/quorum decision-making": ("probable-match", "OE-CONCEPT-bee-k12-swarm-decision-making"),
    "behavior": ("topic-label", None), "complex systems": ("topic-label", None), "ecosystem dynamics": ("topic-label", None), "epidemiology": ("topic-label", None),
    "population cycles": ("topic-label", None), "population dynamics": ("topic-label", None), "predator-prey dynamics": ("topic-label", None), "public health": ("topic-label", None),
    "sustainable resource use": ("topic-label", None),
    "altruism": ("no-entry", None), "cognitive biases": ("no-entry", None), "common pool resource": ("no-entry", None), "common pool resources": ("no-entry", None),
    "cultural evolution": ("no-entry", None), "emergence": ("no-entry", None), "ethnocentrism": ("no-entry", None), "interdependence": ("no-entry", None),
    "norm psychology": ("no-entry", None), "social cognition": ("no-entry", None),
}


def git(root, repo, *args):
    out = subprocess.run(["git", "-C", os.path.join(root, repo), *args], capture_output=True, check=False)
    return out.stdout.decode("utf-8", errors="replace") if out.returncode == 0 else None


def show(root, repo, ref, path):
    return git(root, repo, "show", "%s:%s" % (ref, path))


def listing(root, repo, ref, folder):
    text = git(root, repo, "ls-tree", "-r", "--name-only", ref, folder + "/")
    return sorted(text.split("\n")) if text else []


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def concept(raw, tier):
    defs = {}
    for lang, by_disc in (raw.get("definitions") or {}).items():
        if isinstance(by_disc, dict):
            defs[lang] = {d: clean(t) for d, t in by_disc.items() if clean(t)}
    rel = raw.get("relations") or {}
    labels = raw.get("labels") or {}
    return {
        "id": raw["id"], "tier": tier, "label": clean(labels.get("en") or raw["id"]), "labels": {k: clean(v) for k, v in labels.items()},
        "vocabulary": raw.get("definedInVocabulary"), "status": raw.get("status") or (raw.get("sandboxMeta") or {}).get("status"),
        "version": raw.get("version"), "aliases": {k: [clean(a) for a in v] for k, v in (raw.get("aliases") or {}).items()},
        "definitions": defs, "examples": [clean(e) for e in raw.get("examples") or []], "nonExamples": [clean(e) for e in raw.get("nonExamples") or []],
        "broader": rel.get("skos:broader") or [], "narrower": rel.get("skos:narrower") or [], "related": rel.get("skos:related") or [],
        "citations": [clean((c or {}).get("text") if isinstance(c, dict) else c) for c in raw.get("citations") or []],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lab-root", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "src", "data", "concept-meanings.json"))
    a = ap.parse_args()
    root = a.lab_root

    cb_commit = (git(root, "conceptbase", "rev-parse", "--short", "origin/main") or "").strip()
    nl_commit = (git(root, "netlogo", "rev-parse", "--short", "origin/main") or "").strip()

    concepts = []
    for path in listing(root, "conceptbase", "origin/main", "registry/concept"):
        if path.endswith(".json"):
            raw = json.loads(show(root, "conceptbase", "origin/main", path))
            concepts.append(concept(raw, "sandbox" if raw["id"].startswith("OE-SANDBOX-") else "registered"))
    by_id = {c["id"]: c for c in concepts}
    by_label = {}
    for c in concepts:
        by_label.setdefault(c["label"].lower(), []).append(c["id"])

    alignments = []
    for path in listing(root, "conceptbase", "origin/main", "registry/alignment"):
        if path.endswith(".json"):
            r = json.loads(show(root, "conceptbase", "origin/main", path))
            alignments.append({"id": r["id"], "subject": r["subject"], "object": r["object"], "matchType": r.get("matchType"), "status": r.get("status"),
                               "assertedBy": r.get("assertedBy") or [], "date": r.get("date"), "rationale": clean(r.get("rationale"))})

    pending = []
    text = show(root, "conceptbase", "origin/" + PENDING_BRANCH, PENDING_FILE) if yaml else None
    if text:
        for raw in yaml.safe_load(text).get("concepts") or []:
            c = concept(raw, "pending")
            same = [i for i in by_label.get(c["label"].lower(), []) if by_id[i]["tier"] == "registered"]
            c["replaces"] = same[0] if same else None
            c["sameDefinitionAsReplaced"] = bool(same and by_id[same[0]]["definitions"].get("en") == c["definitions"].get("en"))
            pending.append(c)

    tags = {}
    models = {}
    for path in listing(root, "netlogo", "origin/main", "models"):
        if path.endswith("/metadata.json"):
            meta = json.loads(show(root, "netlogo", "origin/main", path))
            slug = str(meta.get("slug") or path.split("/")[1])
            models[slug] = clean(meta.get("title") or slug)
            for t in meta.get("concepts") or []:
                tags.setdefault(clean(t), []).append(slug)
    tag_rows = []
    for t, slugs in sorted(tags.items(), key=lambda kv: kv[0].lower()):
        pile, cand = TAG_PILES.get(t.lower(), ("unsorted", None))
        same_word = by_label.get(t.lower(), []) + [p["id"] for p in pending if p["label"].lower() == t.lower()]
        tag_rows.append({"tag": t, "models": [{"slug": s, "title": models.get(s, s)} for s in sorted(set(slugs))], "pile": pile, "candidate": cand, "sameWord": same_word})

    cites = {}
    for path in listing(root, "netlogo", "origin/main", "lpm-strands"):
        if not path.endswith(".md") or path.lower().endswith("readme.md"):
            continue
        body = show(root, "netlogo", "origin/main", path) or ""
        slug = os.path.basename(path)[:-3]
        head = re.search(r"^#\s+(.+?)\s*$", body, re.M)
        title = re.sub(r"^(LPM Strand|Multi-Model Comparison)\s*:\s*", "", head.group(1) if head else slug).strip()
        for raw in CITE.findall(body):
            cid = raw.rstrip(".,;:)-")
            row = cites.setdefault((cid, slug), {"concept": cid, "guide": slug, "guideTitle": title, "count": 0})
            row["count"] += 1
    cite_rows = sorted(cites.values(), key=lambda r: (r["concept"], r["guide"]))
    known = set(by_id) | {p["id"] for p in pending}
    for r in cite_rows:
        r["inConceptBase"] = r["concept"] in by_id
        r["inPendingBranch"] = r["concept"] in {p["id"] for p in pending}
        r["unknownId"] = r["concept"] not in known

    snap = {
        "asOf": datetime.date.today().isoformat(),
        "sources": {"conceptbase": {"repo": "openevo-ccs/conceptbase", "ref": "origin/main", "commit": cb_commit, "pendingBranch": PENDING_BRANCH if pending else None},
                    "netlogo": {"repo": "openevo-ccs/netlogo", "ref": "origin/main", "commit": nl_commit}},
        "concepts": concepts, "alignments": alignments, "pending": pending, "netlogoTags": tag_rows, "netlogoCitations": cite_rows,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(snap, fh, ensure_ascii=False, separators=(",", ":"))
    print("concepts %d (registered %d), alignments %d, pending %d, tags %d, citations %d -> %s (%d KB)" % (
        len(concepts), sum(1 for c in concepts if c["tier"] == "registered"), len(alignments), len(pending), len(tag_rows), len(cite_rows), a.out, os.path.getsize(a.out) // 1024))


if __name__ == "__main__":
    main()
