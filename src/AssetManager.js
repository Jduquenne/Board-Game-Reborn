const BASE = 'assets/dungeon';

export const AssetManager = {
    floor:    ()  => `${BASE}/empty.jpg`,
    obstacle: ()  => `${BASE}/obstacle.png`,
    player:   (p) => `${BASE}/characters/${p.image}`,
    weapon:   (w) => `${BASE}/weapons/${w.image}`,
    bonus:    (b) => `${BASE}/bonus/${b.image}`,
    trap:     (t) => `${BASE}/trap/${t.image}`,
};
