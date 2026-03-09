import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';

class FightEngine {

    attack() {
        const { fight, players, phase } = store.state;
        if (!fight || phase !== 'fighting') return;

        const { attackerIndex, targetIndex } = fight;
        const attacker = players[attackerIndex];
        const target   = players[targetIndex];

        let damage = attacker.player.weapon.damage;

        // La défense divise les dégâts par 2
        if (target.player.defense) damage = Math.floor(damage / 2);

        const newHealth = Math.max(0, target.player.health - damage);

        const newPlayers = players.map((p, i) => {
            if (i === targetIndex)  return { ...p, player: { ...p.player, health: newHealth, defense: false } };
            if (i === attackerIndex) return { ...p, player: { ...p.player, defense: false } };
            return p;
        });

        store.setState(() => ({ players: newPlayers }));

        eventBus.emit('fight:attack', {
            attacker: newPlayers[attackerIndex],
            target:   newPlayers[targetIndex],
            damage,
        });

        setTimeout(() => this.#checkVictory(attackerIndex, targetIndex), 500);
    }

    defend() {
        const { fight, players, phase } = store.state;
        if (!fight || phase !== 'fighting') return;

        const { attackerIndex, targetIndex } = fight;

        const newPlayers = players.map((p, i) =>
            i === attackerIndex ? { ...p, player: { ...p.player, defense: true } } : p
        );

        store.setState(() => ({ players: newPlayers }));

        eventBus.emit('fight:defend', {
            attacker: newPlayers[attackerIndex],
            target:   newPlayers[targetIndex],
        });

        setTimeout(() => this.#checkVictory(attackerIndex, targetIndex), 500);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #checkVictory(attackerIndex, targetIndex) {
        const { players } = store.state;
        const attacker = players[attackerIndex];
        const target   = players[targetIndex];

        if (target.player.health <= 0) {
            store.setState(() => ({ phase: 'gameover', fight: null }));
            eventBus.emit('fight:end', { winner: attacker, loser: target });
        } else {
            // Échange les rôles pour le round suivant
            store.setState(() => ({
                phase: 'fighting',
                fight: { attackerIndex: targetIndex, targetIndex: attackerIndex },
            }));
            eventBus.emit('fight:round-end', {
                nextAttacker: target,
                nextTarget:   attacker,
            });
        }
    }
}

export const fightEngine = new FightEngine();
