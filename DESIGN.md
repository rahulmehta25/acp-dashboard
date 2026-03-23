# DESIGN.md — ACP Dashboard

## Brand Identity
- **Project:** ACP (Agent Command Panel) — multi-agent orchestration dashboard
- **Audience:** Developers, DevOps, AI engineers managing agent fleets
- **Visual tone:** Dark + technical, command center aesthetic, cyberpunk-adjacent

## Color System (Hex — Inline Styles)

### Core Palette
| Name | Value | Use |
|------|-------|-----|
| Background | `#0a0a0f` | Page background (dark charcoal) |
| Surface | `#0d0d1a` | Card/panel backgrounds |
| Text Primary | `#e0e0e0` | Primary text |
| Text Secondary | `#d8d8d8` | Secondary text |
| Primary Accent | `#00d4ff` | Cyan — CTAs, active states, links |

### Agent Identity Colors
| Agent | Color | Hex |
|-------|-------|-----|
| Claude | Purple | `#d4a0ff` |
| Codex | Cyan | `#00d4ff` |
| Gemini | Teal | `#4ecdc4` |
| Devin | Indigo | `#6c5ce7` |
| Amp | Orange | `#ff8c42` |
| Pi | Red | `#ff6b6b` |
| OpenCode | Gold | `#f9c74f` |

## Typography
- **Sans:** `'Inter'` (weights: 300, 400, 500, 600, 700) — UI text
- **Mono:** `'JetBrains Mono'` (weights: 300, 400, 500, 600, 700) — code, metrics, terminal output
- Imported from Google Fonts via `next/font`

## Gradients
| Name | Value | Use |
|------|-------|-----|
| Background gradient | `linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)` | Full-page background |

## Motion & Animation
- **Library:** Framer Motion (not CSS keyframes)
- **Fade in:** `opacity: 0 → 1`
- **Slide up:** `y: 20 → 0` with opacity fade
- **Stagger children:** 0.05s delay between list items
- **Default duration:** 0.3s
- **Easing:** Framer Motion defaults (spring physics)

## Layout
- **Approach:** Flexbox with inline styles (no Tailwind)
- **No explicit grid system** — uses flex with percentage/fixed widths
- **No spacing scale** — uses direct px/em values
- **Breakpoints:** responsive via CSS media queries in globals

## Component Library
- **Framework:** Custom components (no shadcn/ui, no component library)
- **Styling:** Inline styles + Framer Motion
- **Icons:** Lucide React
- **Charts:** Custom SVG-based visualizations

## Design Direction
This dashboard follows a command-center aesthetic:
- Dense information display with monospace metrics
- Glowing cyan accents on dark surfaces
- Each agent has a unique identity color for quick visual parsing
- Terminal-like elements for logs and output
- Minimal whitespace — maximize information density

## Anti-Patterns
- Do NOT add Tailwind CSS — this project uses inline styles + Framer Motion
- Do NOT use light backgrounds — this is a dark-only interface
- Do NOT use generic component libraries — components are custom-built
- Do NOT add font imports outside of `next/font` — Inter and JetBrains Mono are already configured
