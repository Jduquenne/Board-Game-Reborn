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

// Taille d'une cellule du plateau, en pixels
const CELL_MIN = 10;
const CELL_MAX = 96;

// Bordure du plateau : border 5px × 2 côtés
const BOARD_BORDER = 10;

export class GameView extends Component {
    #subComponents  = [];
    #onKeydown      = null;
    #resizeObserver = null;

    render() {
        const weapons = WeaponsRepository.findAll();

        return `
            <div class="game">
                <div class="boardArea">
                    <div id="board"></div>
                </div>

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
                        <div class="rulesBody">
                        <p class="rule">- À chaque tour, déplace ton personnage en ligne droite (haut, bas, gauche, droite) d'autant de cases que ses PM au maximum. Les obstacles et les joueurs bloquent le passage.</p>
                        <p class="rule">- Marche sur une arme pour l'échanger avec la tienne : ton ancienne arme reste au sol.</p>
                        <p class="rule">- Les bonus donnent des points de vie ou des PM supplémentaires.</p>
                        <p class="rule">- Des pièges sont cachés sur le plateau : -20 points de vie, puis ils deviennent visibles.</p>
                        <p class="rule">- Les cases cerclées de rouge sont à côté de l'adversaire : t'y arrêter lance le duel, et tu attaques en premier.</p>
                        <p class="rule">- En duel, chacun son tour : « Attaquer » inflige les dégâts de ton arme, « Se défendre » divise par 2 les prochains dégâts reçus. Le premier à 0 point de vie perd.</p>
                        <p class="rule">- En mode IA, l'ordinateur joue le second personnage (badge « IA »).</p>
                        </div>
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

        // Adapte la taille des cellules à la place disponible, puis à chaque
        // redimensionnement de la fenêtre ou rotation de l'écran
        this.#setCellSize();
        this.#resizeObserver = new ResizeObserver(() => this.#setCellSize());
        this.#resizeObserver.observe(this.query('.boardArea'));

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
            this.#setCellSize();
        });

        this.query('#btn-topview').addEventListener('click', () => {
            this.query('#board').classList.remove('isometric');
            this.query('#btn-topview').classList.add('hidden');
            this.query('#btn-isometric').classList.remove('hidden');
            this.#setCellSize();
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
        this.#resizeObserver?.disconnect();
        aiEngine.stop();
        this.#subComponents.forEach(c => c.unmount());
        this.#subComponents = [];
        store.reset();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    // Calcule la taille maximale d'une cellule pour que le plateau tienne
    // entièrement dans sa zone (.boardArea) sans scroll, puis l'applique via CSS custom property.
    #setCellSize() {
        const { rows, cols } = store.state.config;
        const area  = this.query('.boardArea');
        const board = this.query('#board');
        if (!area || !board) return;

        const availW = area.clientWidth;
        const availH = area.clientHeight;

        let size;
        if (board.classList.contains('isometric')) {
            // Vue isométrique (rotateZ 45° puis rotateX 45°) : le plateau projeté mesure
            // (largeur + hauteur) / √2 de large et (largeur + hauteur) / 2 de haut,
            // plus environ 0,7 cellule pour le relief des obstacles
            const sum = cols + rows;
            size = Math.min(
                (availW * Math.SQRT2 - 2 * BOARD_BORDER) / sum,
                (2 * availH - 2 * BOARD_BORDER) / (sum + 1.5),
            );
        } else {
            size = Math.min((availW - BOARD_BORDER) / cols, (availH - BOARD_BORDER) / rows);
        }

        const cellSize = Math.min(Math.max(Math.floor(size), CELL_MIN), CELL_MAX);
        board.style.setProperty('--cell-size', `${cellSize}px`);
    }
}
