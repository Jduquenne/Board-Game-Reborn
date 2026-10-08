import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { gameEngine } from '../Engine/GameEngine.js';
import { fightEngine } from '../Engine/FightEngine.js';
import { boardHtml } from './boardTemplate.js';

export class BoardView extends Component {

    onMount() {
        // Rendu initial au démarrage du jeu
        this.listen('game:started', () => this.#render(store.state));

        // Mise à jour du plateau pendant la partie (y compris le déplacement qui lance un duel)
        this.listen('state:changed', (state) => {
            if (state.phase === 'playing' || state.phase === 'fighting') this.#render(state);
        });

        // Event delegation — un seul listener pour toutes les cellules
        this.root.addEventListener('click', (e) => {
            const cellEl = e.target.closest('.cell');
            if (!cellEl) return;
            const row = parseInt(cellEl.dataset.row);
            const col = parseInt(cellEl.dataset.col);

            // Pendant le choix de la fuite : clic sur une case de repli → tentative de fuite vers elle
            if (cellEl.classList.contains('fleeTarget')) {
                fightEngine.flee({ row, col });
                return;
            }
            gameEngine.movePlayer(row, col);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #render(state) {
        this.root.innerHTML = boardHtml(state);
    }
}
