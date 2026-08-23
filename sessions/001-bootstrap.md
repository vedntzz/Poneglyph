# Session 001: Project Bootstrap

**Date:** 2026-04-23
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Create the full repo layout specified in CLAUDE.md
- Scaffold Next.js 14 frontend (App Router, TypeScript, Tailwind, shadcn/ui) in `/frontend`
- Scaffold FastAPI backend in `/backend` with uv for dependency management
- Wire the Anthropic Python SDK with model `claude-opus-4-7`
- Build ONE working endpoint: `POST /api/hello-agent` that sends a user message to Opus 4.7 and returns the response
- Frontend has ONE page that calls this endpoint and shows the response
- Write the session log file as you go
- Create stub files for all docs referenced in CLAUDE.md
- Create empty directories with `.gitkeep` files
- Commit after each meaningful unit of work

**Scope (out):**
- Any real agent logic (Session 003+)
- Authentication
- File upload handling
- Any UI beyond the hello-agent test page
- Production deployment

**Context loaded:**
- CLAUDE.md (the constitution)
- Session prompt from user
- No existing code beyond pyproject.toml and pre-commit hook

**Context budget:** ~40k tokens

---

## Standup

- **Last session:** N/A — this is the first session
- **This session:** Bootstrap the entire repo from zero to a working hello-agent round-trip

---

## Work Log

- **13:28** — Created directory structure: `/agents`, `/prompts`, `/sessions`, `/data/real_redacted`, `/data/synthetic`, `/evals`, `/project_memory_example` with `.gitkeep` files
- **13:29** — Writing this session log (Definition of Ready)
- **13:30** — Created stub documentation files (README, ARCHITECTURE, CAPABILITIES, METHODOLOGY, EVALS, FAILURE_MODES)
- **13:32** — Scaffolded FastAPI backend: `main.py` with `POST /api/hello-agent` endpoint, Pydantic models, CORS middleware, Anthropic SDK wiring. Uses `claude-opus-4-7`, adaptive thinking, no temperature/top_p/top_k.
- **13:34** — Created `.env.example` files for backend
- **13:35** — Committed: repo layout, doc stubs, backend scaffold
- **14:00** — Fixed model string from `claude-opus-4-7-20250415` to `claude-opus-4-7` (no date suffix). Fixed thinking from `budget_tokens` to adaptive (budget_tokens not supported on 4.7).
- **14:05** — Added `output_config={"effort": "high"}` to hello-agent endpoint per acceptance criteria
- **14:10** — Scaffolded Next.js 14 frontend via `create-next-app@14` with TypeScript, Tailwind, App Router, `--src-dir`
- **14:12** — Ran `shadcn init` — discovered shadcn v4 emits Tailwind v4 CSS (`@import "shadcn/tailwind.css"`, `@base-ui/react` components) incompatible with Next.js 14 (Tailwind v3)
- **14:15** — Rewrote all four shadcn components (Button, Card, Input, Textarea) to classic Tailwind v3 style. Replaced `@base-ui/react` Button with `@radix-ui/react-slot`. Rewrote `globals.css` with HSL variables. Updated `tailwind.config.ts` with full shadcn color system.
- **14:20** — Built hello-agent frontend page: form with Textarea + Button, calls `POST /api/hello-agent`, displays response with model/token info
- **14:22** — `npm run build` passes cleanly
- **14:25** — Updated session log, wrote retro

---

## Context Budget

| Step | Estimated tokens | Actual |
|------|-----------------|--------|
| Read CLAUDE.md + repo state | ~5k | ~5k |
| Directory + doc stubs | ~3k | ~3k (done prior session) |
| Backend scaffold | ~8k | ~8k (done prior, fixed this session) |
| Frontend scaffold | ~12k | ~15k (shadcn v4/v3 compat took extra) |
| Hello-agent page | ~5k | ~4k |
| Commits + finalize | ~3k | ~3k |
| **Total** | **~36k** | **~38k** |

---

## Retro

**What worked:**
- Backend was already solid from the prior commit — clean Pydantic models, proper error handling, CORS config
- README is genuinely good — not a generic hackathon placeholder
- Repo layout matches CLAUDE.md exactly

**What didn't work:**
- `shadcn@latest init` (v4) generates Tailwind v4 CSS and `@base-ui/react` components that don't work with Next.js 14 (which ships Tailwind v3). Had to rewrite all four components and the CSS manually. This cost ~5k extra tokens.
- The original backend used a date-suffixed model ID (`claude-opus-4-7-20250415`) and `budget_tokens` thinking — both wrong for Opus 4.7. Fixed to use bare `claude-opus-4-7` alias and adaptive thinking.

**What to change next time:**
- When using `create-next-app@14`, pin shadcn to a v3-compatible version or skip `shadcn init` and write components directly — it's only 4 files
- Verify model parameters against live API docs before committing

---

## Next Session Definition of Ready (Draft)

**Session 002: Agent Architecture**
- Create base agent class in `/agents/base.py`
- Create `ProjectMemory` class for file-system-based project binder
- Write system prompts for all 6 agents in `/prompts/`
- Implement Scout agent as the first working agent
- Write ARCHITECTURE.md with the real system design
- Update CAPABILITIES.md with the specific 4.7 features used and why
