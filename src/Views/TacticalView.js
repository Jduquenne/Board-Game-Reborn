import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';
import { AssetManager } from '../AssetManager.js';
import { TacticalClassesRepository } from '../Repository/TacticalClassesRepository.js';
import { tacticalEngine } from '../Engine/Tactical/TacticalEngine.js';
import { viewBox, floorSvg, overlaySvg, objectsSvg } from './tacticalBoardSvg.js';

const TEAM_LABEL = ['Joueur 1 (bleu)', 'Joueur 2 (rouge)'];
const TEAM_CLASS = ['teamA', 'teamB'];

// Mode tactique (docs/spec-tactical.md, lots 1–2) : choix des classes, placement, sorts, 2 joueurs sur le même écran
export class TacticalView extends Component {
    #classes   = TacticalClassesRepository.findAll();
    #picked    = ['iop', 'cra']; // classes choisies pour les joueurs 1 et 2
    #spellId   = null;           // sort sélectionné ; null = un clic déplace
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
                    <div class="spellBar" id="t-spells"></div>
                    <div class="groupBtnRow menuBtn">
                        <button class="btn" id="t-ready">Prêt</button>
                        <button class="btn hidden" id="t-end">Fin du tour</button>
                        <button class="btn" id="t-menu">Menu</button>
                    </div>
                </div>

                <div class="modalRules" id="t-modal-classes">
                    <div class="modalContent borderPixel classPicker">
                        <h2 class="rulesTitle">Choix des classes</h2>
                        ${[0, 1].map(team => `
                            <div class="classRow">
                                <div class="classRowLabel"><span class="tTeamDot ${TEAM_CLASS[team]}"></span>${TEAM_LABEL[team]}</div>
                                <div class="classChoices" role="radiogroup" aria-label="Classe du ${TEAM_LABEL[team]}">
                                    ${this.#classes.map(c => `
                                        <button class="classChoice" data-team="${team}" data-class="${c.id}" role="radio" aria-checked="false"
                                                title="${c.name} (${c.role}) : ${c.health} PV, initiative ${c.initiative}">
                                            <img src="${AssetManager.player(c)}" alt="">
                                            <span>${c.name}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                        <div class="groupBtnRow confirmBtns">
                            <button class="btn" id="t-classes-ok">Placer les personnages</button>
                        </div>
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
        this.listen('tactical:initiative', ({ activeIndex, initiatives }) => {
            const other = initiatives[1 - activeIndex];
            this.#log(`${this.#name(activeIndex)} a l'initiative (${initiatives[activeIndex]} contre ${other}) et commence.`);
        });
        this.listen('tactical:spell', (payload) => this.#log(this.#spellMessage(payload)));
        this.listen('tactical:turn', ({ activeIndex, turn }) => {
            if (turn > 1) this.#log(`À ${this.#name(activeIndex)} de jouer.`);
        });
        this.listen('tactical:over', ({ winnerIndex }) => {
            this.query('#t-winner').textContent = `${this.#name(winnerIndex)} remporte le combat !`;
            this.query('#t-modal-over').classList.remove('hidden');
            this.query('#t-replay').focus();
        });

        const board = this.query('#t-board');
        board.addEventListener('click', (e) => this.#clickCell(this.#cellId(e.target)));
        board.addEventListener('pointermove', (e) => this.#hover(this.#cellId(e.target)));
        board.addEventListener('pointerleave', () => this.#hover(null));

        this.query('#t-spells').addEventListener('click', (e) => {
            const button = e.target.closest('[data-spell]');
            if (!button || button.disabled) return;
            this.#spellId = this.#spellId === button.dataset.spell ? null : button.dataset.spell;
            this.#refresh();
        });

        this.query('#t-ready').addEventListener('click', () => tacticalEngine.ready());
        this.query('#t-end').addEventListener('click', () => {
            this.#spellId = null;
            tacticalEngine.endTurn();
        });

        // Choix des classes
        this.query('.classPicker').addEventListener('click', (e) => {
            const choice = e.target.closest('.classChoice');
            if (!choice) return;
            this.#picked[Number(choice.dataset.team)] = choice.dataset.class;
            this.#showPicked();
        });
        this.query('#t-classes-ok').addEventListener('click', () => {
            this.query('#t-modal-classes').classList.add('hidden');
            this.#newFight();
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
            this.query('#t-modal-classes').classList.remove('hidden');
            this.query('#t-classes-ok').focus();
        });

        // Échap : annule le sort sélectionné, ferme la confirmation de sortie
        this.#onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            this.query('#t-modal-quit').classList.add('hidden');
            if (this.#spellId) {
                this.#spellId = null;
                this.#refresh();
            }
        };
        document.addEventListener('keydown', this.#onKeydown);

        // Plateau visible derrière la fenêtre de choix des classes
        this.#showPicked();
        this.#newFight();
        this.query('#t-classes-ok').focus();
    }

    onUnmount() {
        document.removeEventListener('keydown', this.#onKeydown);
        store.reset();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #newFight() {
        this.#spellId = null;
        this.#log('Placement : clique sur une case bleue ou rouge pour placer chaque personnage, puis « Prêt ».');
        tacticalEngine.start({ classes: [...this.#picked] });
    }

    #showPicked() {
        for (const choice of this.queryAll('.classChoice')) {
            const on = this.#picked[Number(choice.dataset.team)] === choice.dataset.class;
            choice.classList.toggle('picked', on);
            choice.setAttribute('aria-checked', String(on));
        }
    }

    #clickCell(id) {
        const tactical = store.state.tactical;
        if (id === null || !tactical) return;
        if (tactical.phase === 'placement') {
            tacticalEngine.place(id);
        } else if (this.#spellId) {
            const spellId = this.#spellId;
            this.#spellId = null;
            tacticalEngine.cast(spellId, id);
            this.#refresh(); // le sort est désélectionné même si le lancer est refusé
        } else {
            tacticalEngine.move(id);
        }
    }

    #drawAll() {
        const { board } = store.state.tactical;
        this.query('#t-board').setAttribute('viewBox', viewBox(board));
        this.query('#t-floor').innerHTML = floorSvg(board);
        this.#refresh();
    }

    #refresh() {
        const tactical = store.state.tactical;
        if (!tactical || !this.query('#t-floor').childElementCount) return;
        const fighting = tactical.phase === 'fighting';
        const active = tactical.fighters[tactical.activeIndex];

        if (this.#spellId && !tactical.spells[this.#spellId]?.available) this.#spellId = null;
        this.query('#t-overlay').innerHTML = overlaySvg(tactical, { spellId: this.#spellId, hoverId: this.#hoverId });
        this.query('#t-objects').innerHTML = objectsSvg(tactical);
        this.query('#t-board').classList.toggle('targeting', !!this.#spellId);

        this.query('#t-fighters').innerHTML = tactical.fighters
            .map((f, i) => this.#fighterCard(f, i === tactical.activeIndex && fighting))
            .join('');

        this.query('#t-spells').innerHTML = fighting ? active.spells.map(s => this.#spellButton(s, tactical.spells[s.id])).join('') : '';
        this.query('#t-ready').classList.toggle('hidden', tactical.phase !== 'placement');
        this.query('#t-end').classList.toggle('hidden', tactical.phase === 'placement');
        this.query('#t-end').disabled = !fighting;
    }

    #hover(id) {
        if (id === this.#hoverId) return;
        this.#hoverId = id;
        const tactical = store.state.tactical;
        if (tactical) this.query('#t-overlay').innerHTML = overlaySvg(tactical, { spellId: this.#spellId, hoverId: id });
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

    #spellMessage({ casterIndex, spellName, results }) {
        const parts = results.map(({ fighterIndex, kind, amount }) => {
            const who = this.#name(fighterIndex);
            switch (kind) {
                case 'damage':     return `−${amount} PV à ${who}`;
                case 'heal':       return `+${amount} PV pour ${who}`;
                case 'push':       return amount ? `${who} repoussé de ${amount} case${amount > 1 ? 's' : ''}` : `${who} ne bouge pas`;
                case 'pull':       return amount ? `${who} attiré de ${amount} case${amount > 1 ? 's' : ''}` : `${who} ne bouge pas`;
                case 'teleport':   return `${who} bondit`;
                case 'swap':       return `échange de place avec ${who}`;
                case 'pa':         return `${who} : ${amount > 0 ? '+' : '−'}${Math.abs(amount)} PA au prochain tour`;
                case 'punishment': return `${who} : Châtiment pendant ${amount} tours`;
                default:           return '';
            }
        });
        return `${this.#name(casterIndex)} lance ${spellName}${parts.length ? ' : ' + parts.join(', ') : ' : aucune cible'}.`;
    }

    #spellButton(spell, options) {
        const selected = this.#spellId === spell.id;
        const wait = options.cooldown ? ` (${options.cooldown})` : '';
        return `
            <button class="btn spellBtn ${selected ? 'btn-active' : ''}" data-spell="${spell.id}" aria-pressed="${selected}"
                    title="${this.#spellDescription(spell)}" ${options.available ? '' : 'disabled'}>
                ${spell.name}<span class="spellCost">${spell.cost} PA${wait}</span>
            </button>
        `;
    }

    #spellDescription(spell) {
        const range = spell.target === 'self' ? 'sur soi' : `portée ${spell.minRange}–${spell.maxRange}`;
        const flags = [
            spell.target !== 'self' && !spell.los ? 'sans ligne de vue' : '',
            spell.inLine ? 'en ligne' : '',
            spell.area ? `zone ${spell.area}` : '',
            `${spell.perTurn} par tour`,
            spell.cooldown ? `relance ${spell.cooldown} tours` : '',
        ].filter(Boolean);
        const effects = spell.effects.map(e => ({
            damage:     `dégâts ${e.min}–${e.max}`,
            heal:       `soin ${e.min}–${e.max}`,
            lifesteal:  `rend ${Math.round(e.ratio * 100)} % des dégâts`,
            push:       `repousse de ${e.cells}`,
            pull:       `attire de ${e.cells}`,
            teleport:   'téléporte sur la case',
            swap:       'échange les places',
            pa:         `${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} PA au prochain tour`,
            punishment: `+10 % de dégâts par coup reçu (${e.turns} tours)`,
        })[e.type]);
        return `${spell.name} : ${spell.cost} PA, ${range}, ${flags.join(', ')}. ${effects.join(', ')}.`;
    }

    #fighterCard(f, isActive) {
        const status = [
            f.paNext ? `${f.paNext > 0 ? '+' : '−'}${Math.abs(f.paNext)} PA au prochain tour` : '',
            f.punishment ? `Châtiment +${f.punishment.stacks * 10} % (${f.punishment.turns} t.)` : '',
        ].filter(Boolean).join(' · ');
        return `
            <div class="playerCard borderPixel ${isActive ? 'active' : ''}">
                <div class="playerTopInfos">
                    <img class="playerImg" src="${AssetManager.player(f)}" alt="${f.name}">
                    <div class="playerInfos">
                        <div class="playerName"><span class="tTeamDot ${TEAM_CLASS[f.team]}"></span>${f.name}</div>
                        <div class="playerHealth">PV ${f.health} / ${f.maxHealth} · <span class="tPA">PA ${f.pa}</span> · <span class="tPM">PM ${f.pm}</span></div>
                        ${status ? `<div class="playerClass">${status}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
}
