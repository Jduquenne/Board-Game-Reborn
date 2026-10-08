# Conventions

## Language

- **Vanilla JavaScript ES2022**: private class fields (`#`), `Object.freeze` (see `DECOR`).
  > Note (migration): the previous `CLAUDE.md` listed `structuredClone` in the stack, but it is not used anywhere in the code; cloning is done with object spread (`{ ...cell }`).
- **Native ES modules**: `import` / `export` everywhere, relative paths with the `.js` extension ([D-002](decisions.md#d-002--native-es-modules-no-bundler)).
- **Zero dependencies** ([D-001](decisions.md#d-001--zero-dependencies)).
- Identifiers in English; code comments and UI text in French (the game is for French-speaking players).

## Naming and file organisation

- One class or one family of factories per file, file named after it (`GameEngine.js`, `Cell.js`).
- Folders: `core/`, `Engine/`, `Models/`, `Repository/`, `Views/` (capitalised except `core/`).
- Engines are classes exported as singletons in camelCase (`export const gameEngine = new GameEngine()`).
- Models export `createXxx` factory functions.
- Repositories export a class with `static findAll()` and a module-level `XXX_DATA` array.
- Views are classes extending `Component`, named `XxxView`, `XxxBanner`, `XxxSidebar`.
- Private helpers use `#private` methods, grouped after a `// ─── Private ───` separator.
- A View that listens on `document` or `window` stores the handler in a private field and removes it in `onUnmount()` (`Component.unmount()` only cleans EventBus subscriptions).

## Layer rules

1. **Engine** never uses `document`, `window`, `querySelector` or any DOM API.
2. **Views** never contain business logic. Only `GameView`, `BoardView` and `BattleBanner` may import from `Engine/`, and only to dispatch user actions ([D-007](decisions.md#d-007--battlebanner-may-import-fightengine)).
3. **Models** are pure factory functions, never methods.
4. **Repositories**: `findAll()` always returns new instances (no shared references).
5. **Store**: the only way to modify state is `store.setState(updater)`.
6. Engines compute new state immutably (clone cells / players, then `setState`).

Verification:

```bash
grep -rnE "document|window" src/Engine src/Models src/Repository   # must print nothing
grep -rln "Engine/" src/Views                                       # only GameView, BoardView, BattleBanner
```

## Error handling

Only one explicit error today: `GameEngine.#randomEmptyCell` throws when no empty cell is left. Engines otherwise guard with early `return` (e.g. wrong `phase`, non-movable cell). TODO(owner): no further error-handling policy documented.

## Testing

Approach: [D-008](decisions.md#d-008--tests-with-nodes-built-in-test-runner). Command: [`development.md`](development.md#tests).

- One file per engine: `tests/<Module>.test.mjs` (`.mjs` so Node loads them as ES modules without a `package.json`).
- Only `node:test` and `node:assert/strict` — no library.
- Test names in English, describing the rule (`'defense halves the damage (rounded down) and is consumed'`).
- Build the state by hand with `tests/helpers.mjs` (`setBoard`, `setFight`, `markMovable`, `recordEvents`) instead of relying on `startGame`'s randomness.
- Control time with `mock.timers.enable({ apis: ['setTimeout'] })` + `mock.timers.tick(ms)`, and randomness with `mock.method(Math, 'random', () => x)`; reset both in `afterEach` (`mock.timers.reset()`, `mock.restoreAll()`).
- Unsubscribe every EventBus listener and call `aiEngine.stop()` in `afterEach` (engines and Store are singletons shared by the tests of a file; each file runs in its own process).
- Every change to a game rule in `src/Engine/` comes with a test, and the matching rule in [`spec-gameplay.md`](spec-gameplay.md) is updated.

## Commit messages

- The agent **never runs git commands that modify the repository**; the owner commits.
- At the end of each feature, fix or refactor, the agent proposes a message in **Conventional Commits** format: `<type>(<optional scope>): <summary>`, types `feat`, `fix`, `refactor`, `docs`, `style`, `chore`.
- Example: `feat(ai): add hard difficulty`.

## Checklists

### Add a character

1. Add an entry to `PLAYER_DATA` in `src/Repository/PlayersRepository.js` (`name`, `health`, `image`, `maxMove`).
2. Add the image to `assets/dungeon/characters/` with the exact `image` filename.

### Add a weapon

1. Add an entry to `WEAPON_DATA` in `src/Repository/WeaponsRepository.js` (`name`, `damage`, `image`).
2. Add the image to `assets/dungeon/weapons/`.

### Add a bonus

1. Add an entry to `BONUS_DATA` in `src/Repository/BonusRepository.js` (`type`: `'move'` or `'life'`, `amount`, `image`).
2. If the image is new, add it to `assets/dungeon/bonus/`.
3. A new `type` also requires handling in `GameEngine.movePlayer` (bonus pickup).

### Add a view / page

1. Create `src/Views/MyView.js` extending `Component`.
2. Register it in `src/app.js` with `router.register('my-route', () => new MyView('#app'))`.
3. Respect the viewport rules in [`ui-design.md`](ui-design.md).

### Add a configuration option

1. Add an entry to the `OPTIONS` array in `src/Views/OptionsView.js` (`key`, `label`, `min`, `max`, `default`) — rendering is automatic.
2. Add the same key with its default value to `config` in `createInitialState()` (`src/core/Store.js`); otherwise the key is missing from the game config until the player clicks +/-.
3. Use the key in `GameEngine` (and document it in [`architecture.md`](architecture.md#state-shape)).

### Add a cell type

1. Add the value to `DECOR` in `src/Models/Cell.js`.
2. Handle it in `src/Engine/GameEngine.js` (placement, effects).
3. Handle it in `src/Engine/MovementSystem.js` if it blocks or alters movement.
4. Render it in `src/Views/BoardView.js` (`#cellTemplate`) and add its image path to `src/AssetManager.js`.

### Add an event or state key

1. Emit / set it from the right layer (Engine or Store).
2. Update the tables in [`architecture.md`](architecture.md#events) in the same task.
