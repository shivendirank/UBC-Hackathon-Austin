"""Receipts: pin the exact order book behind a grade, hash it, and record the hash on Solana.

Proof chain: snapshot JSON (public) --sha256--> snapshot_hash (onchain, in the Receipt account)
and score_book(snapshot) --> grade (onchain). Anyone can download the snapshot, re-hash it and
re-run the open formula. See verify.py.

The Solana part encodes calls to the Anchor program in programs/odds_receipt. It needs the
optional `chain` extra (solders). [verify] against the deployed program before the demo.
"""

from __future__ import annotations

import base64
import hashlib
import json
import struct
from pathlib import Path
from typing import Optional

import httpx

from . import config
from .scoring import FORMULA_VERSION, GRADES, Score, score_book


# ---------- snapshots ----------

def make_snapshot(symbol: str, ts: int, book: dict, last_trade_ts: Optional[int], quantity_minimum: float) -> dict:
    """Everything score_book needs, nothing else. The hash covers exactly this dict."""
    return {
        "formula_version": FORMULA_VERSION,
        "symbol": symbol,
        "ts": ts,
        "bids": [{"price": lv["price"], "amount": lv["amount"]} for lv in book.get("bids", [])],
        "asks": [{"price": lv["price"], "amount": lv["amount"]} for lv in book.get("asks", [])],
        "last_trade_ts": last_trade_ts,
        "quantity_minimum": quantity_minimum,
        "source": "gemini:/v1/book",
    }


def canonical_bytes(snapshot: dict) -> bytes:
    return json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def snapshot_hash(snapshot: dict) -> str:
    return hashlib.sha256(canonical_bytes(snapshot)).hexdigest()


def pin_snapshot(snapshot: dict, directory: Optional[Path] = None) -> tuple[str, Path]:
    """Write the snapshot to <dir>/<hash>.json. Publish that folder (GitHub, IPFS, or the API)."""
    h = snapshot_hash(snapshot)
    directory = Path(directory or config.SNAPSHOT_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{h}.json"
    path.write_bytes(canonical_bytes(snapshot))
    return h, path


def rescore(snapshot: dict) -> Score:
    return score_book(
        snapshot["symbol"], snapshot["bids"], snapshot["asks"],
        now=snapshot["ts"], last_trade_ts=snapshot.get("last_trade_ts"),
        quantity_minimum=snapshot.get("quantity_minimum", 1.0),
    )


# ---------- onchain encoding (Anchor) ----------

def market_id(symbol: str) -> bytes:
    """32-byte market id = sha256(instrument symbol)."""
    return hashlib.sha256(symbol.encode()).digest()


def anchor_discriminator(ix_name: str) -> bytes:
    return hashlib.sha256(f"global:{ix_name}".encode()).digest()[:8]


def _borsh_string(s: str) -> bytes:
    raw = s.encode()
    return struct.pack("<I", len(raw)) + raw


def encode_init_market(symbol: str) -> bytes:
    return anchor_discriminator("init_market") + market_id(symbol) + _borsh_string(symbol[:64])


def encode_record_receipt(score: Score, snap_hash_hex: str, uri: str) -> bytes:
    """Matches `record_receipt(args: ReceiptArgs)` in programs/odds_receipt/src/lib.rs."""
    if len(uri) > 100:
        raise ValueError("uri must be <= 100 bytes")
    mid = score.mid_c if score.mid_c is not None else 0
    return (
        anchor_discriminator("record_receipt")
        + struct.pack("<q", score.ts)
        + struct.pack("<H", int(round(mid * 100)))  # price in basis points (cents * 100)
        + struct.pack("<Q", int(round(score.move_cost_usd * 100)))  # move cost in cents
        + struct.pack("<H", int((score.spread_c or 0) * 100))  # spread in basis points
        + struct.pack("<B", GRADES.index(score.grade))  # 0=A ... 4=F
        + bytes.fromhex(snap_hash_hex)
        + _borsh_string(uri)
    )


class ReceiptMinter:
    """Sends init_market / record_receipt transactions to devnet. Requires `pip install .[chain]`."""

    def __init__(self, program_id: Optional[str] = None, keypair_path: Optional[str] = None,
                 rpc: Optional[str] = None):
        program_id = program_id or config.ODDS_RECEIPT_PROGRAM_ID
        keypair_path = keypair_path or config.RECEIPT_AUTHORITY_KEYPAIR
        if not program_id or not keypair_path:
            raise RuntimeError("Set ODDS_RECEIPT_PROGRAM_ID and RECEIPT_AUTHORITY_KEYPAIR to mint receipts")
        from solders.keypair import Keypair
        from solders.pubkey import Pubkey

        self.program = Pubkey.from_string(program_id)
        self.authority = Keypair.from_bytes(bytes(json.loads(Path(keypair_path).read_text())))
        self.rpc = rpc or config.SOLANA_RPC

    def pdas(self, symbol: str, ts: Optional[int] = None) -> dict:
        from solders.pubkey import Pubkey

        mid = market_id(symbol)
        out = {
            "market": Pubkey.find_program_address([b"market", mid], self.program)[0],
            "latest": Pubkey.find_program_address([b"latest", mid], self.program)[0],
        }
        if ts is not None:
            out["receipt"] = Pubkey.find_program_address([b"receipt", mid, struct.pack("<q", ts)], self.program)[0]
        return out

    def _rpc(self, method: str, params: list):
        r = httpx.post(self.rpc, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=30)
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(body["error"])
        return body["result"]

    def _send(self, ix_data: bytes, accounts: list) -> str:
        from solders.hash import Hash
        from solders.instruction import Instruction
        from solders.message import Message
        from solders.transaction import Transaction

        blockhash = self._rpc("getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
        ix = Instruction(self.program, ix_data, accounts)
        msg = Message.new_with_blockhash([ix], self.authority.pubkey(), Hash.from_string(blockhash))
        tx = Transaction([self.authority], msg, Hash.from_string(blockhash))
        return self._rpc("sendTransaction", [base64.b64encode(bytes(tx)).decode(), {"encoding": "base64"}])

    def _account_exists(self, pubkey) -> bool:
        return self._rpc("getAccountInfo", [str(pubkey), {"encoding": "base64"}])["value"] is not None

    def mint(self, score: Score, snap_hash_hex: str, uri: str) -> dict:
        from solders.instruction import AccountMeta
        from solders.system_program import ID as SYSTEM_PROGRAM_ID

        p = self.pdas(score.symbol, score.ts)
        me = self.authority.pubkey()
        if not self._account_exists(p["market"]):
            self._send(encode_init_market(score.symbol), [
                AccountMeta(me, True, True),
                AccountMeta(p["market"], False, True),
                AccountMeta(p["latest"], False, True),
                AccountMeta(SYSTEM_PROGRAM_ID, False, False),
            ])
        sig = self._send(encode_record_receipt(score, snap_hash_hex, uri), [
            AccountMeta(me, True, True),
            AccountMeta(p["market"], False, False),
            AccountMeta(p["receipt"], False, True),
            AccountMeta(p["latest"], False, True),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
        ])
        return {"tx_sig": sig, "receipt_pda": str(p["receipt"]), "latest_pda": str(p["latest"])}


def explorer_url(kind: str, value: str, cluster: str = "devnet") -> str:
    return f"https://explorer.solana.com/{kind}/{value}?cluster={cluster}"
