import { Component } from '../core/Component.js';
import { AssetManager } from '../AssetManager.js';

export class TrapBanner extends Component {

    onMount() {
        this.listen('trap:triggered', ({ playerInfo }) => {
            this.#show(playerInfo);
            setTimeout(() => this.#hide(), 1500);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #show(playerInfo) {
        const modal = document.querySelector('#trap-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        this.root.innerHTML = `
            <div class="trapInfosText">
                <img class="currentPlayerImg" src="${AssetManager.player(playerInfo.player)}" alt="">
                ${playerInfo.player.name} déclenche un piège, -20 points de vie !
            </div>
        `;
    }

    #hide() {
        const modal = document.querySelector('#trap-modal');
        modal.classList.add('hidden');
        modal.style.display = '';
        this.root.innerHTML = '';
    }
}
