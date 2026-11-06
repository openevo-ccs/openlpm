#!/usr/bin/env python3
"""Cuts the checked-in input file for migration 225 out of the private test folder.

    python scripts/extract_four_space_topic_links_input.py [--source <results_r2/stage-topic-links.json>] [--out scripts/data/four-space-topic-links-2026-11-02.json]

The test (2 Nov 2026) linked the stages of the four synthetic LPM spaces to the topics of the Thueringen Lehrplan Biologie and
Mensch-Natur-Technik. Its working folder stays on a private PC because it holds Lehrplan wording. This script keeps only what the
database needs and nothing else, so the input file holds no Lehrplan text:

    space, stageId, nodeId, class, share (as a number), concepts (our own concept names)

Topic headings, stage titles, the "sense" notes and the per-concept fit and emphasis are left out on purpose. Only the classes
"covers" and "partly" are kept. Rows are sorted, so running this twice gives the same file.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = Path("D:/dev_local/curriculum-data/thuringia-bio-four-space-test/results_r2/stage-topic-links.json")
DEFAULT_OUT = ROOT / "scripts" / "data" / "four-space-topic-links-2026-11-02.json"
SPACE_ORDER = ["bio", "soc", "comp", "int"]
KEEP_CLASSES = {"covers", "partly"}
METHOD = (
    "Two independent AI labelling passes per space against that space's own concepts, reading the Lehrplan wording kept on a private PC; "
    "links by shared concepts; 2 Nov 2026"
)
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def cut(rows):
    out = []
    for r in rows:
        if r["class"] not in KEEP_CLASSES:
            continue
        if not (UUID.match(r["stageId"]) and UUID.match(r["nodeId"])):
            sys.exit(f"Not a uuid: {r['stageId']} / {r['nodeId']}")
        out.append({
            "space": r["space"],
            "stageId": r["stageId"],
            "nodeId": r["nodeId"],
            "class": r["class"],
            "share": round(float(r["shareOfStage"]), 3),
            "concepts": sorted({s["concept"] for s in r["shared"]}),
        })
    out.sort(key=lambda x: (SPACE_ORDER.index(x["space"]), x["stageId"], x["nodeId"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    rows = json.loads(Path(args.source).read_text(encoding="utf-8"))
    links = cut(rows)
    lines = ",\n".join("  " + json.dumps(link, ensure_ascii=False) for link in links)
    text = f'{{\n "version": "2026-11-02",\n "method": {json.dumps(METHOD)},\n "links": [\n{lines}\n ]\n}}\n'
    Path(args.out).write_text(text, encoding="utf-8")
    print(f"{len(links)} links written to {args.out}")


if __name__ == "__main__":
    main()
