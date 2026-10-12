/*
 * Cartes du mode tactique (docs/spec-tactical.md §3), au format d'une carte Dofus Rétro :
 * 15 cases de large, 17 rangées en quinconce = 33 demi-rangées (15 cases sur les paires, 14 sur les impaires,
 * décalées d'une demi-case vers la droite : l'espace en tête de ligne n'est là que pour la lecture).
 *
 *   '.' sol    '#' vide (bord ou trou : bloque le passage, pas la ligne de vue)
 *   'X' bloc (bloque le passage et la ligne de vue)
 *   'a' case de placement du joueur 1 (bleue)    'b' case de placement du joueur 2 (rouge)
 */
const MAP_DATA = [
    {
        id: 'plaine',
        name: 'Plaine',
        // Relevée sur assets/image.png (2026-10-12)
        rows: [
            '###############',
            ' ..............',
            '#.............#',
            ' ..............',
            '#.a.a.........#',
            ' .aaaa.........',
            '#.a.a.........#',
            ' ..............',
            '#..X..........#',
            ' ..............',
            '#.#...........#',
            ' ..............',
            '#.............#',
            ' ..............',
            '#.............#',
            ' ......#.......',
            '#.............#',
            ' .......X......',
            '#.....X.......#',
            ' ..............',
            '#.............#',
            ' ..............',
            '#.............#',
            ' .........#....',
            '#.........b..##',
            ' .........bbX..',
            '#.........b...#',
            ' .............X',
            '#.........b...#',
            ' X......#.bb...',
            '#.........b..##',
            ' ..............',
            '###############',
        ],
    },
];

export class TacticalMapsRepository {

    static findAll() {
        return MAP_DATA.map(m => ({ ...m, rows: [...m.rows] }));
    }

    static find(id) {
        return TacticalMapsRepository.findAll().find(m => m.id === id) ?? null;
    }
}
