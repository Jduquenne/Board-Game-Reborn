/**
 * Générateur pseudo-aléatoire à graine (algorithme mulberry32).
 * Même graine → même suite de nombres : permet de rejouer exactement les mêmes parties
 * (entraînement, comparaisons d'IA, tests). Retourne une fonction compatible avec Math.random.
 *
 * @param {number} seed
 * @returns {() => number} nombre dans [0, 1)
 */
export function createRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
