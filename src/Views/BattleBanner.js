import { Component } from '../core/Component.js';
import { fightEngine } from '../Engine/FightEngine.js';
import { fleeChance, fleeDestination, castableSpells, healAmount, SPELL_COST, ROOT_ACTIONS } from '../Engine/Rules.js';
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

        this.listen('fight:flee', ({ fleer, enemy, success }) => {
            this.#setFleeSelecting(false);
            this.#setBannerFlee(fleer, enemy, success);
        });

        this.listen('fight:spell', ({ caster, target, spell, amount }) => {
            this.#setBannerSpell(caster, target, spell, amount);
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

        // Fin de partie hors combat (mort subite) : même écran de victoire, après la bannière de dégâts
        this.listen('game:over', ({ winner }) => {
            setTimeout(() => {
                this.#showModal();
                this.#setBannerWin(winner, 'remporte la partie');
            }, 1500);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #showModal() {
        document.querySelector('#battle-modal').classList.remove('hidden');
    }

    #hideModal() {
        document.querySelector('#battle-modal').classList.add('hidden');
        this.#setFleeSelecting(false);
        this.root.innerHTML = '';
    }

    // Choix de la fuite : la bannière se range en haut et le plateau redevient cliquable
    #setFleeSelecting(on) {
        document.querySelector('#battle-modal')?.classList.toggle('fleeSelecting', on);
    }

    #setBannerFleeChoice(attacker, target) {
        if (!fightEngine.startFleeSelection()) return; // aucune case de repli
        this.#setFleeSelecting(true);

        const chance = Math.round(fleeChance(attacker.player, target.player) * 100);
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                Choisis ta case de repli (cases vertes) — ${chance} % de chances de fuir
                <span class="battleActions"><button class="btn" id="btn-flee-cancel">Annuler</button></span>
            </h2>
        `;
        this.root.querySelector('#btn-flee-cancel').addEventListener('click', () => {
            fightEngine.cancelFleeSelection();
            this.#setFleeSelecting(false);
            this.#setBannerActionChoice(attacker, target);
        });
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
        // Fuite : chance affichée (Chance contre tacle adverse), bouton absent sans case de repli
        // Sorts (lot 8) : boutons seulement s'ils sont lançables (mana suffisant, Soin inutile à PV pleins)
        const canFlee = !!fleeDestination(store.state);
        const chance  = Math.round(fleeChance(attacker.player, target.player) * 100);
        const spells  = castableSpells(store.state);
        const actions = attacker.player.isAI
            ? `${attacker.player.name} réfléchit…`
            : `<button class="btn" id="btn-attack">Attaquer</button>
               <button class="btn" id="btn-defend">Se défendre</button>
               ${canFlee ? `<button class="btn" id="btn-flee" title="Ta Chance contre son tacle (Agilité)">Fuir (${chance} %)</button>` : ''}
               ${spells.includes('heal') ? `<button class="btn" id="btn-heal" title="${SPELL_COST} mana : rend ${healAmount(attacker.player)} PV">Soin</button>` : ''}
               ${spells.includes('root') ? `<button class="btn" id="btn-root" title="${SPELL_COST} mana : ${target.player.name} ne peut plus fuir pendant ${ROOT_ACTIONS} actions">Entrave</button>` : ''}`;

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
        this.root.querySelector('#btn-flee')?.addEventListener('click', () => this.#setBannerFleeChoice(attacker, target));
        this.root.querySelector('#btn-heal')?.addEventListener('click', () => fightEngine.castSpell('heal'));
        this.root.querySelector('#btn-root')?.addEventListener('click', () => fightEngine.castSpell('root'));
    }

    // Sort lancé (lot 8) : Soin ou Entrave
    #setBannerSpell(caster, target, spell, amount) {
        const text = spell === 'heal'
            ? `${caster.player.name} se soigne : <span class="bannerDodge">+${amount} PV</span> !`
            : `${caster.player.name} entrave ${target.player.name} : <span class="bannerDmg">plus de fuite</span> pendant ${amount} actions !`;
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(caster.player)}" alt="${caster.player.name}">
                ${text}
                <img class="targetImg" src="${AssetManager.player(target.player)}" alt="${target.player.name}">
            </h2>
        `;
    }

    // Résultat d'une tentative de fuite ; réussie, le combat est fini et la bannière se ferme
    #setBannerFlee(fleer, enemy, success) {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(fleer.player)}" alt="${fleer.player.name}">
                ${success
                    ? `${fleer.player.name} <span class="bannerDodge">s'enfuit</span> !`
                    : `${fleer.player.name} tente de fuir… mais ${enemy.player.name} le <span class="bannerDmg">retient</span> !`}
                <img class="targetImg" src="${AssetManager.player(enemy.player)}" alt="${enemy.player.name}">
            </h2>
        `;
        if (success) setTimeout(() => this.#hideModal(), 1200);
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
    #setBannerWin(winner, text = 'remporte le duel') {
        this.root.innerHTML = `
            <h2 class="battleInfosText">
                <img class="attackerImg" src="${AssetManager.player(winner.player)}" alt="${winner.player.name}">
                ${winner.player.name} ${text} !
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
        const { health, mana, maxMana } = playerInfo.player;
        return `<span class="bannerHp">${health} PV${maxMana ? ` · ${mana} mana` : ''}</span>`;
    }
}
