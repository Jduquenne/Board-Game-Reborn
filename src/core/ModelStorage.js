// Sauvegarde des modèles d'IA entraînés dans le navigateur (localStorage).
// Un modèle par leçon : 'fight' (table Q du combat), 'move' (poids du déplacement).
// Toujours protégé par try/catch : stockage indisponible (navigation privée, Node, tests) → null / false.
const KEYS = Object.freeze({ fight: 'bgr.fightModel', move: 'bgr.moveModel' });

export const ModelStorage = {
    save(kind, model) {
        try {
            globalThis.localStorage.setItem(KEYS[kind], JSON.stringify(model));
            return true;
        } catch {
            return false;
        }
    },

    load(kind) {
        try {
            const raw = globalThis.localStorage.getItem(KEYS[kind]);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
};
