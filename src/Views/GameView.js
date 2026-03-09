import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';
import { gameEngine } from '../Engine/GameEngine.js';
import { BoardView } from './BoardView.js';
import { PlayersSidebar } from './PlayersSidebar.js';
import { BattleBanner } from './BattleBanner.js';
import { TrapBanner } from './TrapBanner.js';
import { WeaponsRepository } from '../Repository/WeaponsRepository.js';
import { AssetManager } from '../AssetManager.js';

export class GameView extends Component {
    #subComponents = [];

    render() {
        const weapons = WeaponsRepository.findAll();

        return `
            <div class="game" style="display:flex">
                <div id="board"></div>

                <div id="menu">
                    <h2 class="playersTitle whiteFont">Joueurs</h2>
                    <div class="playerInterface"></div>
                    <div class="groupBtnRow menuBtn">
                        <button class="btn" id="btn-rules">Régles</button>
                        <button class="btn" id="btn-isometric">Isometric</button>
                        <button class="btn" id="btn-topview" style="display:none">Dessus</button>
                        <button class="btn" id="btn-menu">Menu</button>
                    </div>
                </div>

                <div class="modalRules hidden" id="modal">
                    <div class="modalContent borderPixel">
                        <h2 class="rulesTitle">Régles</h2>
                        <span class="close" id="btn-close-rules">X</span>
                        <p class="rule">- Un joueur peut ramasser une arme en marchant dessus.</p>
                        <p class="rule">- Un joueur peut ramasser un bonus en marchant dessus.</p>
                        <p class="rule">- Un duel commence lorsque 2 joueurs sont côte à côte.</p>
                        <p class="rule">- Dégats des armes sur le terrain :</p>
                        <div id="weaponList">
                            ${weapons.map(w => `
                                <div class="weaponInfo">
                                    <img src="${AssetManager.weapon(w)}" alt="${w.name}">
                                    <span>: ${w.damage}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="battleModal hidden" id="battle-modal">
                    <div class="battleBanner" id="battle-banner"></div>
                </div>

                <div class="trapModal hidden" id="trap-modal">
                    <div class="trapBanner" id="trap-banner"></div>
                </div>
            </div>
        `;
    }

    onMount() {
        // Monte les sous-composants dans leurs conteneurs respectifs
        const board   = new BoardView(this.query('#board'));
        const sidebar = new PlayersSidebar(this.query('.playerInterface'));
        const battle  = new BattleBanner(this.query('#battle-banner'));
        const trap    = new TrapBanner(this.query('#trap-banner'));

        this.#subComponents = [board, sidebar, battle, trap];
        this.#subComponents.forEach(c => c.mount());

        // Lance le jeu après que les sous-composants sont montés et à l'écoute
        gameEngine.startGame(store.state.config);

        // Boutons
        this.query('#btn-rules').addEventListener('click', () => {
            this.query('#modal').style.display = 'block';
        });

        this.query('#btn-close-rules').addEventListener('click', () => {
            this.query('#modal').style.display = 'none';
        });

        this.query('#btn-isometric').addEventListener('click', () => {
            this.query('#board').classList.add('isometric');
            this.query('#btn-isometric').style.display = 'none';
            this.query('#btn-topview').style.display   = 'block';
        });

        this.query('#btn-topview').addEventListener('click', () => {
            this.query('#board').classList.remove('isometric');
            this.query('#btn-topview').style.display   = 'none';
            this.query('#btn-isometric').style.display = 'block';
        });

        this.query('#btn-menu').addEventListener('click', () => router.navigate('menu'));
    }

    onUnmount() {
        this.#subComponents.forEach(c => c.unmount());
        this.#subComponents = [];
        store.reset();
    }
}
