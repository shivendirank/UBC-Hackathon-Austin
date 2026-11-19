"""Create Thin Ice Copilot client tools on your ElevenLabs agent.

Reads ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID from backend/.env.
Never prints the API key.

Usage (from backend/):
  .venv\\Scripts\\python.exe scripts\\setup_elevenlabs_tools.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out


PROMPT = """You are Thin Ice Copilot, a prediction-market research assistant.

Rules:
- Never invent odds, liquidity, grades, or market IDs.
- Always use tools for numbers. Prefer get_market_analysis before answering about risk or liquidity.
- If the user names ANY market (including from the home/markets list page), you MUST call open_market_page with query set to their words so the app navigates to /market/{symbol}. Do not only talk — open the page.
- Saying "this market" uses dynamic variable market_symbol when it is non-empty; otherwise ask which market.
- After opening a market, also open evidence widgets (show_liquidity_chart, open_comparison_widget, show_probability_history) when relevant.
- If resolve/open fails, ask which Gemini market they mean. Do not guess.
- Do not place trades or claim manipulation.
"""

QUERY = {
    "type": "string",
    "description": "User's spoken market name or Gemini prediction-markets URL",
}
MARKET_ID = {
    "type": "string",
    "description": "Thin Ice / Gemini instrument symbol from resolve_market or the current page",
}

TOOLS: list[dict] = [
    {
        "type": "client",
        "name": "resolve_market",
        "description": "Resolve a spoken market name or Gemini URL to a Thin Ice symbol and path. Call before opening pages when the user names a market.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "open_market_page",
        "description": "Navigate the Thin Ice web app to /market/{symbol} and open the overview widget.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "get_market_analysis",
        "description": "Fetch real Thin Ice liquidity/odds/grade JSON for a market. Use this for spoken answers; never invent numbers.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "open_market_widget",
        "description": "Open the floating market overview widget for a contract.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "show_liquidity_chart",
        "description": "Open liquidity / cost-to-move evidence widget.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "show_probability_history",
        "description": "Open YES implied-probability history chart widget.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "open_comparison_widget",
        "description": "Open related-market comparison widget. Pass market_id/query for the seed market. Optional market_ids as a comma-separated symbol list.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {
                "query": QUERY,
                "market_id": MARKET_ID,
                "market_ids": {
                    "type": "string",
                    "description": "Optional comma-separated instrument symbols to compare",
                },
            },
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "find_related_markets",
        "description": "Return the Thin Ice relation graph JSON for a market.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {"query": QUERY, "market_id": MARKET_ID},
            "required": [],
        },
    },
    {
        "type": "client",
        "name": "highlight_metric",
        "description": "Highlight a metric chip in the open widget: odds, move_cost, grade, spread, or thin.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {
                "metric_id": {
                    "type": "string",
                    "description": "One of: odds, move_cost, grade, spread, thin",
                }
            },
            "required": ["metric_id"],
        },
    },
    {
        "type": "client",
        "name": "open_investigation",
        "description": "Open a Thin Ice incident page and investigation widget.",
        "expects_response": True,
        "parameters": {
            "type": "object",
            "properties": {
                "incident_id": {
                    "type": "string",
                    "description": "Incident id from Thin Ice",
                }
            },
            "required": ["incident_id"],
        },
    },
    {
        "type": "client",
        "name": "minimize_widget",
        "description": "Minimize the front floating widget.",
        "expects_response": True,
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    {
        "type": "client",
        "name": "close_widget",
        "description": "Close the front floating widget.",
        "expects_response": True,
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
]


def main() -> int:
    env = load_env()
    key = env.get("ELEVENLABS_API_KEY", "")
    agent_id = env.get("ELEVENLABS_AGENT_ID", "")
    if not key or not agent_id:
        print("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in backend/.env")
        return 1

    headers = {"xi-api-key": key, "Content-Type": "application/json"}
    created_ids: list[str] = []
    name_to_id: dict[str, str] = {}

    with httpx.Client(timeout=45.0) as client:
        listed = client.get("https://api.elevenlabs.io/v1/convai/tools", headers=headers)
        if listed.status_code == 200:
            data = listed.json()
            items = data if isinstance(data, list) else data.get("tools") or data.get("items") or []
            for t in items if isinstance(items, list) else []:
                cfg = t.get("tool_config") or t
                name = cfg.get("name") or t.get("name")
                tid = t.get("id")
                if name and tid:
                    name_to_id[name] = tid
            print(f"Existing tools visible to API: {len(name_to_id)}")

        for spec in TOOLS:
            name = spec["name"]
            if name in name_to_id:
                print(f"reuse {name} -> {name_to_id[name]}")
                created_ids.append(name_to_id[name])
                continue
            r = client.post(
                "https://api.elevenlabs.io/v1/convai/tools",
                headers=headers,
                json={"tool_config": spec},
            )
            if r.status_code >= 400:
                print(f"FAIL create {name}: HTTP {r.status_code} {r.text[:500]}")
                return 1
            body = r.json()
            tid = body.get("id") or (body.get("tool") or {}).get("id")
            if not tid:
                print(f"FAIL create {name}: no id in {json.dumps(body)[:300]}")
                return 1
            print(f"created {name} -> {tid}")
            created_ids.append(tid)
            name_to_id[name] = tid

        agent = client.get(f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}", headers=headers)
        if agent.status_code >= 400:
            print(f"FAIL get agent: HTTP {agent.status_code} {agent.text[:300]}")
            return 1
        ag = agent.json()
        conv = ag.get("conversation_config") or {}
        agent_cfg = conv.get("agent") or {}
        prompt = agent_cfg.get("prompt") or {}
        existing_tools = list(prompt.get("tool_ids") or [])
        merged = list(dict.fromkeys([*existing_tools, *created_ids]))

        patch = {
            "conversation_config": {
                "agent": {
                    "prompt": {
                        "prompt": PROMPT,
                        "tool_ids": merged,
                    }
                }
            }
        }
        upd = client.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}",
            headers=headers,
            json=patch,
        )
        if upd.status_code >= 400:
            # try PUT full merge
            ag.setdefault("conversation_config", {}).setdefault("agent", {}).setdefault("prompt", {})
            ag["conversation_config"]["agent"]["prompt"]["prompt"] = PROMPT
            ag["conversation_config"]["agent"]["prompt"]["tool_ids"] = merged
            upd = client.put(
                f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}",
                headers=headers,
                json=ag,
            )
        if upd.status_code >= 400:
            print(f"FAIL update agent: HTTP {upd.status_code} {upd.text[:400]}")
            print("Tools may still exist in the workspace — attach tool_ids manually in the UI.")
            print("tool_ids:", ", ".join(merged))
            return 1

        print(f"OK: agent updated with {len(merged)} tool_ids and Copilot system prompt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
