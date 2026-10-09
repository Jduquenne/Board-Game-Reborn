import { GameEnv, DEFAULT_CONFIG } from './GameEnv.js';
import { chooseAction } from './Arena.js';
import { refreshMarkings, skipIfBlocked, firstPlayerIndex } from '../Engine/Rules.js';
import { createPlayer } from '../Models/Player.js';
import { createRng } from '../core/Random.js';

/*
 * Analyse d'équilibrage des personnages : chaque personnage affronte chacun des autres sur
 * plusieurs parties, avec la MÊME IA des deux côtés → seule la différence de personnage compte.
 * Les places sont alternées (le premier joueur a un avantage). Le reste du plateau est tiré au hasard.
 *
 * Utilisée par training/balance.mjs (terminal) et par le Labo d'équilibrage (Web Worker).
 * Les stats analysées sont celles qu'on lui donne : on peut tester des stats modifiées sans
 * toucher au jeu.
 */

/**
 * Analyse pas à pas (générateur) : rend la progression après chaque paire de personnages,
 * puis retourne le résultat complet.
 *
 * @param {object} options
 * @param {{ name, health, maxMove, image, strength? }[]} options.characters  personnages à comparer (stats libres)
 * @param {object} options.agent           IA utilisée des deux côtés
 * @param {number} [options.gamesPerPair=100]
 * @param {number} [options.seed=1]
 * @returns {Generator<{ pairsDone, pairsTotal }, BalanceResult>}
 */
export function* balanceSteps({ characters, agent, gamesPerPair = 100, seed = 1, config = DEFAULT_CONFIG, maxTurns = 300 }) {
    const rng = createRng(seed);
    const n = characters.length;
    const wins = Array.from({ length: n }, () => new Array(n).fill(0)); // wins[i][j] = victoires de i contre j
    let draws = 0, firstPlayerWins = 0, decided = 0;

    const pairsTotal = (n * (n - 1)) / 2;
    let pairsDone = 0;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            for (let g = 0; g < gamesPerPair; g++) {
                const iFirst = g % 2 === 0;
                const pair   = iFirst ? [characters[i], characters[j]] : [characters[j], characters[i]];
                const { winner, first } = playMatch(pair, agent, { rng, config, maxTurns });

                if (winner === null) { draws++; continue; }
                decided++;
                if (winner === first) firstPlayerWins++;
                if ((winner === 0) === iFirst) wins[i][j]++;
                else wins[j][i]++;
            }
            pairsDone++;
            yield { pairsDone, pairsTotal };
        }
    }

    const games  = pairsTotal * gamesPerPair;
    const matrix = wins.map((row, i) => row.map((w, j) => (i === j ? null : w / gamesPerPair)));

    return {
        games,
        gamesPerPair,
        drawRate: games ? draws / games : 0,
        firstPlayerRate: decided ? firstPlayerWins / decided : 0,
        matrix,
        characters: characters.map((c, i) => {
            const rates = matrix[i].filter(r => r !== null);
            const vs = matrix[i]
                .map((rate, j) => ({ name: characters[j].name, rate }))
                .filter(v => v.rate !== null)
                .sort((a, b) => b.rate - a.rate);
            return {
                name: c.name, characterClass: c.characterClass ?? null, health: c.health, maxMove: c.maxMove,
                strength: c.strength ?? 0, agility: c.agility ?? 0, luck: c.luck ?? 0,
                winRate: rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length),
                best: vs[0] ?? null,
                worst: vs.at(-1) ?? null,
            };
        }),
    };
}

/** Analyse complète d'un coup (sans progression). */
export function runBalance(options) {
    const steps = balanceSteps(options);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
}

/**
 * Une partie où les deux personnages sont imposés. Le premier joueur est choisi par l'initiative.
 * @returns {{ winner: 0 | 1 | null, first: 0 | 1 }} gagnant (null = match nul) et joueur qui a commencé
 */
export function playMatch([charA, charB], agent, { rng, config = DEFAULT_CONFIG, maxTurns = 300 }) {
    const env = new GameEnv({ config, rng, maxTurns });
    env.reset();

    const chosen  = [charA, charB].map(c => createPlayer(c.name, c.health, c.image, c.maxMove, c)); // + stats de combat
    const cells   = env.state.cells.map(row => row.map(cell => ({ ...cell })));
    const players = env.state.players.map((info, i) => {
        cells[info.position.row][info.position.col].player = chosen[i];
        return { ...info, player: chosen[i] };
    });
    // Les PM ont changé : on recalcule les cases accessibles, puis on gère un premier joueur bloqué
    const first = firstPlayerIndex(players, rng);
    env.state = skipIfBlocked(refreshMarkings({ ...env.state, cells, players, activePlayerIndex: first })).state;

    while (!env.done) env.step(chooseAction(agent, env.state, rng));
    return { winner: env.winnerIndex, first };
}
