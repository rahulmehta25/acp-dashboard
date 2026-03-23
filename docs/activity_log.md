# Activity Log

## 2026-03-20 EST

### User Prompt
"Deploy ACP Dashboard to Vercel as a demo/portfolio piece with DEMO_MODE mock data"

### Actions Taken
- Updated `src/lib/demo-data.ts` with 4 realistic running sessions (claude, codex, gemini, amp) and 4 history entries with portfolio-worthy task descriptions
- Verified all API routes already had demo mode checks returning mock data
- Verified `src/lib/api-security.ts` bypasses local-only/token/origin checks in demo mode
- Ran `npm run build` — passed with zero TypeScript errors
- Deployed to Vercel with `NEXT_PUBLIC_DEMO_MODE=true` env var
- Production URL: https://acp-dashboard-one.vercel.app
- Committed all changes to main

## 2026-03-02 18:46 EST

### User Prompt
"Build Phase 1 (Command Center Controls) and Phase 2 (Voice Interface) for the ACP Dashboard"

### Actions Taken

**Phase 1: Command Center Controls**
- Created `/api/spawn` endpoint for spawning new ACP agent sessions (openclaw CLI + direct agent fallback)
- Created `/api/stream/[sessionId]` SSE endpoint for real-time agent output streaming via tail -F
- Created `/api/system` endpoint for CPU, memory, disk, load, uptime, and network vitals
- Created `/api/sessions/[sessionId]` endpoints with PUT (steer), PATCH (cancel), DELETE (close)
- Created `/api/tts` endpoint for ElevenLabs TTS with browser speech synthesis fallback
- Created `/src/lib/api-security.ts` with rate limiting, local-only access, origin checking, and API token support
- Added SpawnModal UI with agent picker, task input, mode toggle (one-shot/persistent), working directory selector
- Added session controls (Steer, Terminal, Cancel, Close) to each SessionCard
- Added inline steer input with text field for sending new instructions
- Added TerminalPanel component with SSE streaming, auto-scroll, and status indicators
- Added SystemVitalsBar widget showing CPU/MEM/DISK bars with load average and uptime
- Added "+ SPAWN" buttons to each agent slot and fleet header
- Replaced static polling with SSE-enhanced polling with error backoff

**Phase 2: Voice Interface**
- Added useVoice hook integrating Web Speech API for voice recognition
- Added voice command parser supporting: spawn, cancel, close, status report, settings
- Added VoiceOrb component with animated rings, mic/speaker SVG icons, and voice level visualization
- Added ElevenLabs TTS integration with browser speech synthesis fallback
- Added voice transcript display in header during active listening
- Added VoiceToast notifications for voice command feedback
- Added wake word detection ("Hey Jarvis") with always-listening toggle
- Added SpeechRecognition type declarations for TypeScript

**Files Created:**
- `src/app/api/spawn/route.ts`
- `src/app/api/stream/[sessionId]/route.ts`
- `src/app/api/system/route.ts`
- `src/app/api/sessions/[sessionId]/route.ts`
- `src/app/api/tts/route.ts`
- `src/lib/api-security.ts`
- `docs/activity_log.md`

**Files Modified:**
- `src/app/page.tsx` (expanded from 1101 to ~2430 lines with all new components)

## 2026-03-02 19:15 EST

### User Prompt
"Build Phase 1 and Phase 2 features for ACP Dashboard"

### Actions Taken

**Bug Fixes:**
- Fixed build error: created `src/app/not-found.tsx` (missing /_not-found page)
- Fixed middleware blocking microphone access: changed `microphone=()` to `microphone=(self)` for voice interface
- Fixed viewport metadata to use Next.js 15 `viewport` export instead of deprecated metadata field

**Phase 1 Enhancements:**
- Created `/api/events` SSE endpoint for real-time dashboard updates (replaces polling)
- Updated `useSSEUpdates` hook to use EventSource with automatic polling fallback
- Added SSE connection status indicator ("SSE LIVE" / "POLLING") to status bar
- Added amp and devin agents to spawn allowed list, CLI fallback map, and process detection
- Updated spawn modal agent picker to include all 7 agents
- Updated voice command parser to recognize amp and devin

**Phase 2 Enhancements:**
- Voice commands now support all 7 agents (added amp, devin)

**Mobile Responsiveness:**
- Agent fleet grid now uses `auto-fill, minmax(130px, 1fr)` instead of fixed columns
- Header wraps on small screens with flex-wrap
- Main container uses `clamp()` for responsive padding
- Status bar uses `clamp()` for responsive gap/padding
- Added proper viewport meta tag

**Files Created:**
- `src/app/not-found.tsx`
- `src/app/api/events/route.ts`

**Files Modified:**
- `middleware.ts` (microphone permission)
- `src/app/layout.tsx` (viewport export)
- `src/app/page.tsx` (SSE hook, agent list, mobile responsive, SSE indicator)
- `src/app/api/spawn/route.ts` (amp/devin agents)
- `src/app/api/sessions/route.ts` (amp/devin detection + config)
- `docs/activity_log.md`

## 2026-03-07 20:20 EST

### User Prompt
"Improve the Jarvis-style ACP Mission Control dashboard with design cleanup, agent performance analytics, task templates, session diff viewer, and fleet heatmap."

### Actions Taken
- Created `src/components/AgentAnalytics.tsx` - bar chart component showing tokens used per agent, avg session duration, success/failure counts with mock data
- Created `src/components/FleetHeatmap.tsx` - 24x7 activity grid showing when agents are most active with mock data
- Created `src/components/DiffViewer.tsx` - collapsible diff viewer for completed sessions showing files modified with +/- line counts
- Modified `src/app/page.tsx` - added task templates ("Security Audit", "Add Tests", "Code Review", "Deploy to Vercel", "Refactor") to SpawnModal
- Modified `src/app/page.tsx` - integrated AgentAnalytics and FleetHeatmap sections between active sessions and history
- Modified `src/app/page.tsx` - added DiffViewer to HistoryRow for completed sessions
- Modified `src/app/page.tsx` - design cleanup: reduced glow intensity on all agent themes, updated borders to zinc-800 (#27272a), updated section headings to zinc-600 (#52525b), reduced header text shadow and HexRing blur

## 2026-03-23 03:44 EST

### User Prompt
"Write a professional README.md for this project"

### Actions Taken
- Read package.json, DESIGN.md, API routes, and page.tsx to understand project structure
- Created README.md with:
  - Badges for Next.js, TypeScript, React, and Framer Motion
  - Overview explaining the Jarvis-style mission control purpose
  - ASCII architecture diagram showing data flow
  - "Why This Architecture" section explaining polling + SSE choice
  - Features list (session monitoring, spawning, streaming, vitals)
  - Getting Started with installation and environment variables
  - API routes table
  - Project structure
  - TODO noting the page.tsx refactor needed
  - MIT license
