import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';
import { AssetManager } from '../AssetManager.js';
import { tacticalEngine } from '../Engine/Tactical/TacticalEngine.js';
import { viewBox, floorSvg, overlaySvg, objectsSvg } from './tacticalBoardSvg.js';

const TEAM_LABEL = ['Joueur 1 (bleu)', 'Joueur 2 (rouge)'];

// Mode tactique (docs/spec-tactical.md, lot 1) : plateau isométrique, PA / PM, Coup de poing, fin du tour, 2 joueurs
export class TacticalView extends Component {
    #mode      = 'move'; // 'move' : un clic déplace ; 'punch' : un clic frappe
    #hoverId   = null;
    #onKeydown = null;

    render() {
        return `
            <div class="game tactical">
                <div class="boardArea">
                    <svg class="tacticalBoard" id="t-board" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plateau du combat tactique">
                        <g id="t-floor"></g>
                        <g id="t-overlay"></g>
                        <g id="t-objects"></g>
                    </svg>
                </div>

                <div id="menu">
                    <div class="playerInterface" id="t-fighters"></div>
                    <p class="tacticalLog" id="t-log" aria-live="polite"></p>
                    <div class="groupBtnRow menuBtn">
                        <button class="btn" id="t-punch" aria-pressed="false" title="Frappe une case voisine : 8 à 12 dégâts">Coup de poing (3 PA)</button>
                        <button class="btn" id="t-end">Fin du tour</button>
                        <button class="btn" id="t-menu">Menu</button>
                    </div>
                </div>

                <div class="modalRules hidden" id="t-modal-quit">
                    <div class="modalContent borderPixel">
                        <h2 class="rulesTitle">Quitter le combat ?</h2>
                        <p class="rule confirmText">Le combat en cours sera perdu.</p>
                        <div class="groupBtnRow confirmBtns">
                            <button class="btn" id="t-quit-confirm">Quitter</button>
                            <button class="btn" id="t-quit-cancel">Continuer</button>
                        </div>
                    </div>
                </div>

                <div class="modalRules hidden" id="t-modal-over">
                    <div class="modalContent borderPixel">
                        <h2 class="rulesTitle" id="t-winner"></h2>
                        <div class="groupBtnRow confirmBtns">
                            <button class="btn" id="t-replay">Rejouer</button>
                            <button class="btn" id="t-over-menu">Menu</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount() {
        this.listen('tactical:started', () => this.#drawAll());
        this.listen('state:changed', ({ tactical }) => { if (tactical) this.#refresh(); });
        this.listen('tactical:moved', ({ fighterIndex, path }) => {
            this.#log(`${this.#name(fighterIndex)} se déplace (${path.length} PM).`);
        });
        this.listen('tactical:attack', ({ attackerIndex, targetIndex, action, damage }) => {
            this.#log(`${this.#name(attackerIndex)} : ${action} sur ${this.#name(targetIndex)}, −${damage} PV.`);
        });
        this.listen('tactical:turn', ({ activeIndex }) => {
            this.#log(`À ${this.#name(activeIndex)} de jouer.`);
        });
        this.listen('tactical:over', ({ winnerIndex }) => {
            this.query('#t-winner').textContent = `${this.#name(winnerIndex)} remporte le combat !`;
            this.query('#t-modal-over').classList.remove('hidden');
            this.query('#t-replay').focus();
        });

        const board = this.query('#t-board');
        board.addEventListener('click', (e) => {
            const id = this.#cellId(e.target);
            if (id === null) return;
            if (this.#mode === 'punch') {
                this.#mode = 'move';
                tacticalEngine.punch(id);
                this.#refresh(); // le mode a changé même si la frappe est refusée
            } else {
                tacticalEngine.move(id);
            }
        });
        board.addEventListener('pointermove', (e) => this.#hover(this.#cellId(e.target)));
        board.addEventListener('pointerleave', () => this.#hover(null));

        this.query('#t-punch').addEventListener('click', () => {
            this.#mode = this.#mode === 'punch' ? 'move' : 'punch';
            this.#refresh();
        });
        this.query('#t-end').addEventListener('click', () => {
            this.#mode = 'move';
            tacticalEngine.endTurn();
        });

        this.query('#t-menu').addEventListener('click', () => {
            this.query('#t-modal-quit').classList.remove('hidden');
            this.query('#t-quit-cancel').focus();
        });
        this.query('#t-quit-confirm').addEventListener('click', () => router.navigate('menu'));
        this.query('#t-quit-cancel').addEventListener('click', () => this.query('#t-modal-quit').classList.add('hidden'));
        this.query('#t-over-menu').addEventListener('click', () => router.navigate('menu'));
        this.query('#t-replay').addEventListener('click', () => {
            this.query('#t-modal-over').classList.add('hidden');
            this.#mode = 'move';
            this.query('#t-log').textContent = '';
            tacticalEngine.start();
        });

        // Échap : annule le Coup de poing sélectionné, ferme la confirmation de sortie
        this.#onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            this.query('#t-modal-quit').classList.add('hidden');
            if (this.#mode === 'punch') {
                this.#mode = 'move';
                this.#refresh();
            }
        };
        document.addEventListener('keydown', this.#onKeydown);

        tacticalEngine.start();
    }

    onUnmount() {
        document.removeEventListener('keydown', this.#onKeydown);
        store.reset();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #drawAll() {
        const { board } = store.state.tactical;
        const svg = this.query('#t-board');
        svg.setAttribute('viewBox', viewBox(board));
        this.query('#t-floor').innerHTML = floorSvg(board);
        this.#refresh();
    }

    #refresh() {
        const tactical = store.state.tactical;
        if (!tactical || !this.query('#t-floor').childElementCount) return;
        const fighting = tactical.phase === 'fighting';

        if (this.#mode === 'punch' && !tactical.targets.length) this.#mode = 'move';
        this.query('#t-overlay').innerHTML = overlaySvg(tactical, { mode: this.#mode, hoverId: this.#hoverId });
        this.query('#t-objects').innerHTML = objectsSvg(tactical);
        this.query('#t-board').classList.toggle('targeting', this.#mode === 'punch');

        this.query('#t-fighters').innerHTML = tactical.fighters
            .map((f, i) => this.#fighterCard(f, i === tactical.activeIndex && fighting))
            .join('');

        const punch = this.query('#t-punch');
        punch.disabled = !tactical.targets.length; // pas assez de PA, ou combat terminé
        punch.classList.toggle('btn-active', this.#mode === 'punch');
        punch.setAttribute('aria-pressed', String(this.#mode === 'punch'));
        this.query('#t-end').disabled = !fighting;
    }

    #hover(id) {
        if (id === this.#hoverId) return;
        this.#hoverId = id;
        const tactical = store.state.tactical;
        if (tactical) this.query('#t-overlay').innerHTML = overlaySvg(tactical, { mode: this.#mode, hoverId: id });
    }

    #cellId(target) {
        const el = target.closest?.('[data-cell]');
        return el ? Number(el.dataset.cell) : null;
    }

    #name(index) {
        return store.state.tactical?.fighters[index]?.name ?? '';
    }

    #log(text) {
        this.query('#t-log').textContent = text;
    }

    #fighterCard(f, isActive) {
        return `
            <div class="playerCard borderPixel ${isActive ? 'active' : ''}">
                <div class="playerTopInfos">
                    <img class="playerImg" src="${AssetManager.player(f)}" alt="${f.name}">
                    <div class="playerInfos">
                        <div class="playerName">${f.name}</div>
                        <div class="playerClass"><span class="tTeamDot ${f.team === 0 ? 'teamA' : 'teamB'}"></span>${TEAM_LABEL[f.team]}</div>
                        <div class="playerHealth">Points de vie : ${f.health} / ${f.maxHealth}</div>
                        <div class="playerMaxMove"><span class="tPA">PA ${f.pa} / ${f.maxPA}</span> · <span class="tPM">PM ${f.pm} / ${f.maxPM}</span></div>
                    </div>
                </div>
            </div>
        `;
    }
}
