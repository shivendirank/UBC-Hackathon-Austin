import hashlib

from thin_ice.receipts import (
    FLAG_EXHAUSTED, FLAG_THIN, KIND_LIQUIDITY, anchor_discriminator, assessment_from_check,
    assessment_from_score, canonical_bytes, encode_record_receipt, make_snapshot, market_id, rescore, snapshot_hash,
)
from thin_ice.scoring import cost_down, cost_up, event_grade, parse_levels, score_book, unusual_move

NOW = 1_800_000_000
FRESH = NOW - 60


def lv(price, amount):
    return {"price": f"{price:.2f}", "amount": str(amount), "timestamp": "0"}


def test_cost_up_stops_at_ten_cents():
    # best ask 0.40; levels at 0.40 and 0.45 count, 0.50 is the target and does not
    asks = parse_levels([lv(0.40, 100), lv(0.45, 100), lv(0.50, 10_000)])
    cost, exhausted = cost_up(asks)
    assert round(cost, 2) == 85.00  # 100*0.40 + 100*0.45
    assert not exhausted


def test_cost_down_prices_the_no_side():
    # selling YES at 0.60 == buying NO at 0.40
    bids = parse_levels([lv(0.60, 100), lv(0.55, 100), lv(0.50, 10_000)])
    cost, exhausted = cost_down(bids)
    assert round(cost, 2) == 85.00  # 100*0.40 + 100*0.45
    assert not exhausted


def test_exhausted_book():
    cost, exhausted = cost_up(parse_levels([lv(0.40, 10)]))
    assert exhausted and round(cost, 2) == 4.00


def test_one_sided_book_is_F():
    s = score_book("X", [], [lv(0.76, 4000)], now=NOW, last_trade_ts=FRESH)
    assert s.grade == "F" and "one-sided" in s.reasons[0]


def test_wide_spread_is_F():
    # the real 2028 "The Rock" book from Nov 17: bid 0.02, ask 0.76
    s = score_book("GEMI-PRES2028-THEROCK", [lv(0.02, 207)], [lv(0.76, 4000)], now=NOW, last_trade_ts=FRESH)
    assert s.grade == "F" and s.spread_c == 74


def test_deep_tight_fresh_is_A():
    bids = [lv(0.49, 30_000), lv(0.38, 1)]
    asks = [lv(0.50, 30_000), lv(0.61, 1)]
    s = score_book("X", bids, asks, now=NOW, last_trade_ts=FRESH)
    assert s.grade == "A", s.reasons
    assert s.move_cost_usd == 15_000.00  # up: 30000*0.50 = 15000; down: 30000*0.51 = 15300


def test_stale_drops_one_grade():
    bids, asks = [lv(0.49, 30_000), lv(0.38, 1)], [lv(0.50, 30_000), lv(0.61, 1)]
    s = score_book("X", bids, asks, now=NOW, last_trade_ts=NOW - 2 * 86400)
    assert s.grade == "B"


def test_spread_over_ten_caps_at_D():
    bids, asks = [lv(0.40, 30_000), lv(0.29, 1)], [lv(0.52, 30_000), lv(0.63, 1)]
    s = score_book("X", bids, asks, now=NOW, last_trade_ts=FRESH)
    assert s.grade == "D"


def test_thin_book_is_F_with_dollar_reason():
    s = score_book("X", [lv(0.30, 20), lv(0.20, 5)], [lv(0.32, 20), lv(0.42, 5)], now=NOW, last_trade_ts=FRESH)
    assert s.grade == "F" and s.move_cost_usd < 100


def test_event_grade_uses_favorite():
    fav = score_book("FAV", [lv(0.70, 1)], [lv(0.72, 1)], now=NOW, last_trade_ts=FRESH)
    long = score_book("LONG", [lv(0.05, 1e6), lv(0.01, 1)], [lv(0.06, 1e6), lv(0.17, 1)], now=NOW, last_trade_ts=FRESH)
    assert event_grade([long, fav]).symbol == "FAV"


def test_unusual_move():
    trades = [{"timestamp": NOW, "price": "0.40"}, {"timestamp": NOW + 300, "price": "0.52"}]
    assert unusual_move(trades, 50)["move_c"] == 12
    assert unusual_move(trades, 5_000) is None  # deep book: not flagged
    spread_out = [{"timestamp": NOW, "price": "0.40"}, {"timestamp": NOW + 3600, "price": "0.52"}]
    assert unusual_move(spread_out, 50) is None


def test_snapshot_roundtrip_is_deterministic():
    book = {"bids": [lv(0.30, 20)], "asks": [lv(0.32, 20)]}
    snap = make_snapshot("X", NOW, book, FRESH, 1.0)
    assert snapshot_hash(snap) == hashlib.sha256(canonical_bytes(snap)).hexdigest()
    assert snapshot_hash(dict(reversed(list(snap.items())))) == snapshot_hash(snap)  # key order irrelevant
    assert rescore(snap).grade == score_book("X", book["bids"], book["asks"], now=NOW, last_trade_ts=FRESH).grade


def test_record_receipt_encoding_layout():
    s = score_book("X", [lv(0.30, 20)], [lv(0.32, 20)], now=NOW, last_trade_ts=FRESH)
    a = assessment_from_score(s)
    assert a.kind == KIND_LIQUIDITY and a.grade == 4 and a.flags & FLAG_THIN and a.flags & FLAG_EXHAUSTED
    data = encode_record_receipt(a, "ab" * 32, "https://x/y.json")
    assert data[:8] == anchor_discriminator("record_receipt")
    # 8 disc + 8 ts + 1 kind + 2 price + 8 cost + 2 spread + 1 grade + 4 flags + 32 hash + 4 len + uri
    assert len(data) == 8 + 8 + 1 + 2 + 8 + 2 + 1 + 4 + 32 + 4 + len("https://x/y.json")
    assert data[16] == KIND_LIQUIDITY and data[29] == 4  # kind byte, grade byte
    assert len(market_id("X")) == 32


def test_consistency_assessment():
    a = assessment_from_check({"relation_id": "ladder:T", "ts": NOW, "status": "executable", "gap_c": 10.0,
                               "violations": [{}], "opportunities": [{}], "verified": True})
    assert a.subject == "relation:ladder:T" and a.grade == 4 and a.price_bps == 1000
    assert a.flags == (1 << 5) | (1 << 6)
