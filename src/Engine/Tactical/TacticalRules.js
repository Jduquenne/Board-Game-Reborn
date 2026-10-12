/*
 * Règles pures du mode tactique (docs/spec-tactical.md, lot 1) — sans DOM, sans Store, sans EventBus.
 * Chaque action retourne { state, events } ; une action refusée retourne le même état et aucun événement.
 *
 * Lot 1 : plateau, déplacements à volonté dans la limite des PM, attaque de test « Coup de poing », fin du tour.
 * Pas encore de classes, de sorts, de ligne de vue ni de phase de placement (lot 2).
 */
import { parseMap, reachableCells, cellsInRange } from './TacticalGrid.js';
import { TacticalMapsRepository } from '../../Repository/TacticalMapsRepository.js';
import { PlayersRepository } from '../../Repository/PlayersRepository.js';

export const BASE_PA = 6;
export const BASE_PM = 3;
export const DEFAULT_MAP = 'plaine';

// Attaque de test du lot 1 (sera remplacée par les sorts de classe au lot 2)
export const PUNCH = Object.freeze({ name: 'Coup de poing', cost: 3, minRange: 1, maxRange: 1, minDamage: 8, maxDamage: 12 });

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

export function createFighter(character, team, cellId) {
    return {
        name: character.name,
        image: character.image,
        team,
        health: character.health,
        maxHealth: character.health,
        pa: BASE_PA,
        pm: BASE_PM,
        maxPA: BASE_PA,
        maxPM: BASE_PM,
        cellId,
    };
}

/**
 * Nouveau combat : deux personnages tirés au hasard, chacun sur une de ses cases de placement.
 * @param {{ mapId?: string }} options
 */
export function createTacticalGame({ mapId = DEFAULT_MAP } = {}, rng = Math.random) {
    const map = TacticalMapsRepository.find(mapId);
    if (!map) throw new Error(`Carte inconnue : ${mapId}`);
    const board = parseMap(map);

    const characters = PlayersRepository.findAll();
    const first = characters.splice(Math.floor(rng() * characters.length), 1)[0];
    const second = pick(characters, rng);

    const fighters = [first, second].map((character, team) => {
        const cells = board.cells.filter(c => c.placement === team);
        return createFighter(character, team, pick(cells, rng).id);
    });

    return withOptions({
        phase: 'fighting', // 'fighting' | 'over'
        board,
        fighters,
        activeIndex: 0,
        turn: 1,
        winnerIndex: null,
    });
}

export function applyMove(state, cellId) {
    const path = state.reachable[cellId];
    if (state.phase !== 'fighting' || !path) return { state, events: [] };

    const fighterIndex = state.activeIndex;
    const fighters = state.fighters.map((f, i) => i === fighterIndex
        ? { ...f, cellId, pm: f.pm - path.length }
        : f);

    return {
        state: withOptions({ ...state, fighters }),
        events: [{ name: 'tactical:moved', payload: { fighterIndex, path } }],
    };
}

export function applyPunch(state, cellId, rng = Math.random) {
    const attackerIndex = state.activeIndex;
    const attacker = state.fighters[attackerIndex];
    const targetIndex = state.fighters.findIndex(f => f.cellId === cellId);
    if (state.phase !== 'fighting' || !state.targets.includes(cellId) || targetIndex < 0) return { state, events: [] };

    const damage = PUNCH.minDamage + Math.floor(rng() * (PUNCH.maxDamage - PUNCH.minDamage + 1));
    const target = state.fighters[targetIndex];
    const health = Math.max(0, target.health - damage);

    const fighters = state.fighters.map((f, i) => {
        if (i === attackerIndex) return { ...f, pa: attacker.pa - PUNCH.cost };
        if (i === targetIndex) return { ...f, health };
        return f;
    });

    const events = [{ name: 'tactical:attack', payload: { attackerIndex, targetIndex, action: PUNCH.name, damage } }];
    if (health > 0) return { state: withOptions({ ...state, fighters }), events };

    events.push({ name: 'tactical:over', payload: { winnerIndex: attackerIndex, loserIndex: targetIndex } });
    return { state: withOptions({ ...state, fighters, phase: 'over', winnerIndex: attackerIndex }), events };
}

export function applyEndTurn(state) {
    if (state.phase !== 'fighting') return { state, events: [] };

    const activeIndex = (state.activeIndex + 1) % state.fighters.length;
    const fighters = state.fighters.map((f, i) => i === activeIndex ? { ...f, pa: f.maxPA, pm: f.maxPM } : f);

    return {
        state: withOptions({ ...state, fighters, activeIndex, turn: state.turn + 1 }),
        events: [{ name: 'tactical:turn', payload: { activeIndex, turn: state.turn + 1 } }],
    };
}

// ─── Privé ────────────────────────────────────────────────────────────────────

// Recalcule ce que le personnage actif peut faire : cases atteignables (avec le chemin) et cases visables
function withOptions(state) {
    if (state.phase !== 'fighting') return { ...state, reachable: {}, targets: [] };

    const active = state.fighters[state.activeIndex];
    const occupied = new Set(state.fighters.map(f => f.cellId));
    return {
        ...state,
        reachable: reachableCells(state.board, active.cellId, active.pm, occupied),
        targets: active.pa >= PUNCH.cost ? cellsInRange(state.board, active.cellId, PUNCH.minRange, PUNCH.maxRange) : [],
    };
}
