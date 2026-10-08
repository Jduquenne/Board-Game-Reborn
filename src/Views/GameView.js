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
    #onKeydown     = null;

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
                        <p class="rule">- À chaque tour, déplace ton personnage en ligne droite (haut, bas, gauche, droite) d'autant de cases que ses PM au maximum. Les obstacles et les joueurs bloquent le passage.</p>
                        <p class="rule">- Marche sur une arme pour l'échanger avec la tienne : ton ancienne arme reste au sol.</p>
                        <p class="rule">- Les bonus donnent des points de vie ou des PM supplémentaires.</p>
                        <p class="rule">- Des pièges sont cachés sur le plateau : -20 points de vie, puis ils deviennent visibles.</p>
                        <p class="rule">- Les cases cerclées de rouge sont à côté de l'adversaire : t'y arrêter lance le duel, et tu attaques en premier.</p>
                        <p class="rule">- En duel, chacun son tour : « Attaquer » inflige les dégâts de ton arme, « Se défendre » divise par 2 les prochains dégâts reçus. Le premier à 0 point de vie perd.</p>
                        <p class="rule">- En mode IA, l'ordinateur joue le second personnage (badge « IA »).</p>
                        <p class="rule">- Dégâts des armes :</p>
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

                <div class="modalRules hidden" id="modal-quit">
                    <div class="modalContent borderPixel">
                        <h2 class="rulesTitle">Quitter la partie ?</h2>
                        <p class="rule confirmText">La partie en cours sera perdue.</p>
                        <div class="groupBtnRow confirmBtns">
                            <button class="btn" id="btn-quit-confirm">Quitter</button>
                            <button class="btn" id="btn-quit-cancel">Continuer</button>
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
            this.query('#btn-close-rules').focus();
        });

        this.query('#btn-close-rules').addEventListener('click', () => {
            this.query('#modal').classList.add('hidden');
        });

        // Fermeture des fenêtres par un clic en dehors du contenu
        for (const modal of this.queryAll('.modalRules')) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }

        // Fermeture des fenêtres avec la touche Échap
        this.#onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            this.queryAll('.modalRules').forEach(modal => modal.classList.add('hidden'));
        };
        document.addEventListener('keydown', this.#onKeydown);

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

        // Retour au menu : confirmation, la partie en cours serait perdue
        this.query('#btn-menu').addEventListener('click', () => {
            this.query('#modal-quit').classList.remove('hidden');
            this.query('#btn-quit-cancel').focus();
        });

        this.query('#btn-quit-confirm').addEventListener('click', () => router.navigate('menu'));

        this.query('#btn-quit-cancel').addEventListener('click', () => {
            this.query('#modal-quit').classList.add('hidden');
        });
    }

    onUnmount() {
        document.removeEventListener('keydown', this.#onKeydown);
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
