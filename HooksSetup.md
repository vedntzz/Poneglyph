# Hooks + Skills Setup

One-time setup, ~5 minutes. Do this right after Session 001 scaffolds the repo.

## Pre-commit hook

Place the hook file, then wire it into git:

```bash
# From repo root:
mkdir -p .claude/hooks
mv pre-commit .claude/hooks/pre-commit
chmod +x .claude/hooks/pre-commit

# Symlink so git finds it:
ln -s ../../.claude/hooks/pre-commit .git/hooks/pre-commit
```

Test it:

```bash
git add .
git commit -m "chore: initial scaffold"
# Should see: ━━━ Poneglyph pre-commit checks ━━━
```

Override only in emergencies:

```bash
git commit --no-verify -m "..."
```

If you use `--no-verify`, document why in the active session log under a "Compromises" heading.

## Python tooling

Install ruff and mypy in the backend:

```bash
cd backend
uv add --dev ruff mypy
# Or with pip: pip install ruff mypy
```

Drop `pyproject.toml` at the backend root. The hook reads it.

## TypeScript tooling

Next.js ships with eslint configured. For `tsc --noEmit`, no setup needed — just ensure `tsconfig.json` has `"strict": true` (it does by default in Next.js 14).

## Claude Code skills to load

At the start of each relevant session, run these in Claude Code:

| Skill | When |
|---|---|
| `/claude-api migrate` | Session 001, right after Anthropic SDK is installed. Catches 4.7 breaking changes. |
| `/ultrareview` | After Sessions 003, 005, 006 complete. Deep review on the hero agents before commit. |

## Auto mode

Only safe for mechanical work. Enable for:
- Session 002 (memory primitives — boilerplate CRUD, low risk)
- Session 009 (evals — long, repetitive)

Supervise directly for Sessions 003, 005, 006 — those are your hero capabilities. No auto mode.

## If something breaks

Pre-commit hook blocking you on a legitimate commit? First, read the error — 90% of the time it's a real issue. If it's genuinely wrong, use `--no-verify`, then open an issue to fix the hook config.

Mypy yelling about a third-party library? Add to `[[tool.mypy.overrides]]` in pyproject.toml with a one-line comment explaining why that library lacks stubs.
