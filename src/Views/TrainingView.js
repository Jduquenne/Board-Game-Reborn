import { Component } from '../core/Component.js';
import { router } from '../core/Router.js';
import { ModelStorage } from '../core/ModelStorage.js';
import { boardHtml } from './boardTemplate.js';

const SPEED_LABELS = [
    { key: 'watch', label: 'Regarder' },
    { key: 'fast',  label: 'Rapide'   },
    { key: 'turbo', label: 'Turbo'    },
    { key: 'max',   label: 'Max'      },
];

const OPPONENTS = [
    { key: 'random', label: 'Aléatoire' },
    { key: 'easy',   label: 'IA Facile' },
    { key: 'normal', label: 'IA Normal' },
];

const LESSONS_LABELS = [
    { key: 'fight', label: 'Combat (Q-learning)' },
    { key: 'move',  label: 'Déplacement (génétique)' },
];

const ACTION_TEXT = { move: 'se déplace', pass: 'passe son tour', attack: 'attaque', defend: 'se défend' };

// Carte de la stratégie : coups nécessaires de 1 à 10 (10 = 10 ou plus), voir src/AI/FightPolicy.js
const MAX_HITS = 10;

// Page « Entraînement de l'IA » : pilote le Web Worker d'entraînement et affiche sa progression.
// Aucune logique d'IA ici : tout est calculé dans le worker (src/AI/training.worker.js).
export class TrainingView extends Component {
    #worker         = null;
    #resizeObserver = null;
    #lastStats      = null;
    #lastFrame      = null;

    render() {
        return `
            <div class="training">
                <header class="trainingHeader">
                    <h1 class="trainingTitle">Entraînement de l'IA</h1>
                    <button class="btn" id="tr-back">Menu</button>
                </header>

                <div class="trainingBody">
                    <section class="trainingMain">
                        <div class="trainingControls">
                            <button class="btn" id="tr-toggle">Démarrer</button>
                            <div class="trainingSpeeds" role="group" aria-label="Vitesse">
                                ${SPEED_LABELS.map(s => `<button class="btn trainingSpeed" data-speed="${s.key}">${s.label}</button>`).join('')}
                            </div>
                            <label class="trainingOpponent">
                                Leçon
                                <select id="tr-lesson">
                                    ${LESSONS_LABELS.map(l => `<option value="${l.key}">${l.label}</option>`).join('')}
                                </select>
                            </label>
                            <label class="trainingOpponent">
                                Adversaire
                                <select id="tr-opponent">
                                    ${OPPONENTS.map(o => `<option value="${o.key}" ${o.key === 'normal' ? 'selected' : ''}>${o.label}</option>`).join('')}
                                </select>
                            </label>
                            <button class="btn" id="tr-reset">Recommencer</button>
                            <button class="btn" id="tr-save">Utiliser dans le jeu</button>
                        </div>

                        <div class="trainingStats">
                            <div class="trainingStat"><span class="trainingStatValue" id="tr-games">0</span><span class="trainingStatLabel">parties jouées</span></div>
                            <div class="trainingStat"><span class="trainingStatValue" id="tr-progress">—</span><span class="trainingStatLabel" id="tr-progress-label">exploration</span></div>
                            <div class="trainingStat"><span class="trainingStatValue trainingStatMain" id="tr-winrate">—</span><span class="trainingStatLabel" id="tr-winrate-label">l'élève bat l'adversaire</span></div>
                            <div class="trainingStat"><span class="trainingStatValue" id="tr-reference">—</span><span class="trainingStatLabel" id="tr-reference-label">l'IA Normal bat l'adversaire</span></div>
                        </div>

                        <div class="trainingChart" id="tr-chart-wrap">
                            <canvas id="tr-chart" aria-label="Courbe d'apprentissage : taux de victoire en fonction du nombre de parties"></canvas>
                        </div>
                    </section>

                    <section class="trainingSide">
                        <div class="trainingBoardWrap hidden" id="tr-board-wrap">
                            <p class="trainingCaption" id="tr-caption"></p>
                            <div class="trainingBoardArea" id="tr-board-area">
                                <div class="trainingBoard" id="tr-board"></div>
                            </div>
                        </div>

                        <div class="trainingWeights hidden" id="tr-weights-wrap">
                            <p class="trainingCaption">Poids du champion : + recherché, − évité</p>
                            <div class="trainingWeightList" id="tr-weights"></div>
                        </div>

                        <div class="trainingPolicy" id="tr-policy-wrap">
                            <p class="trainingCaption">Stratégie apprise (personne en défense)</p>
                            <div class="trainingPolicyGrid" id="tr-policy"></div>
                            <p class="trainingLegend">
                                <span class="legendAttack">■ attaquer</span>
                                <span class="legendDefend">■ se défendre</span>
                                <span class="legendUnknown">⬚ jamais vu</span>
                                · pâle = peu sûr · lignes : coups pour le tuer · colonnes : coups pour me tuer
                            </p>
                        </div>
                    </section>
                </div>

                <p class="trainingNotice" id="tr-notice" aria-live="polite"></p>
            </div>
        `;
    }

    onMount() {
        this.#worker = new Worker(new URL('../AI/training.worker.js', import.meta.url), { type: 'module' });
        this.#worker.addEventListener('message', ({ data }) => this.#onMessage(data));

        this.query('#tr-back').addEventListener('click', () => router.navigate('menu'));

        this.query('#tr-toggle').addEventListener('click', () => {
            this.#worker.postMessage({ type: this.#lastStats?.running ? 'pause' : 'start' });
        });

        this.query('.trainingSpeeds').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-speed]');
            if (btn) this.#worker.postMessage({ type: 'speed', speed: btn.dataset.speed });
        });

        this.query('#tr-opponent').addEventListener('change', () => this.#reset('Nouvel adversaire : l\'entraînement repart de zéro.'));
        this.query('#tr-lesson').addEventListener('change', () => this.#reset('Nouvelle leçon : l\'entraînement repart de zéro.'));
        this.query('#tr-reset').addEventListener('click', () => this.#reset('Entraînement remis à zéro : l\'IA a tout oublié.'));

        this.query('#tr-save').addEventListener('click', () => this.#worker.postMessage({ type: 'export' }));

        // Redessine la courbe et le plateau quand la place disponible change
        this.#resizeObserver = new ResizeObserver(() => {
            this.#drawChart();
            this.#sizeBoard();
        });
        this.#resizeObserver.observe(this.query('#tr-chart-wrap'));
        this.#resizeObserver.observe(this.query('#tr-board-area'));
    }

    onUnmount() {
        this.#worker?.terminate();
        this.#resizeObserver?.disconnect();
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    #onMessage(data) {
        if (data.type === 'stats') this.#renderStats(data);
        if (data.type === 'frame') this.#renderFrame(data);
        if (data.type === 'model') {
            if (data.lesson === 'move' && !data.model.weights) {
                this.#notice('Lance au moins une génération avant d\'enregistrer le déplacement.');
                return;
            }
            const saved = ModelStorage.save(data.lesson, { ...data.model, gamesPlayed: data.gamesPlayed });
            const what  = data.lesson === 'move' ? 'Déplacement' : 'Combat';
            this.#notice(saved
                ? `${what} enregistré (${data.gamesPlayed.toLocaleString('fr-FR')} parties d'entraînement). Choisis « IA Entraînée » dans les Paramètres pour l'affronter.`
                : 'Impossible d\'enregistrer le modèle dans ce navigateur (stockage indisponible).');
        }
    }

    #reset(message) {
        this.#lastFrame = null;
        this.#worker.postMessage({
            type: 'reset',
            opponent: this.query('#tr-opponent').value,
            lesson: this.query('#tr-lesson').value,
        });
        this.#notice(message);
    }

    #renderStats(stats) {
        this.#lastStats = stats;
        const pct = x => (x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`);
        const last = stats.history.at(-1);

        this.query('#tr-toggle').textContent = stats.running ? 'Pause' : 'Démarrer';
        this.query('#tr-games').textContent = stats.gamesPlayed.toLocaleString('fr-FR');
        this.query('#tr-progress').textContent = stats.progress.value;
        this.query('#tr-progress-label').textContent = stats.progress.label;
        this.query('#tr-winrate').textContent = pct(last?.winRate);
        this.query('#tr-reference').textContent = pct(stats.reference);

        // Les pourcentages = taux de victoire CONTRE l'adversaire choisi (pas le score de l'adversaire)
        const opponent = OPPONENTS.find(o => o.key === stats.opponent)?.label ?? "l'adversaire";
        this.query('#tr-winrate-label').textContent   = `l'élève bat ${opponent}`;
        this.query('#tr-reference-label').textContent = `l'IA Normal bat ${opponent} (référence)`;

        this.queryAll('[data-speed]').forEach(btn => btn.classList.toggle('btn-active', btn.dataset.speed === stats.speed));

        // Plateau visible aux vitesses où l'on regarde les parties, sinon ce que l'IA a appris
        const showBoard = (stats.speed === 'watch' || stats.speed === 'fast') && !!this.#lastFrame;
        this.query('#tr-board-wrap').classList.toggle('hidden', !showBoard);
        this.query('#tr-policy-wrap').classList.toggle('hidden', showBoard || stats.lesson !== 'fight');
        this.query('#tr-weights-wrap').classList.toggle('hidden', showBoard || stats.lesson !== 'move');

        if (stats.policy)  this.#renderPolicy(stats.policy);
        if (stats.weights) this.#renderWeights(stats.weights);
        this.#drawChart();
    }

    #renderFrame(frame) {
        const firstFrame = !this.#lastFrame;
        this.#lastFrame = frame;
        const { state, learnerIndex, actor, action, gamesPlayed } = frame;

        const role  = frame.demo ? 'champion' : 'élève';
        const title = frame.demo ? 'Démonstration du champion' : `Partie ${gamesPlayed + 1}`;
        const name  = i => `${state.players[i].player.name}${i === learnerIndex ? ` (${role})` : ''}`;
        this.query('#tr-caption').textContent = action
            ? `${title} — ${name(actor)} ${ACTION_TEXT[action.type]}`
            : `${title} — le ${role} est ${name(learnerIndex)}`;

        const board = this.query('#tr-board');
        board.innerHTML = boardHtml(state, learnerIndex);

        if (firstFrame) {
            this.query('#tr-board-wrap').classList.remove('hidden');
            this.query('#tr-policy-wrap').classList.add('hidden');
        }
        this.#sizeBoard();
    }

    // Taille des cases du plateau d'aperçu, selon la place disponible
    #sizeBoard() {
        const state = this.#lastFrame?.state;
        const area  = this.query('#tr-board-area');
        if (!state || !area) return;
        const { rows, cols } = state.config;
        const size = Math.floor(Math.min((area.clientWidth - 10) / cols, (area.clientHeight - 10) / rows));
        this.query('#tr-board').style.setProperty('--cell-size', `${Math.max(4, Math.min(size, 48))}px`);
    }

    // Grille 10 × 10 : situation (coups pour le tuer × coups pour me tuer) → action apprise
    #renderPolicy(policy) {
        const byKey = new Map(policy.map(p => [p.key, p]));
        const cells = [];

        for (let my = 1; my <= MAX_HITS; my++) {
            for (let enemy = 1; enemy <= MAX_HITS; enemy++) {
                const entry = byKey.get(`${my}|${enemy}|0|0`);
                if (!entry) {
                    cells.push(`<span class="policyCell policyUnknown" title="Jamais rencontrée"></span>`);
                    continue;
                }
                const [attack, defend] = entry.values;
                const confidence = Math.min(1, Math.abs(attack - defend) * 4);
                cells.push(`<span class="policyCell ${entry.best === 'attack' ? 'policyAttack' : 'policyDefend'}"
                    style="opacity: ${(0.35 + 0.65 * confidence).toFixed(2)}"
                    title="${entry.text} → ${entry.best === 'attack' ? 'attaquer' : 'se défendre'} (Q attaque ${attack.toFixed(2)}, Q défense ${defend.toFixed(2)})"></span>`);
            }
        }
        this.query('#tr-policy').innerHTML = cells.join('');
    }

    // Poids du meilleur individu : une barre par caractéristique, vers la droite si positive
    #renderWeights(weights) {
        if (weights.length === 0) {
            this.query('#tr-weights').innerHTML = '<p class="trainingCaption">Aucune génération pour l\'instant : démarre l\'entraînement.</p>';
            return;
        }
        const maxAbs = Math.max(...weights.map(w => Math.abs(w.value)), 0.01);
        this.query('#tr-weights').innerHTML = weights.map(w => {
            const width = (Math.abs(w.value) / maxAbs) * 50;
            const side  = w.value >= 0 ? `left: 50%` : `right: 50%`;
            return `
                <div class="weightRow" title="${w.label} : ${w.value.toFixed(2)}">
                    <span class="weightLabel">${w.label}</span>
                    <span class="weightTrack"><span class="weightBar ${w.value >= 0 ? 'weightPositive' : 'weightNegative'}" style="${side}; width: ${width.toFixed(1)}%"></span></span>
                    <span class="weightValue">${w.value >= 0 ? '+' : ''}${w.value.toFixed(2)}</span>
                </div>`;
        }).join('');
    }

    // Courbe : taux de victoire (évaluation) en fonction des parties jouées, + référence en pointillés
    #drawChart() {
        const canvas = this.query('#tr-chart');
        const wrap   = this.query('#tr-chart-wrap');
        if (!canvas || !wrap || !this.#lastStats) return;

        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (w === 0 || h === 0) return;
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width  = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const css   = getComputedStyle(document.documentElement);
        const color = name => css.getPropertyValue(name).trim();
        const fontSize = Math.max(10, Math.round(h / 14));
        const font  = `${fontSize}px VT323, monospace`;

        const pad = { left: 36, right: 10, top: fontSize, bottom: fontSize + 8 };
        const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
        const { history, reference, gamesPlayed } = this.#lastStats;
        const maxGames = Math.max(1000, gamesPlayed, history.at(-1)?.games ?? 0);
        const x = games => pad.left + (games / maxGames) * plotW;
        const y = rate  => pad.top + (1 - rate) * plotH;

        // Axes et graduations (0, 50, 100 %)
        ctx.font = font;
        ctx.fillStyle = color('--text-light');
        ctx.strokeStyle = color('--third');
        ctx.lineWidth = 1;
        for (const rate of [0, 0.5, 1]) {
            ctx.beginPath(); ctx.moveTo(pad.left, y(rate)); ctx.lineTo(w - pad.right, y(rate)); ctx.stroke();
            ctx.fillText(`${rate * 100}%`, 2, y(rate) + 4);
        }
        ctx.fillText(`${maxGames.toLocaleString('fr-FR')} parties`, w - pad.right - ctx.measureText(`${maxGames.toLocaleString('fr-FR')} parties`).width, h - 4);
        ctx.fillText('0', pad.left, h - 4);

        // Référence (IA Normal) en pointillés
        if (reference !== null) {
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = color('--spinner-text');
            ctx.beginPath(); ctx.moveTo(pad.left, y(reference)); ctx.lineTo(w - pad.right, y(reference)); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Courbe de l'élève
        if (history.length) {
            ctx.strokeStyle = color('--secondary');
            ctx.lineWidth = 2;
            ctx.beginPath();
            history.forEach((p, i) => (i === 0 ? ctx.moveTo(x(p.games), y(p.winRate)) : ctx.lineTo(x(p.games), y(p.winRate))));
            ctx.stroke();
            ctx.fillStyle = color('--secondary');
            for (const p of history) { ctx.beginPath(); ctx.arc(x(p.games), y(p.winRate), 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
    }

    #notice(text) {
        this.query('#tr-notice').textContent = text;
    }
}
