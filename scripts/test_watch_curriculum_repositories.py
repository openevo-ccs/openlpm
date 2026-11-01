"""Tests for the pure parts of the audit and the daily watch. Run: python scripts/test_watch_curriculum_repositories.py"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_curriculum_repositories as audit  # noqa: E402
import watch_curriculum_repositories as watch  # noqa: E402


def rec(i, project, rtype="policy-timeline-event", title="Event", content=None, tier="citation-only", **kw):
    base = {"id": i, "project_id": project, "record_type": rtype, "jurisdiction": "DE-TH", "source_repo": "x", "source_record_id": i,
            "title": title, "content": content or {}, "access_tier": tier, "license_or_rights_note": None, "event_date": None,
            "effective_from": None, "effective_until": None, "supersedes_record_id": None,
            "created_at": "2026-10-01T00:00:00+00:00", "updated_at": "2026-10-01T00:00:00+00:00"}
    base.update(kw)
    return base


def dataset(records):
    return {"fetched_at": "t", "projects": [{"id": "p1", "slug": "thuringia-curriculum-repository", "name": "T", "parent_project_id": None,
                                              "project_kind": "curriculum-repository", "focus_type": "regional", "is_private": True,
                                              "content_license": None, "region_tags": ["DE-TH"]}],
            "records": records, "project_links": [], "record_links": [], "record_tags": []}


PROV = {"provenance": {"review_status": "author-draft", "added_by": "x", "extracted_by": "llm"}}


def test_checks_find_the_planted_problems():
    recs = [
        rec("a", "p1", title="No link", content={**PROV, "dateStart": "2026-01-01"}),
        rec("b", "p1", title="Test", source_repo="diagnostic-test"),
        rec("c", "p1", "institutional-mandate-record", "Cite only with translation", {**PROV, "sourceUrl": "https://x.gov/a", "adoptionDate": "2026-01-01", "statementTextEn": "official words"}),
        rec("d", "p1", title="Excerpt without note", tier="excerpt-only", content={**PROV, "sourceUrl": "https://x.gov/b", "dateStart": "2026-02-01"}, event_date="2026-02-01"),
        rec("e", "p1", title="Planned but past", content={**PROV, "sourceUrl": "https://x.gov/c", "temporalStatus": "planned-future", "dateStart": "2026-03-01"}, event_date="2026-03-01"),
    ]
    rep = audit.analyse(dataset(recs), today=date(2026, 11, 1))
    found = {(i["check"], i["source_record_id"]) for i in rep["issues"]}
    assert ("C01", "a") in found and ("C02b", "a") in found
    assert ("C07", "b") in found
    assert ("C03b", "c") in found
    assert ("C03", "d") in found
    assert ("C11", "e") in found
    assert rep["repos"]["thuringia-curriculum-repository"]["reviewed_by_person"] == 0


def test_a_clean_record_raises_nothing():
    recs = [rec("z", "p1", content={**PROV, "sourceUrl": "https://x.gov/z", "dateStart": "2025-01-01", "verificationStatus": "primary-source-confirmed"}, event_date="2025-01-01")]
    rep = audit.analyse(dataset(recs), today=date(2026, 11, 1))
    assert rep["issues"] == [], rep["issues"]


def test_sibling_tracks_are_not_medium_duplicates():
    a = rec("DE-X-b12-evo-gA", "p1", "institutional-mandate-record", "Grade 12: Evolution", {**PROV, "sourceUrl": "u", "courseLevel": "gA"})
    b = rec("DE-X-b12-evo-eA", "p1", "institutional-mandate-record", "Grade 12: Evolution", {**PROV, "sourceUrl": "u", "courseLevel": "eA"})
    assert not [i for i in audit.analyse(dataset([a, b]), today=date(2026, 11, 1))["issues"] if i["check"] == "C06"]


def test_digest_reports_only_what_changed():
    old_recs = [rec("a", "p1", title="No link", content=PROV)]
    new_recs = [rec("b", "p1", title="Another without link", content=PROV)]
    old = watch.make_snapshot(audit.analyse(dataset(old_recs), today=date(2026, 11, 1)), [], {})
    new = watch.make_snapshot(audit.analyse(dataset(new_recs), today=date(2026, 11, 2)), [], {})
    stats = {"looked": 0, "skipped_robots": 0}
    same = watch.digest(new, watch.compare(new, new), "2026-11-02", stats)
    assert "No changes since the last run." in same
    diff = watch.compare(old, new)
    assert len(diff["new"]) >= 1 and len(diff["gone"]) >= 1
    text = watch.digest(new, diff, "2026-11-01", stats)
    assert "New problems" in text and "no longer show up" in text
    assert "First run" in watch.digest(new, watch.compare(None, new), None, stats)


def test_project_side_checks():
    repo_rec = rec("m", "p1", "institutional-mandate-record", "Bands", {**PROV, "sourceUrl": "u", "gradeBands": ["5/6", "7/8"]})
    data = dataset([repo_rec])
    data["project_links"] = [{"project_id": "q1", "repository_project_id": "p1"}]
    data["project_goals"] = [{"id": "g1", "project_id": "q1", "grade_band": "5/6", "curriculum_version": "2026"},
                             {"id": "g2", "project_id": "q1", "grade_band": "9", "curriculum_version": None},
                             {"id": "s1", "project_id": "syn", "grade_band": "K-2", "curriculum_version": None}]
    data["project_links"].append({"project_id": "syn", "repository_project_id": "p1"})
    data["record_links"] = [{"data_object_id": "g1", "repository_record_id": "m", "relation_type": "built_from", "project_id": "q1"}]
    data["node_goals"] = [{"node_id": "n", "data_object_id": "g1", "project_id": "q1"}]
    data["all_projects"] = [{"id": "q1", "slug": "evo"}, {"id": "syn", "slug": "synthetic"}]
    rep = audit.analyse(data, today=date(2026, 11, 1))
    found = {(i["check"], i["repo"]) for i in rep["issues"]}
    assert ("C16", "project:evo") in found and ("C17", "project:evo") in found and ("C18", "project:evo") in found
    assert not [i for i in rep["issues"] if i["repo"] == "project:synthetic"]


def test_page_hash_ignores_layout_and_scripts():
    one = b"<html><head><script>var a=1</script></head><body><nav>menu</nav><p>Lehrplan 2026</p></body></html>"
    two = b"<html><head><script>var a=2</script></head><body><nav>other menu</nav>\n<p>Lehrplan   2026</p></body></html>"
    three = b"<html><body><p>Lehrplan 2027</p></body></html>"
    assert watch.readable_hash(one, "text/html") == watch.readable_hash(two, "text/html")
    assert watch.readable_hash(one, "text/html") != watch.readable_hash(three, "text/html")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(len(tests), "tests passed")
