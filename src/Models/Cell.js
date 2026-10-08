export const DECOR = Object.freeze({
    FLOOR: 'floor',
    OBSTACLE: 'obstacle',
});

export const createCell = (row, col) => ({
    id: `${row}-${col}`,
    row,
    col,
    decor: DECOR.FLOOR,
    weapon: null,
    bonus: null,
    player: null,
    trap: null,       // null | { name, image, triggered: bool }
    isMovable: false,
    isSecurityZone: false,
    isEscape: false,  // case de repli proposée pendant le choix de fuite
});
