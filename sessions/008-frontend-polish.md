# Session 008: Frontend Polish

**Date:** 2026-04-24
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Redesign /demo page as three-panel layout (left: project binder, center: agent cards + memory feed, right: output viewer)
- Dark theme with locked design tokens (zinc-950 base, emerald/amber/red accents)
- `AgentCard.tsx` — state-driven borders, token bar, monospace counters
- `MemoryFeed.tsx` — live event list, newest on top, fade-in from right
- `ImageWithBoxes.tsx` — SVG overlay with confidence-colored boxes, hover tooltip, click handler
- `VerifiedReportViewer.tsx` — prose with inline ✓/⚠/✗ tag pills, click → evidence view
- Framer Motion for mechanical transitions (card state, memory feed, bbox reveal)
- Backend: enrich SSE with evidence/draft/audit result events + static image serving
- Wire frontend to real SSE stream
- Session log

**Scope (out):**
- Landing page (Session 010)
- Mobile responsiveness
- Dark/light toggle
- File upload UI
- Settings, auth

**Context loaded:**
- CLAUDE.md, sessions 001–007
- Full frontend codebase (6 shadcn components, 2 pages, Tailwind v3, Geist fonts)
- Backend main.py, orchestrator.py, all agent return types
- Design tokens from user spec (locked)

**New dependency:** `framer-motion` — approved by user in session scope. Mechanical animations only, no decorative.

**Acceptance criteria:**
1. Three-panel layout renders cleanly on 1440px+
2. Running canonical demo shows agent cards transitioning states in real-time
3. Memory feed updates live as agents write to project binder
4. Clicking ✓/⚠/✗ tag opens evidence view with correct bounding box
5. Bounding boxes display accurately on all 3 test forms
6. No default shadcn colors — all from design token list
7. No gradient or decorative animation
8. Session log complete

**Build order (locked):**
1. Design tokens in tailwind.config.ts + globals.css
2. AgentCard.tsx
3. MemoryFeed.tsx
4. ImageWithBoxes.tsx
5. VerifiedReportViewer.tsx
6. Three-panel /demo page
7. Wire to real SSE stream + backend enrichment

---

## Standup

- **Last session (007):** Built canonical demo mode — reset endpoint, 3rd synthetic form, one-button demo flow. Full pipeline runs end-to-end (~8 min).
- **This session:** Make it look like a real product. Three-panel layout, dark theme, live output viewer.

---

## Work Log

- **[start]** — Read CLAUDE.md, all session logs, full frontend audit. Context loaded.
- **[session-log]** — Wrote Definition of Ready.
