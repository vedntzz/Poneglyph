# Capabilities — Opus 4.7 Feature Mapping

> Every feature in Poneglyph maps to a specific Opus 4.7 capability. This document is the registry.

---

## Capability Registry

| Feature | Opus 4.7 Capability | Agent | Status |
|---------|---------------------|-------|--------|
| Bounding box evidence citations on scanned docs | High-res vision with pixel-coordinate localization (3.75 MP, 1:1 pixel mapping) | Scout | Planned |
| Cross-session project memory binder | File-system-based persistent memory | Archivist | Planned |
| ✓ / ⚠ / ✗ verification tags on report sentences | Self-verification before responding | Auditor | Planned |
| Live task-budget countdown in UI | Task budgets with visible countdown (beta header `task-budgets-2026-03-13`) | Orchestrator | Planned |
| Deep reasoning on messy field evidence | Adaptive thinking with `effort: xhigh` | Scout, Auditor | Planned |
| Reasoning across many evidence items at once | 1M token context window | Drafter, Archivist | Planned |

---

## Implementation Notes

*(To be added as each capability is implemented. Each entry will include: the API call, why this approach was chosen over alternatives, and a link to the relevant session log.)*
