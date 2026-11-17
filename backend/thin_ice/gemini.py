"""Minimal client for Gemini's public prediction-market endpoints, with a polite rate limit."""

from __future__ import annotations

import time
from typing import Iterator, Optional

import httpx

from . import config

USER_AGENT = "thin-ice/0.1 (+https://github.com/shivendirank/UBC-Hackathon-Austin)"


class Gemini:
    def __init__(self, base_url: str = config.GEMINI_REST, rps: float = config.REQUESTS_PER_SECOND):
        self.http = httpx.Client(base_url=base_url, headers={"User-Agent": USER_AGENT}, timeout=15)
        self.min_interval = 1.0 / rps if rps > 0 else 0
        self._last = 0.0

    def _get(self, path: str, params: Optional[dict] = None):
        for attempt in range(5):
            wait = self._last + self.min_interval - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            r = self.http.get(path, params=params)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(min(60, 2 ** attempt * 2))  # back off
                continue
            r.raise_for_status()
            return r.json()
        r.raise_for_status()
        return r.json()

    def events(self, category: Optional[str] = None, status: str = "active", limit: int = 60) -> Iterator[dict]:
        """All events in a category, following offset pagination."""
        offset = 0
        while True:
            params = {"status": status, "limit": limit, "offset": offset}
            if category:
                params["category"] = category
            page = self._get("/v1/prediction-markets/events", params)
            rows = page.get("data", [])
            yield from rows
            total = page.get("pagination", {}).get("total", 0)
            offset += len(rows)
            if not rows or offset >= total:
                return

    def book(self, symbol: str) -> dict:
        """{"bids": [{"price","amount","timestamp"}], "asks": [...]}"""
        return self._get(f"/v1/book/{symbol}")

    def trades(self, symbol: str, limit: int = 100) -> list[dict]:
        """Newest first: {"timestamp","timestampms","tid","price","amount","type"}"""
        return self._get(f"/v1/trades/{symbol}", {"limit_trades": limit})

    def close(self) -> None:
        self.http.close()


def open_contracts(event: dict) -> Iterator[dict]:
    for c in event.get("contracts", []):
        if c.get("marketState") == "open" and c.get("instrumentSymbol"):
            yield c
