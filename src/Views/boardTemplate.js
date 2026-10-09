import { AssetManager } from '../AssetManager.js';
import { WEAPON_TYPE_LABEL } from '../Models/Weapon.js';
import { DECOR } from '../Models/Cell.js';

/**
 * HTML du plateau — partagé par le jeu (BoardView) et la page d'entraînement (TrainingView).
 * Affichage uniquement : aucun événement, aucune logique de jeu.
 *
 * @param {object} state                 état de partie ({ cells, players, activePlayerIndex })
 * @param {number} [highlightIndex]      joueur à mettre en évidence (par défaut : le joueur actif)
 */
export function boardHtml({ cells, players, activePlayerIndex }, highlightIndex = activePlayerIndex) {
    const highlighted = players[highlightIndex]?.position;

    return cells.map((row, rowIdx) => `
        <div class="lines" id="line${rowIdx}">
            ${row.map(cell => cellHtml(cell, cell.row === highlighted?.row && cell.col === highlighted?.col)).join('')}
        </div>
    `).join('');
}

function cellHtml(cell, isActivePlayer) {
    const classes   = ['cell'];
    const bgImages  = [];
    let   title     = '';

    // Sol ou obstacle comme fond de base
    if (cell.decor === DECOR.OBSTACLE) {
        classes.push('obstacle');
        bgImages.push(`url('${AssetManager.obstacle()}')`);
    } else {
        bgImages.push(`url('${AssetManager.floor()}')`);
    }

    // Contenu de la cellule (par ordre de priorité visuelle)
    if (cell.player) {
        classes.push('player');
        if (isActivePlayer) classes.push('activePlayer');
        bgImages.unshift(`url('${AssetManager.player(cell.player)}')`);
        title = cell.player.name;
    } else if (cell.weapon) {
        classes.push('weapon');
        bgImages.unshift(`url('${AssetManager.weapon(cell.weapon)}')`);
        title = `${cell.weapon.name} — ${cell.weapon.damage} dégâts, arme ${WEAPON_TYPE_LABEL[cell.weapon.type]}`;
    } else if (cell.bonus) {
        classes.push('bonus');
        bgImages.unshift(`url('${AssetManager.bonus(cell.bonus)}')`);
        title = cell.bonus.name;
    } else if (cell.trap?.triggered) {
        classes.push('trapped');
        bgImages.unshift(`url('${AssetManager.trap(cell.trap)}')`);
        title = 'Piège déclenché';
    }

    // Cellule sur laquelle le joueur actif peut se déplacer
    if (cell.isMovable) classes.push('cellToMove');

    // Case accessible à côté de l'adversaire : s'y arrêter lance le duel
    if (cell.isMovable && cell.isSecurityZone) {
        classes.push('fightZone');
        title = title ? `${title} — duel !` : 'Duel !';
    }

    // Case de repli proposée pendant le choix de la fuite
    if (cell.isEscape) {
        classes.push('fleeTarget');
        title = title ? `${title} — fuir ici` : 'Fuir ici';
    }

    return `
        <div
            class="${classes.join(' ')}"
            id="${cell.id}"
            data-row="${cell.row}"
            data-col="${cell.col}"
            ${title ? `title="${title}"` : ''}
            style="background-image: ${bgImages.join(', ')}">
        </div>
    `;
}
