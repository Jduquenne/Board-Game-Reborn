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
import { aiEngine } from '../Engine/AIEngine.js';

export class GameView extends Component {
    #subComponents = [];

    render() {
        const weapons = WeaponsRepository.findAll();

        return `
            <div class="game">
                <div id="board"></div>

                <div id="menu">
                    <h2 class="playersTitle whiteFont">Joueurs</h2>
                    <div class="playerInterface"></div>
                    <div class="groupBtnRow menuBtn">
                        <button class="btn" id="btn-rules">Règles</button>
                        <button class="btn" id="btn-isometric">Isometric</button>
                        <button class="btn hidden" id="btn-topview">Dessus</button>
                        <button class="btn" id="btn-menu">Menu</button>
                    </div>
                </div>

                <div class="modalRules hidden" id="modal">
                    <div class="modalContent borderPixel">
                        <h2 class="rulesTitle">Règles</h2>
                        <button class="close" id="btn-close-rules" aria-label="Fermer les règles">X</button>
                        <p class="rule">- Un joueur peut ramasser une arme en marchant dessus.</p>
                        <p class="rule">- Un joueur peut ramasser un bonus en marchant dessus.</p>
                        <p class="rule">- Un duel commence lorsque 2 joueurs sont côte à côte.</p>
                        <p class="rule">- Dégâts des armes sur le terrain :</p>
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

        // Démarre l'IA avant le jeu pour qu'elle soit prête à écouter turn:changed
        aiEngine.start();

        // Lance le jeu après que les sous-composants sont montés et à l'écoute
        gameEngine.startGame(store.state.config);

        // Adapte la taille des cellules pour que le plateau tienne dans le viewport
        this.#setCellSize();

        // Boutons
        this.query('#btn-rules').addEventListener('click', () => {
            this.query('#modal').classList.remove('hidden');
        });

        this.query('#btn-close-rules').addEventListener('click', () => {
            this.query('#modal').classList.add('hidden');
        });

        this.query('#btn-isometric').addEventListener('click', () => {
            this.query('#board').classList.add('isometric');
            this.query('#btn-isometric').classList.add('hidden');
            this.query('#btn-topview').classList.remove('hidden');
        });

        this.query('#btn-topview').addEventListener('click', () => {
            this.query('#board').classList.remove('isometric');
            this.query('#btn-topview').classList.add('hidden');
            this.query('#btn-isometric').classList.remove('hidden');
        });

        this.query('#btn-menu').addEventListener('click', () => router.navigate('menu'));
    }

    onUnmount() {
        aiEngine.stop();
        this.#subComponents.forEach(c => c.unmount());
        this.#subComponents = [];
        store.reset();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Calcule la taille maximale d'une cellule pour que le plateau tienne
    // entièrement dans le viewport sans scroll, puis l'applique via CSS custom property.
    #setCellSize() {
        const { rows, cols } = store.state.config;

        // L'espace disponible pour le plateau = viewport - largeur de la sidebar - bordures
        const menuEl    = this.query('#menu');
        const sidebarW  = menuEl.offsetWidth + 40; // + marges
        const boardBorder = 10; // border: 5px × 2 côtés

        const availW = window.innerWidth  - sidebarW - boardBorder;
        const availH = window.innerHeight - boardBorder;

        // On prend le plus petit des deux axes pour que tout rentre
        const size     = Math.floor(Math.min(availW / cols, availH / rows));
        const cellSize = Math.min(Math.max(size, 10), 60); // entre 10px et 60px

        this.query('#board').style.setProperty('--cell-size', `${cellSize}px`);
    }
}
