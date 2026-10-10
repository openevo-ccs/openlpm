#!/usr/bin/env python3
"""
Validates every schema-declaring YAML record file in this repo against its
own $schema, and checks that every cross-reference field (any property whose
JSON-Schema pattern targets an INLP-<TYPE>-... id, on a string or an array of
strings) actually resolves to a real id somewhere in the repo.

Ported directly from ../nys_lp/scripts/validate_records.py (itself ported
from ../deutsche_lp/scripts/validate_records.py) -- the only change is the
id-prefix regex (INLP instead of NYLP/DELP). Kept as a near-literal port
deliberately, so a future improvement made to any of the three scripts is
easy to port to the others.

Usage: python scripts/validate_records.py
Exit code 0 = clean; 1 = schema violations, dangling references, or
duplicate ids found.

Requires: pyyaml, jsonschema (not pinned anywhere in this repo yet -- see
CONTRIBUTING.md if that changes).
"""
import re
import sys
from pathlib import Path

import yaml
from jsonschema import Draft7Validator, exceptions as jsonschema_exceptions

REPO_ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules"}

ID_PATTERN_RE = re.compile(r"\^INLP-[A-Z]+-")


def find_yaml_files():
    for path in REPO_ROOT.rglob("*.yaml"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def find_reference_fields(schema):
    """Top-level properties whose pattern (string) or items.pattern (array)
    targets an INLP-<TYPE>-... id. Returns {field_name: is_array}."""
    refs = {}
    for name, prop in schema.get("properties", {}).items():
        if name == "id":
            continue
        pattern = prop.get("pattern", "")
        if ID_PATTERN_RE.match(pattern):
            refs[name] = False
            continue
        items = prop.get("items", {})
        if isinstance(items, dict) and ID_PATTERN_RE.match(items.get("pattern", "")):
            refs[name] = True
    return refs


def main():
    schema_cache = {}
    errors = []
    warnings = []
    id_registry = {}  # id -> "file.yaml#index"
    pending_ref_checks = []  # (location, field, referenced_id)
    files_scanned = 0
    records_validated = 0

    for yaml_path in find_yaml_files():
        text = yaml_path.read_text(encoding="utf-8")
        data = yaml.safe_load(text)
        if not isinstance(data, dict) or "$schema" not in data:
            continue
        files_scanned += 1

        schema_path = (yaml_path.parent / data["$schema"]).resolve()
        if schema_path not in schema_cache:
            if not schema_path.exists():
                errors.append(f"{yaml_path}: \$schema points to missing file {schema_path}")
                continue
            import json
            schema_cache[schema_path] = json.loads(schema_path.read_text(encoding="utf-8"))
        schema = schema_cache[schema_path]
        validator = Draft7Validator(schema)
        ref_fields = find_reference_fields(schema)

        list_keys = [k for k, v in data.items() if k != "$schema" and isinstance(v, list)]
        if len(list_keys) != 1:
            warnings.append(f"{yaml_path}: expected exactly one top-level list key, found {list_keys}")
            continue
        records = data[list_keys[0]]

        for idx, record in enumerate(records):
            location = f"{yaml_path.relative_to(REPO_ROOT)}[{idx}] ({record.get('id', '?')})"
            records_validated += 1

            record_errors = sorted(validator.iter_errors(record), key=lambda e: e.path)
            for e in record_errors:
                path = "/".join(str(p) for p in e.path) or "(root)"
                errors.append(f"{location}: schema violation at {path}: {e.message}")

            rid = record.get("id")
            if rid:
                if rid in id_registry:
                    errors.append(f"{location}: duplicate id, already used at {id_registry[rid]}")
                else:
                    id_registry[rid] = location

            for field, is_array in ref_fields.items():
                value = record.get(field)
                if value is None:
                    continue
                targets = value if is_array else [value]
                for target in targets:
                    pending_ref_checks.append((location, field, target))

    for location, field, target in pending_ref_checks:
        if target not in id_registry:
            errors.append(f"{location}: field '{field}' references unknown id '{target}'")

    print(f"Scanned {files_scanned} record files, validated {records_validated} records, "
          f"{len(id_registry)} unique ids.\n")

    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
        print()

    if errors:
        print(f"FAILED -- {len(errors)} issue(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("OK -- no schema violations, dangling references, or duplicate ids.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
