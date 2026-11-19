# Investigate Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click Grok Bot investigation from the incident page; report renders in place via polling.

**Architecture:** `POST /api/incidents/{id}/investigate` wraps `notify_grok` (returns accepted/failed). Client `InvestigatePanel` triggers it and polls until `report` exists. User configures Grok routine webhook once in `.env`.

**Tech Stack:** FastAPI, httpx, Next.js client component, existing incidents MCP tools.

**Spec:** `docs/superpowers/specs/2026-11-19-investigate-button-design.md`

## Global Constraints
- Never allege manipulation in webhook instructions copy.
- Keys only in `backend/.env`.
- API shapes mirrored in `web/lib/api.ts` / browser helpers.

## Review Focus
- Webhook unset → clear 503, UI shows fallback paste prompt.
- Webhook POST failure → 502, button recoverable.
- Poll stops when report arrives or after timeout (~3 min).
- Unusual-move incidents still triggerable (no recheck required for wake).

---

### Task 1: Backend investigate endpoint

**Files:**
- Modify: `backend/thin_ice/incidents.py` (`notify_grok` → return bool; add `request_investigation`)
- Modify: `backend/thin_ice/api.py` (POST investigate)
- Modify: `backend/tests/test_api.py` (webhook missing + mocked success)

- [ ] Step 1: Make `notify_grok` return `True`/`False`; add `request_investigation(conn, id)` that appends timeline `investigation_requested` and calls notify
- [ ] Step 2: Add `POST /api/incidents/{id}/investigate` → 202 `{ok, notified}` / 404 / 503 / 502
- [ ] Step 3: Extend `test_incident_lifecycle` (or new test) for 503 when unset and 202 when httpx mocked
- [ ] Step 4: Run `pytest -q` green

### Task 2: Incident page InvestigatePanel

**Files:**
- Create: `web/components/InvestigatePanel.tsx`
- Modify: `web/app/incidents/[id]/page.tsx`
- Modify: `docs/GROK_BOT_SETUP.md` (routine webhook steps)

- [ ] Step 1: Client panel: button, POST investigate via `NEXT_PUBLIC_API_URL`, poll GET every 4s
- [ ] Step 2: Wire into incident page Investigation section
- [ ] Step 3: Document Grok routine webhook + `.env` keys in GROK_BOT_SETUP.md
