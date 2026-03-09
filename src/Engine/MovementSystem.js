import { DECOR } from '../Models/Cell.js';

/**
 * Retourne les cellules accessibles depuis une position donnée.
 * Fonction pure — aucun effet de bord.
 *
 * @param {{ row: number, col: number }} position
 * @param {number} maxMove
 * @param {Object[][]} cells
 * @param {{ rows: number, cols: number }} config
 * @returns {Object[]}
 */
export function getMovableCells(position, maxMove, cells, config) {
    const { rows, cols } = config;
    const result = [];
    const directions = [
        { dr: 0,  dc: 1  }, // droite
        { dr: 0,  dc: -1 }, // gauche
        { dr: -1, dc: 0  }, // haut
        { dr: 1,  dc: 0  }, // bas
    ];

    for (const { dr, dc } of directions) {
        for (let i = 1; i <= maxMove; i++) {
            const row = position.row + dr * i;
            const col = position.col + dc * i;

            if (row < 0 || col < 0 || row >= rows || col >= cols) break;

            const cell = cells[row][col];
            if (cell.decor === DECOR.OBSTACLE || cell.player) break;

            result.push(cell);
        }
    }

    return result;
}

/**
 * Retourne les positions adjacentes (haut, bas, gauche, droite) valides.
 * Fonction pure — aucun effet de bord.
 *
 * @param {{ row: number, col: number }} position
 * @param {{ rows: number, cols: number }} config
 * @returns {{ row: number, col: number }[]}
 */
export function getAdjacentPositions(position, config) {
    const { rows, cols } = config;
    return [
        { dr: 0,  dc: 1  },
        { dr: 0,  dc: -1 },
        { dr: -1, dc: 0  },
        { dr: 1,  dc: 0  },
    ]
        .map(({ dr, dc }) => ({ row: position.row + dr, col: position.col + dc }))
        .filter(({ row, col }) => row >= 0 && col >= 0 && row < rows && col < cols);
}
