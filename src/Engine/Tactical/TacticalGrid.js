/*
 * Géométrie du plateau tactique (docs/spec-tactical.md §3) — fonctions pures, aucun DOM.
 *
 * Une carte Dofus est une grille carrée tournée de 45°. Chaque case a :
 *   - sa position à l'écran : `row` (demi-rangée 0–32) et `col` (colonne en demi-cases 0–28, row + col pair) ;
 *   - ses coordonnées carrées `x`, `y` : les 4 voisines d'une case sont (x ± 1, y) et (x, y ± 1),
 *     c'est-à-dire ses 4 voisines en diagonale à l'écran. Les distances sont des distances de Manhattan.
 * L'identifiant `id` suit l'ordre de lecture (comme les numéros de cellule de Dofus) : board.cells[id].
 */

export const TERRAIN = Object.freeze({
    FLOOR: 'floor', // sol
    VOID:  'void',  // bord ou trou : bloque le passage, pas la ligne de vue
    BLOCK: 'block', // bloc : bloque le passage et la ligne de vue
});

const LEGEND = {
    '.': { terrain: TERRAIN.FLOOR, placement: null },
    'a': { terrain: TERRAIN.FLOOR, placement: 0 },
    'b': { terrain: TERRAIN.FLOOR, placement: 1 },
    '#': { terrain: TERRAIN.VOID,  placement: null },
    'X': { terrain: TERRAIN.BLOCK, placement: null },
};

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const key = (x, y) => `${x},${y}`;

/**
 * Construit le plateau à partir d'une carte de TacticalMapsRepository.
 * @returns {{ id, name, width, height, cells: object[], index: Object<string, number> }}
 *          width = cases par rangée paire (15), height = rangées pleines (17), index : "x,y" → id
 */
export function parseMap(map) {
    const rows = map.rows.map(r => r.trim());
    const width = rows[0].length;
    if (rows.length % 2 !== 1) throw new Error(`Carte ${map.id} : nombre de demi-rangées pair`);

    const cells = [];
    const index = {};
    rows.forEach((line, row) => {
        const expected = row % 2 ? width - 1 : width;
        if (line.length !== expected) {
            throw new Error(`Carte ${map.id}, demi-rangée ${row} : ${line.length} cases au lieu de ${expected}`);
        }
        [...line].forEach((char, k) => {
            const legend = LEGEND[char];
            if (!legend) throw new Error(`Carte ${map.id} : caractère inconnu « ${char} »`);
            const col = 2 * k + (row % 2);
            const x = (col + row) / 2;
            const y = (row - col) / 2 + width - 1;
            const id = cells.length;
            cells.push({ id, row, col, x, y, ...legend });
            index[key(x, y)] = id;
        });
    });

    return { id: map.id, name: map.name, width, height: (rows.length + 1) / 2, cells, index };
}

export const isWalkable = cell => cell.terrain === TERRAIN.FLOOR;

export function cellAt(board, x, y) {
    const id = board.index[key(x, y)];
    return id === undefined ? null : board.cells[id];
}

// Les 4 voisines existantes d'une case (quel que soit leur terrain)
export function neighbours(board, cell) {
    return DIRECTIONS.map(([dx, dy]) => cellAt(board, cell.x + dx, cell.y + dy)).filter(Boolean);
}

export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Cases atteignables en au plus `pm` pas, par le plus court chemin sur des cases de sol libres.
 * @param {Set<number>} occupied  ids des cases occupées (personnages)
 * @returns {Object<number, number[]>} id de la case → chemin (ids des cases traversées, départ exclu, arrivée incluse)
 */
export function reachableCells(board, fromId, pm, occupied) {
    const paths = {};
    const seen = new Set([fromId]);
    let frontier = [{ id: fromId, path: [] }];

    for (let step = 1; step <= pm && frontier.length; step++) {
        const next = [];
        for (const { id, path } of frontier) {
            for (const n of neighbours(board, board.cells[id])) {
                if (seen.has(n.id) || !isWalkable(n) || occupied.has(n.id)) continue;
                seen.add(n.id);
                const p = [...path, n.id];
                paths[n.id] = p;
                next.push({ id: n.id, path: p });
            }
        }
        frontier = next;
    }
    return paths;
}

// Cases de sol à une distance comprise entre min et max (portée d'une attaque ; ligne de vue : lot 2)
export function cellsInRange(board, fromId, min, max) {
    const from = board.cells[fromId];
    return board.cells
        .filter(c => isWalkable(c) && distance(from, c) >= min && distance(from, c) <= max)
        .map(c => c.id);
}
