import importlib


def test_watchlist_requires_auth_and_persists(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "w.db"))
    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    monkeypatch.setenv("USERS_CSV", str(tmp_path / "users.csv"))
    monkeypatch.setenv("WATCHLIST_CSV", str(tmp_path / "watchlist.csv"))
    monkeypatch.setenv("MARKETS_CSV", str(tmp_path / "markets.csv"))
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("ODDS_RECEIPT_PROGRAM_ID", "")
    from thin_ice import config
    importlib.reload(config)
    from thin_ice import csv_store, db, api
    importlib.reload(csv_store)
    importlib.reload(db)
    importlib.reload(api)
    from fastapi.testclient import TestClient

    c = TestClient(api.app)
    assert c.get("/api/watchlist").status_code == 401

    reg = c.post("/api/auth/register", json={"email": "a@example.com", "password": "secret12", "name": "Ada"})
    assert reg.status_code == 200
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    empty = c.get("/api/watchlist", headers=headers).json()
    assert empty["symbols"] == [] and empty["markets"] == []

    assert c.put("/api/watchlist/GEMI-DEMO-YES", headers=headers).json()["watching"] is True
    assert c.put("/api/watchlist/GEMI-DEMO-YES", headers=headers).json()["symbols"] == ["GEMI-DEMO-YES"]
    listed = c.get("/api/watchlist", headers=headers).json()
    assert listed["symbols"] == ["GEMI-DEMO-YES"]
    assert listed["markets"][0]["symbol"] == "GEMI-DEMO-YES"
    assert listed["markets"][0].get("missing") is True

    assert c.delete("/api/watchlist/GEMI-DEMO-YES", headers=headers).json()["watching"] is False
    assert c.get("/api/watchlist", headers=headers).json()["symbols"] == []
