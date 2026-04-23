# Session 001: Project Bootstrap

**Date:** 2026-04-23
**Claude Code model:** claude-opus-4-6

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

- **13:28** — Created directory structure: `/agents`, `/prompts`, `/sessions`, `/data/real_redacted`, `/data/synthetic`, `/evals`, `/project_memory_example`, `/frontend`, `/backend` with `.gitkeep` files
- **13:29** — Writing this session log (Definition of Ready)
- **13:30** — Creating stub documentation files (README, ARCHITECTURE, CAPABILITIES, METHODOLOGY, EVALS, FAILURE_MODES)

*(continued below as work progresses)*

---

## Context Budget

| Step | Estimated tokens | Actual |
|------|-----------------|--------|
| Read CLAUDE.md + repo state | ~5k | ~5k |
| Directory + doc stubs | ~3k | TBD |
| Backend scaffold | ~8k | TBD |
| Frontend scaffold | ~12k | TBD |
| Hello-agent page | ~5k | TBD |
| Commits + finalize | ~3k | TBD |
| **Total** | **~36k** | TBD |

---

## Retro

*(to be written at end of session)*
