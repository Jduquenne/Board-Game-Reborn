import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { gameEngine } from '../Engine/GameEngine.js';
import { AssetManager } from '../AssetManager.js';
import { DECOR } from '../Models/Cell.js';

export class BoardView extends Component {

    onMount() {
        // Rendu initial au démarrage du jeu
        this.listen('game:started', () => this.#render(store.state.cells));

        // Mise à jour du plateau pendant la phase de jeu
        this.listen('state:changed', ({ cells, phase }) => {
            if (phase === 'playing') this.#render(cells);
        });

        // Event delegation — un seul listener pour toutes les cellules
        this.root.addEventListener('click', (e) => {
            const cellEl = e.target.closest('.cell');
            if (!cellEl) return;
            const row = parseInt(cellEl.dataset.row);
            const col = parseInt(cellEl.dataset.col);
            gameEngine.movePlayer(row, col);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #render(cells) {
        this.root.innerHTML = cells.map((row, rowIdx) => `
            <div class="lines" id="line${rowIdx}">
                ${row.map(cell => this.#cellTemplate(cell)).join('')}
            </div>
        `).join('');
    }

    #cellTemplate(cell) {
        const classes   = ['cell'];
        const bgImages  = [];

        // Sol ou obstacle comme fond de base
        if (cell.decor === DECOR.OBSTACLE) {
            classes.push('obstacle');
            bgImages.push(`url('${AssetManager.obstacle()}')`);
        } else {
            bgImages.push(`url('${AssetManager.floor()}')`);
        }

        // Contenu de la cellule (par ordre de priorité visuelle)
        if (cell.player) {
            classes.push('player');
            bgImages.unshift(`url('${AssetManager.player(cell.player)}')`);
        } else if (cell.weapon) {
            classes.push('weapon');
            bgImages.unshift(`url('${AssetManager.weapon(cell.weapon)}')`);
        } else if (cell.bonus) {
            classes.push('bonus');
            bgImages.unshift(`url('${AssetManager.bonus(cell.bonus)}')`);
        } else if (cell.trap?.triggered) {
            classes.push('trapped');
            bgImages.unshift(`url('${AssetManager.trap(cell.trap)}')`);
        }

        // Cellule sur laquelle le joueur actif peut se déplacer
        if (cell.isMovable) classes.push('cellToMove');

        return `
            <div
                class="${classes.join(' ')}"
                id="${cell.id}"
                data-row="${cell.row}"
                data-col="${cell.col}"
                style="background-image: ${bgImages.join(', ')}">
            </div>
        `;
    }
}
