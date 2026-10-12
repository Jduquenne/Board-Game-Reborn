/*
 * Règles pures du mode tactique (docs/spec-tactical.md) — sans DOM, sans Store, sans EventBus.
 * Chaque action retourne { state, events } ; une action refusée retourne le même état et aucun événement.
 *
 * Lot 1 : plateau, PA / PM, déplacements, fin du tour.
 * Lot 2 : classes et sorts (portée, ligne de vue, effets), phase de placement, initiative.
 * Lot 3 : caractéristiques et éléments, coups critiques, tacle (esquive), dégâts de poussée, mort subite.
 */
import { parseMap, reachableCells, cellsInRange, lineOfSight, areaCells, pushDirection, cellAt, isWalkable, distance } from './TacticalGrid.js';
import { TacticalMapsRepository } from '../../Repository/TacticalMapsRepository.js';
import { TacticalClassesRepository } from '../../Repository/TacticalClassesRepository.js';

export const BASE_PA = 6;
export const BASE_PM = 3;
export const DEFAULT_MAP = 'plaine';
export const DEFAULT_CLASSES = ['iop', 'cra'];
export const PUNISHMENT_BONUS = 0.1;   // Châtiment : +10 % de dégâts par coup reçu
export const PUSH_DAMAGE = 6;          // dégâts par case de poussée bloquée par un obstacle ou un personnage
export const SUDDEN_DEATH_TURN = 30;   // mort subite à partir de ce tour (15 tours chacun)
export const SUDDEN_DEATH_DAMAGE = 10; // dégâts au début du tour, +5 tous les 10 tours

// Caractéristique qui augmente les dégâts de chaque élément (comme dans Dofus : le neutre suit la Force)
export const ELEMENT_STAT = Object.freeze({
    neutral: 'strength',
    earth: 'strength',
    fire: 'intelligence',
    water: 'chance',
    air: 'agility',
});

const TEAM_SUFFIX = ['bleu', 'rouge'];

const roll = ({ min, max }, rng) => min + Math.floor(rng() * (max - min + 1));

// Multiplicateur d'une caractéristique : +1 % par point
export const statMultiplier = (fighter, stat) => 1 + (fighter.stats[stat] ?? 0) / 100;

/**
 * Coup critique : 1 chance sur N, N réduit par l'Agilité (N × 50 / (50 + Agilité), au moins 2).
 * @returns {number} N effectif, 0 si le sort n'a pas de critique
 */
export function criticalRate(spell, fighter) {
    if (!spell.critRate) return 0;
    return Math.max(2, Math.round(spell.critRate * 50 / (50 + fighter.stats.agility)));
}

// Tacle : chance d'esquiver en quittant le contact d'un ennemi = (Agi + 25) / (Agi + Agi ennemi + 50)
export function dodgeChance(mover, enemy) {
    return (mover.stats.agility + 25) / (mover.stats.agility + enemy.stats.agility + 50);
}

// Dégâts de la mort subite au tour `turn` (0 avant SUDDEN_DEATH_TURN)
export function suddenDeathDamage(turn) {
    if (turn < SUDDEN_DEATH_TURN) return 0;
    return SUDDEN_DEATH_DAMAGE + 5 * Math.floor((turn - SUDDEN_DEATH_TURN) / 10);
}

export function createFighter(classData, team, cellId, name = classData.name) {
    return {
        classId: classData.id,
        name,
        image: classData.image,
        team,
        health: classData.health,
        maxHealth: classData.health,
        initiative: classData.initiative,
        stats: { ...classData.stats },
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

/**
 * Déplacement par le plus court chemin. Chaque fois que le personnage quitte une case au contact d'un ennemi,
 * il doit esquiver le tacle (dodgeChance) ; s'il échoue, il s'arrête sur cette case et perd tous ses PM restants.
 */
export function applyMove(state, cellId, rng = Math.random) {
    const path = state.reachable[cellId];
    if (state.phase !== 'fighting' || !path) return { state, events: [] };

    const fighterIndex = state.activeIndex;
    const mover = state.fighters[fighterIndex];
    const enemy = state.fighters.find((f, i) => i !== fighterIndex);
    const chance = dodgeChance(mover, enemy);
    const events = [];
    const cells = [mover.cellId, ...path];
    let steps = path.length;
    let tackled = false;

    for (let i = 0; i < path.length; i++) {
        if (!isNextTo(state.board, cells[i], enemy.cellId)) continue;
        if (rng() < chance) {
            events.push({ name: 'tactical:dodged', payload: { fighterIndex, chance } });
        } else {
            events.push({ name: 'tactical:tackled', payload: { fighterIndex, chance } });
            steps = i;
            tackled = true;
            break;
        }
    }

    const walked = path.slice(0, steps);
    const fighters = state.fighters.map((f, i) => i === fighterIndex
        ? { ...f, cellId: cells[steps], pm: tackled ? 0 : f.pm - steps }
        : f);
    if (walked.length) events.unshift({ name: 'tactical:moved', payload: { fighterIndex, path: walked } });
    return { state: withOptions({ ...state, fighters }), events };
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
    const rate = criticalRate(spell, caster);
    const critical = rate > 0 && rng() < 1 / rate;
    const results = [];

    for (const effect of spell.effects) {
        fighters = applyEffect(state.board, fighters, casterIndex, targets, cellId, effect, { rng, critical }, results);
    }

    const events = [{ name: 'tactical:spell', payload: { casterIndex, spellId, spellName: spell.name, cellId, critical, results } }];
    return endIfDead({ ...state, fighters }, events);
}

// Fin du tour ; à partir du tour SUDDEN_DEATH_TURN, le joueur suivant perd des PV au début de son tour (mort subite)
export function applyEndTurn(state) {
    if (state.phase !== 'fighting') return { state, events: [] };

    const activeIndex = (state.activeIndex + 1) % state.fighters.length;
    const turn = state.turn + 1;
    const damage = suddenDeathDamage(turn);
    const fighters = state.fighters.map((f, i) => i !== activeIndex ? f : {
        ...startTurn(f),
        health: Math.max(0, f.health - damage),
    });

    const events = [{ name: 'tactical:turn', payload: { activeIndex, turn } }];
    if (damage) events.unshift({ name: 'tactical:sudden-death', payload: { fighterIndex: activeIndex, damage, turn } });
    return endIfDead({ ...state, fighters, activeIndex, turn }, events);
}

// Multiplicateur de dégâts du lanceur (Châtiment)
export const damageMultiplier = fighter => 1 + PUNISHMENT_BONUS * (fighter.punishment?.stacks ?? 0);

// ─── Privé ────────────────────────────────────────────────────────────────────

const isNextTo = (board, aId, bId) => distance(board.cells[aId], board.cells[bId]) === 1;

// Termine le combat si un personnage est à 0 PV (l'autre gagne), sinon recalcule les options
function endIfDead(state, events) {
    const dead = state.fighters.findIndex(f => f.health <= 0);
    if (dead < 0) return { state: withOptions(state), events };

    const winnerIndex = state.fighters.findIndex(f => f.health > 0);
    return {
        state: withOptions({ ...state, phase: 'over', winnerIndex }),
        events: [...events.filter(e => e.name !== 'tactical:turn'), { name: 'tactical:over', payload: { winnerIndex, loserIndex: dead } }],
    };
}

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

/**
 * Applique un effet de sort ; ajoute ce qui s'est passé à `results` (pour l'affichage).
 * Dégâts = (jet + bonus critique) × (1 + caractéristique de l'élément / 100) × Châtiment du lanceur, arrondis.
 * Soins = (jet + bonus critique) × (1 + Intelligence / 100), sans dépasser les PV de départ.
 */
function applyEffect(board, fighters, casterIndex, targets, cellId, effect, { rng, critical }, results) {
    const update = (index, change) => fighters.map((f, i) => i === index ? { ...f, ...change(f) } : f);
    const caster = () => fighters[casterIndex];
    // Coup reçu : PV perdus, et une charge de Châtiment si la cible en a un
    const hurt = (index, damage) => update(index, f => ({
        health: Math.max(0, f.health - damage),
        punishment: f.punishment ? { ...f.punishment, stacks: f.punishment.stacks + 1 } : null,
    }));
    const base = () => roll(effect, rng) + (critical ? effect.crit ?? 0 : 0);

    switch (effect.type) {
        case 'damage':
            for (const t of targets) {
                const stat = statMultiplier(caster(), ELEMENT_STAT[effect.element]);
                const damage = Math.round(base() * stat * damageMultiplier(caster()));
                fighters = hurt(t, damage);
                results.push({ fighterIndex: t, kind: 'damage', amount: damage, element: effect.element });
            }
            return fighters;

        case 'heal':
            for (const t of targets) {
                const before = fighters[t].health;
                const heal = Math.round(base() * statMultiplier(caster(), 'intelligence'));
                fighters = update(t, f => ({ health: Math.min(f.maxHealth, f.health + heal) }));
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
                // Poussée bloquée par un obstacle ou un personnage : dégâts pour chaque case non parcourue
                const damage = effect.type === 'push' ? (effect.cells - path.length) * PUSH_DAMAGE : 0;
                if (damage) fighters = hurt(t, damage);
                results.push({ fighterIndex: t, kind: effect.type, amount: path.length, damage });
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
    if (state.phase !== 'fighting') return { ...state, reachable: {}, tackle: null, spells: {} };

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

    // Tacle : pour chaque case atteignable, nombre de fois où le chemin quitte le contact de l'ennemi
    const enemy = state.fighters.find(f => f !== caster);
    const reachable = reachableCells(state.board, caster.cellId, caster.pm, occupied);
    const rolls = {};
    for (const [id, path] of Object.entries(reachable)) {
        const n = [caster.cellId, ...path.slice(0, -1)].filter(c => isNextTo(state.board, c, enemy.cellId)).length;
        if (n) rolls[id] = n;
    }

    return {
        ...state,
        reachable,
        tackle: { chance: dodgeChance(caster, enemy), rolls },
        spells,
    };
}
