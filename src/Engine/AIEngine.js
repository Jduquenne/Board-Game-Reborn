import { eventBus } from '../core/EventBus.js';
import { store } from '../core/Store.js';
import { gameEngine } from './GameEngine.js';
import { fightEngine } from './FightEngine.js';
import { SCRIPTED_AGENTS, normalAgent } from '../AI/ScriptedAgents.js';
import { createQFightAgent } from '../AI/FightPolicy.js';
import { createWeightedMoveAgent } from '../AI/MoveFeatures.js';
import { createNeuralMoveAgent } from '../AI/NeuralMovePolicy.js';
import { NeuralNetwork } from '../AI/NeuralNetwork.js';
import { QTable } from '../AI/QLearning.js';
import { ModelStorage } from '../core/ModelStorage.js';

// Délai en ms avant que l'IA joue — simule une "réflexion" et rend le tour visible
const THINK_DELAY = 900;

// Délai en ms avant une action de combat — doit rester supérieur aux délais
// d'affichage de BattleBanner (1000 ms au début du combat, 600 ms entre les rounds)
const FIGHT_THINK_DELAY = 1500;

// Branche un agent (src/AI/) sur la partie en cours : écoute les événements,
// demande à l'agent de choisir, puis joue son choix via GameEngine / FightEngine
class AIEngine {
    #unsubs       = [];
    #timeout      = null;
    #trainedAgent = null;

    // Démarre l'écoute des événements — appelé par GameView au montage
    start() {
        // IA Entraînée : modèles enregistrés depuis la page d'entraînement (combat et/ou déplacement) ;
        // pour chaque partie manquante, elle joue comme l'IA Normal
        this.#trainedAgent = this.#loadTrainedAgent();

        this.#unsubs = [
            eventBus.on('turn:changed', ({ activePlayerIndex }) => {
                const { players, phase } = store.state;

                if (phase !== 'playing')                       return;
                if (!this.#agent())                            return;
                if (!players[activePlayerIndex].player.isAI)   return;

                // On attend avant de jouer pour que le joueur humain voie ce qui se passe
                this.#timeout = setTimeout(() => this.#playTurn(), THINK_DELAY);
            }),

            // Combat : l'IA joue quand elle est l'attaquant (début du combat ou nouveau round)
            eventBus.on('fight:start',     ({ attacker })     => this.#scheduleFightAction(attacker)),
            eventBus.on('fight:round-end', ({ nextAttacker }) => this.#scheduleFightAction(nextAttacker)),
        ];
    }

    // Arrête tout — appelé par GameView au démontage
    stop() {
        this.#unsubs.forEach(unsub => unsub());
        this.#unsubs = [];
        if (this.#timeout) { clearTimeout(this.#timeout); this.#timeout = null; }
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #loadTrainedAgent() {
        const fightModel = ModelStorage.load('fight');
        const moveModel  = ModelStorage.load('move');
        const fightAgent = fightModel?.table ? createQFightAgent(QTable.fromJSON(fightModel)) : normalAgent;

        // Déplacement : réseau de neurones (leçon Réseau) ou poids évolués (leçon Déplacement)
        if (moveModel?.network) {
            return createNeuralMoveAgent(NeuralNetwork.fromJSON(moveModel.network), { fightAgent, name: 'trained' });
        }
        return Array.isArray(moveModel?.weights)
            ? createWeightedMoveAgent(moveModel.weights, { fightAgent, name: 'trained' })
            : { ...fightAgent, name: 'trained', chooseMove: normalAgent.chooseMove };
    }

    // Agent correspondant au mode de jeu choisi dans les options (null en mode 2 joueurs)
    #agent() {
        const mode = store.state.config.aiMode;
        if (mode === 'trained') return this.#trainedAgent;
        return SCRIPTED_AGENTS[mode] ?? null;
    }

    #playTurn() {
        const state = store.state;
        const agent = this.#agent();
        if (state.phase !== 'playing' || !agent) return;
        // Sécurité : ne jamais jouer à la place d'un humain (le tour a pu changer entre-temps)
        if (!state.players[state.activePlayerIndex].player.isAI) return;

        const move = agent.chooseMove(state, () => Math.random());
        if (move) gameEngine.movePlayer(move.row, move.col);
    }

    #scheduleFightAction(attackerInfo) {
        if (!this.#agent())             return;
        if (!attackerInfo.player.isAI)  return;

        this.#timeout = setTimeout(() => this.#playFightAction(), FIGHT_THINK_DELAY);
    }

    #playFightAction() {
        const state = store.state;
        const agent = this.#agent();
        if (state.phase !== 'fighting' || !state.fight || !agent) return;
        if (!state.players[state.fight.attackerIndex].player.isAI) return;

        const action = agent.chooseFightAction(state, () => Math.random());
        if (action === 'attack') fightEngine.attack();
        else                     fightEngine.defend();
    }
}

export const aiEngine = new AIEngine();
