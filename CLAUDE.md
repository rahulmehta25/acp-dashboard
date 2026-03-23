# CLAUDE.md — ACP Dashboard

## Stack
Next.js 15 + React 19 + TypeScript 5.7 + Framer Motion. No component library — custom components with inline styles. Deployed on Vercel with DEMO_MODE for portfolio showcase.

## Commands
```bash
npm run dev          # Dev server on :3456
npm run build        # Production build
npm run start        # Production server on :3456
```

No test suite, no linter, no typecheck script configured.

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Main dashboard page
│   ├── layout.tsx            # Root layout (Inter + JetBrains Mono fonts)
│   └── api/                  # API routes (config, events, sessions, spawn, stream, system, tts)
├── components/               # UI components
└── lib/                      # Utilities (api-security, demo-data)
```

## Key Patterns
- **Styling:** Inline styles + Framer Motion — no Tailwind, no CSS modules
- **Fonts:** Inter (sans) + JetBrains Mono (mono) via `next/font`
- **API routes:** Next.js App Router API routes in `src/app/api/`
- **Demo mode:** `DEMO_MODE=true` serves mock data for portfolio showcase
- **Real-time:** SSE streaming via `/api/stream/[sessionId]`

## Design System
See `DESIGN.md` for colors, typography, and component patterns. Dark command-center aesthetic with cyan (`#00d4ff`) primary accent.

## Deployment
- Platform: Vercel
- Demo mode available for portfolio showcase
- Environment: `DEMO_MODE`, API connection configs in `dashboard.config.json`
