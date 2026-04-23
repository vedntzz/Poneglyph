# Architecture — Poneglyph

> System design document. Updated as the architecture evolves.

---

## Overview

Poneglyph is a multi-agent system where six specialized Claude Opus 4.7 agents collaborate to maintain institutional memory for development projects. The Orchestrator coordinates agent execution, each agent has a single responsibility, and all shared state flows through a file-system-based ProjectMemory.

---

## Agent Architecture

```
User (frontend) → API (FastAPI) → Orchestrator → Agent(s) → ProjectMemory
                                                          → Anthropic API
```

Each agent is a Python class in `/agents/` with:
- A `run()` method that accepts typed inputs and returns typed outputs
- A system prompt loaded from `/prompts/<agent_name>.md`
- Access to a shared `ProjectMemory` instance
- Token budget accounting

The Orchestrator is **not** an LLM call — it's a Python controller that routes work to agents based on the request type.

---

## Data Flow

1. **Ingest:** User uploads documents (PDFs, images, transcripts) via the frontend
2. **Extract:** Scout and Scribe process raw inputs into structured evidence
3. **Store:** Archivist writes evidence to ProjectMemory (flat markdown files)
4. **Query:** User asks questions; Orchestrator routes to relevant agents
5. **Report:** Drafter composes reports; Auditor verifies every claim
6. **Verify:** Auditor tags each sentence with ✓ (verified), ⚠ (uncertain), or ✗ (unverified)

---

## ProjectMemory

File-system-based persistent memory. Not a database — that's a deliberate design choice to showcase Opus 4.7's file-system memory capability.

Structure is documented as it evolves. See `/project_memory_example/` for sample output.

---

## Detailed Design

*(To be written in Sessions 002–005 as each agent is implemented.)*
