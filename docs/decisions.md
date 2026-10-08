# Architecture decisions

Lightweight ADR log. New decisions are proposed by the agent, validated by the owner, then recorded here.

Format: `## D-xxx — Title` · Date · Status (accepted / proposed / superseded / rejected) · Context · Decision · Alternatives considered · Consequences.

## D-001 — Zero dependencies

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: BoardGame Reborn is an architectural rewrite of BoardGame (same game, same gameplay) aiming for a clean, scalable vanilla JS codebase.
- **Decision**: no third-party dependency — no jQuery, no bundler, no npm.
- **Alternatives considered**: not documented.
- **Consequences**: no `package.json`; no test runner or linter out of the box; everything (EventBus, Store, Router, Component) is hand-written in `src/core/`.

## D-002 — Native ES modules, no bundler

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: follows from D-001.
- **Decision**: `import` / `export` everywhere, loaded natively by the browser (`<script type="module">`).
- **Alternatives considered**: not documented.
- **Consequences**: a local HTTP server is mandatory ([development](development.md#run-locally)); imports use relative paths with the `.js` extension.

## D-003 — Layered architecture

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: separate game logic from rendering.
- **Decision**: `core/` (infrastructure), `Engine/` (pure logic, no DOM), `Models/` (factories), `Repository/` (static data), `Views/` (DOM, no business logic). See [architecture](architecture.md#layers-and-allowed-dependencies).
- **Alternatives considered**: not documented.
- **Consequences**: engine logic can be reasoned about without the DOM; views react to events and state.

## D-004 — Centralised immutable Store + EventBus

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: views and engines need shared state and notifications.
- **Decision**: a single `Store` whose state changes only through `setState(updater)` and emits `state:changed`; domain events go through a pub/sub `EventBus`.
- **Alternatives considered**: not documented.
- **Consequences**: engines clone data before updating; components subscribe with `listen()` and are cleaned up on `unmount()`.

## D-005 — Hash-based router

- **Date**: unknown, before migration
- **Status**: accepted
- **Context**: navigation between menu, options and game without a server.
- **Decision**: `Router` with `register` / `navigate` / `start`, using `location.hash` and `popstate`.
- **Alternatives considered**: not documented.
- **Consequences**: works with any static server; each navigation unmounts the current view.

## D-006 — AI driven by `turn:changed`

- **Date**: unknown, before migration (code added around 2026-04-12, commit "update: IA test")
- **Status**: proposed
- **Context**: the game offers single-player modes (`easy`, `normal`).
- **Decision**: `AIEngine` listens to `turn:changed`; if the active player has `isAI`, it waits 900 ms then calls `gameEngine.movePlayer`. Since 2026-10-08 it also listens to `fight:start` and `fight:round-end`; if the attacker has `isAI`, it waits 1500 ms (longer than the `BattleBanner` display delays) then calls `fightEngine.attack()` or `defend()`. The player at index 1 is always the AI when an AI mode is selected. `GameView` starts/stops the AI on mount/unmount.
- **Alternatives considered**: not documented.
- **Consequences**: the AI uses the same public engine API as a human player. `BattleBanner` hides the action buttons when the attacker is the AI. The fight delay is coupled to the banner delays.

## D-007 — BattleBanner may import FightEngine

- **Date**: 2026-10-08
- **Status**: accepted
- **Context**: the original rule allowed only `GameView` and `BoardView` to import from `Engine/`, but `BattleBanner` calls `fightEngine.attack()` / `defend()` from its buttons.
- **Decision**: the rule is widened: `GameView`, `BoardView` and `BattleBanner` may import from `Engine/`, only to dispatch user actions.
- **Alternatives considered**: keep the rule and route fight actions through `GameView` or the EventBus.
- **Consequences**: the documentation matches the code; no code change.
