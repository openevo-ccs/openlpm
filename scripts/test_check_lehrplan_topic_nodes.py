#!/usr/bin/env python3
"""Tests for scripts/check_lehrplan_topic_nodes.py.   python scripts/test_check_lehrplan_topic_nodes.py"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_lehrplan_topic_nodes as C  # noqa: E402

SHA = "a" * 64
DE = "Die Lernenden untersuchen Stoffe im Alltag, vergleichen ihre Eigenschaften und planen einfache Versuche dazu. Sie halten die Ergebnisse in Tabellen fest."
EN = "Pupils examine everyday substances, compare their properties and plan simple experiments. They record the results in tables and share them with the class."


def good():
    nodes = [
        {"node_key": "DE-XX/chemie/gymnasium/2020-pdf", "parent_key": None, "level": "edition", "subject": "chemie", "school_type": "Gymnasium", "grade_band": None,
         "sort_order": 0, "label_de": "Chemie", "label_en": "Chemistry", "summary_de": None, "summary_en": None, "source_pages": None, "facts": {}},
        {"node_key": "DE-XX/chemie/gymnasium/2020-pdf/7", "parent_key": "DE-XX/chemie/gymnasium/2020-pdf", "level": "grade_band", "subject": "chemie", "school_type": "Gymnasium",
         "grade_band": "7", "sort_order": 1, "label_de": "Klassenstufe 7", "label_en": "Grade 7", "summary_de": None, "summary_en": None, "source_pages": "p. 5", "facts": {}},
        {"node_key": "DE-XX/chemie/gymnasium/2020-pdf/7/stoffe", "parent_key": "DE-XX/chemie/gymnasium/2020-pdf/7", "level": "topic", "subject": "chemie", "school_type": "Gymnasium",
         "grade_band": "7", "sort_order": 1, "label_de": "Stoffe", "label_en": "Substances", "summary_de": DE, "summary_en": EN, "source_pages": "pp. 5–6", "facts": {}},
    ]
    return {"origin": "lehrplan-pdf-2026-11", "documents": [{"source_title": "Test", "project_slug": "x", "ministry": "M", "source_url": "https://example.org/a.pdf",
                                                              "retrieved_on": "2026-11-16", "sha256": SHA, "edition_key": nodes[0]["node_key"], "nodes": nodes}]}


class Checks(unittest.TestCase):
    def test_good_data_passes(self):
        errors, total = C.check(good())
        self.assertEqual(errors, [])
        self.assertEqual(total, 3)

    def test_missing_parent(self):
        d = good()
        d["documents"][0]["nodes"][2]["parent_key"] = "nope"
        self.assertTrue(any("parent" in e for e in C.check(d)[0]))

    def test_banned_wording(self):
        d = copy.deepcopy(good())
        d["documents"][0]["nodes"][2]["summary_en"] = EN + " This is a robust method."
        self.assertTrue(any("banned" in e for e in C.check(d)[0]))

    def test_contrast_construction(self):
        d = copy.deepcopy(good())
        d["documents"][0]["nodes"][2]["summary_en"] = "Pupils study air, not water, and they describe what they find in a short note to the class."
        self.assertTrue(any("banned" in e for e in C.check(d)[0]))

    def test_wrong_language(self):
        d = copy.deepcopy(good())
        d["documents"][0]["nodes"][2]["summary_en"] = DE
        self.assertTrue(any("looks German" in e for e in C.check(d)[0]))

    def test_page_format(self):
        d = copy.deepcopy(good())
        d["documents"][0]["nodes"][2]["source_pages"] = "Seite 5"
        self.assertTrue(any("source_pages" in e for e in C.check(d)[0]))


if __name__ == "__main__":
    unittest.main()
