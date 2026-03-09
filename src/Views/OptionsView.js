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

export class OptionsView extends Component {
    #config = { ...store.state.config };

    render() {
        return `
            <div class="mainMenu">
                <div class="title h150px fatFont">Board Game Reborn</div>
                <div class="menuSelectOptions">
                    ${OPTIONS.map((opt, i) => `
                        <div class="nb-spinner-${i}">
                            <div class="whiteFont">${opt.label}</div>
                            <button class="btn borderPixel fatFont" data-key="${opt.key}" data-action="increment">+</button>
                            <input disabled class="spinner" type="text"
                                value="${this.#config[opt.key] ?? opt.default}"
                                data-key="${opt.key}"
                                data-min="${opt.min}"
                                data-max="${opt.max}">
                            <button class="btn borderPixel fatFont" data-key="${opt.key}" data-action="decrement">-</button>
                        </div>
                    `).join('')}
                </div>
                <div class="flex h150px">
                    <button class="btn borderPixel fatFont" id="btn-start">Lancer le combat</button>
                    <button class="btn borderPixel fatFont" id="btn-back">Retour</button>
                </div>
            </div>
        `;
    }

    onMount() {
        // Event delegation — un seul listener pour tous les spinners
        this.root.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const key    = btn.dataset.key;
            const action = btn.dataset.action;
            const input  = this.query(`input[data-key="${key}"]`);
            const min    = parseInt(input.dataset.min);
            const max    = parseInt(input.dataset.max);
            let   val    = parseInt(input.value);

            if (action === 'increment' && val < max) val++;
            if (action === 'decrement' && val > min) val--;

            input.value = val;
            this.#config[key] = val;
        });

        this.query('#btn-start').addEventListener('click', () => {
            store.setState(() => ({ config: { ...this.#config } }));
            router.navigate('game');
        });

        this.query('#btn-back').addEventListener('click', () => router.navigate('menu'));
    }
}
