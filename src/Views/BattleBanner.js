import { Component } from '../core/Component.js';
import { fightEngine } from '../Engine/FightEngine.js';
import { gameEngine } from '../Engine/GameEngine.js';
import { store } from '../core/Store.js';
import { AssetManager } from '../AssetManager.js';
import { router } from '../core/Router.js';

export class BattleBanner extends Component {

    onMount() {
        this.listen('fight:start', ({ attacker, target }) => {
            this.#showModal();
            this.#setBannerFightStart(attacker, target);
            setTimeout(() => this.#setBannerActionChoice(attacker), 1000);
        });

        this.listen('fight:attack', ({ attacker, target, damage }) => {
            this.#setBannerDamage(attacker, target, damage);
        });

        this.listen('fight:defend', ({ attacker, target }) => {
            this.#setBannerDefend(attacker, target);
        });

        this.listen('fight:round-end', ({ nextAttacker, nextTarget }) => {
            setTimeout(() => this.#setBannerActionChoice(nextAttacker, nextTarget), 600);
        });

        this.listen('fight:end', ({ winner }) => {
            this.#setBannerWin(winner);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #showModal() {
        document.querySelector('#battle-modal').classList.remove('hidden');
    }

    #hideModal() {
        document.querySelector('#battle-modal').classList.add('hidden');
        this.root.innerHTML = '';
    }

    #setBannerFightStart(attacker, target) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="">
                ${attacker.player.name} lance le combat contre ${target.player.name} !
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="">
            </h2>
        `;
    }

    #setBannerActionChoice(attacker) {
        // Tour de l'IA : pas de boutons, AIEngine choisit l'action
        if (attacker.player.isAI) {
            this.root.innerHTML = `
                <h2 class="battleInfosText">
                    <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="">
                    ${attacker.player.name} réfléchit…
                </h2>
            `;
            return;
        }

        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="">
                <button class="btn" id="btn-attack">Attaquer</button>
                <button class="btn" id="btn-defend">Se défendre</button>
            </h2>
        `;
        this.root.querySelector('#btn-attack').addEventListener('click', () => fightEngine.attack());
        this.root.querySelector('#btn-defend').addEventListener('click', () => fightEngine.defend());
    }

    #setBannerDamage(attacker, target, damage) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="">
                ${attacker.player.name} inflige
                <span class="bannerDmg">${damage}</span>
                dégâts à ${target.player.name} !
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="">
            </h2>
        `;
    }

    #setBannerDefend(attacker, target) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="">
                ${attacker.player.name} se défend ! Au tour de ${target.player.name}.
            </h2>
        `;
    }

    #setBannerWin(winner) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(winner.player)}" alt="">
                ${winner.player.name} remporte le duel ! Félicitations !
            </h2>
        `;
        setTimeout(() => this.#setBannerNewGame(), 1500);
    }

    #setBannerNewGame() {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <button class="btn" id="btn-new-game">Nouvelle partie</button>
                <button class="btn" id="btn-exit">Quitter</button>
            </h2>
        `;
        // Relance une partie en place avec les paramètres de la partie précédente
        this.root.querySelector('#btn-new-game').addEventListener('click', () => {
            this.#hideModal();
            gameEngine.startGame(store.state.config);
        });
        this.root.querySelector('#btn-exit').addEventListener('click', () => {
            this.#hideModal();
            router.navigate('menu');
        });
    }
}
