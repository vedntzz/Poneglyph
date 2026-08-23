# Failure Modes — Poneglyph

> What this system does *not* do well. Honest accounting.

---

## Known Limitations

*(To be populated as we discover and document failure modes during development and evaluation.)*

### Planned sections:

1. **Vision accuracy on degraded inputs** — handwritten forms with poor scan quality, faded ink, non-standard layouts
2. **Language handling** — Hindi, regional languages, mixed-script documents
3. **Hallucination in report drafting** — Drafter may generate plausible-sounding claims not grounded in evidence
4. **Contradiction detection limits** — Archivist's ability to catch subtle contradictions across many documents
5. **Cost** — Opus 4.7 with xhigh effort is expensive; real-world cost per project cycle
6. **Single-project scope** — hackathon version supports one project at a time

---

## How We Test For These

Each failure mode maps to specific eval cases in `/evals/`. See [EVALS.md](EVALS.md) for results.
