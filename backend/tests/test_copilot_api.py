import importlib
import time


def _boot(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "c.db"))
    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("ODDS_RECEIPT_PROGRAM_ID", "")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    monkeypatch.setenv("ELEVENLABS_AGENT_ID", "")
    from thin_ice import config
    importlib.reload(config)
    from thin_ice import db, recorder, service, api, copilot
    importlib.reload(db)
    importlib.reload(service)
    importlib.reload(recorder)
    importlib.reload(copilot)
    importlib.reload(api)
    return api, db, recorder


def test_copilot_unconfigured_session_and_analysis(tmp_path, monkeypatch):
    api, db, recorder = _boot(tmp_path, monkeypatch)
    from fastapi.testclient import TestClient

    now = int(time.time())

    class FakeGemini:
        def book(self, symbol):
            return {"bids": [{"price": "0.40", "amount": "50"}], "asks": [{"price": "0.42", "amount": "50"}]}

        def trades(self, symbol, limit=100):
            return [{"tid": 1, "timestamp": now - 30, "price": "0.41", "amount": "2", "type": "buy"}]

    event = {"ticker": "BTC", "title": "BTC price today", "slug": "btc-today",
             "type": "categorical", "category": "Crypto"}
    contract = {"instrumentSymbol": "GEMI-BTC-A", "label": "$100k or above", "quantityMinimum": "1"}
    with db.tx(api.conn):
        db.upsert_contract(api.conn, event, contract, now)
    recorder.record_one(FakeGemini(), api.conn, "GEMI-BTC-A")

    c = TestClient(api.app)
    st = c.get("/api/copilot/status").json()
    assert st["elevenlabs_configured"] is False
    sess = c.post("/api/copilot/session", json={"symbol": "GEMI-BTC-A"}).json()
    assert sess["configured"] is False and "ELEVENLABS" in sess["reason"]

    analysis = c.get("/api/copilot/markets/GEMI-BTC-A/analysis").json()
    assert analysis["symbol"] == "GEMI-BTC-A"
    assert "move_cost_usd" in analysis and "history" in analysis
    resolved = c.get("/api/copilot/resolve", params={"q": "btc price today"}).json()
    assert resolved["symbol"] == "GEMI-BTC-A" and resolved["path"].startswith("/market/")
    related = c.get("/api/copilot/markets/GEMI-BTC-A/related").json()
    assert related["symbol"] == "GEMI-BTC-A"
    cmp_ = c.post("/api/copilot/compare", json={"symbols": ["GEMI-BTC-A"]}).json()
    assert cmp_["markets"][0]["symbol"] == "GEMI-BTC-A"
    assert c.get("/api/copilot/markets/NOPE/analysis").status_code == 404
    assert c.get("/api/copilot/resolve", params={"q": "zzzz-no-such"}).status_code == 404
