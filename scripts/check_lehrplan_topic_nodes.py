#!/usr/bin/env python3
"""Checks the data file behind the Lehrplan topic-node migration. Exit code 1 when anything is wrong.

    python scripts/check_lehrplan_topic_nodes.py [data.json] [migration.sql]

What is checked here (the data holds no source text, so checks against the originals ran before the file was written, in a private folder):
structure (edition > grade band > topic, parents exist, keys unique inside a space, sort order), every field present, page references in the
form p. 12 or pp. 12-13, a 64-character checksum, a web address and a date per document, topic and grade band labels at most 12 words in English, summaries
between 100 and 560 characters and at most four sentences, German and English summaries in the right language, banned wording, no identical
summary twice in one edition, and, when the
migration file is given, that every node key of the data file is in it.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "scripts" / "data" / "lehrplan_topic_nodes_2026-11-16.json"
BANNED = re.compile(r", not |, nicht |\bnot (just|only)\b|\bnicht nur\b|\b(real|really|actually|genuine|genuinely|honestly|leverage|robust|seamless|unlock|load-bearing)\b|\becht\b|\btatsächlich\b|\bwirklich\b", re.I)
DE_ONLY = {"und", "der", "die", "das", "den", "dem", "des", "mit", "von", "für", "sind", "wird", "werden", "bei", "aus", "über", "durch", "sich", "dabei", "auch", "zum", "zur", "oder", "dass", "ihre", "ihren", "können", "lernenden"}
EN_ONLY = {"the", "and", "of", "with", "they", "their", "is", "are", "how", "from", "by", "that", "also", "pupils"}
PAGES = re.compile(r"^pp?\. \d+(–\d+)?$")
LEVELS = ("edition", "grade_band", "topic")


def words(s):
    return re.findall(r"[\wäöüÄÖÜß]+", s.lower())


def check(data, migration_text=None):
    errors = []
    if data.get("origin") != "lehrplan-pdf-2026-11":
        errors.append("origin is not lehrplan-pdf-2026-11")
    seen = {}
    total = 0
    for d in data["documents"]:
        tag = d["source_title"][:60]
        for k in ("project_slug", "ministry", "source_url", "retrieved_on", "sha256", "edition_key"):
            if not d.get(k):
                errors.append(f"{tag}: {k} is empty")
        if not re.fullmatch(r"[0-9a-f]{64}", d.get("sha256", "")):
            errors.append(f"{tag}: sha256 is not 64 hex characters")
        if not d.get("source_url", "").startswith("https://"):
            errors.append(f"{tag}: source_url is not an https address")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d.get("retrieved_on", "")):
            errors.append(f"{tag}: retrieved_on is not a date")
        keys = {}
        topic_summaries = []
        for n in d["nodes"]:
            total += 1
            where = f"{tag} / {n.get('node_key', '?')[-50:]}"
            if n["level"] not in LEVELS:
                errors.append(f"{where}: level {n['level']!r}")
                continue
            sk = (d["project_slug"], n["node_key"])
            if sk in seen:
                errors.append(f"{where}: node_key used twice in the space")
            seen[sk] = n
            keys[n["node_key"]] = n
            if not n.get("label_de") or not n.get("label_en"):
                errors.append(f"{where}: a label is empty")
            if n["level"] != "edition" and len(words(n.get("label_en") or "")) > 12:
                errors.append(f"{where}: label_en over 12 words")
            if not n.get("subject") or not n.get("school_type"):
                errors.append(f"{where}: subject or school type missing")
            for fld in ("label_de", "label_en", "summary_de", "summary_en"):
                if n.get(fld) and BANNED.search(n[fld]):
                    errors.append(f"{where}: banned wording in {fld}: {BANNED.search(n[fld]).group(0)!r}")
            if n["level"] == "edition":
                if n["parent_key"] is not None:
                    errors.append(f"{where}: an edition has a parent")
                if n["node_key"] != d["edition_key"]:
                    errors.append(f"{where}: edition key differs from the document's")
                continue
            parent = keys.get(n["parent_key"])
            if parent is None:
                errors.append(f"{where}: parent {n['parent_key']!r} missing or listed after the child")
            elif LEVELS.index(parent["level"]) != LEVELS.index(n["level"]) - 1:
                errors.append(f"{where}: parent level {parent['level']} does not fit {n['level']}")
            if not n.get("source_pages") or not PAGES.match(n["source_pages"]):
                errors.append(f"{where}: source_pages {n.get('source_pages')!r}")
            if n["level"] == "grade_band":
                if n.get("summary_de") or n.get("summary_en"):
                    errors.append(f"{where}: a grade band carries a summary")
                continue
            de, en = n.get("summary_de") or "", n.get("summary_en") or ""
            for nm, t in (("summary_de", de), ("summary_en", en)):
                if not (100 <= len(t) <= 560):
                    errors.append(f"{where}: {nm} has {len(t)} characters")
                if len([s for s in re.split(r"(?<=[.!?])\s+", t.strip()) if s]) > 4:
                    errors.append(f"{where}: {nm} has more than four sentences")
            if sum(1 for w in words(de) if w in EN_ONLY) > 1:
                errors.append(f"{where}: summary_de looks English")
            if sum(1 for w in words(en) if w in DE_ONLY) > 1:
                errors.append(f"{where}: summary_en looks German")
            topic_summaries.append((where, de, en))
        # the same summary twice in one edition is a sign of a copy mistake
        seen_text = {}
        for where, de, en in topic_summaries:
            for t in (de, en):
                if t in seen_text:
                    errors.append(f"{where} and {seen_text[t]}: identical summary")
                seen_text[t] = where
    if migration_text is not None:
        for (slug, key) in seen:
            if "'" + key.replace("'", "''") + "'" not in migration_text:
                errors.append(f"migration lacks node key {key}")
    return errors, total


def main():
    data_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA
    mig = Path(sys.argv[2]).read_text(encoding="utf-8") if len(sys.argv) > 2 else None
    data = json.loads(data_path.read_text(encoding="utf-8"))
    errors, total = check(data, mig)
    for e in errors[:80]:
        print("ERROR", e)
    print(f"{total} nodes in {len(data['documents'])} editions, {len(errors)} problems")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
