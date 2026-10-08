import { eventBus } from '../core/EventBus.js';
import { store } from '../core/Store.js';
import { gameEngine } from './GameEngine.js';
import { fightEngine } from './FightEngine.js';

// Délai en ms avant que l'IA joue — simule une "réflexion" et rend le tour visible
const THINK_DELAY = 900;

// Délai en ms avant une action de combat — doit rester supérieur aux délais
// d'affichage de BattleBanner (1000 ms au début du combat, 600 ms entre les rounds)
const FIGHT_THINK_DELAY = 1500;

// Mode facile : probabilité d'attaquer plutôt que de se défendre
const EASY_ATTACK_CHANCE = 0.7;

class AIEngine {
    #unsubs  = [];
    #timeout = null;

    // Démarre l'écoute des événements — appelé par GameView au montage
    start() {
        this.#unsubs = [
            eventBus.on('turn:changed', ({ activePlayerIndex }) => {
                const { players, config, phase } = store.state;

                if (phase !== 'playing')      return;
                if (config.aiMode === 'none') return;

                const activeInfo = players[activePlayerIndex];
                if (!activeInfo.player.isAI)  return;

                // On attend avant de jouer pour que le joueur humain voie ce qui se passe
                this.#timeout = setTimeout(() => this.#playTurn(config.aiMode), THINK_DELAY);
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

    #playTurn(difficulty) {
        const { cells, players, activePlayerIndex, phase } = store.state;

        if (phase !== 'playing') return;

        // Toutes les cases accessibles à l'IA ce tour-ci
        const movableCells = cells.flat().filter(c => c.isMovable);
        if (movableCells.length === 0) return;

        const chosen = difficulty === 'easy'
            ? this.#randomMove(movableCells)
            : this.#smartMove(movableCells, players, activePlayerIndex);

        gameEngine.movePlayer(chosen.row, chosen.col);
    }

    #scheduleFightAction(attackerInfo) {
        const { config } = store.state;

        if (config.aiMode === 'none')   return;
        if (!attackerInfo.player.isAI)  return;

        this.#timeout = setTimeout(() => this.#playFightAction(config.aiMode), FIGHT_THINK_DELAY);
    }

    #playFightAction(difficulty) {
        const { fight, players, phase } = store.state;

        if (phase !== 'fighting' || !fight) return;

        const me    = players[fight.attackerIndex];
        const enemy = players[fight.targetIndex];
        if (!me.player.isAI) return;

        const shouldAttack = difficulty === 'easy'
            ? Math.random() < EASY_ATTACK_CHANCE
            : this.#smartFightChoice(me.player, enemy.player);

        if (shouldAttack) fightEngine.attack();
        else              fightEngine.defend();
    }

    // ─── Stratégies ───────────────────────────────────────────────────────────

    // Facile : choix aléatoire parmi les cases accessibles
    #randomMove(movableCells) {
        return movableCells[Math.floor(Math.random() * movableCells.length)];
    }

    // Normal : arbre de décision par ordre de priorité
    #smartMove(movableCells, players, activePlayerIndex) {
        const waitingIndex = (activePlayerIndex + 1) % players.length;
        const me    = players[activePlayerIndex];
        const enemy = players[waitingIndex];

        // Priorité 1 : déclencher un combat si on est avantagé
        // (on fait plus de dégâts OU on a plus de HP que l'adversaire)
        const fightCells = movableCells.filter(c => c.isSecurityZone);
        if (fightCells.length > 0) {
            const weHaveEdge =
                me.player.weapon.damage >= enemy.player.weapon.damage ||
                me.player.health > enemy.player.health;

            if (weHaveEdge) {
                return this.#closestTo(fightCells, enemy.position);
            }
        }

        // Priorité 2 : ramasser une arme meilleure que celle qu'on porte
        const weaponCells = movableCells.filter(c =>
            c.weapon && c.weapon.damage > me.player.weapon.damage
        );
        if (weaponCells.length > 0) {
            // Parmi les armes disponibles, on prend celle qui nous rapproche le plus de l'ennemi
            return this.#closestTo(weaponCells, enemy.position);
        }

        // Priorité 3 : ramasser un bonus (vie ou PM)
        const bonusCells = movableCells.filter(c => c.bonus);
        if (bonusCells.length > 0) {
            return this.#closestTo(bonusCells, enemy.position);
        }

        // Priorité 4 : se rapprocher de l'ennemi (distance de Manhattan)
        return this.#closestTo(movableCells, enemy.position);
    }

    // Retourne la cellule de la liste la plus proche de targetPosition
    // Utilise la distance de Manhattan : |Δrow| + |Δcol|
    #closestTo(cells, targetPosition) {
        return cells.reduce((best, cell) => {
            const dBest = Math.abs(best.row - targetPosition.row) + Math.abs(best.col - targetPosition.col);
            const dCell = Math.abs(cell.row - targetPosition.row) + Math.abs(cell.col - targetPosition.col);
            return dCell < dBest ? cell : best;
        });
    }

    // Combat normal : retourne true pour attaquer, false pour se défendre
    #smartFightChoice(me, enemy) {
        // Priorité 1 : achever l'adversaire si notre coup suffit (sa défense divise par 2)
        const myDamage = enemy.defense ? Math.floor(me.weapon.damage / 2) : me.weapon.damage;
        if (myDamage >= enemy.health) return true;

        // Priorité 2 : se défendre si le prochain coup adverse peut nous tuer
        // (inutile si on est déjà en défense — le bonus ne se cumule pas)
        if (!me.defense && enemy.weapon.damage >= me.health) return false;

        // Priorité 3 : attaquer
        return true;
    }
}

export const aiEngine = new AIEngine();
