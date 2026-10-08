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
            setTimeout(() => this.#setBannerActionChoice(attacker, target), 1000);
        });

        this.listen('fight:attack', ({ attacker, target, damage, critical, dodged }) => {
            this.#setBannerDamage(attacker, target, damage, { critical, dodged });
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
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="${attacker.player.name}">
                ${attacker.player.name} lance le combat contre ${target.player.name} !
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="${target.player.name}">
            </h2>
        `;
    }

    #setBannerActionChoice(attacker, target) {
        // Tour de l'IA : pas de boutons, AIEngine choisit l'action
        const actions = attacker.player.isAI
            ? `${attacker.player.name} réfléchit…`
            : `<button class="btn" id="btn-attack">Attaquer</button>
               <button class="btn" id="btn-defend">Se défendre</button>`;

        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="${attacker.player.name}">
                ${this.#hp(attacker)}
                <span class="battleActions">${actions}</span>
                ${this.#hp(target)}
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="${target.player.name}">
            </h2>
        `;
        if (attacker.player.isAI) return;

        this.root.querySelector('#btn-attack').addEventListener('click', () => fightEngine.attack());
        this.root.querySelector('#btn-defend').addEventListener('click', () => fightEngine.defend());
    }

    // Résultat d'une attaque : esquive (Chance de la cible), coup critique (Agilité de l'attaquant) ou coup normal
    #setBannerDamage(attacker, target, damage, { critical = false, dodged = false } = {}) {
        const text = dodged
            ? `${target.player.name} <span class="bannerDodge">esquive</span> l'attaque de ${attacker.player.name} !`
            : `${critical ? '<span class="bannerCritical">Coup critique !</span> ' : ''}${attacker.player.name} inflige
                <span class="bannerDmg">${damage}</span>
                dégâts à ${target.player.name} !`;

        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="${attacker.player.name}">
                ${text}
                ${this.#hp(target)}
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="${target.player.name}">
            </h2>
        `;
    }

    #setBannerDefend(attacker, target) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(attacker.player)}" alt="${attacker.player.name}">
                ${attacker.player.name} se défend ! Au tour de ${target.player.name}.
            </h2>
        `;
    }

    // Message de victoire et choix de la suite affichés ensemble
    #setBannerWin(winner) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(winner.player)}" alt="${winner.player.name}">
                ${winner.player.name} remporte le duel !
                <span class="battleActions">
                    <button class="btn" id="btn-new-game">Nouvelle partie</button>
                    <button class="btn" id="btn-exit">Quitter</button>
                </span>
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

    // Points de vie affichés pendant le combat
    #hp(playerInfo) {
        return `<span class="bannerHp">${playerInfo.player.health} PV</span>`;
    }
}
