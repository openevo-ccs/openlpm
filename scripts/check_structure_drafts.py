#!/usr/bin/env python3
"""Checks the drafted labels and summaries of the Thueringen structure tree against the pilot tree. Exit code 1 when anything is wrong.

    python scripts/check_structure_drafts.py [tree.json] [drafts.json]

What is checked by code (a person still has to read the texts): same order and length as the tree; headings copied exactly; every field present
and not empty; summaries at most 200 characters; English labels at most 8 words and English text free of German function words; numbering such
as 2.2.1 kept in English labels; no run of more than 4 words copied from a heading or goal title (except in the headings themselves); no
the contrast construction built on a comma and the word not; no filler words.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GERMAN = re.compile(r"\b(und|der|die|das|den|dem|des|ein|eine|einer|mit|von|zu|zur|zum|für|sind|wird|werden|bei|auf|aus|nicht|über|durch|wie)\b", re.I)
BANNED = re.compile(r", " + r"not |" + r"not " + r"just|\b(genuine|genuinely|really|actually|honestly)\b|\becht\b|\btatsächlich\b|\bwirklich\b", re.I)
NUMBERING = re.compile(r"^\s*(\d+(\.\d+)*)\b")


def words(s):
    return re.findall(r"[\wäöüÄÖÜß-]+", s.lower())


def runs(s, size=5):
    w = words(s)
    return {tuple(w[i:i + size]) for i in range(len(w) - size + 1)}


def check(tree, drafts):
    errors = []
    if len(tree) != len(drafts):
        return [f"length differs: tree {len(tree)}, drafts {len(drafts)}"]
    for i, (node, d) in enumerate(zip(tree, drafts)):
        where = f"topic {i} ({node['topic'][:30]!r})"
        expected_topic = node["topic"] or "Weitere Lernziele"
        if d.get("band") != node["band"]:
            errors.append(f"{where}: band {d.get('band')!r} differs")
        if d.get("topic_de") != expected_topic:
            errors.append(f"{where}: topic_de {d.get('topic_de')!r} is not the heading {expected_topic!r}")
        subs = d.get("subtopics") or []
        if len(subs) != len(node["subtopics"]):
            errors.append(f"{where}: {len(subs)} subtopics, expected {len(node['subtopics'])}")
            continue
        items = [(where, d, expected_topic, [t for s in node["subtopics"] for t in s["sample_titles"]])]
        for j, (sub, sd) in enumerate(zip(node["subtopics"], subs)):
            expected = sub["label"] or expected_topic
            if sd.get("label_de") != expected:
                errors.append(f"{where} sub {j}: label_de {sd.get('label_de')!r} is not the heading {expected!r}")
            items.append((f"{where} sub {j}", sd, expected, sub["sample_titles"]))
        for w, item, heading, titles in items:
            for field in ("label_en", "summary_de", "summary_en"):
                if not isinstance(item.get(field), str) or not item[field].strip():
                    errors.append(f"{w}: {field} is empty")
            if errors and any(e.startswith(w) and "is empty" in e for e in errors):
                continue
            le, sde, sen = item["label_en"], item["summary_de"], item["summary_en"]
            n_words = len(words(NUMBERING.sub("", le, count=1)))  # the numbering (2.2.1, 10.3) does not count as a word
            if n_words > 8:
                errors.append(f"{w}: label_en has {n_words} words")
            m = NUMBERING.match(heading)
            if m and not le.strip().startswith(m.group(1)):
                errors.append(f"{w}: label_en lost the numbering {m.group(1)}")
            for field, text in (("summary_de", sde), ("summary_en", sen)):
                if len(text) > 200:
                    errors.append(f"{w}: {field} has {len(text)} characters")
            for field, text in (("label_en", le), ("summary_en", sen)):
                if len(GERMAN.findall(text)) >= 2:
                    errors.append(f"{w}: {field} contains German words: {GERMAN.findall(text)[:4]}")
            for field, text in (("label_en", le), ("summary_de", sde), ("summary_en", sen)):
                if BANNED.search(text):
                    errors.append(f"{w}: {field} has banned wording: {BANNED.search(text).group(0)!r}")
            source_runs = runs(heading) | {r for t in titles for r in runs(t)}
            for field, text in (("summary_de", sde), ("summary_en", sen)):
                shared = runs(text) & source_runs
                if shared:
                    errors.append(f"{w}: {field} copies {len(next(iter(shared)))} words in a row: {' '.join(next(iter(shared)))!r}")
    return errors


def main():
    tree_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "scripts/data/thueringen_lehrplan_structure_tree_2026_11_02.json"
    drafts_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "scripts/data/thueringen_structure_drafts_2026_11_02.json"
    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    drafts = json.loads(drafts_path.read_text(encoding="utf-8"))
    errors = check(tree, drafts)
    topics = len(drafts)
    subs = sum(len(d.get("subtopics", [])) for d in drafts)
    print(f"{topics} topics, {subs} subtopics, {len(errors)} problems")
    for e in errors[:60]:
        print(" -", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
