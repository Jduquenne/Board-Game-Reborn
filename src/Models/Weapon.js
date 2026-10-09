// Types d'armes (docs/spec-game-design.md §5) : lourde (Force renforcée), légère (+ critiques), équilibrée (aucun bonus)
export const WEAPON_TYPE = Object.freeze({
    HEAVY: 'heavy',
    LIGHT: 'light',
    BALANCED: 'balanced',
});

export const WEAPON_TYPE_LABEL = Object.freeze({
    [WEAPON_TYPE.HEAVY]: 'lourde',
    [WEAPON_TYPE.LIGHT]: 'légère',
    [WEAPON_TYPE.BALANCED]: 'équilibrée',
});

export const createWeapon = (name, damage, image, type = WEAPON_TYPE.BALANCED) => ({ name, damage, image, type });
