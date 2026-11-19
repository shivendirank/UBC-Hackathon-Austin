# Grok Bot ↔ Thin Ice (MCP connector + skill)

Thin Ice does the **math** (liquidity + consistency). Grok Bot **investigates** flagged incidents and files a sourced report. It must not allege manipulation or intent.

## Architecture

```
Gemini books → Thin Ice engines → incidents (SQLite)
                                      ↓
                         MCP tools on :8001/mcp
                                      ↓
                    Cloudflare tunnel (public HTTPS)
                                      ↓
                         Grok Bot custom connector
```

No routine webhook in this setup — you (or the demo) ask Grok to investigate.

---

## 1. Run locally (stable URL — set once)

Cloudflare quick tunnels change every restart. Use **one ngrok domain** instead:

1. Claim a free domain: https://dashboard.ngrok.com/domains  
2. Put it in `backend/.env`:

```env
NGROK_DOMAIN=your-name.ngrok-free.app
```

3. Start MCP + the stable tunnel:

```powershell
cd backend
$env:HOME = $env:USERPROFILE
.\.venv\Scripts\python.exe -m thin_ice.mcp_server
# other terminal:
powershell -File .\scripts\start_grok_tunnel.ps1
```

Grok connector URL (never changes):

`https://your-name.ngrok-free.app/mcp`

Keep both processes running while you demo.

---

## 2. Add the connector in Grok

**Grok Bot app:** Connect apps → Add a custom connector → Type **remote HTTPS**  
**Or grok.com:** [grok.com/connectors](https://grok.com/connectors) → New Connector → Custom

| Field | Value |
|---|---|
| Name | `Thin Ice` |
| Server URL | `https://YOUR-TUNNEL.trycloudflare.com/mcp` |
| Auth | none required for the hackathon MCP (or add Bearer later) |

Save. Grok should discover tools: `grade_market`, `list_incidents`, `get_incident`, `recheck`, `submit_report`, `get_receipt`, `mint_receipt`, `publish_assessment`.

---

## 3. Skill / system instructions (paste into the Bot)

```
You are the Thin Ice Sentinel investigator for Gemini prediction markets.

Hard rules:
- Thin Ice engines already compute liquidity grades and consistency. You investigate; you do not invent grades.
- Describe liquidity and pricing only. Never allege manipulation, intent, or bad actors.
- A displayed-price disagreement is not tradeable unless recheck shows an executable gap (bid/ask, size, fees, synced books).
- Prefer verified relations. If rules differ across contracts, conclude different_rules.

Workflow for an incident:
1. list_incidents(status="open")
2. get_incident(id) — read engine output, members, settlement rules, expiry
3. recheck(id) — fresh synced books before concluding
4. Research public context (news, contract rules pages) and cite URLs
5. submit_report with conclusion one of:
   confirmed_inconsistency | stale_data | different_rules | inconclusive | no_issue
6. If confirmed_inconsistency and the finding is significant, publish_assessment(id)

For a one-off claim (X post / URL / symbol):
1. grade_market(query)
2. Optionally mint_receipt(symbol) after grading
3. get_receipt(symbol) to show explorer links

Keep reports short, sourced, and specific about what the books show.
```

---

## 4. One-click investigate (dashboard → Grok webhook)

The incident page has **Investigate with Grok**. It POSTs to your Bot routine webhook; Grok uses MCP and `submit_report`; the page polls until the report appears.

1. In **Thin Ice** Bot (desktop), create a routine, e.g. name `Thin Ice investigate`.
2. Instruction (or point it at the `thin-ice` skill):

```
When woken, read incident_id from the webhook JSON body.
Use Thin Ice MCP: get_incident → recheck (if inconsistency) → research sources → submit_report.
Describe liquidity and pricing only; never allege manipulation or intent.
```

3. Add a **webhook** trigger → Save → copy **POST to** and **key**.
4. Put them in `backend/.env`:

```env
GROK_ROUTINE_WEBHOOK=https://...   # POST to
GROK_ROUTINE_TOKEN=...             # key (Bearer)
```

5. Restart the API. Open `/incidents/3` → **Investigate with Grok**.

A `200` from Grok means the run *started*, not finished. Watch the Bot chat and the incident page.

---

## 5. Demo prompts

- `List open Thin Ice incidents and investigate the first one end to end.`
- `Grade this Gemini market: <URL or symbol>. Then mint a Solana receipt.`
- `Recheck incident <id> and file a report with sources.`

---

## 6. Checklist

- [ ] API/recorder have graded markets / open incidents (or synthetic)
- [ ] `python -m thin_ice.mcp_server` running
- [ ] Stable ngrok tunnel; connector URL ends with `/mcp`
- [ ] Skill created under Personal skills
- [ ] Routine webhook in `.env`; one-click Investigate works
- [ ] One successful `list_incidents` or `grade_market` from Grok
