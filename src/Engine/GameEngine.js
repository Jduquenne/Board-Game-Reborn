import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { createCell, DECOR } from '../Models/Cell.js';
import { getMovableCells, getAdjacentPositions } from './MovementSystem.js';
import { PlayersRepository } from '../Repository/PlayersRepository.js';
import { WeaponsRepository } from '../Repository/WeaponsRepository.js';
import { BonusRepository } from '../Repository/BonusRepository.js';
import { TrapRepository } from '../Repository/TrapRepository.js';

class GameEngine {

    startGame(config) {
        const cells = this.#createGrid(config);
        this.#placeObstacles(cells, config);
        this.#placeBonus(cells, config);
        this.#placeTraps(cells, config);
        this.#placeWeapons(cells, config);
        const players = this.#placePlayers(cells, config);

        store.setState(() => ({
            phase: 'playing',
            config,
            cells,
            players,
            activePlayerIndex: 0,
            fight: null,
        }));

        this.#refreshMovableCells();
        eventBus.emit('game:started');
    }

    movePlayer(targetRow, targetCol) {
        const { cells, players, activePlayerIndex, phase } = store.state;

        if (phase !== 'playing') return;

        const targetCell = cells[targetRow][targetCol];
        if (!targetCell.isMovable) return;

        const activeInfo = players[activePlayerIndex];
        const isFightTrigger = targetCell.isSecurityZone;

        // Copie des cellules pour mise à jour immutable
        const newCells = this.#cloneCells(cells);
        this.#clearMarkings(newCells);

        // Déplace le joueur
        newCells[activeInfo.position.row][activeInfo.position.col].player = null;
        newCells[targetRow][targetCol].player = activeInfo.player;

        let updatedInfo = { ...activeInfo, position: { row: targetRow, col: targetCol } };

        // Piège
        let trapTriggered = false;
        if (targetCell.trap && !targetCell.trap.triggered) {
            updatedInfo = {
                ...updatedInfo,
                player: { ...updatedInfo.player, health: Math.max(0, updatedInfo.player.health - 20) },
            };
            newCells[targetRow][targetCol].trap = { ...targetCell.trap, triggered: true };
            trapTriggered = true;
        }

        // Ramassage d'arme — échange avec l'arme actuelle du joueur
        if (targetCell.weapon) {
            const oldWeapon = updatedInfo.player.weapon;
            updatedInfo = {
                ...updatedInfo,
                player: { ...updatedInfo.player, weapon: targetCell.weapon },
            };
            newCells[targetRow][targetCol].weapon = oldWeapon;
        }

        // Ramassage de bonus
        if (targetCell.bonus) {
            const { type, amount } = targetCell.bonus;
            const playerUpdate = type === 'life'
                ? { health: updatedInfo.player.health + amount }
                : { maxMove: updatedInfo.player.maxMove + amount };
            updatedInfo = { ...updatedInfo, player: { ...updatedInfo.player, ...playerUpdate } };
            newCells[targetRow][targetCol].bonus = null;
        }

        const newPlayers = players.map((p, i) => i === activePlayerIndex ? updatedInfo : p);

        store.setState(() => ({ cells: newCells, players: newPlayers }));

        if (trapTriggered) {
            eventBus.emit('trap:triggered', { playerInfo: newPlayers[activePlayerIndex] });
        }

        if (isFightTrigger) {
            const waitingIndex = (activePlayerIndex + 1) % newPlayers.length;
            this.#startFight(activePlayerIndex, waitingIndex);
        } else {
            this.#nextTurn();
        }
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #startFight(attackerIndex, targetIndex) {
        store.setState(() => ({
            phase: 'fighting',
            fight: { attackerIndex, targetIndex },
        }));
        const { players } = store.state;
        eventBus.emit('fight:start', {
            attacker: players[attackerIndex],
            target: players[targetIndex],
        });
    }

    #nextTurn() {
        const { activePlayerIndex, players } = store.state;
        const nextIndex = (activePlayerIndex + 1) % players.length;
        store.setState(() => ({ activePlayerIndex: nextIndex }));
        this.#refreshMovableCells();
        eventBus.emit('turn:changed', { activePlayerIndex: nextIndex });
    }

    #refreshMovableCells() {
        const { cells, players, activePlayerIndex, config } = store.state;
        const activeInfo  = players[activePlayerIndex];
        const waitingInfo = players[(activePlayerIndex + 1) % players.length];

        const newCells = this.#cloneCells(cells);
        this.#clearMarkings(newCells);

        // Cases accessibles au joueur actif
        const movable = getMovableCells(activeInfo.position, activeInfo.player.maxMove, newCells, config);
        for (const cell of movable) {
            newCells[cell.row][cell.col].isMovable = true;
        }

        // Zones de sécurité (cases adjacentes au joueur en attente)
        for (const pos of getAdjacentPositions(waitingInfo.position, config)) {
            const cell = newCells[pos.row][pos.col];
            if (cell.decor === DECOR.FLOOR && !cell.player) {
                newCells[pos.row][pos.col].isSecurityZone = true;
            }
        }

        store.setState(() => ({ cells: newCells }));
    }

    #clearMarkings(cells) {
        for (const row of cells) {
            for (const cell of row) {
                cell.isMovable = false;
                cell.isSecurityZone = false;
            }
        }
    }

    #createGrid({ rows, cols }) {
        return Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => createCell(row, col))
        );
    }

    #cloneCells(cells) {
        return cells.map(row => row.map(cell => ({ ...cell })));
    }

    // Cherche une cellule sol vide parmi toutes les cellules (pas de boucle infinie)
    #randomEmptyCell(cells, config) {
        const { rows, cols } = config;
        const empty = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = cells[r][c];
                if (cell.decor === DECOR.FLOOR && !cell.player && !cell.weapon && !cell.bonus && !cell.trap) {
                    empty.push({ row: r, col: c });
                }
            }
        }

        if (empty.length === 0) throw new Error('Aucune cellule vide disponible sur le plateau.');
        return empty[Math.floor(Math.random() * empty.length)];
    }

    #shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    #placeObstacles(cells, config) {
        for (let k = 0; k < config.nbObstacles; k++) {
            const { row, col } = this.#randomEmptyCell(cells, config);
            cells[row][col].decor = DECOR.OBSTACLE;
        }
    }

    #placeWeapons(cells, config) {
        const weapons = this.#shuffleArray(WeaponsRepository.findAll());
        for (let k = 0; k < config.nbWeapons; k++) {
            const { row, col } = this.#randomEmptyCell(cells, config);
            cells[row][col].weapon = weapons[k % weapons.length];
        }
    }

    #placeBonus(cells, config) {
        const bonuses = this.#shuffleArray(BonusRepository.findAll());
        for (let k = 0; k < config.nbBonus; k++) {
            const { row, col } = this.#randomEmptyCell(cells, config);
            cells[row][col].bonus = bonuses[k % bonuses.length];
        }
    }

    #placeTraps(cells, config) {
        const traps = this.#shuffleArray(TrapRepository.findAll());
        for (let k = 0; k < config.nbTraps; k++) {
            const { row, col } = this.#randomEmptyCell(cells, config);
            cells[row][col].trap = { ...traps[k % traps.length], triggered: false };
        }
    }

    #placePlayers(cells, config) {
        const allPlayers = this.#shuffleArray(PlayersRepository.findAll());
        const players = [];

        for (let k = 0; k < 2; k++) {
            const { row, col } = this.#randomEmptyCell(cells, config);
            // Copie profonde suffisante pour l'arme de base
            const player = { ...allPlayers[k], weapon: { ...allPlayers[k].weapon } };
            const playerInfo = { player, position: { row, col } };
            cells[row][col].player = player;
            players.push(playerInfo);
        }

        return players;
    }
}

export const gameEngine = new GameEngine();
