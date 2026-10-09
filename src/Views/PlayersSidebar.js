import { Component } from '../core/Component.js';
import { store } from '../core/Store.js';
import { AssetManager } from '../AssetManager.js';
import { WEAPON_TYPE_LABEL } from '../Models/Weapon.js';

export class PlayersSidebar extends Component {

    onMount() {
        this.listen('game:started', () => {
            const { players, activePlayerIndex } = store.state;
            this.#render(players, activePlayerIndex);
        });

        // Mise à jour lors de chaque changement d'état (HP, arme, tour actif)
        this.listen('state:changed', ({ players, activePlayerIndex, phase }) => {
            if (phase === 'playing' || phase === 'fighting') {
                this.#render(players, activePlayerIndex);
            }
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #render(players, activePlayerIndex) {
        this.root.innerHTML = players
            .map((info, i) => this.#playerCardTemplate(info.player, i === activePlayerIndex))
            .join('');
    }

    #playerCardTemplate(player, isActive) {
        return `
            <div class="playerCard borderPixel ${isActive ? 'active' : ''}">
                <div class="playerTopInfos">
                    <img class="playerImg" src="${AssetManager.player(player)}" alt="${player.name}">
                    <div class="playerInfos">
                        <div class="playerName">
                            ${player.name}
                            ${player.isAI ? '<span class="ai-badge">IA</span>' : ''}
                        </div>
                        <div class="playerHealth">Points de vie : ${player.health}</div>
                        <div class="playerMaxMove">PM : ${player.maxMove}</div>
                        <div class="playerStats" title="Force · Agilité · Intelligence · Chance">
                            FOR ${player.strength} · AGI ${player.agility} · INT ${player.intelligence} · CHA ${player.luck}
                        </div>
                    </div>
                </div>
                <div class="playerWeapon">
                    <img class="playerWeaponImg" src="${AssetManager.weapon(player.weapon)}" alt="${player.weapon.name}">
                    <div class="playerWeaponName">
                        ${player.weapon.name} <span class="red">${player.weapon.damage}</span> (${WEAPON_TYPE_LABEL[player.weapon.type]})
                    </div>
                </div>
            </div>
        `;
    }
}
