# Evals — Poneglyph

> Honest numbers on what works and what doesn't.

---

## Eval Framework

Each agent is evaluated on test cases in `/evals/`. Scoring is automated where possible, manual where necessary. We report both pass rates and failure modes.

---

## Results

*(To be populated as agents are implemented and evaluated. Target: 12+ test cases across all agents.)*

| Agent | Test Cases | Pass Rate | Notes |
|-------|-----------|-----------|-------|
| Scout | — | — | Planned |
| Scribe | — | — | Planned |
| Archivist | — | — | Planned |
| Auditor | — | — | Planned |
| Drafter | — | — | Planned |
| Orchestrator | — | — | Planned |

---

## Methodology

- Test cases use both synthetic and real (redacted) data
- Synthetic data is in `/data/synthetic/`, real data in `/data/real_redacted/`
- Scoring scripts live in `/evals/`
- Results are reproducible: same inputs, same model params, deterministic where possible
