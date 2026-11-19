# Investigate with Grok (in-site) — design

Approved 2026-11-19.

## Goal
From `/incidents/[id]`, one click starts Grok Bot investigation; the report appears on the same page. User does not leave Thin Ice.

## Flow
1. User clicks **Investigate with Grok**.
2. Browser `POST /api/incidents/{id}/investigate`.
3. Backend POSTs to `GROK_ROUTINE_WEBHOOK` with Bearer `GROK_ROUTINE_TOKEN` and JSON `{incident_id, kind, subject, summary, evidence_url, instructions}`.
4. Grok Bot routine uses Thin Ice MCP (`get_incident`, `recheck`, `submit_report`).
5. Page polls `GET /api/incidents/{id}` until `report` is present, then renders it.

## UI
- Replace paste-prompt box when no report.
- States: idle → requesting → waiting (poll) → reported | error (webhook missing / failed).
- Keep paste prompt as fallback link/text if webhook not configured (503).

## Non-goals
- Streaming Grok tokens into the page
- Calling xAI chat API directly
- Auto-investigate on every new incident (webhook still used by `notify_grok` when configured)
