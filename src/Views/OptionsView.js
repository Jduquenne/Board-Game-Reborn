import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { store } from '../core/Store.js';

// Ajouter une option ici suffit — le rendu est automatique
const OPTIONS = [
    { key: 'rows',        label: 'Hauteur du plateau',   min: 7, max: 12, default: 10 },
    { key: 'cols',        label: 'Largeur du plateau',    min: 7, max: 12, default: 10 },
    { key: 'nbObstacles', label: "Nombre d'obstacles",   min: 7, max: 20, default: 10 },
    { key: 'nbWeapons',   label: "Nombre d'armes",        min: 1, max: 5,  default: 3  },
    { key: 'nbBonus',     label: 'Nombre de bonus',       min: 1, max: 5,  default: 3  },
    { key: 'nbTraps',     label: 'Nombre de pièges',      min: 1, max: 5,  default: 3  },
];

const AI_MODES = [
    { key: 'none',   label: '2 Joueurs' },
    { key: 'easy',   label: 'IA Facile'  },
    { key: 'normal', label: 'IA Normal'  },
];

export class OptionsView extends Component {
    #config = { ...store.state.config };

    render() {
        return `
            <div class="mainMenu options-view">
                <div class="title gameTitle">Board Game Reborn</div>

                <div class="optionsGrid">
                    ${OPTIONS.map(opt => this.#optionTemplate(opt)).join('')}
                </div>

                <div class="ai-mode-selector">
                    <span class="optionLabel whiteFont">Mode de jeu</span>
                    <div class="groupBtnRow">
                        ${AI_MODES.map(m => `
                            <button
                                class="btn borderPixel ${this.#config.aiMode === m.key ? 'btn-active' : ''}"
                                data-ai="${m.key}">
                                ${m.label}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="optionsActions">
                    <button class="btn borderPixel fatFont" id="btn-start">Lancer le combat</button>
                    <button class="btn borderPixel fatFont" id="btn-back">Retour</button>
                </div>
            </div>
        `;
    }

    onMount() {
        // Event delegation — gère les boutons +/− ET les boutons de mode IA
        this.root.addEventListener('click', (e) => {
            // Boutons +/− : la valeur reste entre min et max, le bouton est désactivé à la limite
            const stepBtn = e.target.closest('[data-action]');
            if (stepBtn) {
                const opt     = OPTIONS.find(o => o.key === stepBtn.dataset.key);
                const current = this.#config[opt.key] ?? opt.default;
                const next    = stepBtn.dataset.action === 'increment'
                    ? Math.min(current + 1, opt.max)
                    : Math.max(current - 1, opt.min);

                this.#config[opt.key] = next;
                this.query(`output[data-key="${opt.key}"]`).textContent = next;
                this.query(`[data-key="${opt.key}"][data-action="decrement"]`).disabled = next <= opt.min;
                this.query(`[data-key="${opt.key}"][data-action="increment"]`).disabled = next >= opt.max;
                return;
            }

            // Mode IA
            const aiBtn = e.target.closest('[data-ai]');
            if (aiBtn) {
                this.#config.aiMode = aiBtn.dataset.ai;
                // Met à jour l'état visuel de tous les boutons de mode
                this.queryAll('[data-ai]').forEach(btn => {
                    btn.classList.toggle('btn-active', btn.dataset.ai === this.#config.aiMode);
                });
            }
        });

        this.query('#btn-start').addEventListener('click', () => {
            store.setState(() => ({ config: { ...this.#config } }));
            router.navigate('game');
        });

        this.query('#btn-back').addEventListener('click', () => router.navigate('menu'));
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #optionTemplate(opt) {
        const value = this.#config[opt.key] ?? opt.default;

        return `
            <div class="optionItem">
                <span class="optionLabel whiteFont" id="label-${opt.key}">${opt.label}</span>
                <div class="optionControl">
                    <button class="btn borderPixel stepBtn" data-key="${opt.key}" data-action="decrement"
                        aria-label="Diminuer : ${opt.label}" ${value <= opt.min ? 'disabled' : ''}>−</button>
                    <output class="spinner" data-key="${opt.key}" aria-labelledby="label-${opt.key}" aria-live="polite">${value}</output>
                    <button class="btn borderPixel stepBtn" data-key="${opt.key}" data-action="increment"
                        aria-label="Augmenter : ${opt.label}" ${value >= opt.max ? 'disabled' : ''}>+</button>
                </div>
            </div>
        `;
    }
}
