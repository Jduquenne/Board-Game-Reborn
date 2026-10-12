/*
 * Règles pures du mode tactique (docs/spec-tactical.md) — sans DOM, sans Store, sans EventBus.
 * Chaque action retourne { state, events } ; une action refusée retourne le même état et aucun événement.
 *
 * Lot 1 : plateau, PA / PM, déplacements, fin du tour.
 * Lot 2 : classes et sorts (portée, ligne de vue, effets), phase de placement, initiative.
 * Pas encore de caractéristiques, d'éléments, de coups critiques ni de tacle (lot 3).
 */
import { parseMap, reachableCells, cellsInRange, lineOfSight, areaCells, pushDirection, cellAt, isWalkable } from './TacticalGrid.js';
import { TacticalMapsRepository } from '../../Repository/TacticalMapsRepository.js';
import { TacticalClassesRepository } from '../../Repository/TacticalClassesRepository.js';

export const BASE_PA = 6;
export const BASE_PM = 3;
export const DEFAULT_MAP = 'plaine';
export const DEFAULT_CLASSES = ['iop', 'cra'];
export const PUNISHMENT_BONUS = 0.1; // Châtiment : +10 % de dégâts par coup reçu

const TEAM_SUFFIX = ['bleu', 'rouge'];

const roll = ({ min, max }, rng) => min + Math.floor(rng() * (max - min + 1));
const shuffle = (list, rng) => list.map(v => ({ v, k: rng() })).sort((a, b) => a.k - b.k).map(o => o.v);

export function createFighter(classData, team, cellId, name = classData.name) {
    return {
        classId: classData.id,
        name,
        image: classData.image,
        team,
        health: classData.health,
        maxHealth: classData.health,
        initiative: classData.initiative,
        pa: BASE_PA,
        pm: BASE_PM,
        maxPA: BASE_PA,
        maxPM: BASE_PM,
        cellId,
        spells: classData.spells,
        casts: {},        // lancers de ce tour, par sort
        cooldowns: {},    // tours restants avant de pouvoir relancer, par sort
        paNext: 0,        // PA en plus ou en moins au prochain tour (Flèche glacée, Mot stimulant)
        punishment: null, // Châtiment : { turns, stacks }
    };
}

/**
 * Nouveau combat, en phase de placement : chaque personnage sur une case de placement de sa couleur, au hasard.
 * @param {{ classes?: string[], mapId?: string }} options  classes des joueurs 1 et 2
 */
export function createTacticalGame({ classes = DEFAULT_CLASSES, mapId = DEFAULT_MAP } = {}, rng = Math.random) {
    const map = TacticalMapsRepository.find(mapId);
    if (!map) throw new Error(`Carte inconnue : ${mapId}`);
    const board = parseMap(map);

    const fighters = classes.map((classId, team) => {
        const classData = TacticalClassesRepository.find(classId);
        if (!classData) throw new Error(`Classe inconnue : ${classId}`);
        const name = classes[0] === classes[1] ? `${classData.name} ${TEAM_SUFFIX[team]}` : classData.name;
        const cells = board.cells.filter(c => c.placement === team);
        return createFighter(classData, team, cells[Math.floor(rng() * cells.length)].id, name);
    });

    return withOptions({
        phase: 'placement', // 'placement' | 'fighting' | 'over'
        board,
        fighters,
        activeIndex: 0,
        turn: 0,
        winnerIndex: null,
    });
}

// Placement : le personnage de l'équipe de la case (bleue ou rouge) s'y place, si elle est libre
export function applyPlace(state, cellId) {
    const cell = state.board.cells[cellId];
    if (state.phase !== 'placement' || !cell || cell.placement === null) return { state, events: [] };
    if (state.fighters.some(f => f.cellId === cellId)) return { state, events: [] };

    const fighterIndex = state.fighters.findIndex(f => f.team === cell.placement);
    const fighters = state.fighters.map((f, i) => i === fighterIndex ? { ...f, cellId } : f);
    return {
        state: withOptions({ ...state, fighters }),
        events: [{ name: 'tactical:placed', payload: { fighterIndex, cellId } }],
    };
}

// Fin du placement : la plus haute initiative commence (égalité : tirage au sort)
export function applyStart(state, rng = Math.random) {
    if (state.phase !== 'placement') return { state, events: [] };

    const best = Math.max(...state.fighters.map(f => f.initiative));
    const tied = state.fighters.map((f, i) => i).filter(i => state.fighters[i].initiative === best);
    const activeIndex = tied[Math.floor(rng() * tied.length)];
    const fighters = state.fighters.map((f, i) => i === activeIndex ? startTurn(f) : f);

    return {
        state: withOptions({ ...state, phase: 'fighting', fighters, activeIndex, turn: 1 }),
        events: [
            { name: 'tactical:initiative', payload: { activeIndex, initiatives: state.fighters.map(f => f.initiative) } },
            { name: 'tactical:turn', payload: { activeIndex, turn: 1 } },
        ],
    };
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

/**
 * Lance un sort du personnage actif sur une case. Refusé si la case n'est pas une cible valide
 * (portée, ligne de vue, type de cible) ou si le sort n'est pas disponible (PA, lancers par tour, relance).
 */
export function applyCast(state, spellId, cellId, rng = Math.random) {
    const options = state.spells[spellId];
    if (state.phase !== 'fighting' || !options?.valid.includes(cellId)) return { state, events: [] };

    const casterIndex = state.activeIndex;
    const caster = state.fighters[casterIndex];
    const spell = caster.spells.find(s => s.id === spellId);

    let fighters = state.fighters.map((f, i) => i !== casterIndex ? f : {
        ...f,
        pa: f.pa - spell.cost,
        casts: { ...f.casts, [spellId]: (f.casts[spellId] ?? 0) + 1 },
        cooldowns: spell.cooldown ? { ...f.cooldowns, [spellId]: spell.cooldown } : f.cooldowns,
    });

    const zone = new Set(areaCells(state.board, cellId, spell.area));
    const targets = fighters.map((f, i) => i).filter(i => zone.has(fighters[i].cellId));
    const results = [];

    for (const effect of spell.effects) {
        fighters = applyEffect(state.board, fighters, casterIndex, targets, cellId, effect, rng, results);
    }

    const events = [{ name: 'tactical:spell', payload: { casterIndex, spellId, spellName: spell.name, cellId, results } }];
    const dead = fighters.findIndex(f => f.health <= 0);
    if (dead < 0) return { state: withOptions({ ...state, fighters }), events };

    const winnerIndex = fighters.findIndex(f => f.health > 0);
    events.push({ name: 'tactical:over', payload: { winnerIndex, loserIndex: dead } });
    return { state: withOptions({ ...state, fighters, phase: 'over', winnerIndex }), events };
}

export function applyEndTurn(state) {
    if (state.phase !== 'fighting') return { state, events: [] };

    const activeIndex = (state.activeIndex + 1) % state.fighters.length;
    const fighters = state.fighters.map((f, i) => i === activeIndex ? startTurn(f) : f);

    return {
        state: withOptions({ ...state, fighters, activeIndex, turn: state.turn + 1 }),
        events: [{ name: 'tactical:turn', payload: { activeIndex, turn: state.turn + 1 } }],
    };
}

// Multiplicateur de dégâts du lanceur (Châtiment)
export const damageMultiplier = fighter => 1 + PUNISHMENT_BONUS * (fighter.punishment?.stacks ?? 0);

// ─── Privé ────────────────────────────────────────────────────────────────────

// Début du tour d'un personnage : PA (avec le bonus / malus reçu) et PM rechargés, relances et Châtiment décomptés
function startTurn(fighter) {
    const cooldowns = Object.fromEntries(Object.entries(fighter.cooldowns)
        .map(([id, n]) => [id, n - 1])
        .filter(([, n]) => n > 0));
    const turns = (fighter.punishment?.turns ?? 0) - 1;
    return {
        ...fighter,
        pa: Math.max(0, fighter.maxPA + fighter.paNext),
        pm: fighter.maxPM,
        paNext: 0,
        casts: {},
        cooldowns,
        punishment: turns > 0 ? { ...fighter.punishment, turns } : null,
    };
}

// Applique un effet de sort ; ajoute ce qui s'est passé à `results` (pour l'affichage)
function applyEffect(board, fighters, casterIndex, targets, cellId, effect, rng, results) {
    const update = (index, change) => fighters.map((f, i) => i === index ? { ...f, ...change(f) } : f);
    const caster = () => fighters[casterIndex];

    switch (effect.type) {
        case 'damage':
            for (const t of targets) {
                const damage = Math.round(roll(effect, rng) * damageMultiplier(caster()));
                fighters = update(t, f => ({
                    health: Math.max(0, f.health - damage),
                    punishment: f.punishment ? { ...f.punishment, stacks: f.punishment.stacks + 1 } : null,
                }));
                results.push({ fighterIndex: t, kind: 'damage', amount: damage });
            }
            return fighters;

        case 'heal':
            for (const t of targets) {
                const before = fighters[t].health;
                fighters = update(t, f => ({ health: Math.min(f.maxHealth, f.health + roll(effect, rng)) }));
                results.push({ fighterIndex: t, kind: 'heal', amount: fighters[t].health - before });
            }
            return fighters;

        case 'lifesteal': {
            const dealt = results.filter(r => r.kind === 'damage').reduce((sum, r) => sum + r.amount, 0);
            const before = caster().health;
            fighters = update(casterIndex, f => ({ health: Math.min(f.maxHealth, f.health + Math.floor(dealt * effect.ratio)) }));
            results.push({ fighterIndex: casterIndex, kind: 'heal', amount: fighters[casterIndex].health - before });
            return fighters;
        }

        case 'push':
        case 'pull':
            for (const t of targets.filter(i => i !== casterIndex)) {
                const from = board.cells[caster().cellId];
                const target = board.cells[fighters[t].cellId];
                const dir = effect.type === 'push' ? pushDirection(from, target) : pushDirection(target, from);
                const path = slide(board, fighters, target, dir, effect.cells);
                if (path.length) fighters = update(t, () => ({ cellId: path.at(-1) }));
                results.push({ fighterIndex: t, kind: effect.type, amount: path.length });
            }
            return fighters;

        case 'teleport':
            results.push({ fighterIndex: casterIndex, kind: 'teleport', amount: 0 });
            return update(casterIndex, () => ({ cellId }));

        case 'swap': {
            const t = targets.find(i => i !== casterIndex);
            const casterCell = caster().cellId;
            fighters = update(casterIndex, () => ({ cellId: fighters[t].cellId }));
            fighters = update(t, () => ({ cellId: casterCell }));
            results.push({ fighterIndex: t, kind: 'swap', amount: 0 });
            return fighters;
        }

        case 'pa':
            for (const t of targets) {
                fighters = update(t, f => ({ paNext: f.paNext + effect.amount }));
                results.push({ fighterIndex: t, kind: 'pa', amount: effect.amount });
            }
            return fighters;

        case 'punishment':
            results.push({ fighterIndex: casterIndex, kind: 'punishment', amount: effect.turns });
            return update(casterIndex, () => ({ punishment: { turns: effect.turns, stacks: 0 } }));

        default:
            throw new Error(`Effet de sort inconnu : ${effect.type}`);
    }
}

// Cases parcourues en glissant de `cells` pas dans la direction `dir`, jusqu'au premier obstacle ou personnage
function slide(board, fighters, start, dir, cells) {
    if (!dir) return [];
    const occupied = new Set(fighters.map(f => f.cellId));
    const path = [];
    let current = start;
    for (let i = 0; i < cells; i++) {
        const next = cellAt(board, current.x + dir.dx, current.y + dir.dy);
        if (!next || !isWalkable(next) || occupied.has(next.id)) break;
        path.push(next.id);
        current = next;
    }
    return path;
}

// Une case peut-elle être visée par ce sort (en plus de la portée et de la ligne de vue) ?
function isValidTarget(state, spell, caster, cellId) {
    const fighterHere = state.fighters.find(f => f.cellId === cellId);
    switch (spell.target) {
        case 'enemy': return !!fighterHere && fighterHere !== caster;
        case 'self':  return cellId === caster.cellId;
        case 'free':  return !fighterHere && isWalkable(state.board.cells[cellId]);
        case 'cell':  return true;
        default:      return false;
    }
}

// Recalcule ce que le personnage actif peut faire : cases atteignables (avec le chemin) et, pour chaque sort,
// les cases à portée avec / sans ligne de vue et les cibles valides
function withOptions(state) {
    if (state.phase !== 'fighting') return { ...state, reachable: {}, spells: {} };

    const caster = state.fighters[state.activeIndex];
    const occupied = new Set(state.fighters.map(f => f.cellId));
    const spells = {};

    for (const spell of caster.spells) {
        const inRange = spell.target === 'self'
            ? [caster.cellId]
            : cellsInRange(state.board, caster.cellId, spell.minRange, spell.maxRange, spell.inLine);
        const seen = id => !spell.los || lineOfSight(state.board, caster.cellId, id, occupied);
        const range = inRange.filter(seen);
        const cooldown = caster.cooldowns[spell.id] ?? 0;
        const available = caster.pa >= spell.cost && (caster.casts[spell.id] ?? 0) < spell.perTurn && cooldown === 0;
        spells[spell.id] = {
            range,
            blocked: inRange.filter(id => !seen(id)),
            valid: available ? range.filter(id => isValidTarget(state, spell, caster, id)) : [],
            available,
            cooldown,
        };
    }

    return {
        ...state,
        reachable: reachableCells(state.board, caster.cellId, caster.pm, occupied),
        spells,
    };
}
