# ACP Dashboard

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-purple?logo=framer)

Real-time mission control for orchestrating AI coding agents. A Jarvis-style command center that monitors, spawns, and streams output from multiple concurrent agent sessions.

![Screenshot Placeholder](docs/screenshot.png)

## Overview

ACP Dashboard provides unified visibility into your fleet of AI coding agents. It polls the [OpenClaw](https://github.com/anthropics/openclaw) gateway for session data, displays real-time agent output via SSE streaming, and shows system resource utilization. The interface follows a dark command-center aesthetic with agent-specific color coding for quick visual parsing.

**Supported Agents:** Claude Code, Codex, Gemini CLI, Pi, OpenCode, Amp, Devin

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACP Dashboard                            │
│                     (Next.js on :3456)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Sessions   │    │    Spawn     │    │   Stream     │      │
│  │   Polling    │    │    Agent     │    │    SSE       │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
└─────────┼───────────────────┼───────────────────┼───────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway (:18789)                    │
│           (Process detection, session management)               │
└─────────────────────────────────────────────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Claude  │        │  Codex   │        │  Gemini  │  ...
   └──────────┘        └──────────┘        └──────────┘
```

**Data Flow:**
1. Dashboard polls `/api/sessions` every few seconds
2. Backend detects running agents via process inspection (`ps`, `lsof`)
3. SSE streams (`/api/stream/[sessionId]`) tail agent output logs in real-time
4. System vitals collected via Node.js `os` module and shell commands

## Why This Architecture

**Polling + SSE over WebSockets:** HTTP polling for session state is simple, stateless, and resilient to network interruptions. SSE provides real-time streaming for active sessions without WebSocket complexity. No connection state to manage, no reconnection logic to debug.

**Process-based detection:** Rather than requiring agents to register themselves, the dashboard inspects running processes. This means any agent CLI works out of the box, no integration required.

**Next.js App Router:** Single codebase for both the React dashboard and API routes. API routes handle process spawning, system stats, and SSE streaming. Fast iteration with hot reload.

**Inline styles + Framer Motion:** No build-time CSS processing. Component styles are colocated with logic. Framer Motion handles animations without CSS keyframes.

## Features

- **Session Monitoring:** Live view of all running agent sessions with status, elapsed time, and working directory
- **Agent Spawning:** Launch new agent sessions from the dashboard with task input and mode selection
- **SSE Streaming:** Real-time agent output streamed to the browser via Server-Sent Events
- **System Vitals:** CPU, memory, disk usage, load averages, and process count
- **Session History:** Recent completed/terminated sessions for quick reference
- **Agent Identity Colors:** Each agent type has a distinct color for instant visual identification
- **Demo Mode:** Runs with realistic mock data on Vercel for portfolio showcase

## Getting Started

```bash
# Clone and install
git clone https://github.com/rahulmehta25/acp-dashboard.git
cd acp-dashboard
npm install

# Start development server
npm run dev
# Dashboard available at http://localhost:3456

# Production build
npm run build
npm start
```

**Requirements:**
- Node.js 18+
- OpenClaw gateway running on `:18789` (for live data)
- Or set `DEMO_MODE=true` for mock data

**Environment Variables:**
| Variable | Description | Default |
|----------|-------------|---------|
| `DEMO_MODE` | Enable mock data for demo/portfolio | `false` |
| `PORT` | Server port (via npm scripts) | `3456` |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List active sessions, history, gateway status, config |
| `/api/spawn` | POST | Spawn a new agent session |
| `/api/stream/[sessionId]` | GET | SSE stream of agent output |
| `/api/system` | GET | System vitals (CPU, memory, disk, load) |
| `/api/config` | GET | Dashboard configuration |
| `/api/events` | GET | Recent events |

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Main dashboard (monolith, needs refactor)
│   ├── layout.tsx         # Root layout with fonts
│   └── api/               # API routes
├── components/            # UI components (AgentAnalytics, FleetHeatmap, DiffViewer)
└── lib/                   # Utilities (api-security, demo-data)
```

## TODO

- [ ] **Refactor page.tsx:** The main dashboard is a 2,549-line monolith. Break into smaller components: SessionCard, SystemVitals, SpawnModal, StreamViewer, etc.
- [ ] Add linting and typecheck scripts
- [ ] Add test coverage

## License

MIT
