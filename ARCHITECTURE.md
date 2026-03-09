# ACP Dashboard Architecture

Date: 2026-03-02
Project: `acp-dashboard` (Next.js 15, App Router)
Scope reviewed: `src/app/**`, `src/lib/**`, `middleware.ts`, `next.config.ts`, `dashboard.config.json`

## 1. System Overview

ACP Dashboard is a local-first operations console for managing OpenClaw ACP sessions.

Core architecture:
- Frontend: one large client component (`src/app/page.tsx`) that renders the full command center UI, voice controls, and session actions.
- Backend: Next.js route handlers under `src/app/api/**` that invoke local OS/CLI commands and return JSON or SSE streams.
- Security layer: shared guard utilities in `src/lib/api-security.ts`.
- Config storage: file-backed dashboard settings in `dashboard.config.json`.

External integrations:
- OpenClaw gateway health probe: `http://127.0.0.1:18789/`
- OpenClaw CLI (spawn/steer/cancel/close/session listing)
- OS commands (`ps`, `pgrep`, `lsof`, `df`, `tail`)
- ElevenLabs API for TTS (optional)

## 2. Runtime Building Blocks

### Frontend (App Router)
- `src/app/layout.tsx`: global metadata and font inclusion.
- `src/app/error.tsx`: client-side render error boundary.
- `src/app/page.tsx`: dashboard UI + voice logic + API orchestration.

### Backend API Routes
- `GET /api/config`: read dashboard config
- `POST /api/config`: validate and persist dashboard config
- `GET /api/sessions`: aggregate ACP sessions + gateway status + history
- `PUT|PATCH|DELETE /api/sessions/[sessionId]`: steer/cancel/close sessions
- `POST /api/spawn`: spawn new agent sessions
- `GET /api/stream/[sessionId]`: per-session SSE log/stats stream
- `GET /api/events`: global SSE snapshot stream for dashboard state
- `GET /api/system`: machine vitals
- `POST /api/tts`: text-to-speech proxy

### Shared Security and Headers
- `src/lib/api-security.ts`: local-access guard, trusted-origin guard, API token auth, rate limiter, shared header application.
- `middleware.ts`: response hardening headers + no-store on `/api/*` + conditional HSTS.

## 3. Data Flow

```text
Browser (Dashboard page.tsx)
  |-- GET /api/config (startup settings)
  |-- Poll GET /api/sessions (primary state)
  |-- Poll GET /api/system (vitals)
  |-- SSE GET /api/stream/[sessionId] (terminal output per card)
  |-- POST /api/spawn (new session)
  |-- PUT/PATCH/DELETE /api/sessions/[sessionId] (session controls)
  |-- POST /api/config (settings save)
  |-- POST /api/tts (voice feedback)
  v
Next.js route handlers (control plane)
  |-- execFile/spawn local commands
  |-- read/write dashboard.config.json
  |-- query OpenClaw gateway + OpenClaw config
  |-- optional call to ElevenLabs
  v
Local host resources + external TTS API
```

`/api/events` also streams global snapshots every 3s, but the current dashboard UI is still driven by polling `/api/sessions` and does not consume `/api/events` yet.

## 4. Component Hierarchy (UI)

`src/app/page.tsx` is monolithic (~2400 lines) but internally split into many local components/hooks.

Hierarchy:
- `RootLayout`
- `Dashboard` (top-level page)
- `SystemVitalsBar`
- `StatusItem`
- `AgentSlot`
- `SessionCard`
- `TerminalPanel`
- `SpawnModal`
- `SettingsPanel`
- `HistoryRow`
- `VoiceOrb`
- `VoiceToast`

Hooks and utility functions inside the same file:
- `useNotificationSound`
- `useVoice`
- `useSSEUpdates`
- `parseVoiceCommand`

Architectural consequence: high coupling of rendering, networking, voice/audio, and state orchestration in one file.

## 5. API Design Notes

Common API guard pattern:
- Local access restriction: `ensureLocalAccess`
- Optional API token: `ensureApiToken`
- Origin check for mutating browser endpoints: `ensureTrustedOrigin`
- Per-route bucketed in-memory rate limits: `enforceRateLimit`

Command execution style:
- Uses `execFile(...)` and `spawn(...)` with explicit argument arrays.
- Avoids shell string interpolation.

Session control strategy:
- PIDs are extracted from session IDs when possible.
- Process operations are gated by process command-line heuristics before signal delivery.
- Fallback path uses `openclaw` CLI subcommands.

Persistence model:
- No database.
- Route-level in-memory caches/history for runtime convenience.
- Durable settings only via `dashboard.config.json`.

## 6. Real-Time Strategy

Current strategy is hybrid:
- Main dashboard list/status uses interval polling (`useSSEUpdates` wrapping `fetchData`) against `/api/sessions`.
- System vitals use separate 10-second polling against `/api/system`.
- Session terminal output uses dedicated SSE per open terminal panel (`/api/stream/[sessionId]`).
- A global SSE feed (`/api/events`) exists server-side but is not wired into the UI yet.

Tradeoff:
- Simple and robust for local single-user operation.
- Duplicated polling work and process inspection overhead as clients scale.

## 7. Deployment Architecture

Current mode:
- Next.js app served on port `3456` (`package.json` scripts).
- API routes directly control local processes and inspect host state.

Cloudflare Tunnel target mode:
- Dashboard becomes a remote control plane, not just a localhost utility.
- Security posture must assume hostile network reachability.

Security-critical env controls:
- `ACP_DASHBOARD_ALLOW_REMOTE`
- `ACP_DASHBOARD_API_TOKEN` / `ACP_API_TOKEN`
- `ACP_DASHBOARD_TRUST_PROXY` (for trusting forwarded proxy headers)

## 8. Recommended Improvements

### High Priority
1. Split `src/app/page.tsx` into modules (`components/`, `hooks/`, `services/`) to reduce regression risk.
2. Standardize on one real-time backbone: either migrate UI to `/api/events` SSE, or remove unused route and keep polling intentionally.
3. Add request body-size enforcement that does not rely only on `content-length` headers for all JSON mutation endpoints.
4. Add structured audit logs for spawn/steer/cancel/close actions.

### Medium Priority
1. Move rate limiting from in-memory map to a shared store if multiple instances are expected.
2. Add a consistent response contract and shared runtime schema for route payloads.
3. Reduce repeated process sampling by caching snapshots server-side for short windows.

### Low Priority
1. Add CSP with explicit font/script/connect policy.
2. Remove duplicated session/snapshot logic between `/api/sessions` and `/api/events` into shared server utilities.
