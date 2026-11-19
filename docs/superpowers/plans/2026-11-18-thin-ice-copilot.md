# Thin Ice Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Browser JARVIS-style Copilot with opt-in wake/manual activate, ElevenLabs session (when configured), real Thin Ice analysis, and floating market widgets.

**Architecture:** Client `CopilotProvider` + `ActiveMarketProvider` + widget store wrap the Next.js layout. Porcupine runs only when AccessKey + `.ppn` exist; otherwise manual Activate. ElevenLabs Agents React SDK starts on activate when agent/signed URL is configured; otherwise a demo mode still drives widgets from backend tools. Backend adds thin analysis helpers and a signed-URL proxy that never exposes ElevenLabs secrets to the client.

**Tech Stack:** Next.js 16, React 19, `@elevenlabs/react`, `@picovoice/porcupine-react`, `lightweight-charts`, FastAPI existing engines.

**Spec:** User Copilot brief (2026-11-18) + approved design (web-first; Electron deferred).

## Global Constraints

- Never stream standby audio to ElevenLabs or backend.
- Wake/manual mic is opt-in; obvious mute and status.
- Pause wake detection while ElevenLabs holds the mic.
- No fabricated market IDs; ask when context is missing.
- No Electron until browser flow works.
- No committing secrets; document Picovoice Console + ElevenLabs agent setup.
- Do not commit unless the user asks (prior conversation rule).

## Review Focus

- Mic permission denial → clear disabled state, no crash.
- Missing Picovoice/ElevenLabs config → honest fallbacks, not fake ASR.
- Only one ElevenLabs session at a time.
- Widget updates reuse existing panel instead of spawning duplicates.
- Analysis numbers come from Python APIs, not the LLM.

---

### Task 1: Backend copilot analysis + session proxy

**Files:**
- Create: `backend/thin_ice/copilot.py`
- Modify: `backend/thin_ice/api.py`
- Modify: `backend/thin_ice/config.py` (ElevenLabs env vars)
- Test: `backend/tests/test_copilot_api.py`

- [ ] Analysis endpoints wrapping `service.get_market`, relations, liquidity/history
- [ ] `POST /api/copilot/session` returns signed URL when `ELEVENLABS_API_KEY` + agent id set; else `{ configured: false }`
- [ ] Pytest for configured/unconfigured paths

### Task 2: Active market + widget store + shell UI

**Files:**
- Create: `web/lib/active-market.tsx`, `web/lib/widgets.tsx`, `web/lib/copilot-types.ts`
- Create: `web/components/copilot/*` (orb, panel, widgets, charts)
- Modify: `web/app/layout.tsx`, `web/app/market/[symbol]/page.tsx`, `web/app/globals.css`
- Create: `web/docs/COPILOT_SETUP.md`

- [ ] Providers in layout; market page registers active symbol
- [ ] Floating widgets: overview, liquidity, comparison (+ probability history chart)
- [ ] Voice orb + standby/listening/processing/speaking/muted states
- [ ] Manual Activate fallback; Porcupine when env + `public/porcupine/` model present
- [ ] ElevenLabs ConversationProvider + client tools when session configured; demo tool runner otherwise

### Task 3: Wire client tools + verify

- [ ] Client tools open/update widgets from real `getMarket` / relations data
- [ ] Typecheck / lint / note manual tests requiring credentials
- [ ] Electron explicitly deferred

## Decisions (approved)

- Missing agent ID / wake model: ship with documented setup + working manual/demo path.
- Electron: Phase 6 later.
- No git commits in this pass unless user asks.
