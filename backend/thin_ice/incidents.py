"""Relations, consistency checks and incidents: the glue between the engines and Grok Bot.

Flow (spec section 6):
  recorder pass -> run_checks() -> CheckResult per relation -> open/update/resolve incidents
  new incident -> POST to the Grok Bot routine webhook (if configured)
  Grok Bot -> MCP tools (get_incident, recheck, submit_report) -> report stored on the incident
"""

from __future__ import annotations

import json
import logging
import time
from typing import Iterable, Optional

import httpx

from . import config, db
from .consistency import Book, Relation, book_from, check, load_manual

log = logging.getLogger("thin_ice.incidents")

CONCLUSIONS = ("confirmed_inconsistency", "stale_data", "different_rules", "inconclusive", "no_issue")
MIN_GAP_C = 2.0  # ignore sub-2-cent incoherence (tick size noise)
FLAG_STATUSES = ("theoretical_only", "executable", "stale")


# ---------- relations ----------

def sync_relations(conn, suggested: Iterable[Relation]) -> None:
    """Store suggested relations; manual relations.json entries override by id."""
    now = int(time.time())
    rels = {r.id: r for r in suggested}
    rels.update({r.id: r for r in load_manual()})
    with db.tx(conn):
        for r in rels.values():
            existing = conn.execute("SELECT source, verified FROM relations WHERE id=?", (r.id,)).fetchone()
            # never downgrade a human verification
            verified = r.verified or bool(existing and existing["source"] == "manual" and existing["verified"])
            conn.execute(
                """INSERT INTO relations(id, kind, members_json, source, verified, event_ticker, note, updated_at)
                   VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, members_json=excluded.members_json,
                       source=CASE WHEN relations.source='manual' THEN 'manual' ELSE excluded.source END,
                       verified=?, note=excluded.note, updated_at=excluded.updated_at""",
                (r.id, r.kind, json.dumps(r.members), r.source, int(verified), r.event_ticker, r.note, now,
                 int(verified)),
            )


def relations(conn, *, verified_only: bool = False) -> list[Relation]:
    sql = "SELECT * FROM relations" + (" WHERE verified=1" if verified_only else "")
    return [Relation(r["id"], r["kind"], json.loads(r["members_json"]), r["source"], bool(r["verified"]),
                     r["event_ticker"], r["note"] or "") for r in conn.execute(sql).fetchall()]


def latest_books(conn, symbols: Iterable[str]) -> dict[str, Book]:
    out = {}
    for s in symbols:
        row = conn.execute("SELECT ts, bids_json, asks_json FROM snapshots WHERE symbol=? ORDER BY id DESC LIMIT 1",
                           (s,)).fetchone()
        if row:
            out[s] = book_from(s, row["ts"], json.loads(row["bids_json"]), json.loads(row["asks_json"]))
    return out


# ---------- checks -> incidents ----------

def run_checks(conn, now: Optional[int] = None, books: Optional[dict[str, Book]] = None) -> list[dict]:
    now = now or int(time.time())
    results = []
    for rel in relations(conn):
        bk = books if books is not None else latest_books(conn, rel.members)
        res = check(rel, bk, now=now)
        if res.status == "insufficient_data":
            continue  # nothing recorded for this relation yet; don't fill the table with empty checks
        with db.tx(conn):
            conn.execute("INSERT INTO consistency_checks(relation_id, ts, status, gap_c, result_json) VALUES (?,?,?,?,?)",
                         (rel.id, now, res.status, res.gap_c, json.dumps(res.to_dict())))
        _update_incident(conn, rel, res.to_dict(), now)
        results.append(res.to_dict())
    return results


def _open_incident(conn, kind: str, subject: str) -> Optional[dict]:
    row = conn.execute("SELECT * FROM incidents WHERE kind=? AND subject=? AND status!='resolved' "
                       "ORDER BY id DESC LIMIT 1", (kind, subject)).fetchone()
    return dict(row) if row else None


def _append(conn, inc_id: int, now: int, event: str, detail: dict, status: Optional[str] = None) -> None:
    row = conn.execute("SELECT timeline_json FROM incidents WHERE id=?", (inc_id,)).fetchone()
    tl = json.loads(row["timeline_json"])
    tl.append({"ts": now, "event": event, "detail": detail})
    conn.execute("UPDATE incidents SET timeline_json=?, updated_at=?" + (", status=?" if status else "") + " WHERE id=?",
                 (json.dumps(tl), now, *( [status] if status else []), inc_id))


def _update_incident(conn, rel: Relation, res: dict, now: int) -> None:
    if not rel.verified:
        return  # suggested relations are checked and shown, but only verified ones open incidents
    flagged = res["status"] in FLAG_STATUSES and (res["gap_c"] >= MIN_GAP_C or res["opportunities"])
    current = _open_incident(conn, "inconsistency", rel.id)
    with db.tx(conn):
        if flagged and not current:
            cur = conn.execute(
                "INSERT INTO incidents(kind, subject, status, opened_at, updated_at, evidence_json, timeline_json) "
                "VALUES ('inconsistency', ?, 'open', ?, ?, ?, ?)",
                (rel.id, now, now, json.dumps(res),
                 json.dumps([{"ts": now, "event": "opened", "detail": {"status": res["status"], "gap_c": res["gap_c"]}}])))
            incident_id = cur.lastrowid
        elif current:
            incident_id = None
            last = json.loads(current["timeline_json"])[-1]
            if not flagged:
                _append(conn, current["id"], now, "resolved_by_data", {"status": res["status"]}, status="resolved")
            elif last["detail"].get("status") != res["status"]:
                _append(conn, current["id"], now, "status_changed", {"status": res["status"], "gap_c": res["gap_c"]})
        else:
            incident_id = None
    if incident_id:
        notify_grok(incident_id, "inconsistency", rel.id, res["summary"])


def open_move_incident(conn, symbol: str, move: dict, now: int) -> None:
    """Called by the recorder when scoring.unusual_move fires."""
    if _open_incident(conn, "unusual_move", symbol):
        return
    with db.tx(conn):
        cur = conn.execute(
            "INSERT INTO incidents(kind, subject, status, opened_at, updated_at, evidence_json, timeline_json) "
            "VALUES ('unusual_move', ?, 'open', ?, ?, ?, ?)",
            (symbol, now, now, json.dumps(move), json.dumps([{"ts": now, "event": "opened", "detail": move}])))
    notify_grok(cur.lastrowid, "unusual_move", symbol, "Unusual move on a thin book.")


def notify_grok(incident_id: int, kind: str, subject: str, summary: str) -> None:
    """POST to the Grok Bot routine webhook. Never blocks recording on failure. [verify payload format]"""
    if not config.GROK_ROUTINE_WEBHOOK:
        return
    headers = {"Authorization": f"Bearer {config.GROK_ROUTINE_TOKEN}"} if config.GROK_ROUTINE_TOKEN else {}
    body = {
        "incident_id": incident_id, "kind": kind, "subject": subject, "summary": summary,
        "evidence_url": f"{config.PUBLIC_API_URL}/api/incidents/{incident_id}",
        "instructions": "Investigate with the Thin Ice MCP tools (get_incident, recheck, submit_report). "
                        "Describe liquidity, not intent; never allege manipulation.",
    }
    try:
        httpx.post(config.GROK_ROUTINE_WEBHOOK, json=body, headers=headers, timeout=5)
    except httpx.HTTPError as exc:
        log.warning("grok webhook failed: %s", exc)


# ---------- read / report ----------

def _incident_out(row) -> dict:
    d = dict(row)
    for k in ("evidence_json", "timeline_json", "report_json"):
        d[k.removesuffix("_json")] = json.loads(d.pop(k)) if d.get(k) else None
    d["synthetic"] = str(d.get("subject", "")).startswith("synthetic:")
    return d


def list_incidents(conn, status: Optional[str] = None, limit: int = 50) -> list[dict]:
    sql, args = "SELECT * FROM incidents", []
    if status:
        sql += " WHERE status=?"
        args.append(status)
    sql += " ORDER BY updated_at DESC LIMIT ?"
    args.append(limit)
    return [_incident_out(r) for r in conn.execute(sql, args).fetchall()]


def get_incident(conn, incident_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
    if not row:
        return None
    inc = _incident_out(row)
    if inc["kind"] == "inconsistency":
        rel = conn.execute("SELECT * FROM relations WHERE id=?", (inc["subject"],)).fetchone()
        members = json.loads(rel["members_json"]) if rel else []
        inc["relation"] = dict(rel, members=members) if rel else None
        latest = conn.execute("SELECT result_json FROM consistency_checks WHERE relation_id=? ORDER BY id DESC LIMIT 1",
                              (inc["subject"],)).fetchone()
        inc["latest_check"] = json.loads(latest["result_json"]) if latest else None
    else:
        members = [inc["subject"]]
    # contract rules so Grok Bot (and people) can compare settlement terms
    inc["contracts"] = [dict(r) for r in conn.execute(
        f"SELECT symbol, event_title, label, expiry, terms_url, rules_text FROM contracts WHERE symbol IN "
        f"({','.join('?' * len(members))})", members).fetchall()] if members else []
    return inc


def submit_report(conn, incident_id: int, conclusion: str, summary: str, sources: list[str],
                  details: str = "", author: str = "grok_bot") -> dict:
    if conclusion not in CONCLUSIONS:
        raise ValueError(f"conclusion must be one of {CONCLUSIONS}")
    now = int(time.time())
    report = {"conclusion": conclusion, "summary": summary, "sources": sources, "details": details,
              "author": author, "ts": now}
    with db.tx(conn):
        conn.execute("UPDATE incidents SET report_json=?, conclusion=?, status=CASE WHEN status='resolved' "
                     "THEN 'resolved' ELSE 'reported' END, updated_at=? WHERE id=?",
                     (json.dumps(report), conclusion, now, incident_id))
        _append(conn, incident_id, now, "report", {"conclusion": conclusion, "author": author})
    return get_incident(conn, incident_id)


def recheck(conn, client, incident_id: int) -> dict:
    """Fetch fresh books for every member back-to-back (so they're synchronized) and re-run the math."""
    inc = get_incident(conn, incident_id)
    if not inc:
        raise LookupError(incident_id)
    if inc["kind"] != "inconsistency" or not inc.get("relation"):
        raise ValueError("recheck supports inconsistency incidents")
    rel = Relation(inc["relation"]["id"], inc["relation"]["kind"], inc["relation"]["members"],
                   inc["relation"]["source"], bool(inc["relation"]["verified"]))
    synthetic = rel.source == "synthetic"
    books = {}
    if synthetic:
        books = latest_books(conn, rel.members)
    else:
        for s in rel.members:
            b = client.book(s)
            books[s] = book_from(s, int(time.time()), b.get("bids", []), b.get("asks", []))
    res = check(rel, books, now=int(time.time()))
    with db.tx(conn):
        conn.execute("INSERT INTO consistency_checks(relation_id, ts, status, gap_c, result_json) VALUES (?,?,?,?,?)",
                     (rel.id, res.ts, res.status, res.gap_c, json.dumps(res.to_dict())))
        _append(conn, incident_id, res.ts, "recheck",
                {"status": res.status, "gap_c": res.gap_c, "synthetic": synthetic})
    out = res.to_dict()
    out["synthetic"] = synthetic
    out["refreshed_from_gemini"] = not synthetic
    return out
