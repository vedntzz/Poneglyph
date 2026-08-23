# CLAUDE.md — Poneglyph

This file is read by Claude Code at the start of every session. It is the constitution of this project. Read it carefully before doing anything.

---

## What this project is

**Poneglyph** is a multi-agent system built on Claude Opus 4.7 that acts as an institutional memory for multi-stakeholder development projects.

Named after the indestructible stone tablets in *One Piece* that carry true history across centuries — scattered across the world, unreadable in isolation, revealing a forgotten truth only when read together. That's exactly what this tool does for development projects: evidence is scattered across forms, emails, WhatsApp, meetings, CRMs; individually useless, collectively the truth of what the project actually is.

This project is being built for the **Built with Opus 4.7 Hackathon** hosted by Cerebral Valley and Anthropic. Judges include Anthropic engineers, potentially including the creator of Claude Code. The submission deadline is **April 27, 2026, 05:00 IST**. The target is the grand prize.

---

## The problem we're solving (canonical — founder-approved)

Consulting firms run projects for multilateral and bilateral funding agencies — the World Bank, GIZ, UN agencies, and central and state governments. Think: setting up farmer companies, building supportive infrastructure across the value chain (including specialised warehouses like cold storage), and running rural livelihood programs.

**The project shape.** Every project has a plan with targets: reach a minimum of 1,000 farmers, set up salepoints for outputs and inputs, create an ecosystem of 100,000 stakeholders. The consulting firm must deliver this scope of work within the given timeframe.

**The problem.** The main challenges in effective project delivery are the data requirement, coupled with its fragmented availability. The information needed to substantiate analysis and decision-making is often dispersed across multiple sources within the project area, making data collection time-consuming and resource-intensive. This scattered nature of the data not only affects efficiency but also poses risks to accuracy, consistency, and timely execution of project activities.

Field staff across districts send updates in Excel, email, WhatsApp, photos, and handwritten notes, often in local languages. Field software like FarmTrac captures some of it — but only the basics (names, phone numbers, locations). Meetings with stakeholders produce decisions and promises, but nobody writes proper minutes, so what was agreed in the first meeting gets quietly forgotten by the fourth. Nothing talks to each other.

When it's time to write the quarterly or annual report for the funder, a senior consultant spends a full week manually reading through all of it, matching evidence to targets, and rewriting it in the funder's specific format.

Generic tools like Jira or Trello don't fit this work. It's not tasks. **It's evidence, promises, and reports.**

---

## What Poneglyph does

A team of specialized Opus 4.7 agents watches what actually happens on a project — scanned field forms, photos, meeting recordings, WhatsApp exports, CRM data — and holds the truth across time. The PM asks questions and makes decisions. Everything else is the agents' job.

Every existing PM tool forces humans to translate messy reality into clean tickets. Poneglyph inverts this. The people doing the work don't change anything. The agents do the synthesis.

---

## What "done" looks like for the hackathon

1. Working live demo at a public URL (deterministic demo mode + user-upload mode)
2. Public GitHub repo with a README that makes an Anthropic engineer click "star" within 30 seconds
3. A 3-minute video demo that ends with a GitHub link
4. A 100–200 word written summary
5. Session logs in `/sessions/` documenting the Agile for AI methodology used to build this
6. Evals showing honest numbers on 12+ test cases
7. A `FAILURE_MODES.md` that names what the system does *not* do well

---

## Project-wide rules (non-negotiable)

### Rule 1: Use Opus 4.7 features deliberately, not by default
The judging criterion for "Opus 4.7 Use" is *"did you surface capabilities that surprised even us?"* This means every architecture decision must justify itself in terms of a 4.7-specific capability. We are specifically leaning on:

- **High-resolution vision with pixel-coordinate bounding-box localization** (`3.75 MP`, 1:1 pixel mapping) — for citing evidence on scanned documents
- **File-system-based persistent memory** — for the Archivist agent's cross-session project binder
- **Self-verification before responding** — for the Auditor agent's ✓ / ⚠ / ✗ tagging
- **Task budgets with visible countdown** (beta header `task-budgets-2026-03-13`) — for the Orchestrator's honest cost reasoning
- **Adaptive thinking with `effort: xhigh`** — for agentic reasoning tasks
- **1M token context window** — for reasoning across many field evidence items at once

If a feature does not use at least one of the above, ask whether it belongs in this project.

### Rule 2: Prefer simple over clever
The judges built Claude Code. They respect simple architecture, clean orchestration, honest engineering. A three-file orchestrator that works beats a ten-file abstraction layer. Default to the simplest thing that could work. Only add indirection when you've hit a concrete need.

### Rule 3: Every agent has one job and a written system prompt
We have six agents: Scout, Scribe, Archivist, Auditor, Drafter, Orchestrator. Each must:
- Have a single clear responsibility
- Live in its own file under `/agents/`
- Have a system prompt in `/prompts/` that is readable to a human, with comments explaining why each instruction is there
- Never do the job of another agent

### Rule 4: Write session logs as you go
Every Claude Code session produces one markdown file in `/sessions/` named `NNN-slug.md`. It contains:
- **Definition of Ready:** what was the scope? What was out of scope? What context was loaded?
- **Standup:** what was done last session? what's being done now?
- **Work log:** timestamped notes as the session unfolds
- **Context budget:** rough tokens spent, and on what
- **Retro:** what worked, what didn't, what to change

These are not marketing. They are real. If something failed, write it down. Anthropic engineers will read these.

### Rule 5: No synthetic data pretending to be real
Demo data that is fake must be labeled as fake. Real data (from Synergy Technofin's past projects, redacted) is marked `real_redacted/`. Synthetic data is marked `synthetic/`. Do not mix them in demos without disclosure.

### Rule 6: The repo is the primary artifact
The video is a trailer for the repo. Every commit should ask: *"would Boris Cherny respect this?"* If the answer is no, don't commit it. Session logs, prompt files, architecture docs, evals — these are first-class artifacts, not afterthoughts.

### Rule 7: Ship live, ship deterministic
The live URL has two modes:
- **Demo mode** (primary): runs agents on prepared inputs. Tested 50 times. Always works.
- **Upload mode** (secondary): users can drop their own documents. May fail. That's okay — but the demo-mode link is what we ship in the video.

---

## Technical decisions (locked)

### Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui
- **Backend:** FastAPI (Python), deployed separately from frontend
- **Agent runtime:** Anthropic Python SDK, model `claude-opus-4-7`
- **Persistent memory:** flat markdown files in a project directory (not a database — that's the point)
- **Storage for uploads:** local filesystem in dev, S3 or similar in prod
- **Deployment:** Vercel for frontend, Railway or Fly for backend
- **Vision:** Opus 4.7 high-res image input, base64-encoded

### Model parameters
- Default model: `claude-opus-4-7`
- Default effort: `xhigh` for agentic reasoning, `high` for simple extraction
- Always use adaptive thinking: `thinking: {"type": "adaptive"}`
- Use task budgets for agent loops: beta header `task-budgets-2026-03-13`, minimum 20k tokens
- **Never** set `temperature`, `top_p`, or `top_k` — they return 400 on 4.7

### Agent architecture
Six agents. Each agent is a Python class in `/agents/` with:
- A `run()` method
- A system prompt loaded from `/prompts/<agent_name>.md`
- Access to a shared `ProjectMemory` object (the file-system-based project binder)
- Token budget accounting written to `/sessions/context_budget.md`

**Scout** — reads documents and images. Uses 4.7's pixel-coordinate vision. Returns structured evidence with bounding boxes.

**Scribe** — takes meeting audio/transcripts. Extracts decisions, commitments, open questions. Writes MoMs.

**Archivist** — owns the `ProjectMemory`. Reads and writes markdown notes across sessions. Detects contradictions across time.

**Auditor** — self-verification. Re-reads drafts, checks every citation against source, assigns ✓ / ⚠ / ✗ tags. Can refuse claims.

**Drafter** — writes donor-format reports, citing evidence via Archivist and Scout outputs. Does not verify its own work — Auditor does that.

**Orchestrator** — top-level coordinator. Decides which agent runs when. Exposes task budget countdown to the UI. Not an LLM call — a Python controller that calls agents in sequence or parallel.

### Repo layout (locked)
```
/poneglyph
├── CLAUDE.md                    (this file)
├── README.md                    (user-facing)
├── ARCHITECTURE.md              (system design)
├── CAPABILITIES.md              (each feature → 4.7 capability mapping)
├── METHODOLOGY.md               (Agile for AI, narrowly scoped)
├── EVALS.md                     (honest numbers)
├── FAILURE_MODES.md             (what we don't handle)
├── /agents/                     (one file per agent)
├── /prompts/                    (system prompts, human-readable)
├── /sessions/                   (dev logs, one per session)
├── /frontend/                   (Next.js app)
├── /backend/                    (FastAPI service)
├── /data/
│   ├── real_redacted/           (real Synergy data, redacted)
│   └── synthetic/               (generated demo data)
├── /evals/                      (test cases + scoring scripts)
└── /project_memory_example/     (sample output of Archivist's memory)
```

---

## How to start a session

1. Read this file (`CLAUDE.md`)
2. Read the last 1–2 entries in `/sessions/` to see where the previous session left off
3. Ask: what is the scope of this session? Write the **Definition of Ready** to the top of a new `/sessions/NNN-slug.md` file *before writing any code*
4. Ask: what's the context budget for this session? Write it down
5. Do the work
6. Write the session log as you go, not after
7. End with a retro: what worked, what didn't

## How to end a session

- All code committed with meaningful messages
- Session log complete with retro
- `README.md` or `ARCHITECTURE.md` updated if anything structural changed
- If agent prompts changed, update `/prompts/` and note why in the session log
- Next session's Definition of Ready drafted at the bottom of current session log

---

## Things I (Vedant) want Claude Code to do without asking

- Write clean, typed Python. Type hints on everything.
- Write clean, typed TypeScript. No `any`.
- Use shadcn/ui components directly, don't rebuild them.
- Commit after every meaningful unit of work.
- Write session logs as we go.
- Flag context budget concerns proactively — don't wait until you're out of room.
- Push back on me if a suggestion of mine violates Rule 2 (simple over clever).

---

## Code Quality Standards (non-negotiable)

These are the rules for every line of code committed to this repo. Anthropic engineers will read the code. Make it respectable.

### Clean code principles

**1. Name things precisely.**
- Functions are verbs: `extract_evidence()`, not `evidence_handler()`.
- Variables are nouns: `verified_claim`, not `data` or `result`.
- Boolean variables read as questions: `is_verified`, `has_citations`, `should_retry`.
- No abbreviations except universally understood ones (`id`, `url`, `api`). No `usr`, `ctx`, `mgr`.

**2. Functions do one thing.**
- A function longer than 40 lines is a code smell. Consider splitting.
- If you need to write "and" in the function's docstring, it's two functions.
- Pure functions where possible — input → output, no side effects. Reserve side effects for explicitly-named methods (`save_evidence`, `emit_event`).

**3. Fail loudly, fail early.**
- Validate inputs at function boundaries. Use Pydantic models on the Python side.
- No silent except blocks. Never `except: pass`. Catch specific exceptions with specific handling.
- Raise `ValueError` with a message that tells the next developer what went wrong and how to fix it.

**4. No magic numbers, no magic strings.**
- Constants at module top with SCREAMING_SNAKE_CASE: `MAX_EVIDENCE_PER_REQUEST = 20`.
- Enum types for finite string sets (verification tags, agent names, etc.), not raw strings scattered through the codebase.

**5. Structure over cleverness.**
- A long, obvious if/else is better than a compact one-liner nobody can read.
- List comprehensions: fine when simple. When nested two deep, use a for loop.
- Type hints everywhere in Python. No `any` in TypeScript.

**6. Dependencies are debt.**
- Before adding a package, ask: can the standard library do this? Can 10 lines of code do this?
- Prefer boring, well-maintained libraries (FastAPI, Pydantic, shadcn, Tailwind) over trendy ones.

### Comment standards

Comments exist to explain **why**, not **what**. The code shows what it does. Comments explain why it does it that way.

**Required comments:**

- **Agent system prompts (`/prompts/*.md`):** every non-obvious instruction must have a comment explaining why it's there. Example:
  ```markdown
  You are Scout, a field evidence extractor.

  <!-- We force tool use rather than asking for JSON in prose because
       Opus 4.7 follows tool schemas more reliably than prose JSON,
       especially for deeply nested structured output. -->
  Always record evidence using the `record_evidence` tool. Do not describe
  evidence in prose.
  ```

- **Opus 4.7-specific API calls:** comment every place where we use a 4.7 feature, and reference CAPABILITIES.md. Example:
  ```python
  # Opus 4.7 task budget: see CAPABILITIES.md#task-budgets
  # The model sees this countdown and self-prioritizes. Minimum 20k.
  headers = {"anthropic-beta": "task-budgets-2026-03-13"}
  request_body["task_budget"] = 25_000
  ```

- **Non-obvious design decisions:** if the reader would wonder "why not just X?" — answer it in a comment. Example:
  ```python
  # We read memory files on demand via tool use rather than loading all
  # evidence into context upfront. This showcases 4.7's file-system-based
  # memory — the "consultant opens their binder" behavior (see
  # ARCHITECTURE.md#archivist-design).
  ```

- **Acknowledged compromises:** when we choose a shortcut for the hackathon, say so explicitly. Example:
  ```python
  # HACKATHON COMPROMISE: single-project support only. Real product would
  # need project_id scoping on every memory operation. See FAILURE_MODES.md.
  ```

**Forbidden comments:**

- `# increment counter` above `counter += 1`. The code says what. Delete.
- `# TODO: fix this later` with no context. Write an issue or a FAILURE_MODES.md entry instead, or actually fix it.
- `# this is a hack` — say why it's a hack and what the right thing would be.
- Commented-out code. Delete it. Git has it.

**Docstring conventions:**

- Every public function/class in Python has a docstring. Google style.
- Every exported function/component in TypeScript has JSDoc describing parameters and return type.
- The docstring describes **contract** (what inputs are valid, what outputs mean), not implementation.

Example Python docstring:

```python
def extract_evidence(
    image_bytes: bytes,
    logframe: str,
    effort: Literal["high", "xhigh"] = "xhigh",
) -> list[Evidence]:
    """Extract structured evidence from a scanned document image.

    Uses Opus 4.7's pixel-coordinate vision (shipped April 16, 2026) to
    locate evidence regions and return bounding boxes in the image's
    native pixel space. See CAPABILITIES.md#pixel-vision.

    Args:
        image_bytes: Raw bytes of the image. Must be JPEG, PNG, or WebP.
            Do not downsample before passing — 4.7's high-res vision is
            the point. Images > 3.75 MP will be auto-downsampled by the API.
        logframe: The project's logframe as markdown text. Used to map
            extracted evidence to target indicators.
        effort: Opus effort level. "xhigh" is default because evidence
            extraction from messy handwritten forms benefits from
            exploratory reasoning.

    Returns:
        A list of Evidence objects. Empty list if no evidence is found
        (does NOT raise). Bounding boxes are guaranteed to be within
        the image dimensions.

    Raises:
        ValueError: if image_bytes is not a supported format.
        AnthropicAPIError: on API-level failures. Callers should retry
            with backoff on transient errors.
    """
```

### Code review checklist (Claude Code self-reviews before committing)

Before every commit, Claude Code should mentally run this checklist:

- [ ] Does every function have a single, clear responsibility?
- [ ] Are names precise? Would a new reader understand without context?
- [ ] Are inputs validated at function boundaries?
- [ ] Are errors specific, with actionable messages?
- [ ] Is there a comment for every non-obvious decision?
- [ ] Is there a comment for every 4.7-specific feature used?
- [ ] Any `any` types (TypeScript) or untyped returns (Python)?
- [ ] Any commented-out code? Any `TODO: fix this later` without context? Delete.
- [ ] Any dependencies added? Are they justified?
- [ ] Does the commit message describe what and why, not just what?

If any box is unchecked, fix it before committing.

### Commit message format

```
<type>(<scope>): <short description>

<optional longer explanation of why, not what>

<optional references to session log or doc>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
Scope: `scout`, `scribe`, `archivist`, `auditor`, `drafter`, `orchestrator`, `memory`, `frontend`, `backend`, `evals`.

Examples:

```
feat(scout): add pixel-coordinate bounding box extraction

Uses Opus 4.7's 1:1 pixel mapping (shipped 2026-04-16). The earlier
approach of normalized coordinates required post-hoc rescaling and
introduced drift. See sessions/003-scout.md retro.

Ref: CAPABILITIES.md#pixel-vision
```

```
fix(auditor): re-read source image for image-backed evidence claims

Previously, the Auditor verified image-sourced claims against the
cached text extraction, which meant it was checking Scout's own
summary — circular. Now Auditor loads the original image and
re-verifies against it directly. Drops false-VERIFIED rate from
18% to 3% on the eval set.

Ref: sessions/009-evals.md, EVALS.md#auditor-accuracy
```

## Things to ask before doing

- Adding a new dependency (I want to know why)
- Changing the agent architecture (6 agents is locked unless we agree to change it)
- Adding any feature not in the session's Definition of Ready
- Making a change that would affect the demo flow

---

## Demo flow (canonical — this is what the video shows)

1. User opens Poneglyph, uploads a project logframe PDF + 3 scanned Hindi field forms + one meeting transcript
2. Orchestrator activates. UI shows four agents spinning up with live task-budget countdowns
3. Scout processes forms — bounding boxes appear on scanned documents showing extracted evidence
4. Scribe processes the meeting — produces a structured MoM with decisions and commitments
5. Archivist writes to project memory — the project binder visibly updates
6. User asks: *"Where are we on the women's PHM training target?"*
7. Orchestrator routes the query. Archivist reads its notes. Scout provides visual evidence. Response includes:
   - An answer grounded in evidence
   - Visual citations (click a sentence → the scanned form opens with the exact bounding box highlighted)
   - A gap flag (*"2 villages have no evidence for this quarter"*)
8. User clicks "Draft Q2 Report — World Bank format"
9. Drafter writes. Auditor verifies. Report appears with every sentence tagged ✓, ⚠, or ✗
10. User clicks one ⚠ — sees why: contested evidence across two sources, reconciliation needed

Every step of this flow is real. No fakery. Judges can click into any citation and see the underlying evidence.

---

## What success looks like after 4 days

- Live URL works for the canonical demo flow above
- Repo tells the technical story compellingly
- Session logs show real engineering
- Evals are honest
- The video ends and the viewer wants to open the repo

That's it. Let's build.
