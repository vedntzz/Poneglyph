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

## Lessons Learned

### Integration tests that exercise the cross-agent pipeline are not optional

Isolated agent tests miss contract mismatches. In Session 008, `test_scribe.py` passed while the live demo crashed — because the test only checked Scribe's own output fields, never the identity fields (`meeting_id`, `title`, `commitment_id`) that the Orchestrator reads when emitting SSE events. The Orchestrator is the consumer of Scribe's return type, but no test exercised that interface.

**Rule:** every agent's return type must be tested through the lens of its downstream consumer, not just its own correctness. If Agent B reads `record.field_x` from Agent A's output, a test must assert `field_x` exists and is populated. Isolated agent tests verify extraction; integration tests verify contracts.

---

## Session Index

| Session | Slug | Focus |
|---------|------|-------|
| 001 | bootstrap | Repo scaffolding, frontend + backend hello-world |

*(Updated as sessions are completed.)*
