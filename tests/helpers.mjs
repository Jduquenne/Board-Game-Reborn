// Outils partagés par les tests — construisent un état de jeu contrôlé (sans hasard)
import { store } from '../src/core/Store.js';
import { eventBus } from '../src/core/EventBus.js';
import { createCell, DECOR } from '../src/Models/Cell.js';
import { createPlayer } from '../src/Models/Player.js';
import { createWeapon } from '../src/Models/Weapon.js';
import { getMovableCells, getAdjacentPositions } from '../src/Engine/MovementSystem.js';

export { DECOR, createWeapon };

export function makePlayer(overrides = {}) {
    return { ...createPlayer('Joueur', 100, 'joueur.png', 3), ...overrides };
}

export function makeGrid(rows, cols) {
    return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => createCell(r, c))
    );
}

/**
 * Remplace l'état du Store par un plateau construit à la main.
 * players : [{ row, col, ...champs du joueur }]
 * setup(cells) : place obstacles, armes, bonus, pièges avant le calcul des cases accessibles.
 */
export function setBoard({ rows = 5, cols = 5, players, aiMode = 'none', activePlayerIndex = 0, setup } = {}) {
    const cells = makeGrid(rows, cols);
    const infos = players.map(({ row, col, ...overrides }) => {
        const player = makePlayer(overrides);
        cells[row][col].player = player;
        return { player, position: { row, col } };
    });

    setup?.(cells);

    store.reset();
    store.setState(state => ({
        phase: 'playing',
        config: { ...state.config, rows, cols, aiMode },
        cells,
        players: infos,
        activePlayerIndex,
        fight: null,
    }));

    markMovable();
}

// Recalcule isMovable / isSecurityZone comme le fait GameEngine en début de tour
export function markMovable() {
    const { cells, players, activePlayerIndex, config } = store.state;
    const active  = players[activePlayerIndex];
    const waiting = players[(activePlayerIndex + 1) % players.length];

    const newCells = cells.map(row => row.map(cell => ({ ...cell, isMovable: false, isSecurityZone: false })));

    for (const cell of getMovableCells(active.position, active.player.maxMove, newCells, config)) {
        newCells[cell.row][cell.col].isMovable = true;
    }
    for (const pos of getAdjacentPositions(waiting.position, config)) {
        const cell = newCells[pos.row][pos.col];
        if (cell.decor === DECOR.FLOOR && !cell.player) cell.isSecurityZone = true;
    }

    store.setState(() => ({ cells: newCells }));
}

// Passe l'état en phase de combat
export function setFight(attackerIndex, targetIndex) {
    store.setState(() => ({ phase: 'fighting', fight: { attackerIndex, targetIndex } }));
}

// Enregistre les événements émis ; appeler stop() en fin de test
export function recordEvents(names) {
    const log = [];
    const unsubs = names.map(name => eventBus.on(name, payload => log.push({ name, payload })));
    return {
        log,
        names: () => log.map(e => e.name),
        stop:  () => unsubs.forEach(unsub => unsub()),
    };
}
