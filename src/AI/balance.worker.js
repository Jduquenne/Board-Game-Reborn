// Web Worker du Labo d'équilibrage : fait tourner l'analyse (src/AI/Balance.js) hors du fil principal,
// par petits morceaux, pour envoyer la progression et pouvoir être annulé.
import { balanceSteps } from './Balance.js';
import { SCRIPTED_AGENTS } from './ScriptedAgents.js';
import { createWeightedMoveAgent } from './MoveFeatures.js';
import { CHAMPION_MOVE_WEIGHTS } from './DefaultModels.js';

const AGENTS = {
    normal:   SCRIPTED_AGENTS.normal,
    champion: createWeightedMoveAgent(CHAMPION_MOVE_WEIGHTS, { name: 'champion' }),
};

const SLICE_MS = 50; // durée de calcul entre deux messages de progression

let run = null; // { id, steps } de l'analyse en cours

self.addEventListener('message', ({ data }) => {
    if (data.type === 'cancel') { run = null; return; }
    if (data.type !== 'run') return;

    run = {
        id: data.id,
        steps: balanceSteps({ characters: data.characters, agent: AGENTS[data.agent], gamesPerPair: data.gamesPerPair }),
    };
    continueRun(run);
});

function continueRun(current) {
    if (run !== current) return; // annulée ou remplacée par une nouvelle analyse

    const deadline = performance.now() + SLICE_MS;
    let step;
    do { step = current.steps.next(); } while (!step.done && performance.now() < deadline);

    if (step.done) {
        self.postMessage({ type: 'result', id: current.id, result: step.value });
        run = null;
    } else {
        self.postMessage({ type: 'progress', id: current.id, ...step.value });
        setTimeout(() => continueRun(current), 0);
    }
}
