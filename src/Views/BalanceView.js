import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { AssetManager } from '../AssetManager.js';
import { PlayersRepository } from '../Repository/PlayersRepository.js';

// Bornes des stats modifiables dans le labo
const LIMITS = Object.freeze({ health: { min: 10, max: 500, step: 5 }, maxMove: { min: 1, max: 8, step: 1 } });

// Seuils de couleur des barres : en dessous / au-dessus = trop faible / trop fort
const LOW = 0.4, HIGH = 0.6;

const pct = x => `${Math.round(x * 100)} %`;

// Labo d'équilibrage : modifier les stats des personnages (ici seulement, pas dans le jeu) et mesurer
// leur équilibre. Aucune logique d'IA ici : l'analyse tourne dans src/AI/balance.worker.js.
export class BalanceView extends Component {
    #worker     = null;
    #original   = PlayersRepository.findAll().map(p => ({ name: p.name, health: p.health, maxMove: p.maxMove, image: p.image }));
    #characters = this.#original.map(c => ({ ...c }));
    #result     = null;   // dernier résultat d'analyse
    #analyzed   = null;   // stats utilisées pour ce résultat (pour savoir si elles ont changé depuis)
    #runId      = 0;
    #running    = false;

    render() {
        return `
            <div class="balance">
                <header class="trainingHeader">
                    <h1 class="trainingTitle">Labo d'équilibrage</h1>
                    <div class="balanceNav">
                        <button class="btn" id="bl-training">Entraînement</button>
                        <button class="btn" id="bl-menu">Menu</button>
                    </div>
                </header>

                <div class="trainingControls">
                    <label class="trainingOpponent">
                        IA
                        <select id="bl-agent">
                            <option value="normal">IA Normal (va au combat, rapide)</option>
                            <option value="champion">Champion (prudent, lent)</option>
                        </select>
                    </label>
                    <label class="trainingOpponent">
                        Parties par duel
                        <select id="bl-games">
                            <option value="50">50</option>
                            <option value="100" selected>100</option>
                            <option value="200">200</option>
                            <option value="400">400</option>
                        </select>
                    </label>
                    <button class="btn" id="bl-run">Lancer l'analyse</button>
                    <button class="btn" id="bl-reset">Stats d'origine</button>
                    <button class="btn" id="bl-copy">Copier les stats</button>
                </div>

                <div class="balanceProgress" aria-hidden="true"><span id="bl-progress"></span></div>

                <div class="balanceSummary" id="bl-summary">
                    Modifie les PV et PM puis lance l'analyse : chaque personnage affronte tous les autres, avec la même IA des deux côtés.
                </div>

                <div class="balanceTabs" role="tablist">
                    <button class="btn btn-active" data-tab="characters">Personnages</button>
                    <button class="btn" data-tab="matrix">Matrice des duels</button>
                </div>

                <div class="balanceBody" data-tab="characters">
                    <section class="balanceCharacters" id="bl-characters"></section>
                    <section class="balanceMatrixPanel">
                        <p class="trainingCaption">Qui bat qui (ligne contre colonne) — rouge : la ligne gagne, bleu : elle perd</p>
                        <div class="balanceMatrix" id="bl-matrix"></div>
                    </section>
                </div>

                <p class="trainingNotice" id="bl-notice" aria-live="polite"></p>
            </div>
        `;
    }

    onMount() {
        this.#worker = new Worker(new URL('../AI/balance.worker.js', import.meta.url), { type: 'module' });
        this.#worker.addEventListener('message', ({ data }) => this.#onMessage(data));

        this.query('#bl-training').addEventListener('click', () => router.navigate('training'));
        this.query('#bl-menu').addEventListener('click', () => router.navigate('menu'));
        this.query('#bl-run').addEventListener('click', () => (this.#running ? this.#cancel() : this.#run()));
        this.query('#bl-reset').addEventListener('click', () => {
            this.#characters = this.#original.map(c => ({ ...c }));
            this.#renderCharacters();
            this.#notice('Stats d\'origine rétablies.');
        });
        this.query('#bl-copy').addEventListener('click', () => this.#copy());

        // Modification des stats (event delegation sur le tableau)
        this.query('#bl-characters').addEventListener('change', (e) => {
            const input = e.target.closest('input[data-stat]');
            if (!input) return;
            const { stat } = input.dataset;
            const { min, max } = LIMITS[stat];
            const value = Math.min(max, Math.max(min, Math.round(Number(input.value) || min)));
            this.#characters[Number(input.dataset.index)][stat] = value;
            this.#renderCharacters();
        });

        // Onglets (écrans en portrait)
        this.query('.balanceTabs').addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (!tab) return;
            this.query('.balanceBody').dataset.tab = tab.dataset.tab;
            this.queryAll('.balanceTabs [data-tab]').forEach(b => b.classList.toggle('btn-active', b === tab));
        });

        this.#renderCharacters();
        this.#renderMatrix();
    }

    onUnmount() {
        this.#worker?.terminate();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #run() {
        this.#running  = true;
        this.#analyzed = this.#characters.map(c => ({ ...c }));
        this.#worker.postMessage({
            type: 'run',
            id: ++this.#runId,
            characters: this.#analyzed,
            agent: this.query('#bl-agent').value,
            gamesPerPair: Number(this.query('#bl-games').value),
        });
        this.query('#bl-run').textContent = 'Arrêter';
        this.#setProgress(0);
        this.#notice('Analyse en cours…');
    }

    #cancel() {
        this.#worker.postMessage({ type: 'cancel' });
        this.#running = false;
        this.query('#bl-run').textContent = 'Lancer l\'analyse';
        this.#setProgress(0);
        this.#notice('Analyse arrêtée.');
    }

    #onMessage(data) {
        if (data.id !== this.#runId || !this.#running) return; // message d'une analyse annulée

        if (data.type === 'progress') {
            this.#setProgress(data.pairsDone / data.pairsTotal);
        }
        if (data.type === 'result') {
            this.#running = false;
            this.#result  = data.result;
            this.query('#bl-run').textContent = 'Lancer l\'analyse';
            this.#setProgress(1);
            this.#renderSummary();
            this.#renderCharacters();
            this.#renderMatrix();
            this.#notice(`Analyse terminée : ${data.result.games.toLocaleString('fr-FR')} parties.`);
        }
    }

    #setProgress(ratio) {
        this.query('#bl-progress').style.width = `${Math.round(ratio * 100)}%`;
    }

    // Les stats ont-elles changé depuis la dernière analyse ?
    #isStale() {
        return !this.#analyzed || this.#characters.some((c, i) =>
            c.health !== this.#analyzed[i].health || c.maxMove !== this.#analyzed[i].maxMove);
    }

    #renderSummary() {
        const r = this.#result;
        const rates  = r.characters.map(c => c.winRate);
        const spread = Math.max(...rates) - Math.min(...rates);
        this.query('#bl-summary').innerHTML = `
            <span><strong>${pct(r.drawRate)}</strong> de matchs nuls</span>
            <span>1er joueur : <strong>${pct(r.firstPlayerRate)}</strong> des victoires</span>
            <span>écart fort / faible : <strong>${pct(spread)}</strong></span>
            <span>${r.games.toLocaleString('fr-FR')} parties</span>`;
    }

    #renderCharacters() {
        const stale = this.#result && this.#isStale();
        const rows = this.#characters.map((c, i) => {
            const origin   = this.#original[i];
            const modified = c.health !== origin.health || c.maxMove !== origin.maxMove;
            const res      = this.#result?.characters[i];
            const level    = !res ? '' : res.winRate > HIGH ? 'balanceHigh' : res.winRate < LOW ? 'balanceLow' : 'balanceOk';
            const title    = res
                ? `${c.name} : ${pct(res.winRate)} de victoires — bat le mieux ${res.best.name} (${pct(res.best.rate)}), perd contre ${res.worst.name} (${pct(res.worst.rate)})`
                : c.name;

            return `
                <div class="balanceRow ${modified ? 'balanceModified' : ''}" title="${title}">
                    <img class="balanceAvatar" src="${AssetManager.player(c)}" alt="">
                    <span class="balanceName">${c.name}</span>
                    <label class="balanceStat">PV
                        <input type="number" data-index="${i}" data-stat="health" value="${c.health}"
                            min="${LIMITS.health.min}" max="${LIMITS.health.max}" step="${LIMITS.health.step}" aria-label="Points de vie de ${c.name}">
                    </label>
                    <label class="balanceStat">PM
                        <input type="number" data-index="${i}" data-stat="maxMove" value="${c.maxMove}"
                            min="${LIMITS.maxMove.min}" max="${LIMITS.maxMove.max}" step="${LIMITS.maxMove.step}" aria-label="Points de mouvement de ${c.name}">
                    </label>
                    <span class="balanceBarTrack ${stale ? 'balanceStale' : ''}">
                        ${res ? `<span class="balanceBar ${level}" style="width: ${(res.winRate * 100).toFixed(1)}%"></span>` : ''}
                        <span class="balanceMid"></span>
                    </span>
                    <span class="balanceRate">${res ? pct(res.winRate) : '—'}</span>
                </div>`;
        });
        this.query('#bl-characters').innerHTML = rows.join('');
        if (stale) this.#notice('Stats modifiées depuis l\'analyse : relance-la pour voir l\'effet.');
    }

    // Matrice : case (ligne i, colonne j) = taux de victoire de i contre j
    #renderMatrix() {
        const chars = this.#analyzed ?? this.#characters;
        const m = this.#result?.matrix;
        const n = chars.length;
        const cells = ['<span class="matrixCorner"></span>'];

        for (const c of chars) cells.push(`<img class="matrixHead" src="${AssetManager.player(c)}" alt="${c.name}" title="${c.name}">`);
        chars.forEach((row, i) => {
            cells.push(`<img class="matrixHead" src="${AssetManager.player(row)}" alt="${row.name}" title="${row.name}">`);
            for (let j = 0; j < n; j++) {
                const rate = m?.[i]?.[j];
                if (i === j || rate === undefined || rate === null) {
                    cells.push(`<span class="matrixCell matrixEmpty"></span>`);
                    continue;
                }
                const strength = Math.min(1, Math.abs(rate - 0.5) * 2);
                cells.push(`<span class="matrixCell ${rate >= 0.5 ? 'matrixWin' : 'matrixLoss'}"
                    style="opacity: ${(0.15 + 0.85 * strength).toFixed(2)}"
                    title="${row.name} bat ${chars[j].name} : ${pct(rate)}"></span>`);
            }
        });

        const grid = this.query('#bl-matrix');
        grid.style.setProperty('--matrix-size', n + 1);
        grid.innerHTML = cells.join('');
    }

    // Stats actuelles, au format de PLAYER_DATA (src/Repository/PlayersRepository.js), dans le presse-papiers
    async #copy() {
        const lines = this.#characters.map(c =>
            `    { name: '${c.name.replace(/'/g, "\\'")}', health: ${c.health}, image: '${c.image}', maxMove: ${c.maxMove} },`);
        const text = lines.join('\n');
        try {
            await navigator.clipboard.writeText(text);
            this.#notice('Stats copiées (format PLAYER_DATA). Colle-les dans la conversation pour les inscrire dans le jeu.');
        } catch {
            this.#notice('Copie impossible dans ce navigateur.');
        }
    }

    #notice(text) {
        this.query('#bl-notice').textContent = text;
    }
}
