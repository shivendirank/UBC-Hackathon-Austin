"""Check a receipt yourself: re-hash a pinned snapshot and re-run the open formula.

    python -m thin_ice.verify snapshot.json
    python -m thin_ice.verify https://.../<hash>.json --expect-grade D
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

from .receipts import rescore, snapshot_hash


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", help="path or URL of a pinned snapshot JSON")
    ap.add_argument("--expect-hash")
    ap.add_argument("--expect-grade")
    args = ap.parse_args()

    if args.snapshot.startswith("http"):
        snap = httpx.get(args.snapshot, timeout=15).raise_for_status().json()
    else:
        snap = json.loads(Path(args.snapshot).read_text())

    h = snapshot_hash(snap)
    score = rescore(snap)
    expect_hash = args.expect_hash or (Path(args.snapshot).stem if len(Path(args.snapshot).stem) == 64 else None)
    print(f"market      {snap['symbol']}")
    print(f"sha256      {h}")
    print(f"grade       {score.grade}  (move 10 cents for ${score.move_cost_usd:,.2f}, spread {score.spread_c} cents)")
    for r in score.reasons:
        print(f"            - {r}")
    ok = True
    if expect_hash and expect_hash != h:
        print(f"HASH MISMATCH: expected {expect_hash}")
        ok = False
    if args.expect_grade and args.expect_grade != score.grade:
        print(f"GRADE MISMATCH: expected {args.expect_grade}")
        ok = False
    print("verified" if ok else "NOT verified")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
