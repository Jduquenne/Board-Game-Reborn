// Auto-équilibrage : ajuste les PV de chaque personnage pour approcher 50 % de victoires partout,
// en gardant ses autres stats (PM, Force…) — donc son identité.
//
// Principe (une « passe ») : on mesure l'équilibre (src/AI/Balance.js), puis chaque personnage gagne
// des PV s'il est sous 50 %, en perd s'il est au-dessus, proportionnellement à l'écart :
//     PV ← PV × (1 + vitesse × (0,5 − taux de victoire))
// On recommence jusqu'à ce que l'écart maximal soit sous la tolérance. Les PV restent des entiers.
// La vitesse diminue à chaque passe (× 0,7) pour se stabiliser, et on garde la MEILLEURE passe :
// tant que les combats sont déterministes, l'équilibre fonctionne par paliers (1 PV peut ajouter
// un coup à encaisser), donc le réglage oscille au lieu de converger exactement.
//
// Usage :   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON training/auto-balance.mjs
//               [--games 400] [--passes 10] [--tolerance 0.02] [--speed 0.8] [--agent normal|champion] [--seed 1]
// Sortie :  progression par passe, résultat vérifié sur d'autres cartes (autre graine),
//           et les lignes PLAYER_DATA proposées (rien n'est modifié dans le jeu).

import { runBalance } from '../src/AI/Balance.js';
import { SCRIPTED_AGENTS } from '../src/AI/ScriptedAgents.js';
import { createWeightedMoveAgent } from '../src/AI/MoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS } from '../src/AI/DefaultModels.js';
import { PlayersRepository } from '../src/Repository/PlayersRepository.js';

const args = process.argv.slice(2);
const raw  = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };

const GAMES     = Number(raw('games', 400));
const PASSES    = Number(raw('passes', 10));
const TOLERANCE = Number(raw('tolerance', 0.02));
const SPEED     = Number(raw('speed', 0.8));
const SEED      = Number(raw('seed', 1));
const AGENT     = raw('agent', 'normal') === 'champion'
    ? createWeightedMoveAgent(CHAMPION_MOVE_WEIGHTS, { name: 'champion' })
    : SCRIPTED_AGENTS.normal;

const pct = x => `${(x * 100).toFixed(1)} %`;
const spreadOf = result => {
    const rates = result.characters.map(c => c.winRate);
    return { min: Math.min(...rates), max: Math.max(...rates), worst: Math.max(...rates.map(r => Math.abs(r - 0.5))) };
};

let characters = PlayersRepository.findAll().map(p => ({
    name: p.name, health: p.health, maxMove: p.maxMove, image: p.image,
    strength: p.strength, agility: p.agility, intelligence: p.intelligence, luck: p.luck,
}));
const original = characters.map(c => c.health);

console.log(`Auto-balance of health — agent "${AGENT.name}", ${GAMES} games per pair, tolerance ±${pct(TOLERANCE)}\n`);

let best = null;
let speed = SPEED;
for (let pass = 0; pass <= PASSES; pass++) {
    const r = runBalance({ characters, agent: AGENT, gamesPerPair: GAMES, seed: SEED });
    const s = spreadOf(r);
    const isBest = !best || s.worst < best.spread.worst;
    if (isBest) best = { characters: characters.map(c => ({ ...c })), result: r, spread: s, pass };
    console.log(`pass ${String(pass).padStart(2)}: win rates ${pct(s.min)} – ${pct(s.max)} (worst gap ${pct(s.worst)})${isBest ? '  ← best so far' : ''}`);
    if (s.worst <= TOLERANCE || pass === PASSES) break;

    characters = characters.map((c, i) => ({
        ...c,
        health: Math.max(10, Math.round(c.health * (1 + speed * (0.5 - r.characters[i].winRate)))),
    }));
    speed *= 0.7;
}
characters = best.characters;
const result = best.result;
console.log(`
Kept pass ${best.pass} (worst gap ${pct(best.spread.worst)})`);

// Vérification sur d'autres cartes : un réglage ne vaut que s'il tient sur des parties jamais vues
const check = runBalance({ characters, agent: AGENT, gamesPerPair: GAMES, seed: SEED + 1000 });
const c = spreadOf(check);
console.log(`\nCheck on other maps (seed ${SEED + 1000}): win rates ${pct(c.min)} – ${pct(c.max)} (worst gap ${pct(c.worst)}), draws ${pct(check.drawRate)}, first player ${pct(check.firstPlayerRate)}\n`);

console.log('character'.padEnd(18) + 'HP before'.padStart(10) + 'HP after'.padStart(10) + 'PM'.padStart(4) + 'STR'.padStart(5) + 'win (tuning)'.padStart(14) + 'win (check)'.padStart(13));
characters.forEach((ch, i) => console.log(
    ch.name.padEnd(18) + String(original[i]).padStart(10) + String(ch.health).padStart(10) + String(ch.maxMove).padStart(4) +
    String(ch.strength).padStart(5) + pct(result.characters[i].winRate).padStart(14) + pct(check.characters[i].winRate).padStart(13),
));

console.log('\nProposed PLAYER_DATA (not applied):');
for (const ch of characters) {
    const extra = ['strength', 'agility', 'intelligence', 'luck'].filter(k => ch[k]).map(k => `, ${k}: ${ch[k]}`).join('');
    console.log(`    { name: '${ch.name.replace(/'/g, "\\'")}', health: ${ch.health}, image: '${ch.image}', maxMove: ${ch.maxMove}${extra} },`);
}
