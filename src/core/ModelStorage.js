// Sauvegarde du modèle d'IA entraîné dans le navigateur (localStorage).
// Toujours protégé par try/catch : stockage indisponible (navigation privée, Node, tests) → null / false.
const FIGHT_MODEL_KEY = 'bgr.fightModel';

export const ModelStorage = {
    saveFightModel(model) {
        try {
            globalThis.localStorage.setItem(FIGHT_MODEL_KEY, JSON.stringify(model));
            return true;
        } catch {
            return false;
        }
    },

    loadFightModel() {
        try {
            const raw = globalThis.localStorage.getItem(FIGHT_MODEL_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
};
