/*
 * Agents du mode tactique (docs/spec-tactical.md §9, lot 4) — sans DOM, utilisables dans le jeu, l'arène et Node.
 *
 * Un agent joue une action à la fois :
 *   choosePlacement(state, index, rng) → id de la case de placement
 *   chooseAction(state, index, rng)    → { type: 'move', cellId } | { type: 'cast', spellId, cellId } | { type: 'end' }
 * Il ne voit que l'état du combat (aucune information cachée dans ce mode).
 */
import {
    applyPlace, applyStart, applyMove, applyCast, applyEndTurn,
    statMultiplier, damageMultiplier, ELEMENT_STAT,
} from '../../Engine/Tactical/TacticalRules.js';
import { distance } from '../../Engine/Tactical/TacticalGrid.js';

export const END = Object.freeze({ type: 'end' });

// Applique une action d'agent aux règles pures
export function applyAction(state, action, rng = Math.random) {
    switch (action.type) {
        case 'place': return applyPlace(state, action.cellId);
        case 'ready': return applyStart(state, rng);
        case 'move':  return applyMove(state, action.cellId, rng);
        case 'cast':  return applyCast(state, action.spellId, action.cellId, rng);
        case 'end':   return applyEndTurn(state);
        default:      throw new Error(`Action inconnue : ${action.type}`);
    }
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const freePlacements = (state, index) => state.board.cells
    .filter(c => c.placement === state.fighters[index].team && !state.fighters.some(f => f.cellId === c.id))
    .map(c => c.id);

// ─── Aléatoire : référence la plus faible ─────────────────────────────────────

export const randomAgent = {
    name: 'random',

    choosePlacement(state, index, rng) {
        return pick(freePlacements(state, index), rng) ?? state.fighters[index].cellId;
    },

    chooseAction(state, index, rng) {
        const options = [
            ...Object.keys(state.reachable).map(id => ({ type: 'move', cellId: Number(id) })),
            ...Object.entries(state.spells).flatMap(([spellId, o]) => o.valid.map(cellId => ({ type: 'cast', spellId, cellId }))),
        ];
        if (!options.length || rng() < 0.15) return END;
        return pick(options, rng);
    },
};

// ─── Normal : règles écrites à la main ────────────────────────────────────────
/*
 * À chaque décision :
 *   1. Pour chaque position possible (rester, marcher vers une case atteignable, Bond), calcule le meilleur
 *      « plan » de sorts lançables depuis cette position avec les PA restants (dégâts attendus + soins utiles),
 *      plus un score de placement (distance préférée de la classe à l'ennemi). Le risque de tacle diminue la valeur.
 *   2. Si la meilleure position n'est pas la case actuelle : y aller. Sinon, lancer le premier sort du plan.
 *   3. Plus de sort utile : sort d'appoint (Châtiment, Mot stimulant, Attirance…) avec les PA restants.
 *   4. Puis se replacer avec les PM restants (s'éloigner pour un Crâ, se rapprocher pour un Iop), et finir le tour.
 */

// Distance préférée à l'ennemi en fin de tour, par classe
const PREFERRED_DISTANCE = { iop: 1, sacrieur: 1, cra: 6, eniripsa: 4 };
const POSITION_WEIGHT = 2;  // valeur d'une case d'écart à la distance préférée, en points de dégâts
const HEAL_WEIGHT = 0.8;    // valeur d'un PV soigné par rapport à un PV infligé
const PA_VALUE = 5;         // valeur d'un PA retiré à l'ennemi pour son prochain tour, en points de dégâts
const NO_ROLL = () => 0.5;  // tirages médians pour les simulations (pas de critique)
const ALWAYS_DODGE = () => 0;

const average = e => (e.min + e.max) / 2;

// Valeur attendue d'un lancer : dégâts à l'ennemi + soins utiles au lanceur
function spellValue(spell, caster, enemy) {
    let damage = 0;
    let heal = 0;
    for (const e of spell.effects) {
        if (e.type === 'damage') damage += average(e) * statMultiplier(caster, ELEMENT_STAT[e.element]) * damageMultiplier(caster);
        if (e.type === 'heal') heal += average(e) * statMultiplier(caster, 'intelligence');
        if (e.type === 'lifesteal') heal += damage * e.ratio;
        if (e.type === 'pa' && e.amount < 0) damage += -e.amount * PA_VALUE; // PA retirés à l'ennemi
    }
    const missing = caster.maxHealth - caster.health;
    return Math.min(damage, enemy.health + 20) + HEAL_WEIGHT * Math.min(heal, missing);
}

const pushes = spell => spell.effects.some(e => e.type === 'push');

/**
 * Meilleure combinaison de sorts lançables depuis la position actuelle (sac à dos sur les PA).
 * Sorts qui repoussent en dernier : l'ennemi s'éloigne, les sorts suivants ne l'atteindraient plus.
 * @returns {{ value: number, spells: object[] }}
 */
function bestPlan(state, index) {
    const caster = state.fighters[index];
    const enemy = state.fighters[1 - index];
    const candidates = caster.spells
        .map(spell => {
            const options = state.spells[spell.id];
            const target = spell.target === 'self' ? caster.cellId : enemy.cellId;
            if (!options?.valid.includes(target)) return null;
            const value = spellValue(spell, caster, enemy);
            if (value <= 0) return null;
            const left = spell.perTurn - (caster.casts[spell.id] ?? 0);
            return { spell, value, max: Math.min(left, Math.floor(caster.pa / spell.cost)) };
        })
        .filter(Boolean);

    let best = { value: 0, spells: [] };
    const search = (i, pa, value, chosen) => {
        if (value > best.value) best = { value, spells: [...chosen] };
        if (i >= candidates.length) return;
        const { spell, value: v, max } = candidates[i];
        for (let n = 0; n <= max && n * spell.cost <= pa; n++) {
            search(i + 1, pa - n * spell.cost, value + n * v, [...chosen, ...Array(n).fill(spell)]);
        }
    };
    search(0, caster.pa, 0, []);
    best.spells.sort((a, b) => pushes(a) - pushes(b));
    return best;
}

function positionScore(state, index, cellId) {
    const me = state.fighters[index];
    const enemy = state.fighters[1 - index];
    const d = distance(state.board.cells[cellId], state.board.cells[enemy.cellId]);
    return -POSITION_WEIGHT * Math.abs(d - (PREFERRED_DISTANCE[me.classId] ?? 1));
}

// Positions possibles : rester, marcher, Bond ; valeur = plan + placement, pondérée par le risque de tacle
function bestPosition(state, index) {
    const evaluate = (s) => bestPlan(s, index).value + positionScore(s, index, s.fighters[index].cellId);
    const stay = evaluate(state);
    let best = { action: null, value: stay };

    for (const id of Object.keys(state.reachable).map(Number)) {
        const after = applyMove(state, id, ALWAYS_DODGE).state;
        const rolls = state.tackle?.rolls[id] ?? 0;
        const p = rolls ? state.tackle.chance ** rolls : 1;
        const value = p * evaluate(after) + (1 - p) * stay;
        if (value > best.value + 1e-9) best = { action: { type: 'move', cellId: id }, value };
    }

    for (const id of state.spells.bond?.valid ?? []) {
        const after = applyCast(state, 'bond', id, NO_ROLL).state;
        const value = evaluate(after);
        if (value > best.value + 1e-9) best = { action: { type: 'cast', spellId: 'bond', cellId: id }, value };
    }
    return best.action;
}

// Sorts d'appoint avec les PA qui restent quand plus aucun sort de dégâts ou de soin n'est utile
function utilityAction(state, index) {
    const me = state.fighters[index];
    const enemy = state.fighters[1 - index];
    const d = distance(state.board.cells[me.cellId], state.board.cells[enemy.cellId]);
    const can = (spellId, cellId) => state.spells[spellId]?.valid.includes(cellId);
    const ranged = (PREFERRED_DISTANCE[me.classId] ?? 1) > 1;

    if (can('chatiment', me.cellId) && d <= 6) return { type: 'cast', spellId: 'chatiment', cellId: me.cellId };
    if (can('mot-frayeur', enemy.cellId) && ranged && d <= 2) return { type: 'cast', spellId: 'mot-frayeur', cellId: enemy.cellId };
    if (can('attirance', enemy.cellId) && !ranged && d >= 2) return { type: 'cast', spellId: 'attirance', cellId: enemy.cellId };
    if (can('mot-stimulant', me.cellId)) return { type: 'cast', spellId: 'mot-stimulant', cellId: me.cellId };
    return null;
}

// Se replacer avec les PM restants : meilleure case pour la distance préférée, risque de tacle compris
function repositionAction(state, index) {
    const me = state.fighters[index];
    const current = positionScore(state, index, me.cellId);
    let best = { cellId: null, value: current };
    for (const id of Object.keys(state.reachable).map(Number)) {
        const rolls = state.tackle?.rolls[id] ?? 0;
        const p = rolls ? state.tackle.chance ** rolls : 1;
        const value = p * positionScore(state, index, id) + (1 - p) * current;
        if (value > best.value + 0.5) best = { cellId: id, value };
    }
    return best.cellId === null ? null : { type: 'move', cellId: best.cellId };
}

export const normalAgent = {
    name: 'normal',

    // Case de placement la plus proche de la distance préférée à l'ennemi
    choosePlacement(state, index) {
        const cells = freePlacements(state, index);
        if (!cells.length) return state.fighters[index].cellId;
        return cells.reduce((a, b) => positionScore(state, index, b) > positionScore(state, index, a) ? b : a);
    },

    chooseAction(state, index) {
        const move = bestPosition(state, index);
        if (move) return move;

        const enemy = state.fighters[1 - index];
        const me = state.fighters[index];
        const [first] = bestPlan(state, index).spells;
        if (first) return { type: 'cast', spellId: first.id, cellId: first.target === 'self' ? me.cellId : enemy.cellId };

        return utilityAction(state, index) ?? repositionAction(state, index) ?? END;
    },
};

export const TACTICAL_AGENTS = Object.freeze({ random: randomAgent, normal: normalAgent });
