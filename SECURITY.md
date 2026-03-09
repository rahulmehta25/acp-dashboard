# ACP Dashboard Security Audit

Date: 2026-03-02
Project: `acp-dashboard`
Scope: all API routes in `src/app/api/**`, shared guards in `src/lib/api-security.ts`, and `middleware.ts` headers

## Executive Summary

- Reviewed 8 API route files and shared security primitives.
- Command execution is generally hardened (`execFile`/`spawn` with explicit args, no shell interpolation).
- No unresolved CRITICAL/HIGH findings remain after fixes in this audit.
- High-risk trust-boundary and auth-coverage issues were patched directly.

## Route Inventory Audited

- `src/app/api/config/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/[sessionId]/route.ts`
- `src/app/api/spawn/route.ts`
- `src/app/api/stream/[sessionId]/route.ts`
- `src/app/api/system/route.ts`
- `src/app/api/tts/route.ts`
- Shared controls: `src/lib/api-security.ts`, `middleware.ts`

## Findings (Ranked)

## CRITICAL

None.

## HIGH

### 1) Forwarded-header spoofing could bypass local/origin trust boundary (Fixed)
- Location:
  - `src/lib/api-security.ts:21-47` (`ensureLocalAccess`)
  - `src/lib/api-security.ts:49-73` (`ensureTrustedOrigin`)
  - `src/lib/api-security.ts:143-170` (`getRequestHostHeader`, `getClientAddress`)
- Risk:
  - Prior behavior trusted `x-forwarded-host`/`x-forwarded-for` unconditionally.
  - A direct client could spoof forwarded headers to appear local/trusted.
- Fix applied:
  - Added explicit proxy trust flag: `ACP_DASHBOARD_TRUST_PROXY=true`.
  - By default, host/IP now derive from direct request headers (`host`) and local identity.
  - Missing host now fails closed (`400`) instead of implicit allow.

### 2) Auth coverage gap on config write/read endpoints when token is configured (Fixed)
- Location:
  - `src/app/api/config/route.ts:368-389` (`GET`) and `388-408` (`POST`)
- Risk:
  - With `ACP_DASHBOARD_API_TOKEN` set, config endpoints previously still allowed unauthenticated access.
  - This allowed remote config tampering when remote access was enabled.
- Fix applied:
  - Added `ensureApiToken(...)` checks to `GET /api/config` and `POST /api/config`.

## MEDIUM

### 1) Body-size controls rely on `content-length` and can be bypassed by chunked requests
- Location:
  - `src/app/api/config/route.ts:428-438`
  - `src/app/api/spawn/route.ts:191-201`
  - `src/app/api/tts/route.ts:78-88`
  - `src/app/api/sessions/[sessionId]/route.ts:135-146` (no max-body check)
- Impact:
  - Very large JSON payloads can still reach `request.json()` and increase memory pressure.
- Recommended fix:
  - Read request bodies as streams (or text), enforce byte caps directly, then parse JSON.

### 2) Rate limiting is in-memory and per-process only
- Location: `src/lib/api-security.ts:7-8`, `91-128`
- Impact:
  - Limits reset on restart and do not coordinate across multiple instances.
- Recommended fix:
  - Move to shared limit state (Redis/Cloudflare rate limiting) for tunnel/multi-instance deployment.

### 3) Process ownership checks are heuristic
- Location:
  - `src/app/api/sessions/[sessionId]/route.ts:36-49`
  - `src/app/api/stream/[sessionId]/route.ts:39-52`
- Impact:
  - Regex-based command-line checks may classify non-dashboard processes with matching tokens.
- Recommended fix:
  - Track spawned PIDs/session IDs in a signed internal registry and authorize actions against that registry.

### 4) `/api/events` does full snapshot polling per open SSE client
- Location: `src/app/api/events/route.ts:201-213`
- Impact:
  - Multiple clients can multiply expensive process inspection work.
- Recommended fix:
  - Centralize snapshot collection server-side and fan out cached snapshots to subscribers.

### 5) `/api/sessions` does not currently enforce API token
- Location: `src/app/api/sessions/route.ts:345-359`
- Impact:
  - When `ACP_DASHBOARD_ALLOW_REMOTE=true`, session metadata remains readable without token auth.
  - Exposes runtime context (agents, task hints, PIDs) to any network-reachable caller.
- Recommended fix:
  - Add `ensureApiToken(req)` in `GET /api/sessions`, or require an upstream access layer (Cloudflare Access) that blocks anonymous requests.

## LOW

### 1) No Content-Security-Policy (CSP)
- Location: `middleware.ts:4-12`
- Impact:
  - Reduced defense-in-depth against XSS/content injection.
- Recommended fix:
  - Add an explicit CSP suitable for Next.js + Google Fonts + same-origin APIs.

### 2) External Google Fonts dependency in layout
- Location: `src/app/layout.tsx:16-19`
- Impact:
  - External request dependency and metadata leakage to font CDN.
- Recommended fix:
  - Use self-hosted fonts via `next/font` where possible.

## Audit by Security Category

## A) Command Injection / Command Execution

Result: No active injection sink identified.

Evidence:
- `execFile` used with explicit args in:
  - `src/app/api/sessions/route.ts`
  - `src/app/api/sessions/[sessionId]/route.ts`
  - `src/app/api/stream/[sessionId]/route.ts`
  - `src/app/api/system/route.ts`
  - `src/app/api/events/route.ts`
- `spawn` used with explicit args in:
  - `src/app/api/spawn/route.ts`
  - `src/app/api/stream/[sessionId]/route.ts` (`tail`)
- No `exec(...)` with interpolated user strings found.

## B) Path Traversal / File Read-Write

Result: No unresolved path traversal found in reviewed routes.

Controls in place:
- Config path is fixed: `dashboard.config.json` (`src/app/api/config/route.ts`).
- Spawn working directory is canonicalized and restricted to allowed roots (`src/app/api/spawn/route.ts:42-77`).
- Stream log file access requires strict spawn-session ID format before resolving `/tmp/acp-${sessionId}.log` (`src/app/api/stream/[sessionId]/route.ts:27-29`, `127-130`).

## C) Input Validation

Strong coverage:
- Session ID regex validation in dynamic routes.
- Structured config merge validation with allowlists and type/range checks.
- Spawn payload validation for agent/task/mode/working directory.
- TTS validation for text length and voice ID format.

Residual gap:
- Request size hardening should not rely solely on `content-length` (see Medium #1).

## D) CORS / Cross-Origin Controls

Current posture:
- No permissive CORS headers are set.
- Browser cross-origin reads are blocked by default.
- Mutating endpoints use origin checks (`ensureTrustedOrigin`) where applicable.

Assessment:
- Appropriate for same-origin dashboard use.
- For tunnel deployment, keep same-origin policy strict unless there is a deliberate multi-origin requirement.

## E) Rate Limiting

Coverage:
- Route-bucketed rate limiting is applied across all audited API routes.
- Responses include standard rate limit headers and `429` handling.

Residual risk:
- In-memory scope only; not durable or shared (Medium #2).

## Fixes Implemented in This Audit

1. Hardened trust boundary in `src/lib/api-security.ts`
   - Added `ACP_DASHBOARD_TRUST_PROXY` gate.
   - Default no longer trusts spoofable forwarded headers.
   - Host-missing path now fails closed.

2. Expanded token enforcement for sensitive endpoints
   - Added `ensureApiToken` to:
     - `GET /api/config`
     - `POST /api/config`

## Validation Performed

- Production build succeeds after fixes: `npm run build`.
- All API route files re-reviewed after patching for command execution, path handling, auth/origin guards, input validation, and rate limiting.
