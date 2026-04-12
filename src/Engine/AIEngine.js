import { eventBus } from '../core/EventBus.js';
import { store } from '../core/Store.js';
import { gameEngine } from './GameEngine.js';

// Délai en ms avant que l'IA joue — simule une "réflexion" et rend le tour visible
const THINK_DELAY = 900;

class AIEngine {
    #unsub   = null;
    #timeout = null;

    // Démarre l'écoute des événements — appelé par GameView au montage
    start() {
        this.#unsub = eventBus.on('turn:changed', ({ activePlayerIndex }) => {
            const { players, config, phase } = store.state;

            if (phase !== 'playing')      return;
            if (config.aiMode === 'none') return;

            const activeInfo = players[activePlayerIndex];
            if (!activeInfo.player.isAI)  return;

            // On attend avant de jouer pour que le joueur humain voie ce qui se passe
            this.#timeout = setTimeout(() => this.#playTurn(config.aiMode), THINK_DELAY);
        });
    }

    // Arrête tout — appelé par GameView au démontage
    stop() {
        if (this.#unsub)   { this.#unsub(); this.#unsub = null; }
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
}

export const aiEngine = new AIEngine();
