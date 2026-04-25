# Session 012: Saturday Night Part 2 — Landing Page, Route Migration, Engine Integration, Tooltips

**Date:** 2026-04-26
**Claude Code model:** claude-opus-4-6

---

## Definition of Ready

**Scope (in):**
- New marketing landing page at `/` with Framer Motion animations
  - Sticky nav (transparent → white on scroll)
  - Hero: 100vh, staggered fade-in (eyebrow → headline → subhead → CTAs)
  - Problem section: two-column, scattered document cards, scroll-reveal
  - Capabilities: 3-card grid with mini SVG previews, stagger animation
  - Technical proof: 6 agent badges, 3 eval stats
  - Final CTA + footer
- Route migration: existing tool moves from `/` to `/app`
  - Update all internal links (AppNav, CommandPalette, landing CTAs)
  - Briefing modal, Cmd+K, scroll tracking all still work at `/app`
- Engine integration: embed `/demo` content as collapsible section in `/app`
  - Default collapsed, expands on click or Engine tab
  - Warm-light restyling (white cards, light borders)
  - SSE streaming still works
- Notion-style "?" tooltip popovers on each section header in `/app`
  - 320px white popover, soft shadow, arrow
  - Close on click-outside, Esc, X
  - Content for: Hero stat, Briefings, Drift, Logframe, Documents, Engine

**Scope (out):**
- Real activity feed on landing
- Authentication, project switching
- Mobile responsiveness
- Dark/light theme toggle
- New agent capabilities
- Custom domain

**Context loaded:**
- CLAUDE.md, sessions/011, sessions/010a
- Full frontend codebase: app router, components, tailwind config
- Locked color palette + typography from session 011

**Context budget:** ~200k tokens

**Acceptance criteria:**
1. `/` shows landing page with hero, problem, capabilities, technical proof, CTA, footer
2. Hero animation triggers on load (staggered fade + slide)
3. Section reveals trigger on scroll (Framer Motion useInView)
4. Color palette uses ONLY locked tokens
5. `/app` loads the tool with all features intact
6. Engine section embedded in `/app`, collapsed by default, expands on click
7. Engine section uses warm-light styling
8. "?" icons on each section header, click opens popover
9. Popover closes on click-outside, Esc, X
10. `/demo` still works as fallback
11. Landing CTAs link to `/app`
12. No console errors
13. Session log complete

---

## Standup

- **Last session (011):** Warm-light homepage rebuild. Top nav, command palette, circular arc stat, briefing card, drift timeline, logframe coverage, documents grid. All at `/`. `/demo` untouched.
- **This session:** Split `/` into marketing landing + `/app` tool. Embed Engine in `/app`. Add tooltips. Polish for hackathon submission.

---

## Work Log

- **[start]** — Read CLAUDE.md, session logs 010a + 011. Reviewed full spec: landing page, route migration, engine integration, tooltips.

- **[migration]** — Route migration (Build 1):
  - Created `app/app/` directory, copied `page.tsx` into it
  - Updated `app-nav.tsx`: Engine tab changed from `/demo` link to `#engine` scroll anchor; removed `isExternal` branch
  - Updated `command-palette.tsx`: "Run pipeline" and "Navigate > Engine" now call `onNavigate("engine")` instead of `window.location.href = "/demo"`
  - Build passes: 3 routes (`/`, `/app`, `/demo`) all compile, both `/app` and `/demo` return 200
  - Verified: tool renders at `/app` with all sections intact (header, 88% arc, drift, logframe, documents)

- **[landing]** — Landing page (Build 2 + 3 combined):
  - Added `2xl` (48px) and `3xl` (64px) to `tailwind.config.ts` font scale for hero
  - Built 7-section landing page at `/`:
    1. **LandingNav**: sticky 64px nav, transparent over hero, white bg + hairline on scroll past 80px. Left: logo. Right: GitHub ghost link + "Try the demo" forest green CTA
    2. **HeroSection**: 100vh, subtle warm gradient (#FAFAF7 → #F4F2EC), mono eyebrow "INSTITUTIONAL MEMORY · OPUS 4.7", 48px headline with -0.02em tracking, 18px subhead, two CTA buttons. Framer Motion staggered fade-in (0/100/250/400ms delay). Bobbing scroll chevron.
    3. **ProblemSection**: 60/40 two-column. Left: eyebrow + h2 + paragraph with `useInView` slide-right reveal. Right: 5 scattered document cards with varied rotations (-8° to +5°), staggered animate-in (80ms each). Caption "5 sources · 3 formats · 0 single source of truth" in amber.
    4. **CapabilitiesSection**: centered eyebrow + h2, 3-card grid. Each card: 32px SVG icon, title, description, preview SVG (ScoutPreview with bounding boxes, DriftPreview with 50→42 timeline, BriefingPreview with push_for/push_back/do_not_bring_up bars). Scale+fade animation with 120ms stagger.
    5. **TechnicalProofSection**: centered text block, 6 agent badges (Scout through Orchestrator) with green dots, 3 eval stat cards (12/12, 3/3, 55K tokens), "Read EVALS.md →" link.
    6. **FinalCTASection**: centered h2 + subhead + large primary CTA button.
    7. **Footer**: 3-column (branding + links + made-by), hairline top border, hackathon attribution.
  - All animations use Framer Motion `motion`, `useInView`, ease-out 200-600ms. No springs or bounces.

- **[engine]** — Engine integration (Build 3):
  - Added `.warm-engine` CSS class to `globals.css`: overrides all shadcn CSS variables (--background, --card, --border, etc.) to warm-light HSL values. This makes the dark-themed demo components render in warm palette when embedded.
  - Added `EngineDashboard` dynamic import in `/app` page — lazy-loads the `/demo` page component only when engine section expands. SSR disabled for the import.
  - Built `EngineSection` component: collapsed state shows CTA card ("See the agents at work"), expanded state reveals the full demo dashboard wrapped in `warm-engine` class + `AnimatePresence` height animation.
  - `scrollToSection("engine")` auto-expands the engine and scrolls with 100ms delay for React render.
  - Added `"engine"` to `SECTION_IDS` for IntersectionObserver.

- **[tooltips]** — Notion-style popovers (Build 4):
  - Built `components/info-popover.tsx`: 16px "?" circle button, 320px white popover with arrow, soft shadow. Closes on click-outside (mousedown listener), Esc (keydown listener), X button. AnimatePresence fade+slide animation.
  - Updated `SectionHeader` to accept optional `tooltip` prop. When present, renders `InfoPopover` inline.
  - Added tooltip content constants (`TOOLTIPS`) with specific text for: heroStat, briefings, drift, logframe, documents, engine.
  - Hero stat "?" placed next to "verified" label inside the circular arc.
  - All 6 sections in `/app` now have "?" popovers.

- **[verify]** — End-to-end smoke test:
  - Clean build (zero TS errors). All 3 routes compile.
  - `/` landing page: all 11 key elements verified (headline, eyebrow, CTAs, problem, 3 capabilities, tech proof, final CTA, footer). 9 links to `/app`.
  - `/app` tool: page header, hero stat, drift, logframe, documents, engine collapsed CTA, tooltip `aria-label="More information"` all present.
  - `/demo` fallback: returns 200.
  - Warm-light tokens confirmed: bg-canvas, bg-surface, border-hairline, accent-forest all present in `/app` HTML.
