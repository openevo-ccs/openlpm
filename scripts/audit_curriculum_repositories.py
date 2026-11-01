#!/usr/bin/env python3
"""Read-only audit of every Curriculum Repository space in OpenLPM.

Reads the live tables (curriculum_repository_records, project_repository_links,
curriculum_repository_links, curriculum_repository_record_tags) with the same
service_role convention as pull_feedback.mjs / import_curriculum_repository.py,
runs a fixed set of checks, and writes a machine-readable report plus a
plain-language scorecard. Changes nothing in the database.

Usage:
    python scripts/audit_curriculum_repositories.py --out <dir>
    python scripts/audit_curriculum_repositories.py --out <dir> --from-dir <dir>   # offline, reuse a saved raw dump
    python scripts/audit_curriculum_repositories.py --out <dir> --src-deutsche <path> --src-nys <path>
    python scripts/audit_curriculum_repositories.py --out <dir> --links            # also check every source URL (slow, polite)

Every check has an id (C01 ...). The scheduled monitor (scripts/monitor_curriculum_repositories.py)
imports analyse() from here and reports only what changed since the last run.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUPABASE_URL = "https://tfynvjjxyluzorigyfsp.supabase.co"

# Record types whose content should carry a source link. The other types are
# our own analysis (findings, principles, redesigns) and cite other records.
EXPECT_URL_FIELD = {
    "policy-timeline-event": "sourceUrl",
    "institutional-mandate-record": "sourceUrl",
    "institutional-actor-record": "url",
}
DISTINGUISHING_FIELDS = ("courseLevel", "schoolType", "gradeFrom", "gradeTo", "unitNumber", "subject", "lehrplanEdition")
DATE_FIELDS = ("dateStart", "adoptionDate", "effectiveFrom", "targetDate", "outcomeDate")
# statementText is removed by the importer on citation-only rows; its English translation (statementTextEn) is not.
# sourcePassage is a page reference in the India records and is not checked here.
TEXT_FIELDS_BEYOND_CITATION = ("statementText", "statementTextEn")
OFFICIAL_HOST = re.compile(
    r"(\.gov$|\.gov\.[a-z]{2}$|\.gouv\.|\.nic\.in$|\.edu$|\.ac\.in$|\.state\.[a-z]{2}\.us$|\.k12\.[a-z]{2}\.us$|"
    r"(^|\.)(thueringen|sachsen|sachsen-anhalt|bildung-lsa|kmk|bildungsserver|schulportal-thueringen|"
    r"schule-in-thueringen|thillm|bmbf|bmbfsfj|bmftr|bpb|nysed|cde\.ca|fldoe|ncert|cbse|scert|kite|ssa)\b)"
)
SECONDARY_HINT = re.compile(r"wikipedia|wikimedia|edweek|ncse|nytimes|washingtonpost|tagesspiegel|bildungsklick|"
                            r"spiegel|zeit\.de|faz\.net|reuters|apnews|npr\.org|newspaper|blog|medium\.com")


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------

def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env.strip()
    for base in (ROOT, ROOT.parent / "openlpm"):
        p = base / ".supabase-secrets" / "service-role-key.txt"
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    sys.exit("No service_role key: set SUPABASE_SERVICE_ROLE_KEY or fill .supabase-secrets/service-role-key.txt")


def _get(path_query: str, key: str, page: int = 1000) -> list:
    rows, start = [], 0
    while True:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{path_query}",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Range-Unit": "items", "Range": f"{start}-{start + page - 1}"},
        )
        with urllib.request.urlopen(req, timeout=90) as r:
            chunk = json.loads(r.read().decode("utf-8"))
        rows += chunk
        if len(chunk) < page:
            return rows
        start += page


def fetch_all() -> dict:
    key = load_service_role_key()
    projects = _get("projects?select=id,slug,name,parent_project_id,project_kind,focus_type,is_private,"
                    "content_license,region_tags,created_at,updated_at&project_kind=eq.curriculum-repository", key)
    ids = ",".join(p["id"] for p in projects)
    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "projects": projects,
        "records": _get(f"curriculum_repository_records?select=*&project_id=in.({ids})&order=created_at", key),
        "project_links": _get("project_repository_links?select=*", key),
        "record_links": _get("curriculum_repository_links?select=id,project_id,data_object_id,repository_record_id,"
                             "relation_type,created_at", key),
        "record_tags": _get("curriculum_repository_record_tags?select=*", key),
    }


def save_raw(data: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for k, v in data.items():
        (out / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False), encoding="utf-8")


def load_raw(src: Path) -> dict:
    names = ["projects", "records", "project_links", "record_links", "record_tags"]
    data = {n: json.loads((src / f"{n}.json").read_text(encoding="utf-8")) for n in names}
    meta = src / "fetched_at.json"
    data["fetched_at"] = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else "offline"
    return data


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def parse_day(s) -> date | None:
    """Accepts 2026, 2026-03, 2026-03-07 and ISO timestamps. Missing parts become the first day."""
    if not s:
        return None
    m = re.match(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?", str(s))
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2) or 1), int(m.group(3) or 1))
    except ValueError:
        return None


def norm_title(t: str) -> list[str]:
    return re.findall(r"[a-z0-9äöüß]+", (t or "").lower())


def jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = set(a), set(b)
    return len(sa & sb) / len(sa | sb) if sa and sb else 0.0


def host_of(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def content_urls(rec: dict) -> list[str]:
    c = rec.get("content") or {}
    out = []
    for k in ("sourceUrl", "url"):
        v = c.get(k)
        if isinstance(v, str) and v.strip():
            out.append(v.strip())
    return out


def prov(rec: dict) -> dict:
    p = (rec.get("content") or {}).get("provenance")
    return p if isinstance(p, dict) else {}


def has_fffd(obj) -> bool:
    return "�" in json.dumps(obj, ensure_ascii=False)


# --------------------------------------------------------------------------
# Drift against the version-controlled source repositories
# --------------------------------------------------------------------------

def source_drift(db_records: list[dict], src_deutsche: Path | None, src_nys: Path | None) -> dict:
    """Compare DB rows with the YAML in deutsche_lp / nys_lp / the in-repo curriculum-sources.
    Returns {} when the importer module cannot be loaded."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        import import_curriculum_repository as imp  # type: ignore
    except Exception as e:  # pragma: no cover
        return {"error": f"importer not loadable: {e}"}
    if src_deutsche:
        imp.REPOS["deutsche-lpm"]["path"] = src_deutsche
    if src_nys:
        imp.REPOS["nys-lpm"]["path"] = src_nys
    by_repo, warnings, _edges = imp.collect_all()
    drift = {}
    for source_repo, parsed in by_repo.items():
        db = {r["source_record_id"]: r for r in db_records if r["source_repo"] == source_repo}
        src = {p["source_record_id"]: p for p in parsed}
        changed = []
        for sid, p in src.items():
            r = db.get(sid)
            if not r:
                continue
            same_content = json.dumps(r["content"], sort_keys=True, ensure_ascii=False) == \
                json.dumps(p["content"], sort_keys=True, default=str, ensure_ascii=False)
            same_tier = r["access_tier"] == p["access_tier"]
            if not (same_content and same_tier):
                changed.append(sid)
        drift[source_repo] = {
            "in_source": len(src),
            "in_db": len(db),
            "missing_in_db": sorted(set(src) - set(db)),
            "only_in_db": sorted(set(db) - set(src)),
            "changed": sorted(changed),
        }
    drift["_warnings"] = warnings
    return drift


# --------------------------------------------------------------------------
# The analysis
# --------------------------------------------------------------------------

def analyse(data: dict, drift: dict | None = None, link_cache: dict | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    projects = data["projects"]
    recs = data["records"]
    pid = {p["id"]: p for p in projects}
    rid = {r["id"]: r for r in recs}
    by_project = defaultdict(list)
    for r in recs:
        by_project[r["project_id"]].append(r)

    linked_counts = Counter(l["repository_record_id"] for l in data["record_links"])
    built_from = Counter(l["repository_record_id"] for l in data["record_links"] if l["relation_type"] == "built_from")
    proposed = Counter(l["repository_record_id"] for l in data["record_links"] if l["relation_type"].startswith("proposed"))
    inbound_by_repo = defaultdict(set)
    for l in data["project_links"]:
        inbound_by_repo[l["repository_project_id"]].add(l["project_id"])

    issues: list[dict] = []

    def issue(check, severity, p, r, detail):
        issues.append({
            "check": check, "severity": severity, "repo": p["slug"],
            "source_repo": r["source_repo"] if r else None,
            "source_record_id": r["source_record_id"] if r else None,
            "title": (r["title"][:110] if r else None), "detail": detail,
        })

    repos = {}
    for p in sorted(projects, key=lambda p: p["slug"]):
        rs = by_project.get(p["id"], [])
        m: dict = {"slug": p["slug"], "name": p["name"], "records": len(rs),
                   "parent": pid[p["parent_project_id"]]["slug"] if p["parent_project_id"] else None,
                   "focus_type": p["focus_type"], "private": p["is_private"], "content_license": p["content_license"]}
        m["by_type"] = dict(Counter(r["record_type"] for r in rs))
        m["by_tier"] = dict(Counter(r["access_tier"] for r in rs))
        m["by_origin"] = dict(Counter(r["source_repo"] for r in rs))
        m["added_by"] = dict(Counter(prov(r).get("added_by", "unknown") for r in rs))
        m["extracted_by"] = dict(Counter(prov(r).get("extracted_by", "unknown") for r in rs))
        m["review_status"] = dict(Counter(prov(r).get("review_status", "none") for r in rs))
        m["verification_status"] = dict(Counter((r["content"] or {}).get("verificationStatus", "none") for r in rs))
        m["reviewed_by_person"] = sum(1 for r in rs if prov(r).get("review_status") not in (None, "author-draft"))
        m["last_changed"] = max((r["updated_at"] for r in rs), default=None)
        m["first_added"] = min((r["created_at"] for r in rs), default=None)

        # C01 source URL
        exp = [r for r in rs if r["record_type"] in EXPECT_URL_FIELD]
        no_url = [r for r in exp if not (r["content"] or {}).get(EXPECT_URL_FIELD[r["record_type"]])]
        m["expect_url"] = len(exp)
        m["missing_url"] = len(no_url)
        for r in no_url:
            issue("C01", "medium", p, r, f"{r['record_type']} has no {EXPECT_URL_FIELD[r['record_type']]}")

        # C02 dates
        timeline = [r for r in rs if r["record_type"] == "policy-timeline-event"]
        mandates_nonunit = [r for r in rs if r["record_type"] == "institutional-mandate-record"
                            and (r["content"] or {}).get("mandateType") != "curriculum-unit"]
        dated_pool = timeline + mandates_nonunit
        undated, column_gap = [], []
        for r in dated_pool:
            c = r["content"] or {}
            col = r["event_date"] or r["effective_from"]
            in_content = any(c.get(f) for f in DATE_FIELDS)
            if not col and not in_content:
                undated.append(r)
            elif not col:
                column_gap.append(r)
        m["date_checked"] = len(dated_pool)
        m["undated"] = len(undated)
        m["date_column_empty_but_content_has_date"] = len(column_gap)
        for r in undated:
            issue("C02", "medium", p, r, "no date anywhere (column or content)")
        for r in column_gap:
            issue("C02b", "low", p, r, "date is in the content but the date columns are empty (timeline cannot place it)")

        # C03 rights
        rights_missing_strict = [r for r in rs if r["access_tier"] in ("excerpt-only", "full-text-stored")
                                 and not (r["license_or_rights_note"] or (r["content"] or {}).get("licenseOrRightsNote"))]
        summary_no_note = [r for r in rs if r["access_tier"] == "summary-only"
                           and not (r["license_or_rights_note"] or (r["content"] or {}).get("licenseOrRightsNote"))]
        text_beyond = [r for r in rs if r["access_tier"] == "citation-only"
                       and any((r["content"] or {}).get(f) for f in TEXT_FIELDS_BEYOND_CITATION)]
        m["rights_missing_note_excerpt_or_full"] = len(rights_missing_strict)
        m["rights_summary_without_note"] = len(summary_no_note)
        m["citation_only_but_text_stored"] = len(text_beyond)
        for r in rights_missing_strict:
            issue("C03", "high", p, r, f"tier {r['access_tier']} without a rights note")
        for r in text_beyond:
            issue("C03b", "high", p, r, "tier citation-only but the content still holds the official wording or its translation (statementText/statementTextEn)")

        # C04 review
        m["not_reviewed_by_person"] = len(rs) - m["reviewed_by_person"]
        m["no_provenance"] = sum(1 for r in rs if not prov(r))
        for r in rs:
            if not prov(r):
                issue("C04", "medium", p, r, "no provenance block (who added it, how, review status)")

        # C05 verification status (how well the claim is backed)
        weak = [r for r in rs if (r["content"] or {}).get("verificationStatus") in
                ("unverified-secondary-source", "secondary-source-only", "unverified-exercise-caution")]
        m["weakly_verified"] = len(weak)
        m["no_verification_status"] = sum(1 for r in rs if "verificationStatus" not in (r["content"] or {}))

        # C06 duplicates
        dups = []
        seen_by_type = defaultdict(list)
        for r in rs:
            seen_by_type[r["record_type"]].append(r)
        for t, group in seen_by_type.items():
            toks = [(r, norm_title(r["title"])) for r in group]
            for i in range(len(toks)):
                for j in range(i + 1, len(toks)):
                    a, ta = toks[i]
                    b, tb = toks[j]
                    same_url = content_urls(a) and content_urls(a) == content_urls(b)
                    sim = jaccard(ta, tb)
                    if not (sim >= 0.92 or (same_url and sim >= 0.8)):
                        continue
                    ca, cb = a["content"] or {}, b["content"] or {}
                    # records that differ in course level, school type, grade or unit number are different records
                    if any(ca.get(k) != cb.get(k) for k in DISTINGUISHING_FIELDS):
                        continue
                    # ids that differ in a single token (ntg / spaet) are sibling tracks. They are different records, so they are reported as low
                    ida, idb = a["source_record_id"].split("-"), b["source_record_id"].split("-")
                    sibling = len(ida) == len(idb) and sum(x != y for x, y in zip(ida, idb)) == 1
                    dups.append((a, b, sim, sibling))
        m["possible_duplicates"] = len(dups)
        for a, b, sim, sibling in dups:
            issue("C06", "low" if sibling else "medium", p, a,
                  f"{'same title, id differs in one word (a sibling track?)' if sibling else 'possible duplicate'} of "
                  f"{b['source_record_id']} (title similarity {sim:.2f})")

        # C07 leftovers
        left = [r for r in rs if r["source_repo"] in ("diagnostic-test",) or re.search(r"safe to delete|diagnostic test", r["title"], re.I)]
        m["test_leftovers"] = len(left)
        for r in left:
            issue("C07", "high", p, r, "test row left in production")

        # C08 broken characters
        bad = [r for r in rs if has_fffd(r["title"]) or has_fffd(r["content"])]
        m["broken_characters"] = len(bad)
        for r in bad:
            issue("C08", "medium", p, r, "contains the replacement character U+FFFD (damaged umlaut or similar)")

        # C09 supersession
        sup = [r for r in rs if r["supersedes_record_id"]]
        bad_sup = 0
        for r in sup:
            tgt = rid.get(r["supersedes_record_id"])
            if not tgt or tgt["project_id"] != p["id"]:
                bad_sup += 1
                issue("C09", "high", p, r, "supersedes a record outside this repository or a missing one")
                continue
            a = parse_day(r["effective_from"] or r["event_date"])
            b = parse_day(tgt["effective_from"] or tgt["event_date"])
            if a and b and a < b:
                bad_sup += 1
                issue("C09", "high", p, r, f"replaces a record that is dated later ({b} vs {a})")
        # cycles
        for r in sup:
            seen, cur = set(), r
            while cur and cur["supersedes_record_id"]:
                if cur["id"] in seen:
                    bad_sup += 1
                    issue("C09", "high", p, r, "supersession cycle")
                    break
                seen.add(cur["id"])
                cur = rid.get(cur["supersedes_record_id"])
        m["supersession_links"] = len(sup)
        m["supersession_problems"] = bad_sup
        # editions with no replacement link although a sibling with the same subject exists is judged by hand

        # C10 links
        m["records_with_a_content_link"] = sum(1 for r in rs if linked_counts[r["id"]])
        m["built_from_links"] = sum(built_from[r["id"]] for r in rs)
        m["proposed_links_waiting"] = sum(proposed[r["id"]] for r in rs)
        m["projects_linking_here"] = sorted(pid[x]["slug"] if x in pid else x[:8] for x in inbound_by_repo[p["id"]])
        if not inbound_by_repo[p["id"]]:
            m["flag_no_project_uses_this_repository"] = True

        # C11 staleness of moving targets
        stale = []
        for r in timeline:
            c = r["content"] or {}
            ts = c.get("temporalStatus")
            if ts == "planned-future":
                d = parse_day(c.get("dateStart") or r["event_date"] or r["effective_from"])
                if d and d < today:
                    stale.append(r)
                    issue("C11", "medium", p, r, f"marked planned-future but its date {d} has passed")
            elif ts == "current-in-progress":
                d = parse_day(c.get("dateEnd"))
                if d and d < today:
                    stale.append(r)
                    issue("C11", "medium", p, r, f"marked in-progress but its end date {d} has passed")
        m["stale_status"] = len(stale)
        newest = max((parse_day(r["event_date"] or r["effective_from"] or (r["content"] or {}).get("dateStart"))
                      for r in rs if parse_day(r["event_date"] or r["effective_from"] or (r["content"] or {}).get("dateStart"))
                      and parse_day(r["event_date"] or r["effective_from"] or (r["content"] or {}).get("dateStart")) <= today),
                     default=None)
        m["newest_dated_event"] = str(newest) if newest else None

        # C12 jurisdiction
        tags = set(p["region_tags"] or [])
        wrong = [r for r in rs if r["jurisdiction"] and tags and not any(t in str(r["jurisdiction"]) for t in tags)
                 and p["focus_type"] != "thematic" and r["jurisdiction"] not in ("DE", "US", "IN")]
        m["jurisdiction_mismatch"] = len(wrong)
        for r in wrong[:50]:
            issue("C12", "low", p, r, f"jurisdiction {r['jurisdiction']} does not match this space ({sorted(tags)})")
        m["jurisdiction_empty"] = sum(1 for r in rs if not r["jurisdiction"])

        # structure and language coverage
        struct = [r for r in rs if r["record_type"] == "institutional-mandate-record"
                  and ((r["content"] or {}).get("subject") or (r["content"] or {}).get("lehrplanEdition"))
                  and ((r["content"] or {}).get("gradeFrom") is not None or (r["content"] or {}).get("unitNumber") is not None)]
        m["structure_bearing_records"] = len(struct)
        m["structure_subjects"] = sorted({str((r["content"] or {}).get("subject")) for r in struct if (r["content"] or {}).get("subject")})[:40]
        m["with_german_label"] = sum(1 for r in rs if (r["content"] or {}).get("labelDe"))
        m["with_english_statement"] = sum(1 for r in rs if (r["content"] or {}).get("statementTextEn"))

        # URLs
        urls = [(r, u) for r in rs for u in content_urls(r)]
        hosts = Counter(host_of(u) for _r, u in urls)
        m["urls"] = len(urls)
        m["distinct_urls"] = len({u for _r, u in urls})
        m["urls_official_looking"] = sum(1 for _r, u in urls if OFFICIAL_HOST.search(host_of(u)))
        m["urls_known_secondary"] = sum(1 for _r, u in urls if SECONDARY_HINT.search(host_of(u)))
        m["top_hosts"] = hosts.most_common(6)
        if link_cache:
            dead, blocked = [], 0
            for r, u in urls:
                st = link_cache.get(u)
                if st and not st.get("ok"):
                    if st.get("status") in (401, 403, 429, 303, 308):
                        blocked += 1  # the site refuses scripts or loops its redirects; it may open fine in a browser, so it is counted apart
                    else:
                        dead.append((r, u, st))
            m["links_checked"] = sum(1 for _r, u in urls if u in link_cache)
            m["links_dead"] = len(dead)
            m["links_blocked_to_scripts"] = blocked
            for r, u, st in dead:
                issue("C13", "medium", p, r, f"source link does not open: {u} -> {st.get('status') or st.get('error')}")

        # source drift
        if drift:
            for sr in m["by_origin"]:
                d = drift.get(sr)
                if d:
                    m.setdefault("drift", {})[sr] = {k: (len(v) if isinstance(v, list) else v) for k, v in d.items()}

        repos[p["slug"]] = m

    # C15: the database and the version-controlled source repositories disagree
    if drift:
        for sr, d in drift.items():
            if sr.startswith("_") or not isinstance(d, dict):
                continue
            for kind, why in (("missing_in_db", "is in the source repository but not in the database"),
                              ("only_in_db", "is in the database but no longer in the source repository"),
                              ("changed", "differs between the database and the source repository")):
                for sid in d.get(kind, []):
                    issues.append({"check": "C15", "severity": "medium", "repo": f"source:{sr}", "source_repo": sr,
                                   "source_record_id": sid, "title": None, "detail": f"{sid} {why}"})

    # records origin: not in any git source
    origin_untracked = Counter(r["source_repo"] for r in recs if r["source_repo"] in ("openlpm-starter-draft", "diagnostic-test"))

    tags_used = len(data["record_tags"])
    totals = {
        "repositories": len(projects), "records": len(recs),
        "project_links": len(data["project_links"]), "content_links": len(data["record_links"]),
        "record_tags_rows": tags_used,
        "reviewed_by_person": sum(m["reviewed_by_person"] for m in repos.values()),
        "records_only_in_database_not_in_any_git_source": dict(origin_untracked),
    }
    return {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "data_fetched_at": data.get("fetched_at"),
            "today": str(today), "totals": totals, "repos": repos, "issues": issues, "drift": drift or {}}


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

def rating(m: dict) -> str:
    n = m["records"]
    if n == 0:
        return "empty"
    sourced = 1 - (m["missing_url"] / m["expect_url"]) if m["expect_url"] else 1
    if m["test_leftovers"] or m["citation_only_but_text_stored"] or m["supersession_problems"]:
        return "needs repair"
    if n < 20 or m["structure_bearing_records"] == 0 and n < 40:
        return "thin"
    if n >= 100 and sourced >= 0.9:
        return "strong on context"
    return "medium"


def render_markdown(rep: dict) -> str:
    t = rep["totals"]
    L = []
    L.append(f"# Curriculum Repository audit, {rep['today']}\n")
    L.append(f"Data read from the live database at {rep['data_fetched_at']}. {t['repositories']} repositories, {t['records']} records, "
             f"{t['content_links']} links from project goals to records, {t['project_links']} project-to-repository links.\n")
    L.append(f"People who have reviewed a record: **{t['reviewed_by_person']}** of {t['records']}.\n")
    L.append("| Repository | Records | Types | Sourced | Dated | Official-looking links | Links to goals | Structure records | Rating |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for slug, m in rep["repos"].items():
        sourced = f"{m['expect_url'] - m['missing_url']}/{m['expect_url']}" if m["expect_url"] else "-"
        dated = f"{m['date_checked'] - m['undated']}/{m['date_checked']}" if m["date_checked"] else "-"
        off = f"{m['urls_official_looking']}/{m['urls']}" if m["urls"] else "-"
        L.append(f"| {slug.replace('-curriculum-repository', '')} | {m['records']} | {len(m['by_type'])} | {sourced} | {dated} | {off} | "
                 f"{m['records_with_a_content_link']} | {m['structure_bearing_records']} | {rating(m)} |")
    L.append("")
    sev = Counter((i["check"], i["severity"]) for i in rep["issues"])
    L.append("## Issue counts by check\n")
    for (c, s), n in sorted(sev.items()):
        L.append(f"- {c} ({s}): {n}")
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------
# URL check (separate, slow, polite)
# --------------------------------------------------------------------------

UA = "OpenEvoCCSLab-LinkCheck/1.0 (research link verification for curriculum records)"


def check_links(urls: list[str], cache_path: Path, max_age_days: int = 7, per_host_delay: float = 2.0) -> dict:
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    now = time.time()
    last_hit: dict[str, float] = {}
    todo = [u for u in dict.fromkeys(urls) if now - cache.get(u, {}).get("checked_ts", 0) > max_age_days * 86400]
    print(f"{len(todo)} of {len(set(urls))} URLs need a check", file=sys.stderr)
    for i, u in enumerate(todo, 1):
        h = host_of(u)
        wait = per_host_delay - (time.time() - last_hit.get(h, 0))
        if wait > 0:
            time.sleep(wait)
        last_hit[h] = time.time()
        entry = {"checked_ts": time.time(), "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(u, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    entry.update(status=r.status, final_url=r.geturl(), ok=200 <= r.status < 400)
                break
            except urllib.error.HTTPError as e:
                entry.update(status=e.code, ok=False)
                if method == "HEAD" and e.code in (400, 403, 405, 406, 501):
                    continue  # some servers refuse HEAD; ask once with GET
                break
            except Exception as e:
                entry.update(status=None, ok=False, error=f"{type(e).__name__}: {str(e)[:120]}")
                break
        cache[u] = entry
        if i % 25 == 0:
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"  checked {i}/{len(todo)}", file=sys.stderr)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--from-dir", help="reuse a raw dump instead of reading the live database")
    ap.add_argument("--src-deutsche", help="checkout of deutsche_lp at the commit to compare against")
    ap.add_argument("--src-nys", help="checkout of nys_lp at the commit to compare against")
    ap.add_argument("--no-drift", action="store_true")
    ap.add_argument("--links", action="store_true", help="check every source URL (slow); results cached in <out>/link_cache.json")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    data = load_raw(Path(args.from_dir)) if args.from_dir else fetch_all()
    if not args.from_dir:
        save_raw(data, out / "raw")
        (out / "raw" / "fetched_at.json").write_text(json.dumps(data["fetched_at"]), encoding="utf-8")
    drift = None if args.no_drift else source_drift(
        data["records"], Path(args.src_deutsche) if args.src_deutsche else None, Path(args.src_nys) if args.src_nys else None)
    cache_path = out / "link_cache.json"
    if args.links:
        urls = [u for r in data["records"] for u in content_urls(r)]
        check_links(urls, cache_path)
    link_cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else None
    rep = analyse(data, drift, link_cache)
    (out / "report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    (out / "scorecard.md").write_text(render_markdown(rep), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(render_markdown(rep))


if __name__ == "__main__":
    main()
