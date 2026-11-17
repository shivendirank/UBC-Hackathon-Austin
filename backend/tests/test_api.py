import importlib
import time


def test_api_flow(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("ODDS_RECEIPT_PROGRAM_ID", "")
    from thin_ice import config
    importlib.reload(config)
    from thin_ice import db, recorder, service, api
    importlib.reload(db); importlib.reload(service); importlib.reload(recorder); importlib.reload(api)
    from fastapi.testclient import TestClient

    now = int(time.time())

    class FakeGemini:
        def book(self, symbol):
            return {"bids": [{"price": "0.30", "amount": "20"}], "asks": [{"price": "0.32", "amount": "20"}]}

        def trades(self, symbol, limit=100):
            return [{"tid": 1, "timestamp": now - 60, "price": "0.31", "amount": "5", "type": "buy"}]

    event = {"ticker": "PM", "title": "Who will be the next Prime Minister?", "slug": "next-pm",
             "type": "categorical", "category": "Politics"}
    contract = {"instrumentSymbol": "GEMI-PM-NETANYAHU", "label": "Netanyahu", "quantityMinimum": "1"}
    with db.tx(api.conn):
        db.upsert_contract(api.conn, event, contract, now)
    assert recorder.record_one(FakeGemini(), api.conn, "GEMI-PM-NETANYAHU")["grade"] == "F"

    c = TestClient(api.app)
    assert c.get("/health").json() == {"ok": True}
    ms = c.get("/api/markets").json()["markets"]
    assert ms[0]["symbol"] == "GEMI-PM-NETANYAHU" and ms[0]["grade"] == "F"
    assert c.get("/api/grade", params={"q": "next prime minister netanyahu"}).json()["symbol"] == "GEMI-PM-NETANYAHU"
    assert c.get("/api/grade", params={"q": "https://www.gemini.com/prediction-markets/next-pm"}).status_code == 200
    assert c.post("/api/markets/GEMI-PM-NETANYAHU/receipt").status_code == 401
    r = c.post("/api/markets/GEMI-PM-NETANYAHU/receipt", headers={"X-Admin-Token": "secret"}).json()
    assert r["grade"] == "F" and "Pinned only" in r["note"]
    snap = c.get(f"/api/snapshots/{r['snapshot_hash']}.json")
    assert snap.status_code == 200 and snap.json()["symbol"] == "GEMI-PM-NETANYAHU"
    assert c.get("/api/markets/NOPE").status_code == 404


def test_incident_lifecycle(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "i.db"))
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("RELATIONS_PATH", str(tmp_path / "none.json"))
    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    monkeypatch.setenv("ODDS_RECEIPT_PROGRAM_ID", "")
    from thin_ice import config
    importlib.reload(config)
    from thin_ice import db, incidents, service, api
    importlib.reload(db); importlib.reload(incidents); importlib.reload(service); importlib.reload(api)
    from fastapi.testclient import TestClient
    from thin_ice.consistency import Relation

    conn, now = api.conn, int(time.time())
    incidents.sync_relations(conn, [Relation("ladder:T", "threshold_ladder", ["LOW", "HIGH"], "auto_same_event", True)])

    def put(symbol, bid, ask, ts):
        with db.tx(conn):
            db.insert_snapshot(conn, symbol, ts, {"bids": [{"price": bid, "amount": "10"}],
                                                  "asks": [{"price": ask, "amount": "10"}]})

    put("LOW", "0.50", "0.90", now); put("HIGH", "0.65", "0.95", now)   # mids 70 vs 80: inconsistent
    [res] = incidents.run_checks(conn, now)
    assert res["status"] == "theoretical_only"
    c = TestClient(api.app)
    [inc] = c.get("/api/incidents").json()["incidents"]
    assert inc["kind"] == "inconsistency" and inc["status"] == "open"
    assert c.get(f"/api/incidents/{inc['id']}").json()["latest_check"]["status"] == "theoretical_only"
    assert c.post(f"/api/incidents/{inc['id']}/report", json={"conclusion": "bogus", "summary": "x"},
                  headers={"X-Admin-Token": "secret"}).status_code == 422
    r = c.post(f"/api/incidents/{inc['id']}/report", json={"conclusion": "inconclusive", "summary": "thin quotes",
               "sources": ["https://example.com"]}, headers={"X-Admin-Token": "secret"}).json()
    assert r["status"] == "reported" and r["report"]["conclusion"] == "inconclusive"

    a = c.post("/api/relations/ladder:T/assessment", headers={"X-Admin-Token": "secret"}).json()
    assert a["status"] == "theoretical_only" and a["flags"] == 1 << 5
    import json as _json
    from thin_ice.receipts import recheck_snapshot, snapshot_hash
    pinned = _json.loads((tmp_path / "snaps" / f"{a['snapshot_hash']}.json").read_text())
    assert snapshot_hash(pinned) == a["snapshot_hash"] and recheck_snapshot(pinned)["status"] == "theoretical_only"

    put("LOW", "0.70", "0.72", now + 60); put("HIGH", "0.30", "0.32", now + 60)  # back to coherent
    incidents.run_checks(conn, now + 60)
    done = c.get(f"/api/incidents/{inc['id']}").json()
    assert done["status"] == "resolved" and done["timeline"][-1]["event"] == "resolved_by_data"
    assert c.get("/api/relations").json()["relations"][0]["latest_check"]["status"] == "coherent"
