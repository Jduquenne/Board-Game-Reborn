import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { gameEngine } from '../Engine/GameEngine.js';
import { AssetManager } from '../AssetManager.js';
import { DECOR } from '../Models/Cell.js';

export class BoardView extends Component {

    onMount() {
        // Rendu initial au démarrage du jeu
        this.listen('game:started', () => this.#render(store.state));

        // Mise à jour du plateau pendant la phase de jeu
        this.listen('state:changed', (state) => {
            if (state.phase === 'playing') this.#render(state);
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

    #render({ cells, players, activePlayerIndex }) {
        const activePos = players[activePlayerIndex]?.position;

        this.root.innerHTML = cells.map((row, rowIdx) => `
            <div class="lines" id="line${rowIdx}">
                ${row.map(cell => this.#cellTemplate(cell, cell.row === activePos?.row && cell.col === activePos?.col)).join('')}
            </div>
        `).join('');
    }

    #cellTemplate(cell, isActivePlayer) {
        const classes   = ['cell'];
        const bgImages  = [];
        let   title     = '';

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
            if (isActivePlayer) classes.push('activePlayer');
            bgImages.unshift(`url('${AssetManager.player(cell.player)}')`);
            title = cell.player.name;
        } else if (cell.weapon) {
            classes.push('weapon');
            bgImages.unshift(`url('${AssetManager.weapon(cell.weapon)}')`);
            title = `${cell.weapon.name} — ${cell.weapon.damage} dégâts`;
        } else if (cell.bonus) {
            classes.push('bonus');
            bgImages.unshift(`url('${AssetManager.bonus(cell.bonus)}')`);
            title = cell.bonus.name;
        } else if (cell.trap?.triggered) {
            classes.push('trapped');
            bgImages.unshift(`url('${AssetManager.trap(cell.trap)}')`);
            title = 'Piège déclenché';
        }

        // Cellule sur laquelle le joueur actif peut se déplacer
        if (cell.isMovable) classes.push('cellToMove');

        // Case accessible à côté de l'adversaire : s'y arrêter lance le duel
        if (cell.isMovable && cell.isSecurityZone) {
            classes.push('fightZone');
            title = title ? `${title} — duel !` : 'Duel !';
        }

        return `
            <div
                class="${classes.join(' ')}"
                id="${cell.id}"
                data-row="${cell.row}"
                data-col="${cell.col}"
                ${title ? `title="${title}"` : ''}
                style="background-image: ${bgImages.join(', ')}">
            </div>
        `;
    }
}
