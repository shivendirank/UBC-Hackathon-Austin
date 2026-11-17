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
