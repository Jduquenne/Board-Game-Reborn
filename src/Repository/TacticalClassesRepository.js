/*
 * Classes et sorts du mode tactique (docs/spec-tactical.md §8, lot 2) — inspirés de Dofus Rétro, valeurs à régler.
 * Pas encore de caractéristiques ni d'éléments (lot 3) : les dégâts sont un jet entre min et max.
 *
 * Sort :
 *   cost              PA dépensés
 *   minRange/maxRange portée (0 = sur soi)
 *   los               ligne de vue nécessaire
 *   inLine            lancer en ligne uniquement (même x ou même y sur la grille carrée)
 *   rangeModifiable   portée modifiable par la future stat Portée (pas d'effet pour l'instant)
 *   target            'enemy' (case de l'adversaire), 'self', 'free' (case de sol libre), 'cell' (n'importe quelle case de sol)
 *   area              rayon de la zone autour de la case visée (0 = la case seule)
 *   perTurn           lancers maximum par tour
 *   cooldown          tours du lanceur à attendre avant de le relancer (0 = aucun)
 *   effects           appliqués dans l'ordre :
 *     { type: 'damage', min, max }     { type: 'heal', min, max }       { type: 'lifesteal', ratio }  (soigne le lanceur)
 *     { type: 'push', cells }          { type: 'pull', cells }          { type: 'teleport' }    { type: 'swap' }
 *     { type: 'pa', amount }           (PA de la cible à son prochain tour)
 *     { type: 'punishment', turns }    (Châtiment : chaque coup reçu donne +10 % de dégâts pendant `turns` tours)
 */

const PUNCH = {
    id: 'punch', name: 'Coup de poing', cost: 3, minRange: 1, maxRange: 1, los: true, inLine: false,
    rangeModifiable: false, target: 'enemy', area: 0, perTurn: 2, cooldown: 0,
    effects: [{ type: 'damage', min: 6, max: 9 }],
};

const spell = (data) => ({ los: true, inLine: false, rangeModifiable: false, area: 0, perTurn: 2, cooldown: 0, ...data });

const CLASS_DATA = [
    {
        id: 'iop', name: 'Iop', role: 'mêlée', image: 'Lancelot.png', health: 110, initiative: 100,
        spells: [
            spell({ id: 'pression', name: 'Pression', cost: 3, minRange: 1, maxRange: 1, target: 'enemy',
                effects: [{ type: 'damage', min: 13, max: 17 }] }),
            spell({ id: 'bond', name: 'Bond', cost: 4, minRange: 2, maxRange: 5, los: false, target: 'free', perTurn: 1, cooldown: 2,
                effects: [{ type: 'teleport' }] }),
            spell({ id: 'intimidation', name: 'Intimidation', cost: 2, minRange: 1, maxRange: 1, target: 'enemy', perTurn: 1,
                effects: [{ type: 'damage', min: 4, max: 6 }, { type: 'push', cells: 3 }] }),
            spell({ id: 'colere', name: 'Colère de Iop', cost: 6, minRange: 1, maxRange: 1, target: 'enemy', perTurn: 1, cooldown: 3,
                effects: [{ type: 'damage', min: 34, max: 42 }] }),
        ],
    },
    {
        id: 'cra', name: 'Crâ', role: 'distance', image: 'Prirodny.png', health: 90, initiative: 110,
        spells: [
            spell({ id: 'fleche-magique', name: 'Flèche magique', cost: 3, minRange: 2, maxRange: 8, rangeModifiable: true, target: 'enemy',
                effects: [{ type: 'damage', min: 8, max: 11 }] }),
            spell({ id: 'fleche-recul', name: 'Flèche de recul', cost: 3, minRange: 1, maxRange: 6, inLine: true, rangeModifiable: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'damage', min: 5, max: 7 }, { type: 'push', cells: 3 }] }),
            spell({ id: 'fleche-glacee', name: 'Flèche glacée', cost: 3, minRange: 2, maxRange: 6, rangeModifiable: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'damage', min: 4, max: 6 }, { type: 'pa', amount: -2 }] }),
            spell({ id: 'fleche-explosive', name: 'Flèche explosive', cost: 4, minRange: 3, maxRange: 7, rangeModifiable: true, target: 'cell', area: 1, perTurn: 1,
                effects: [{ type: 'damage', min: 9, max: 12 }] }),
        ],
    },
    {
        id: 'eniripsa', name: 'Eniripsa', role: 'soin', image: 'Khadgar.png', health: 95, initiative: 105,
        spells: [
            spell({ id: 'mot-interdit', name: 'Mot interdit', cost: 3, minRange: 1, maxRange: 6, rangeModifiable: true, target: 'enemy',
                effects: [{ type: 'damage', min: 8, max: 11 }] }),
            spell({ id: 'mot-soignant', name: 'Mot soignant', cost: 3, minRange: 0, maxRange: 0, target: 'self', perTurn: 1,
                effects: [{ type: 'heal', min: 14, max: 18 }] }),
            spell({ id: 'mot-frayeur', name: 'Mot de frayeur', cost: 2, minRange: 1, maxRange: 3, inLine: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'push', cells: 3 }] }),
            spell({ id: 'mot-stimulant', name: 'Mot stimulant', cost: 2, minRange: 0, maxRange: 0, target: 'self', perTurn: 1, cooldown: 3,
                effects: [{ type: 'pa', amount: 2 }] }),
        ],
    },
    {
        id: 'sacrieur', name: 'Sacrieur', role: 'semi-mêlée', image: 'Thork.png', health: 120, initiative: 90,
        spells: [
            spell({ id: 'attirance', name: 'Attirance', cost: 3, minRange: 2, maxRange: 6, inLine: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'pull', cells: 5 }] }),
            spell({ id: 'transposition', name: 'Transposition', cost: 2, minRange: 1, maxRange: 5, los: false, target: 'enemy', perTurn: 1, cooldown: 2,
                effects: [{ type: 'swap' }] }),
            spell({ id: 'absorption', name: 'Absorption', cost: 4, minRange: 1, maxRange: 2, target: 'enemy',
                effects: [{ type: 'damage', min: 11, max: 14 }, { type: 'lifesteal', ratio: 0.5 }] }),
            spell({ id: 'chatiment', name: 'Châtiment', cost: 2, minRange: 0, maxRange: 0, target: 'self', perTurn: 1, cooldown: 4,
                effects: [{ type: 'punishment', turns: 3 }] }),
        ],
    },
];

const copySpell = s => ({ ...s, effects: s.effects.map(e => ({ ...e })) });

export class TacticalClassesRepository {

    // Chaque classe reçoit aussi le Coup de poing (attaque de base au corps à corps)
    static findAll() {
        return CLASS_DATA.map(c => ({ ...c, spells: [...c.spells, PUNCH].map(copySpell) }));
    }

    static find(id) {
        return TacticalClassesRepository.findAll().find(c => c.id === id) ?? null;
    }
}
