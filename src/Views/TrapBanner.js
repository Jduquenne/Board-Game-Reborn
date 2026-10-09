import { Component } from '../core/Component.js';
import { AssetManager } from '../AssetManager.js';

export class TrapBanner extends Component {

    onMount() {
        this.listen('trap:triggered', ({ playerInfo }) => {
            this.#show(playerInfo, `${playerInfo.player.name} déclenche un piège, -20 points de vie !`);
            setTimeout(() => this.#hide(), 1500);
        });

        // Début de partie : qui commence, selon l'initiative
        this.listen('game:initiative', ({ playerInfo, initiatives }) => {
            const [a, b] = initiatives;
            const detail = a === b ? `à égalité (${a}), tirage au sort` : `${Math.max(a, b)} contre ${Math.min(a, b)}`;
            this.#show(playerInfo, `${playerInfo.player.name} a l'initiative (${detail}) et commence.`);
            setTimeout(() => this.#hide(), 1500);
        });

        // Mort subite : le joueur qui commence son tour perd des PV
        this.listen('sudden-death:hit', ({ playerInfo, damage }) => {
            this.#show(playerInfo, `Mort subite ! ${playerInfo.player.name} perd ${damage} points de vie.`);
            setTimeout(() => this.#hide(), 1500);
        });

        // Même bannière pour signaler un joueur bloqué qui passe son tour
        this.listen('turn:skipped', ({ playerInfo }) => {
            this.#show(playerInfo, `${playerInfo.player.name} est bloqué et passe son tour.`);
            setTimeout(() => this.#hide(), 1500);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #show(playerInfo, message) {
        const modal = document.querySelector('#trap-modal');
        modal.classList.remove('hidden');

        this.root.innerHTML = `
            <div class="trapInfosText">
                <img class="currentPlayerImg" src="${AssetManager.player(playerInfo.player)}" alt="${playerInfo.player.name}">
                ${message}
            </div>
        `;
    }

    #hide() {
        const modal = document.querySelector('#trap-modal');
        modal.classList.add('hidden');
        this.root.innerHTML = '';
    }
}
