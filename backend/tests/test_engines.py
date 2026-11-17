from thin_ice.consistency import (
    Relation, book_from, check, isotonic_nonincreasing, project_simplex, suggest_relations,
)
from thin_ice.liquidity import book_report, resilience, simulate_fill
from thin_ice.scoring import parse_levels

NOW = 1_800_000_000


def lv(price, amount):
    return {"price": f"{price:.2f}", "amount": str(amount)}


# ---------- liquidity ----------

def test_fill_walks_levels_and_reports_slippage():
    asks = parse_levels([lv(0.40, 100), lv(0.50, 1000)])
    f = simulate_fill(asks, "buy_yes", 90)  # 100 @ 0.40 = $40, then 100 @ 0.50 = $50
    assert f.complete and f.contracts == 200 and f.avg_price_c == 45 and f.slippage_c == 5


def test_fill_runs_out():
    f = simulate_fill(parse_levels([lv(0.40, 10)]), "buy_yes", 100)
    assert not f.complete and f.filled_usd == 4.0


def test_sell_side_uses_no_collateral():
    f = simulate_fill(parse_levels([lv(0.60, 100)]), "sell_yes", 40)  # 1 - 0.60 = $0.40 each
    assert f.complete and f.contracts == 100


def test_book_report_summary_mentions_exhaustion():
    r = book_report([lv(0.30, 5)], [lv(0.32, 5)])
    assert "run out" in r["summary"]


def test_resilience_time_weighted():
    h = [{"ts": 0, "move_cost_usd": 50, "best_bid_c": 40, "best_ask_c": 42},
         {"ts": 300, "move_cost_usd": 5000, "best_bid_c": 40, "best_ask_c": 42},
         {"ts": 400, "move_cost_usd": 5000, "best_bid_c": 50, "best_ask_c": 52}]
    r = resilience(h)
    assert r["share_thin"] == 0.75 and r["longest_thin_s"] == 300 and len(r["around_moves"]) == 1


# ---------- optimization ----------

def test_isotonic():
    assert isotonic_nonincreasing([90, 70, 85, 10]) == [90, 77.5, 77.5, 10]


def test_simplex_projection():
    p = project_simplex([60, 50, 10], 100, inequality=True)
    assert abs(sum(p) - 100) < 1e-9 and p[0] > p[1] > p[2]
    assert project_simplex([30, 20], 100, inequality=True) == [30, 20]  # already coherent


# ---------- discovery ----------

def ev(ticker, title, labels):
    return {"ticker": ticker, "title": title, "type": "categorical", "contracts": [
        {"label": l, "instrumentSymbol": f"GEMI-{ticker}-{i}", "marketState": "open"} for i, l in enumerate(labels)]}


def test_suggest_threshold_ladder_sorted_low_to_high():
    rels = suggest_relations([ev("BTC", "BTC price today at 7pm", ["$64,600 or above", "$64,500 or above", "$65K or above"])])
    assert len(rels) == 1 and rels[0].kind == "threshold_ladder" and rels[0].verified
    assert rels[0].members == ["GEMI-BTC-1", "GEMI-BTC-0", "GEMI-BTC-2"]


def test_suggest_time_ladder_latest_first():
    rels = suggest_relations([ev("ALITO", "When will Alito retire?", ["Before Jan 1, 2027", "Before Jul 1, 2027"])])
    assert rels[0].kind == "time_ladder" and rels[0].members == ["GEMI-ALITO-1", "GEMI-ALITO-0"]


def test_multi_select_is_not_exclusive():
    rels = suggest_relations([ev("CAB", "Who will leave the Trump Administration in 2026?", ["A", "B", "C"])])
    assert rels == []


def test_winner_event_suggested_but_unverified():
    rels = suggest_relations([ev("PRES", "Presidential Election Winner 2028?", ["A", "B"])])
    assert rels[0].kind == "exclusive" and not rels[0].verified


# ---------- execution-aware checks ----------

LADDER = Relation("ladder:T", "threshold_ladder", ["LOW", "HIGH"], verified=True)  # LOW more likely


def test_ladder_coherent():
    books = {"LOW": book_from("LOW", NOW, [lv(0.70, 10)], [lv(0.72, 10)]),
             "HIGH": book_from("HIGH", NOW, [lv(0.30, 10)], [lv(0.32, 10)])}
    assert check(LADDER, books, now=NOW, fee_c=0).status == "coherent"


def test_ladder_theoretical_only_when_not_crossable():
    # mids: LOW 70, HIGH 80 (violation) but HIGH bid 0.65 < LOW ask 0.90
    books = {"LOW": book_from("LOW", NOW, [lv(0.50, 10)], [lv(0.90, 10)]),
             "HIGH": book_from("HIGH", NOW, [lv(0.65, 10)], [lv(0.95, 10)])}
    r = check(LADDER, books, now=NOW, fee_c=0)
    assert r.status == "theoretical_only" and r.violations and not r.opportunities
    assert r.gap_c > 0


def test_ladder_executable_with_size():
    books = {"LOW": book_from("LOW", NOW, [lv(0.68, 10)], [lv(0.70, 25)]),
             "HIGH": book_from("HIGH", NOW, [lv(0.85, 10)], [lv(0.87, 10)])}
    r = check(LADDER, books, now=NOW, fee_c=0)
    assert r.status == "executable"
    assert r.opportunities[0]["contracts"] == 10 and r.opportunities[0]["locked_profit_usd"] == 1.5


def test_fees_can_erase_the_edge():
    books = {"LOW": book_from("LOW", NOW, [lv(0.68, 10)], [lv(0.70, 25)]),
             "HIGH": book_from("HIGH", NOW, [lv(0.85, 10)], [lv(0.87, 10)])}
    r = check(LADDER, books, now=NOW, fee_c=8)  # 2 legs x 8 cents > 15-cent edge
    assert r.status == "theoretical_only"


def test_unsynced_books_are_stale():
    books = {"LOW": book_from("LOW", NOW - 600, [lv(0.68, 10)], [lv(0.70, 25)]),
             "HIGH": book_from("HIGH", NOW, [lv(0.85, 10)], [lv(0.87, 10)])}
    assert check(LADDER, books, now=NOW, fee_c=0, sync_tolerance_s=120).status == "stale"


def test_live_btc_shape_one_sided_member_is_not_executable():
    # Nov 17 BTC hourly ladder: $64,100 bid 0.96 / no ask; $64,200 bid 0.98 / no ask
    books = {"LOW": book_from("LOW", NOW, [lv(0.96, 5)], []),
             "HIGH": book_from("HIGH", NOW, [lv(0.98, 5)], [])}
    r = check(LADDER, books, now=NOW, fee_c=0)
    assert r.status == "insufficient_data" and not r.opportunities


def test_exclusive_sum_over_100_sellable():
    rel = Relation("excl:X", "exclusive", ["A", "B", "C"], verified=True)
    books = {"A": book_from("A", NOW, [lv(0.50, 5)], [lv(0.52, 5)]),
             "B": book_from("B", NOW, [lv(0.40, 7)], [lv(0.42, 5)]),
             "C": book_from("C", NOW, [lv(0.20, 9)], [lv(0.22, 5)])}
    r = check(rel, books, now=NOW, fee_c=0)
    assert r.status == "executable"
    assert r.opportunities[0] == {"action": "sell_all_yes", "edge_c_per_set": 10.0, "sets": 5.0}
