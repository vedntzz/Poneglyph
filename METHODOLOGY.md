# Methodology — Agile for AI

> How we built Poneglyph: scoped sessions, honest retros, context budgets.

---

## Approach

Each Claude Code session is a sprint. Every session has:

1. **Definition of Ready** — scope, out-of-scope, acceptance criteria, context budget
2. **Work log** — timestamped notes written as the session unfolds
3. **Context budget** — rough token tracking to avoid blowing context limits
4. **Retro** — what worked, what didn't, what to change next session

Session logs live in [`/sessions/`](sessions/) and are the primary record of how this project was built. They are honest — failures are documented alongside successes.

---

## Why This Matters

AI-assisted development is new enough that there's no established methodology. We're documenting ours not because it's perfect, but because it's real. The session logs show:

- How scope decisions were made
- Where context limits forced trade-offs
- What the AI got wrong and how we recovered
- The actual cost (in tokens and time) of each session

---

## Session Index

| Session | Slug | Focus |
|---------|------|-------|
| 001 | bootstrap | Repo scaffolding, frontend + backend hello-world |

*(Updated as sessions are completed.)*
