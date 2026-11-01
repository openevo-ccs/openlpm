#!/usr/bin/env python3
"""Daily watch over every Curriculum Repository: runs the audit, looks at a slice of the source pages, and reports only what changed.

    python scripts/watch_curriculum_repositories.py --state-dir <dir> [--src-deutsche <path>] [--src-nys <path>] [--page-budget 60]

Reads the live database (read only), compares today's findings with the last saved run, writes
<state-dir>/<date>.json and <state-dir>/latest.md (the plain-language digest). Nothing is written to the database or to any repository.
No AI model is called: every line of the digest comes from code. A model may summarise the digest later; whatever it says is checked
against this file.

Source pages: each run looks at up to --page-budget pages (the ones not seen for longest), so the whole set is covered about once a week
and no site gets more than one request every two seconds. robots.txt is read first; a page it disallows is skipped and counted, never
fetched. Each look stores the status, the final address and a hash of the readable text, so the next look can say that a page changed.
A changed hash can mean a new edition or only a new page layout; the digest says "changed", a person decides what it means.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_curriculum_repositories as audit  # noqa: E402

UA = audit.UA
PLAIN = {
    "C01": "records with no source link",
    "C02": "records with no date anywhere",
    "C02b": "records whose date the timeline cannot place",
    "C03": "records that hold an excerpt or full text without a rights note",
    "C03b": "cite-only records that still hold official wording or its translation",
    "C04": "records without a provenance block",
    "C06": "possible duplicate records",
    "C07": "test rows left in the live data",
    "C08": "records with damaged characters",
    "C09": "problems in an edition chain",
    "C11": "events still marked planned or in progress after their date",
    "C12": "records whose place tag does not match their space",
    "C13": "source links that do not open",
    "C14": "source pages that changed since the last look",
    "C15": "records where the database and the source repository disagree",
}


def issue_key(i: dict) -> str:
    return "|".join([i["check"], i["repo"], i.get("source_record_id") or (i.get("title") or ""), i["detail"][:90]])


# --------------------------------------------------------------------------
# Source pages
# --------------------------------------------------------------------------

class _FollowRedirects(urllib.request.HTTPRedirectHandler):
    """Python 3.10 does not follow 308 redirects; several ministry sites use them."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if code == 308:
            return urllib.request.Request(newurl, headers={k: v for k, v in req.header_items()}, origin_req_host=req.origin_req_host,
                                          unverifiable=True)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

    http_error_308 = urllib.request.HTTPRedirectHandler.http_error_302


import http.cookiejar  # noqa: E402  (some sites redirect until a cookie is set)

OPENER = urllib.request.build_opener(_FollowRedirects, urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}


def robots_allows(url: str) -> bool:
    host = urllib.parse.urlparse(url)
    base = f"{host.scheme}://{host.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
            _robots[base] = rp
        except urllib.error.HTTPError as e:
            _robots[base] = None if e.code in (401, 403, 404, 410) or e.code >= 500 else None  # no usable robots.txt: allowed
        except Exception:
            _robots[base] = None
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(UA, url)


def readable_hash(body: bytes, content_type: str) -> str:
    if "html" in content_type or "xml" in content_type:
        text = body.decode("utf-8", "replace")
        text = re.sub(r"(?is)<(script|style|noscript|svg|header|footer|nav)\b.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = re.sub(r"&[a-z]+;|&#\d+;", " ", text)
        body = re.sub(r"\s+", " ", text).strip().lower().encode("utf-8")
    return hashlib.sha256(body).hexdigest()[:16]


def look_at_page(url: str) -> dict:
    entry = {"checked_ts": time.time(), "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    if not robots_allows(url):
        entry.update(ok=True, status=None, robots="disallowed")
        return entry
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
            with OPENER.open(req, timeout=25) as r:
                ctype = r.headers.get("Content-Type", "")
                entry.update(status=r.status, final_url=r.geturl(), ok=200 <= r.status < 400, content_type=ctype.split(";")[0],
                             etag=r.headers.get("ETag"), last_modified=r.headers.get("Last-Modified"))
                if method == "GET":
                    entry["text_hash"] = readable_hash(r.read(1_500_000), ctype)
                    entry["bytes_read"] = True
            if method == "HEAD":
                continue  # always follow with one GET: the hash needs the body
            break
        except urllib.error.HTTPError as e:
            entry.update(status=e.code, ok=False)
            if method == "HEAD" and e.code in (400, 403, 405, 406, 501):
                continue
            break
        except Exception as e:
            entry.update(status=None, ok=False, error=f"{type(e).__name__}: {str(e)[:120]}")
            break
    return entry


def refresh_pages(urls: list[str], cache_path: Path, budget: int, per_host_delay: float = 2.0) -> tuple[dict, list[dict]]:
    """Looks at up to `budget` pages, oldest look first. Returns (cache, changes found in this run)."""
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    order = sorted(dict.fromkeys(urls), key=lambda u: cache.get(u, {}).get("checked_ts", 0))
    last_hit: dict[str, float] = {}
    changes = []
    for u in order[:budget]:
        host = audit.host_of(u)
        wait = per_host_delay - (time.time() - last_hit.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        last_hit[host] = time.time()
        before = cache.get(u, {})
        now = look_at_page(u)
        if before.get("text_hash") and now.get("text_hash") and before["text_hash"] != now["text_hash"]:
            changes.append({"url": u, "was": before["text_hash"], "now": now["text_hash"], "was_checked": before.get("checked_at")})
        if before.get("ok") and not now.get("ok"):
            now["was_ok_on"] = before.get("checked_at")
        cache[u] = now
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache, changes


# --------------------------------------------------------------------------
# Snapshot, comparison, digest
# --------------------------------------------------------------------------

def make_snapshot(report: dict, page_changes: list[dict], url_owner: dict[str, list[str]]) -> dict:
    keys = {}
    for i in report["issues"]:
        keys[issue_key(i)] = {k: i[k] for k in ("check", "severity", "repo", "source_record_id", "title", "detail")}
    for c in page_changes:
        owners = url_owner.get(c["url"], ["?"])
        keys[f"C14|{c['url']}|{c['now']}"] = {"check": "C14", "severity": "low", "repo": owners[0], "source_record_id": None,
                                               "title": None, "detail": f"the page {c['url']} changed since {c['was_checked']}"}
    repos = {slug: {k: m[k] for k in ("records", "newest_dated_event", "last_changed", "reviewed_by_person", "records_with_a_content_link",
                                      "structure_bearing_records") if k in m} | {"by_type": m["by_type"]}
             for slug, m in report["repos"].items()}
    return {"date": report["today"], "taken_at": report["generated"], "totals": report["totals"], "repos": repos, "issues": keys}


def compare(prev: dict | None, cur: dict) -> dict:
    if not prev:
        return {"first_run": True}
    new = {k: v for k, v in cur["issues"].items() if k not in prev["issues"]}
    gone = {k: v for k, v in prev["issues"].items() if k not in cur["issues"]}
    moved = {}
    for slug, m in cur["repos"].items():
        old = prev["repos"].get(slug)
        if old is None:
            moved[slug] = {"new_repository": True}
            continue
        d = {k: [old.get(k), m.get(k)] for k in m if k != "by_type" and old.get(k) != m.get(k) and k != "last_changed"}
        if m["by_type"] != old.get("by_type"):
            d["by_type"] = [old.get("by_type"), m["by_type"]]
        if d:
            moved[slug] = d
    for slug in prev["repos"]:
        if slug not in cur["repos"]:
            moved[slug] = {"removed_repository": True}
    return {"new": new, "gone": gone, "moved": moved}


def digest(cur: dict, diff: dict, prev_name: str | None, page_stats: dict) -> str:
    L = [f"# Curriculum Repository watch, {cur['date']}", "",
         "Made by a script with no AI model, from the live database and the source repositories. "
         f"Compared with: {prev_name or 'nothing yet (first run)'}.", "",
         f"{cur['totals']['repositories']} repositories, {cur['totals']['records']} records, "
         f"{cur['totals']['reviewed_by_person']} reviewed by a person. Open problems: {len(cur['issues'])} "
         f"({sum(1 for v in cur['issues'].values() if v['severity'] == 'high')} high). "
         f"Pages looked at today: {page_stats['looked']} ({page_stats['skipped_robots']} skipped because robots.txt asks crawlers to stay away).", ""]
    if diff.get("first_run"):
        L.append("First run: nothing to compare. Today's open problems by kind:")
        by = {}
        for v in cur["issues"].values():
            by[v["check"]] = by.get(v["check"], 0) + 1
        L += [f"- {PLAIN.get(c, c)}: {n}" for c, n in sorted(by.items())]
        return "\n".join(L) + "\n"
    new, gone, moved = diff["new"], diff["gone"], diff["moved"]
    if not (new or gone or moved):
        L.append("No changes since the last run.")
        return "\n".join(L) + "\n"
    if moved:
        L += ["## Changes in the repositories"]
        for slug, d in moved.items():
            if d.get("new_repository") or d.get("removed_repository"):
                L.append(f"- {slug}: {'new repository' if d.get('new_repository') else 'no longer in the live data'}")
                continue
            parts = []
            for k, (a, b) in d.items():
                if k == "by_type":
                    parts.append("record kinds changed")
                else:
                    parts.append(f"{k.replace('_', ' ')}: {a} to {b}")
            L.append(f"- {slug}: " + "; ".join(parts))
        L.append("")
    if new:
        L += ["## New problems"]
        by = {}
        for v in new.values():
            by.setdefault(v["check"], []).append(v)
        for c, items in sorted(by.items(), key=lambda kv: (kv[1][0]["severity"] != "high", kv[0])):
            L.append(f"- {PLAIN.get(c, c)}: {len(items)} new ({items[0]['severity']})")
            for v in items[:8]:
                label = v["title"] or v["source_record_id"] or v["repo"]
                L.append(f"  - {v['repo'].replace('-curriculum-repository', '')}: {str(label)[:90]}. {v['detail'][:140]}")
            if len(items) > 8:
                L.append(f"  - and {len(items) - 8} more")
        L.append("")
    if gone:
        by = {}
        for v in gone.values():
            by[v["check"]] = by.get(v["check"], 0) + 1
        L += ["## Problems that no longer show up"] + [f"- {PLAIN.get(c, c)}: {n} fewer" for c, n in sorted(by.items())] + [""]
    return "\n".join(L) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--state-dir", required=True)
    ap.add_argument("--src-deutsche")
    ap.add_argument("--src-nys")
    ap.add_argument("--page-budget", type=int, default=60)
    ap.add_argument("--from-dir", help="reuse a raw dump instead of reading the live database (testing)")
    ap.add_argument("--today", help="override today's date (testing)")
    args = ap.parse_args()
    state = Path(args.state_dir)
    state.mkdir(parents=True, exist_ok=True)
    today = date.fromisoformat(args.today) if args.today else date.today()

    data = audit.load_raw(Path(args.from_dir)) if args.from_dir else audit.fetch_all()
    urls = [u for r in data["records"] for u in audit.content_urls(r)]
    url_owner: dict[str, list[str]] = {}
    proj = {p["id"]: p["slug"] for p in data["projects"]}
    for r in data["records"]:
        for u in audit.content_urls(r):
            url_owner.setdefault(u, []).append(proj.get(r["project_id"], "?"))
    cache, page_changes = refresh_pages(urls, state / "page_cache.json", args.page_budget)
    drift = audit.source_drift(data["records"], Path(args.src_deutsche) if args.src_deutsche else None,
                               Path(args.src_nys) if args.src_nys else None)
    report = audit.analyse(data, drift, cache, today)
    snap = make_snapshot(report, page_changes, url_owner)

    earlier = sorted(p for p in state.glob("20*.json") if p.stem < today.isoformat())
    prev = json.loads(earlier[-1].read_text(encoding="utf-8")) if earlier else None
    diff = compare(prev, snap)
    stats = {"looked": min(args.page_budget, len(set(urls))), "skipped_robots": sum(1 for u in set(urls) if cache.get(u, {}).get("robots"))}
    text = digest(snap, diff, earlier[-1].stem if earlier else None, stats)
    (state / f"{today.isoformat()}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
    (state / "latest.md").write_text(text, encoding="utf-8")
    (state / "full_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
