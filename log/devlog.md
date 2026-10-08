# Devlog

Session journal, most recent first. Every session that changes something adds an entry.

Entry format:

```markdown
## YYYY-MM-DD — Short title

- **Done**: what was done.
- **Numbers**: optional (files touched, checks run…).
- **Problems**: what failed or surprised.
- **Still open**: what remains for the next session.
```

## 2026-10-08 — Migrate agent context to AGENTS.md, docs/ and devlog

- **Done**: split the former `CLAUDE.md` (28 information blocks) into `AGENTS.md`, `docs/` (architecture, development, conventions, ui-design, spec-gameplay, decisions, roadmap) and this devlog; added `ATTRIBUTION.md`; traceability map in `docs/archive/migration-map-2026-10-08.md`. Documentation aligned with the code (added `AIEngine`, `aiMode`, `isAI`, `Store.reset()`, completed "Add a …" checklists, widened the Engine-import rule to `BattleBanner` — D-007). No source code changed.
- **Numbers**: 28 blocks migrated (1 merged). `node --check` passes on 26/26 files; `python -m http.server` serves `index.html` and `src/app.js` (200).
- **Problems**: the agent is not allowed to modify its own configuration (`CLAUDE.md`, `.claude/`); the owner archived the original `CLAUDE.md`, installed the new one and `.claude/settings.json` by hand. `.gitignore` no longer ignores `CLAUDE.md` (owner decision). `MIGRATION_PROMPT.md` deleted at the end (owner decision).
- **Still open**:
  - Manual in-browser play-through not done.
  - `npx serve .` not verified.
  - TODO(owner) items: roadmap "Current focus" and "Ideas / later", UI known deviations, AI behaviour during fights, asset sources in `ATTRIBUTION.md`, test strategy.

## Before 2026-10-08 (migrated)

From git history only (no session notes existed):

- **2026-04-12** — `ca9e75f` "update: IA test": AI opponent (`AIEngine`, `aiMode` option, `isAI` flag).
- **2026-03-09** — `eddd594` "refactor global": architectural rewrite of BoardGame into the layered vanilla JS architecture.
