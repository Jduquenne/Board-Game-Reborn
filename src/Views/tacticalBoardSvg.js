import { AssetManager } from '../AssetManager.js';

/*
 * Rendu SVG du plateau tactique isométrique (docs/spec-tactical.md §10) — fonctions qui retournent du texte SVG.
 * Le viewBox met le plateau entier à l'échelle de la place disponible (pas de scroll).
 * Couches : sol (cliquable, data-cell) → surbrillances → objets (blocs et personnages, du fond vers l'avant).
 */

const CW = 86;           // largeur d'un losange
const CH = 43;           // hauteur d'un losange
const RAISE = 16;        // hauteur des blocs
const TOP = 54;          // marge au-dessus de la première rangée (personnages qui dépassent)
const SPRITE = 100;      // taille du portrait d'un personnage

const TERRAIN_CLASS = { floor: 'tFloor', void: 'tVoid', block: 'tFloor' };

const center = cell => ({ cx: CW / 2 + cell.col * CW / 2, cy: TOP + CH / 2 + cell.row * CH / 2 });

// Losange centré en (cx, cy), éventuellement surélevé de `lift`
function diamond(cx, cy, lift = 0) {
    const y = cy - lift;
    return `${cx},${y - CH / 2} ${cx + CW / 2},${y} ${cx},${y + CH / 2} ${cx - CW / 2},${y}`;
}

export function viewBox(board) {
    return `0 0 ${board.width * CW} ${TOP + board.height * CH}`;
}

// Fond de la carte puis sol : un losange par case, alternance de deux teintes comme sur un damier
export function floorSvg(board) {
    const background = `<rect class="tBackground" width="${board.width * CW}" height="${TOP + board.height * CH}" rx="8"/>`;
    return background + board.cells.map(cell => {
        const { cx, cy } = center(cell);
        const shade = cell.terrain === 'void' ? '' : ((cell.x + cell.y) % 2 ? ' alt' : '');
        return `<polygon class="${TERRAIN_CLASS[cell.terrain]}${shade}" data-cell="${cell.id}" points="${diamond(cx, cy)}"/>`;
    }).join('');
}

/**
 * Surbrillances : cases de placement, portée du sort choisi (avec ou sans ligne de vue, zone sous le pointeur),
 * ou cases atteignables et chemin sous le pointeur.
 * @param {object} tactical  état du combat (store.state.tactical)
 * @param {{ spellId: string | null, hoverId: number | null }} ui  spellId null = déplacement
 */
export function overlaySvg(tactical, { spellId, hoverId }) {
    const { board } = tactical;
    const shape = (id, cls) => {
        const { cx, cy } = center(board.cells[id]);
        return `<polygon class="${cls}" points="${diamond(cx, cy)}"/>`;
    };

    if (tactical.phase === 'placement') {
        return board.cells.filter(c => c.placement !== null)
            .map(c => shape(c.id, c.placement === 0 ? 'tPlaceA' : 'tPlaceB')).join('');
    }
    if (tactical.phase !== 'fighting') return '';

    if (spellId) {
        const options = tactical.spells[spellId];
        const spell = tactical.fighters[tactical.activeIndex].spells.find(s => s.id === spellId);
        const base = options.range.map(id => shape(id, 'tRange')).join('')
            + options.blocked.map(id => shape(id, 'tBlocked')).join('');
        if (!options.valid.includes(hoverId)) return base;
        // Zone touchée : cases de sol à au plus `area` pas de la case visée (affichage seulement, les règles décident)
        const target = board.cells[hoverId];
        const zone = board.cells.filter(c => c.terrain === 'floor'
            && Math.abs(c.x - target.x) + Math.abs(c.y - target.y) <= spell.area);
        return base + zone.map(c => shape(c.id, 'tTarget')).join('');
    }

    const reachable = Object.keys(tactical.reachable).map(Number);
    const path = new Set(tactical.reachable[hoverId] ?? []);
    return reachable.map(id => shape(id, path.has(id) ? 'tPath' : 'tReach')).join('');
}

// Blocs et personnages, dessinés de la rangée du fond vers l'avant pour que les plus proches recouvrent les autres
export function objectsSvg(tactical) {
    const { board, fighters, activeIndex } = tactical;
    const items = [
        ...board.cells.filter(c => c.terrain === 'block').map(cell => ({ cell, svg: blockSvg(cell) })),
        ...fighters.map((f, i) => {
            const cell = board.cells[f.cellId];
            return { cell, svg: fighterSvg(f, cell, i === activeIndex && tactical.phase === 'fighting') };
        }),
    ];
    return items
        .sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
        .map(i => i.svg)
        .join('');
}

function blockSvg(cell) {
    const { cx, cy } = center(cell);
    const top = cy - RAISE;
    const left = `${cx - CW / 2},${top} ${cx},${top + CH / 2} ${cx},${cy + CH / 2} ${cx - CW / 2},${cy}`;
    const right = `${cx + CW / 2},${top} ${cx},${top + CH / 2} ${cx},${cy + CH / 2} ${cx + CW / 2},${cy}`;
    return `<g class="tBlock">
        <polygon class="tBlockLeft" points="${left}"/>
        <polygon class="tBlockRight" points="${right}"/>
        <polygon class="tBlockTop" points="${diamond(cx, cy, RAISE)}"/>
    </g>`;
}

function fighterSvg(fighter, cell, isActive) {
    const { cx, cy } = center(cell);
    const team = fighter.team === 0 ? 'tTeamA' : 'tTeamB';
    return `<g class="tFighter" data-cell="${cell.id}">
        <title>${fighter.name} — ${fighter.health} / ${fighter.maxHealth} PV</title>
        <ellipse class="tTeamRing ${team}${isActive ? ' tActive' : ''}" cx="${cx}" cy="${cy}" rx="${CW * 0.36}" ry="${CH * 0.36}"/>
        <image href="${AssetManager.player(fighter)}" x="${cx - SPRITE / 2}" y="${cy + CH * 0.2 - SPRITE}"
               width="${SPRITE}" height="${SPRITE}" preserveAspectRatio="xMidYMax meet"/>
    </g>`;
}
