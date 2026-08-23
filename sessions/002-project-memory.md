# Session 002: Project Memory Foundation

**Date:** 2026-04-23
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Design and implement `ProjectMemory` Python class in `/backend/memory/project_memory.py`
- The memory is a directory on disk, one per project, structured as:
  ```
  /data/projects/<project_id>/
    project.yaml
    logframe.md
    /evidence/<evidence_id>.md
    /meetings/<meeting_id>.md
    /commitments/<commitment_id>.md
    /stakeholders/<stakeholder_id>.md
    /timeline.md
  ```
- Implement methods: `create_project`, `load_logframe`, `add_evidence`, `add_meeting`, `add_commitment`, `append_timeline`, `read_all_evidence`, `read_all_meetings`, `read_all_commitments`, `read_timeline`, `find_contradictions` (stub)
- Define Pydantic models for Evidence, Meeting, Commitment, StakeholderPosition, TimelineEvent
- Each markdown file has YAML frontmatter (structured fields) + markdown body (prose)
- Write test script `/backend/memory/test_memory.py` — creates a project, adds 3 evidence, 2 meetings, 1 commitment, reads them all, prints timeline
- Create hand-written example project in `/project_memory_example/`
- This session log

**Scope (out):**
- Any LLM calls (Archivist agent is Session 004)
- Frontend changes (memory is backend-only for now)
- Contradiction detection logic (stubbed only)
- Auth/multi-user concerns

**Context loaded:**
- CLAUDE.md (the constitution)
- /sessions/001-bootstrap.md
- backend/main.py, backend/pyproject.toml

**Context budget:** ~50k tokens

---

## Standup

- **Last session:** Bootstrapped repo — directory structure, doc stubs, FastAPI backend with hello-agent endpoint, Next.js frontend with hello-agent page. All working.
- **This session:** Build the ProjectMemory substrate — the file-system-based project binder that the Archivist agent will read/write in Session 004. This is the core data layer that makes Poneglyph's "flat markdown memory" architecture real.

---

## Work Log

- **[start]** — Read CLAUDE.md, session 001 log, existing backend code. PyYAML already available via transitive dependency (anthropic SDK), but added as explicit dependency for clarity.
- **[models]** — Created `/backend/memory/models.py` with 5 Pydantic models (Evidence, Meeting, Commitment, StakeholderPosition, TimelineEvent) and 4 enums (EvidenceSource, VerificationStatus, CommitmentStatus, TimelineEventType). Design choices: snake_case frontmatter keys, string IDs (human-readable slugs), ISO 8601 strings for dates (clean YAML serialization), Optional fields for real-world partial data.
- **[project_memory]** — Created `/backend/memory/project_memory.py` with ProjectMemory class. 12 methods total. Key design: `_write_markdown` and `_read_markdown` helpers for YAML frontmatter I/O. Timeline is append-only. `find_contradictions` stubbed for Session 004. Enum values are serialized to strings in YAML for human readability.
- **[fix imports]** — Initial imports used `backend.memory.*` prefix, but `backend/` is its own uv-managed project (no parent package). Fixed to `memory.*` imports.
- **[test]** — Created `/backend/memory/test_memory.py`. Uses tempdir for isolation. Creates a realistic MP FPC project with 3 evidence items (field form, photo, WhatsApp — covering verified/pending/contested statuses), 2 meetings, 1 commitment. All assertions pass on first run.
- **[example binder]** — Hand-wrote 9 files in `/project_memory_example/`: project.yaml, logframe.md, 3 evidence files, 1 meeting, 2 commitments, timeline.md. Content is based on real Synergy Technofin project patterns — beneficiary registration, cold storage construction, WhatsApp field updates, DC-level review meetings, land allotment bureaucracy. All YAML frontmatter validated as parseable.
- **[deps]** — Added `pyyaml>=6.0` as explicit dependency in pyproject.toml, updated lock file.
- **[verify]** — Re-ran test after all changes. All assertions pass.

---

## Context Budget

| Step | Estimated tokens | Actual |
|------|-----------------|--------|
| Read CLAUDE.md + session 001 + backend code | ~5k | ~5k |
| Design Pydantic models | ~5k | ~4k |
| Implement ProjectMemory class | ~10k | ~10k |
| Fix imports + test | ~5k | ~4k |
| Hand-write example binder (9 files) | ~10k | ~12k |
| Session log + commits | ~5k | ~5k |
| **Total** | **~40k** | **~40k** |

---

## Retro

**What worked:**
- Models-first design was right — defining the Pydantic models before the ProjectMemory class forced clear thinking about what each data type carries. No refactoring needed.
- The frontmatter approach (YAML between `---` fences + markdown body) is genuinely readable. Opening any file in the example binder, a consultant would understand it without knowing anything about the system.
- Using a temp directory in the test makes it safe to run repeatedly without cleanup worries.
- The example binder content is realistic and interconnected — ev-003 (WhatsApp claim) is linked to cmt-001 (collect attendance sheets) is linked to mtg-002 (where the commitment was made). This tells a story across files, which is exactly what the Archivist needs to reason over.

**What didn't work:**
- Initial `backend.memory.*` imports failed because `backend/` is a standalone uv project, not a subpackage. Fixed quickly, but cost one iteration. Should have checked the existing import style in `main.py` first.

**What to change next time:**
- Before writing imports, check how existing code in the same project resolves its modules.
- The timeline file format (appending YAML blocks separated by `---`) works but is slightly fragile — a malformed block could break parsing of later blocks. For the hackathon this is fine, but a production system would use one file per event or a proper append-only format.

---

## Acceptance Criteria Check

- [x] `python backend/memory/test_memory.py` runs end-to-end and prints the timeline
- [x] Inspecting the temp project directory shows human-readable markdown files
- [x] Each markdown file has valid YAML frontmatter parseable by `yaml.safe_load`
- [x] ProjectMemory class is type-hinted throughout with Pydantic models
- [x] `/project_memory_example/` has hand-written content a consultant would recognize
- [x] Session log complete with retro

---

## Next Session Definition of Ready (Draft)

**Session 003: Agent Architecture + Scout**
- Create base agent pattern in `/agents/`
- Write system prompts for all 6 agents in `/prompts/`
- Implement Scout agent — first working agent that uses Opus 4.7 vision to extract evidence from scanned documents
- Write ARCHITECTURE.md with the real system design
- Update CAPABILITIES.md with specific 4.7 features used and why
- Integrate Scout with ProjectMemory (add_evidence flow)
