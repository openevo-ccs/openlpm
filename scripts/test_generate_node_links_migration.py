"""Tests for the node-links migration generator. Run: python scripts/test_generate_node_links_migration.py

The main test is the zero-diff check: the migration file in the repository must be exactly what the generator writes from the checked-in
input file. The others check the input (no Lehrplan wording, nothing but the agreed fields) and the rules the generator enforces.
"""
import copy
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_node_links_migration as gen  # noqa: E402

INPUT = json.loads(gen.DEFAULT_INPUT.read_text(encoding="utf-8"))
MIGRATION = gen.DEFAULT_OUT.read_text(encoding="utf-8")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def good_link(**kw):
    base = {"space": "bio", "stageId": "4f1b4d5d-6232-5ef5-b44c-a850224b58a5", "nodeId": "257cb19f-c497-5d5f-94ea-0d2d55e96ced",
            "class": "covers", "share": 0.5, "concepts": ["Gene"]}
    base.update(kw)
    return base


def test_migration_regenerates_with_zero_diff():
    assert gen.render_migration(INPUT) == MIGRATION, "run: python scripts/generate_node_links_migration.py"


def test_generation_is_repeatable():
    assert gen.render_migration(copy.deepcopy(INPUT)) == gen.render_migration(copy.deepcopy(INPUT))


def test_check_mode_agrees_with_the_file():
    import subprocess
    r = subprocess.run([sys.executable, "-I", str(Path(gen.__file__)), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


def test_input_has_103_rows_per_space_and_only_the_agreed_fields():
    links = INPUT["links"]
    assert len(links) == 103
    counts = {s: sum(1 for x in links if x["space"] == s) for s in gen.SPACE_SLUGS}
    assert counts == {"bio": 44, "soc": 7, "comp": 1, "int": 51}
    assert set(INPUT) == {"version", "method", "links"}
    for x in links:
        assert set(x) == gen.ALLOWED_KEYS
        assert UUID.match(x["stageId"]) and UUID.match(x["nodeId"])
        assert x["class"] in ("covers", "partly")
        assert 0 < x["share"] <= 1
        assert x["concepts"] and all(isinstance(c, str) for c in x["concepts"])


def test_input_holds_no_lehrplan_wording():
    # Concept names are our own English words. Topic headings, summaries and "sense" notes are not in the file at all.
    names = {c for x in INPUT["links"] for c in x["concepts"]}
    assert len(names) == 23 and all(re.fullmatch(r"[A-Z][A-Za-z ]+", n) for n in names), sorted(names)
    text = json.dumps(INPUT, ensure_ascii=False)
    assert not re.search(r"[äöüÄÖÜß]", text), "German characters in the input"
    assert "heading" not in text.lower() and "Zusammenh" not in text


def test_method_text_is_the_agreed_one():
    assert INPUT["method"] == (
        "Two independent AI labelling passes per space against that space's own concepts, reading the Lehrplan wording kept on a private PC; "
        "links by shared concepts; 2 Nov 2026"
    )
    assert gen.q(INPUT["method"]) in MIGRATION


def test_every_seeded_row_is_a_draft_with_open_vocabulary_columns():
    assert "'ai-draft'" in MIGRATION and "DEFAULT 'ai-draft'" in MIGRATION
    assert "relation_type TEXT NOT NULL DEFAULT 'proposed_covers'" in MIGRATION
    assert not re.search(r"CREATE TYPE|AS ENUM", MIGRATION), "open vocabularies are plain text"
    rows = re.findall(r"^  \('(?:[a-z-]+)', '[0-9a-f-]{36}', '[0-9a-f-]{36}', 'proposed_(?:covers|partly)'", MIGRATION, re.M)
    assert len(rows) == 103


def test_insert_is_safe_to_run_twice_and_casts_every_id():
    assert "UNIQUE (data_object_id, node_id)" in MIGRATION
    assert "ON CONFLICT (data_object_id, node_id) DO NOTHING" in MIGRATION
    for cast in ("v.stage_id::uuid", "v.node_id::uuid", "v.share::numeric", "v.shared_concepts::jsonb"):
        assert cast in MIGRATION, cast
    assert "o.project_id = p.id" in MIGRATION, "a stage must belong to the space its code names"


def test_policies_use_functions_that_exist_in_earlier_migrations():
    migrations = Path(gen.ROOT) / "supabase" / "migrations"
    earlier = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in sorted(migrations.glob("[0-9]*.sql")) if p.name < gen.DEFAULT_OUT.name)
    body = MIGRATION.split("CREATE POLICY", 1)[1]
    used = set(re.findall(r"\b(is_admin|is_project_member|has_project_role)\(", body))
    assert used == {"is_admin", "is_project_member", "has_project_role"}, used
    for fn in used:
        assert re.search(rf"CREATE OR REPLACE FUNCTION {fn}\(", earlier), f"{fn} is not defined in an earlier migration"
    assert "ENABLE ROW LEVEL SECURITY" in MIGRATION
    assert MIGRATION.count("CREATE POLICY") == 2


def test_the_counting_function_is_closed_to_anon_and_returns_no_names():
    assert "REVOKE ALL ON FUNCTION curriculum_repository_node_link_counts(UUID) FROM anon" in MIGRATION
    sig = re.search(r"RETURNS TABLE \(([^)]*)\)", MIGRATION).group(1)
    assert sig == "node_id UUID, links INTEGER, spaces INTEGER"


def test_migration_text_has_no_banned_constructions():
    assert not re.search(r", " + r"not |not " + r"just", MIGRATION)
    assert "No expert has checked it yet" not in MIGRATION
    assert "AI draft." not in MIGRATION


def test_bad_rows_are_refused():
    for bad, why in (
        ({"space": "xyz"}, "unknown space"),
        ({"class": "adjacent"}, "class"),
        ({"share": 0}, "share"),
        ({"share": 1.5}, "share"),
        ({"concepts": []}, "concepts"),
        ({"concepts": ["Gene", " "]}, "concepts"),
    ):
        try:
            gen.link_rows({"links": [good_link(**bad)]})
        except ValueError:
            continue
        raise AssertionError(f"accepted a row with a bad {why}: {bad}")
    extra = good_link()
    extra["topicHeading"] = "anything"
    try:
        gen.link_rows({"links": [extra]})
    except ValueError:
        pass
    else:
        raise AssertionError("accepted an extra field")
    try:
        gen.link_rows({"links": [good_link(), good_link()]})
    except ValueError:
        pass
    else:
        raise AssertionError("accepted a duplicate pair")


def test_quotes_are_escaped_in_sql():
    assert gen.q("that space's own") == "'that space''s own'"
    rows = gen.link_rows({"links": [good_link(concepts=["Niche Construction", "O'Brien"])]})
    assert rows[0]["shared_concepts"] == '["Niche Construction","O\'Brien"]'
    text = gen.render_migration({"method": "it's", "links": [good_link(concepts=["O'Brien"])]})
    assert "'it''s'" in text and "O''Brien" in text


def test_relation_and_rationale_follow_the_class():
    rows = gen.link_rows({"links": [good_link(), good_link(nodeId="3fe08921-3152-434a-b819-724271a799ac", **{"class": "partly", "share": 0.346})]})
    assert [r["relation_type"] for r in rows] == ["proposed_covers", "proposed_partly"]
    assert rows[1]["share"] == "0.346"
    assert rows[1]["rationale"] == "Shared concepts: Gene. They make up about 35% of the stage's concept weight."


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(len(tests), "tests passed")
