# Poneglyph

**Institutional memory for development projects that actually works.**

Consulting firms running projects for the World Bank, GIZ, and government agencies drown in fragmented evidence — scanned field forms in Hindi, WhatsApp photo updates, meeting recordings where promises are made and forgotten, CRM exports that capture names but not context. When it's time to write the quarterly report, a senior consultant spends a week manually piecing together what actually happened.

Poneglyph is a multi-agent system built on Claude Opus 4.7 that watches what happens on a project — scanned documents, meeting transcripts, field data — and holds the truth across time. Six specialized agents extract, store, verify, and report on project evidence so that the humans doing the work don't have to change anything about how they work.

**The agents don't replace the PM. They replace the week of manual synthesis.**

---

## Quick Start

```bash
# Backend
cd backend
uv sync
uvicorn main:app --reload  # http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:3000
```

Requires `ANTHROPIC_API_KEY` in your environment.

---

## Architecture

Six agents, each with one job:

| Agent | Job |
|-------|-----|
| **Scout** | Reads documents and images. Extracts evidence with pixel-coordinate bounding boxes. |
| **Scribe** | Processes meeting transcripts. Extracts decisions, commitments, open questions. |
| **Archivist** | Owns the project memory. Reads and writes notes across sessions. Detects contradictions. |
| **Auditor** | Self-verification. Re-reads drafts, checks citations, assigns ✓ / ⚠ / ✗ tags. |
| **Drafter** | Writes donor-format reports, citing evidence. Does not verify its own work. |
| **Orchestrator** | Top-level coordinator. Decides which agent runs when. Exposes cost to the UI. |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

---

## Why Opus 4.7

This isn't a chatbot wrapper. Every architectural decision maps to a specific Opus 4.7 capability:

- **Pixel-coordinate vision** — citing evidence on scanned documents with bounding boxes
- **File-system persistent memory** — the Archivist's cross-session project binder
- **Self-verification** — the Auditor's ✓ / ⚠ / ✗ tagging
- **Task budgets** — honest cost reasoning visible in the UI
- **1M token context** — reasoning across many field evidence items at once

See [CAPABILITIES.md](CAPABILITIES.md) for the full mapping.

---

## Project Status

Built for the **Built with Opus 4.7 Hackathon** (Cerebral Valley + Anthropic, April 2026).

Session logs documenting the build process live in [`/sessions/`](sessions/).

---

## License

MIT
