/*
 * Classes et sorts du mode tactique (docs/spec-tactical.md §8 et §13) — inspirés de Dofus Rétro, valeurs à régler.
 *
 * Classe :
 *   health, initiative
 *   stats             { strength, intelligence, chance, agility } (Force, Intelligence, Chance, Agilité) — lot 3 :
 *                     chaque point donne +1 % de dégâts dans son élément ; l'Intelligence augmente aussi les soins ;
 *                     l'Agilité augmente aussi les coups critiques et l'esquive (tacle)
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
 *   critRate          1 chance sur critRate de coup critique (réduit par l'Agilité), 0 = jamais
 *   effects           appliqués dans l'ordre :
 *     { type: 'damage', min, max, element, crit }   element : 'neutral' (Force), 'earth' (Force), 'fire' (Intelligence),
 *                                                   'water' (Chance), 'air' (Agilité) ; crit : dégâts en plus sur un critique
 *     { type: 'heal', min, max, crit }              (Intelligence)
 *     { type: 'lifesteal', ratio }                  (soigne le lanceur d'une part des dégâts infligés)
 *     { type: 'push', cells }    { type: 'pull', cells }    { type: 'teleport' }    { type: 'swap' }
 *     { type: 'pa', amount }                        (PA de la cible à son prochain tour)
 *     { type: 'punishment', turns }                 (Châtiment : chaque coup reçu donne +10 % de dégâts pendant `turns` tours)
 */

const PUNCH = {
    id: 'punch', name: 'Coup de poing', cost: 3, minRange: 1, maxRange: 1, los: true, inLine: false,
    rangeModifiable: false, target: 'enemy', area: 0, perTurn: 2, cooldown: 0, critRate: 50,
    effects: [{ type: 'damage', min: 6, max: 9, element: 'neutral', crit: 3 }],
};

const spell = (data) => ({ los: true, inLine: false, rangeModifiable: false, area: 0, perTurn: 2, cooldown: 0, critRate: 0, ...data });

const CLASS_DATA = [
    {
        id: 'iop', name: 'Iop', role: 'mêlée', image: 'Lancelot.png', health: 165, initiative: 100,
        stats: { strength: 40, intelligence: 0, chance: 0, agility: 10 },
        spells: [
            spell({ id: 'pression', name: 'Pression', cost: 3, minRange: 1, maxRange: 1, target: 'enemy', critRate: 40,
                effects: [{ type: 'damage', min: 13, max: 17, element: 'earth', crit: 5 }] }),
            spell({ id: 'bond', name: 'Bond', cost: 4, minRange: 2, maxRange: 5, los: false, target: 'free', perTurn: 1, cooldown: 2,
                effects: [{ type: 'teleport' }] }),
            spell({ id: 'intimidation', name: 'Intimidation', cost: 2, minRange: 1, maxRange: 1, target: 'enemy', perTurn: 1, critRate: 50,
                effects: [{ type: 'damage', min: 4, max: 6, element: 'neutral', crit: 2 }, { type: 'push', cells: 3 }] }),
            spell({ id: 'colere', name: 'Colère de Iop', cost: 6, minRange: 1, maxRange: 1, target: 'enemy', perTurn: 1, cooldown: 3, critRate: 40,
                effects: [{ type: 'damage', min: 34, max: 42, element: 'earth', crit: 10 }] }),
        ],
    },
    {
        id: 'cra', name: 'Crâ', role: 'distance', image: 'Prirodny.png', health: 135, initiative: 110,
        stats: { strength: 0, intelligence: 15, chance: 15, agility: 40 },
        spells: [
            spell({ id: 'fleche-magique', name: 'Flèche magique', cost: 3, minRange: 2, maxRange: 8, rangeModifiable: true, target: 'enemy', critRate: 40,
                effects: [{ type: 'damage', min: 8, max: 11, element: 'air', crit: 4 }] }),
            spell({ id: 'fleche-recul', name: 'Flèche de recul', cost: 3, minRange: 1, maxRange: 6, inLine: true, rangeModifiable: true, target: 'enemy', perTurn: 1, critRate: 50,
                effects: [{ type: 'damage', min: 5, max: 7, element: 'air', crit: 3 }, { type: 'push', cells: 3 }] }),
            spell({ id: 'fleche-glacee', name: 'Flèche glacée', cost: 3, minRange: 2, maxRange: 6, rangeModifiable: true, target: 'enemy', perTurn: 1, critRate: 50,
                effects: [{ type: 'damage', min: 4, max: 6, element: 'water', crit: 2 }, { type: 'pa', amount: -2 }] }),
            spell({ id: 'fleche-explosive', name: 'Flèche explosive', cost: 4, minRange: 3, maxRange: 7, rangeModifiable: true, target: 'cell', area: 1, perTurn: 1, critRate: 50,
                effects: [{ type: 'damage', min: 9, max: 12, element: 'fire', crit: 4 }] }),
        ],
    },
    {
        id: 'eniripsa', name: 'Eniripsa', role: 'soin', image: 'Khadgar.png', health: 140, initiative: 105,
        stats: { strength: 0, intelligence: 40, chance: 0, agility: 20 },
        spells: [
            spell({ id: 'mot-interdit', name: 'Mot interdit', cost: 3, minRange: 1, maxRange: 6, rangeModifiable: true, target: 'enemy', critRate: 40,
                effects: [{ type: 'damage', min: 8, max: 11, element: 'fire', crit: 4 }] }),
            spell({ id: 'mot-soignant', name: 'Mot soignant', cost: 3, minRange: 0, maxRange: 0, target: 'self', perTurn: 1, critRate: 40,
                effects: [{ type: 'heal', min: 14, max: 18, crit: 6 }] }),
            spell({ id: 'mot-frayeur', name: 'Mot de frayeur', cost: 2, minRange: 1, maxRange: 3, inLine: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'push', cells: 3 }] }),
            spell({ id: 'mot-stimulant', name: 'Mot stimulant', cost: 2, minRange: 0, maxRange: 0, target: 'self', perTurn: 1, cooldown: 3,
                effects: [{ type: 'pa', amount: 2 }] }),
        ],
    },
    {
        id: 'sacrieur', name: 'Sacrieur', role: 'semi-mêlée', image: 'Thork.png', health: 180, initiative: 90,
        stats: { strength: 30, intelligence: 0, chance: 0, agility: 25 },
        spells: [
            spell({ id: 'attirance', name: 'Attirance', cost: 3, minRange: 2, maxRange: 6, inLine: true, target: 'enemy', perTurn: 1,
                effects: [{ type: 'pull', cells: 5 }] }),
            spell({ id: 'transposition', name: 'Transposition', cost: 2, minRange: 1, maxRange: 5, los: false, target: 'enemy', perTurn: 1, cooldown: 2,
                effects: [{ type: 'swap' }] }),
            spell({ id: 'absorption', name: 'Absorption', cost: 4, minRange: 1, maxRange: 2, target: 'enemy', critRate: 40,
                effects: [{ type: 'damage', min: 11, max: 14, element: 'earth', crit: 5 }, { type: 'lifesteal', ratio: 0.5 }] }),
            spell({ id: 'chatiment', name: 'Châtiment', cost: 2, minRange: 0, maxRange: 0, target: 'self', perTurn: 1, cooldown: 4,
                effects: [{ type: 'punishment', turns: 3 }] }),
        ],
    },
];

const copySpell = s => ({ ...s, effects: s.effects.map(e => ({ ...e })) });

export class TacticalClassesRepository {

    // Chaque classe reçoit aussi le Coup de poing (attaque de base au corps à corps)
    static findAll() {
        return CLASS_DATA.map(c => ({ ...c, stats: { ...c.stats }, spells: [...c.spells, PUNCH].map(copySpell) }));
    }

    static find(id) {
        return TacticalClassesRepository.findAll().find(c => c.id === id) ?? null;
    }
}
