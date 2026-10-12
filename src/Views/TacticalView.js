import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';
import { AssetManager } from '../AssetManager.js';
import { TacticalClassesRepository } from '../Repository/TacticalClassesRepository.js';
import { tacticalEngine } from '../Engine/Tactical/TacticalEngine.js';
import { tacticalAIEngine } from '../Engine/Tactical/TacticalAIEngine.js';
import { viewBox, floorSvg, overlaySvg, objectsSvg } from './tacticalBoardSvg.js';

const TEAM_LABEL = ['Joueur 1 (bleu)', 'Joueur 2 (rouge)'];
const TEAM_CLASS = ['teamA', 'teamB'];
const CONTROLLERS = [{ id: 'human', label: 'Humain' }, { id: 'normal', label: 'IA Normal' }];
const ELEMENT_LABEL = { neutral: 'neutres', earth: 'terre', fire: 'feu', water: 'eau', air: 'air' };

// Mode tactique (docs/spec-tactical.md, lots 1–2) : choix des classes, placement, sorts, 2 joueurs sur le même écran
export class TacticalView extends Component {
    #classes   = TacticalClassesRepository.findAll();
    #picked    = ['iop', 'cra']; // classes choisies pour les joueurs 1 et 2
    #controllers = ['human', 'normal']; // 'human' ou agent d'IA (TACTICAL_AGENTS), joueurs 1 et 2
    #spellId   = null;           // sort sélectionné ; null = un clic déplace
    #hoverId   = null;
    #lastLog   = '';
    #logParts  = [];
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
                                <div class="classRowHead">
                                    <div class="classRowLabel"><span class="tTeamDot ${TEAM_CLASS[team]}"></span>${TEAM_LABEL[team]}</div>
                                    <div class="controllerChoices" role="radiogroup" aria-label="Contrôle du ${TEAM_LABEL[team]}">
                                        ${CONTROLLERS.map(c => `<button class="controllerChoice" data-team="${team}" data-controller="${c.id}" role="radio" aria-checked="false">${c.label}</button>`).join('')}
                                    </div>
                                </div>
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
        this.listen('tactical:dodged', ({ fighterIndex, chance }) => {
            this.#log(`${this.#name(fighterIndex)} esquive le tacle (${Math.round(chance * 100)} %).`);
        });
        this.listen('tactical:tackled', ({ fighterIndex, chance }) => {
            this.#log(`${this.#name(fighterIndex)} est taclé (${Math.round(chance * 100)} % d'esquive) et perd ses PM.`);
        });
        this.listen('tactical:sudden-death', ({ fighterIndex, damage }) => {
            this.#log(`Mort subite ! ${this.#name(fighterIndex)} perd ${damage} PV.`);
        });
        this.listen('tactical:initiative', ({ activeIndex, initiatives }) => {
            const other = initiatives[1 - activeIndex];
            this.#log(`${this.#name(activeIndex)} a l'initiative (${initiatives[activeIndex]} contre ${other}) et commence.`);
        });
        this.listen('tactical:spell', (payload) => this.#log(this.#spellMessage(payload)));
        this.listen('tactical:turn', ({ activeIndex, turn }) => {
            const ai = store.state.tactical?.fighters[activeIndex].controller !== 'human';
            if (ai) this.#log(`${this.#name(activeIndex)} (IA) réfléchit…`);
            else if (turn > 1) this.#log(`À ${this.#name(activeIndex)} de jouer.`);
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
            const controller = e.target.closest('.controllerChoice');
            if (choice) this.#picked[Number(choice.dataset.team)] = choice.dataset.class;
            if (controller) this.#controllers[Number(controller.dataset.team)] = controller.dataset.controller;
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

        // L'IA écoute avant le premier combat (elle place ses personnages dès tactical:started)
        tacticalAIEngine.start();

        // Plateau visible derrière la fenêtre de choix des classes
        this.#showPicked();
        this.#newFight();
        this.query('#t-classes-ok').focus();
    }

    onUnmount() {
        document.removeEventListener('keydown', this.#onKeydown);
        tacticalAIEngine.stop();
        store.reset();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #newFight() {
        this.#spellId = null;
        this.#log(this.#controllers.every(c => c !== 'human')
            ? 'Placement automatique des IA : « Prêt » lance le combat.'
            : 'Placement : clique sur une case de ta couleur pour placer ton personnage, puis « Prêt ».');
        tacticalEngine.start({ classes: [...this.#picked], controllers: [...this.#controllers] });
    }

    #showPicked() {
        for (const choice of this.queryAll('.classChoice, .controllerChoice')) {
            const team = Number(choice.dataset.team);
            const on = choice.dataset.class ? this.#picked[team] === choice.dataset.class : this.#controllers[team] === choice.dataset.controller;
            choice.classList.toggle('picked', on);
            choice.setAttribute('aria-checked', String(on));
        }
    }

    #clickCell(id) {
        const tactical = store.state.tactical;
        if (id === null || !tactical) return;
        if (tactical.phase === 'placement') {
            // Seulement les cases d'un personnage humain (l'IA place les siens)
            const team = tactical.board.cells[id].placement;
            if (tactical.fighters.find(f => f.team === team)?.controller === 'human') tacticalEngine.place(id);
        } else if (!this.#humanTurn(tactical)) {
            return;
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
        const human = this.#humanTurn(tactical);

        if (this.#spellId && (!human || !tactical.spells[this.#spellId]?.available)) this.#spellId = null;
        this.query('#t-overlay').innerHTML = this.#overlay(tactical);
        this.query('#t-objects').innerHTML = objectsSvg(tactical);
        this.query('#t-board').classList.toggle('targeting', !!this.#spellId);

        this.query('#t-fighters').innerHTML = tactical.fighters
            .map((f, i) => this.#fighterCard(f, i === tactical.activeIndex && fighting))
            .join('');

        this.query('#t-spells').innerHTML = human ? active.spells.map(s => this.#spellButton(s, tactical.spells[s.id])).join('') : '';
        this.query('#t-ready').classList.toggle('hidden', tactical.phase !== 'placement');
        this.query('#t-end').classList.toggle('hidden', tactical.phase === 'placement');
        this.query('#t-end').disabled = !human;
    }

    // Tour d'un joueur humain : seul moment où les clics sur le plateau et les sorts agissent
    #humanTurn(tactical) {
        return tactical.phase === 'fighting' && tactical.fighters[tactical.activeIndex].controller === 'human';
    }

    // Pendant le tour de l'IA, pas de cases atteignables ni de portée affichées
    #overlay(tactical) {
        if (tactical.phase === 'fighting' && !this.#humanTurn(tactical)) return '';
        return overlaySvg(tactical, { spellId: this.#spellId, hoverId: this.#hoverId });
    }

    #hover(id) {
        if (id === this.#hoverId) return;
        this.#hoverId = id;
        const tactical = store.state.tactical;
        if (!tactical) return;
        this.query('#t-overlay').innerHTML = this.#overlay(tactical);

        // Chemin qui quitte le contact de l'ennemi : chance d'esquiver le tacle affichée tant que le pointeur est dessus
        const rolls = !this.#spellId && this.#humanTurn(tactical) && tactical.tackle?.rolls[id];
        this.query('#t-log').textContent = rolls
            ? `Quitter le contact : ${Math.round(tactical.tackle.chance * 100)} % d'esquive${rolls > 1 ? ` (${rolls} fois)` : ''}, sinon tous les PM sont perdus.`
            : this.#lastLog;
    }

    #cellId(target) {
        const el = target.closest?.('[data-cell]');
        return el ? Number(el.dataset.cell) : null;
    }

    #name(index) {
        return store.state.tactical?.fighters[index]?.name ?? '';
    }

    // Les messages des événements d'une même action (émis à la suite) sont réunis sur une ligne
    #log(text) {
        if (!this.#logParts.length) {
            queueMicrotask(() => {
                this.#lastLog = this.#logParts.join(' ');
                this.#logParts = [];
                const log = this.query('#t-log');
                if (log) log.textContent = this.#lastLog;
            });
        }
        this.#logParts.push(text);
    }

    #spellMessage({ casterIndex, spellName, critical, results }) {
        const parts = results.map(({ fighterIndex, kind, amount, damage }) => {
            const who = this.#name(fighterIndex);
            const hit = damage ? ` et se cogne (−${damage} PV)` : '';
            switch (kind) {
                case 'damage':     return `−${amount} PV à ${who}`;
                case 'heal':       return `+${amount} PV pour ${who}`;
                case 'push':       return amount ? `${who} repoussé de ${amount} case${amount > 1 ? 's' : ''}${hit}` : `${who} ne bouge pas${hit}`;
                case 'pull':       return amount ? `${who} attiré de ${amount} case${amount > 1 ? 's' : ''}` : `${who} ne bouge pas`;
                case 'teleport':   return `${who} bondit`;
                case 'swap':       return `échange de place avec ${who}`;
                case 'pa':         return `${who} : ${amount > 0 ? '+' : '−'}${Math.abs(amount)} PA au prochain tour`;
                case 'punishment': return `${who} : Châtiment pendant ${amount} tours`;
                default:           return '';
            }
        });
        const crit = critical ? ' Coup critique !' : '';
        return `${this.#name(casterIndex)} lance ${spellName}${parts.length ? ' : ' + parts.join(', ') : ' : aucune cible'}.${crit}`;
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
            spell.critRate ? `critique 1/${spell.critRate} avant Agilité` : '',
        ].filter(Boolean);
        const crit = e => e.crit ? ` (+${e.crit} sur un critique)` : '';
        const effects = spell.effects.map(e => ({
            damage:     `dégâts ${ELEMENT_LABEL[e.element]} ${e.min}–${e.max}${crit(e)}`,
            heal:       `soin ${e.min}–${e.max}${crit(e)}`,
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
                        <div class="playerName"><span class="tTeamDot ${TEAM_CLASS[f.team]}"></span>${f.name}${f.controller !== 'human' ? ' <span class="ai-badge">IA</span>' : ''}</div>
                        <div class="playerHealth">PV ${f.health} / ${f.maxHealth} · <span class="tPA">PA ${f.pa}</span> · <span class="tPM">PM ${f.pm}</span></div>
                        <div class="playerStats" title="Force (terre, neutre) · Intelligence (feu, soins) · Chance (eau) · Agilité (air, critiques, esquive)">FOR ${f.stats.strength} · INT ${f.stats.intelligence} · CHA ${f.stats.chance} · AGI ${f.stats.agility}</div>
                        ${status ? `<div class="playerClass">${status}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
}
