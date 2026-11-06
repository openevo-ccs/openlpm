#!/usr/bin/env python3
"""Test integration for the Learning Commons Knowledge Graph MCP server
(https://docs.learningcommons.org/knowledge-graph/using-knowledge-graph/mcp-server),
scoped to the one real overlap that made this worth revisiting: v1.16.0
(2026-10-21) added a current Tennessee Science standards framework, and
OpenLPM already has a Tennessee Curriculum Repository project.

This was parked on 2026-10-20 (see lab_manager's
openlpm_learning_commons_kg_parked_2026_10_20 memory) for two reasons, both
now checked:
  - Content mismatch (US math only, no biology/German content) -- no longer
    true as of v1.16.0, which added Tennessee (Science) and Kentucky (ELA).
  - License unread -- now read: data license is CC BY 4.0 for "Open" tier
    datasets (the US academic standards dataset shows "Open" for its
    subjects), MIT for the server code, attribution must travel with the
    data in any derivative. Good enough for a test read; re-check the
    specific dataset's license tier before any real redistribution/storage
    in OpenLPM's own data.

This script is deliberately narrow: authenticate, list the server's real
tools (its docs page describes 3, but the live tools/list response is the
authoritative source, not the docs prose), then resolve ONE real Tennessee
Science standard code to prove the pipeline works end to end. It does not
write anything into OpenLPM -- Dustin's own curriculum_repository_records
for Tennessee are policy/historical narrative (Scopes trial, the 2012
"monkey law"), not standards-code data, so there's no existing row to
attach this to yet. Wiring real results into OpenLPM's schema is a
follow-up scoping question once this proves the API itself works.

Usage:
    python scripts/test_learning_commons_kg.py [STANDARD_CODE] [--jurisdiction CODE]

    python scripts/test_learning_commons_kg.py                  # tools/list only, no standard lookup
    python scripts/test_learning_commons_kg.py 3.LS1.1 --jurisdiction US-TN

Auth: reads the API key from $LEARNING_COMMONS_API_KEY, or
.supabase-secrets/learning-commons-api-key.txt (gitignored, same convention
as service-role-key.txt) if the env var isn't set.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MCP_URL = "https://kg.mcp.learningcommons.org/mcp"


def load_api_key() -> str:
    env_key = os.environ.get("LEARNING_COMMONS_API_KEY")
    if env_key:
        return env_key.strip()
    key_path = ROOT / ".supabase-secrets" / "learning-commons-api-key.txt"
    if key_path.exists():
        return key_path.read_text(encoding="utf-8").strip()
    print(
        f"No Learning Commons API key found.\n\n"
        f"Set $LEARNING_COMMONS_API_KEY for this one run, or save it to\n"
        f"{key_path}\n(gitignored, same convention as service-role-key.txt).",
        file=sys.stderr,
    )
    sys.exit(1)


async def run(standard_code: str | None, jurisdiction: str | None) -> None:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    api_key = load_api_key()
    headers = {"x-api-key": api_key}

    async with streamablehttp_client(MCP_URL, headers=headers) as (read, write, _get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print(f"Connected. {len(tools.tools)} tool(s) exposed:")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")
            print()

            if not standard_code:
                print("No standard code given -- stopping after tools/list. "
                      "Re-run with a real code, e.g.:\n"
                      "  python scripts/test_learning_commons_kg.py 3.LS1.1 --jurisdiction US-TN")
                return

            find_tool = next(
                (t for t in tools.tools if "standard_statement" in t.name.lower()),
                None,
            )
            if find_tool is None:
                print("Could not find a 'find standard statement'-shaped tool in the live tool list above.")
                return

            args = {"statementCode": standard_code}
            if jurisdiction:
                args["jurisdiction"] = jurisdiction

            print(f"Calling {find_tool.name!r} with {args!r} ...")
            result = await session.call_tool(find_tool.name, args)
            for item in result.content:
                text = getattr(item, "text", None)
                if text:
                    try:
                        print(json.dumps(json.loads(text), indent=2, ensure_ascii=False))
                    except json.JSONDecodeError:
                        print(text)
                else:
                    print(item)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("standard_code", nargs="?", default=None,
                         help="A real standard code to resolve, e.g. 3.LS1.1")
    parser.add_argument("--jurisdiction", default=None,
                         help="Jurisdiction to scope the lookup, e.g. US-TN")
    args = parser.parse_args()
    asyncio.run(run(args.standard_code, args.jurisdiction))


if __name__ == "__main__":
    main()
