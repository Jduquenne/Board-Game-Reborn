// Vérification responsive de l'interface — outil de développement, zéro dépendance (voir D-009).
//
// Lance un serveur statique local + Chrome headless (protocole DevTools), ouvre chaque écran
// du jeu à plusieurs tailles d'écran, puis vérifie : pas de scroll de page, aucun élément hors
// de l'écran, aucune zone scrollable, aucun contenu coupé. Enregistre une capture par cas.
//
// Usage :   node tools/ui-check.mjs [--viewport <filtre>] [--screen <filtre>] [--out <dossier>]
// Exemple : node tools/ui-check.mjs --viewport phone --screen game
// Chrome :  détecté automatiquement, ou variable d'environnement CHROME_PATH.
// Sortie :  code 0 si aucun problème, 1 sinon.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─── Arguments ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg  = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const VIEWPORT_FILTER = arg('viewport', '');
const SCREEN_FILTER   = arg('screen', '');
const OUT             = resolve(ROOT, arg('out', 'tools/output'));

// ─── Cas testés ───────────────────────────────────────────────────────────────

// [nom, largeur, hauteur, mobile]
const VIEWPORTS = [
    ['phone-portrait',   360,  640,  true],
    ['phone-landscape',  640,  360,  true],
    ['iphone-portrait',  390,  844,  true],
    ['iphone-landscape', 844,  390,  true],
    ['tablet-portrait',  768,  1024, true],
    ['tablet-landscape', 1024, 768,  true],
    ['laptop',           1366, 768,  false],
    ['desktop',          1920, 1080, false],
].filter(([name]) => name.includes(VIEWPORT_FILTER));

// Scénarios : [nom, route, action JS exécutée dans la page (optionnelle)]
const fightSetup = `
    const { eventBus } = await import('/src/core/EventBus.js');
    const { store }    = await import('/src/core/Store.js');
    const [a, t] = store.state.players;`;

const SCREENS = [
    ['menu',    '#menu',    null],
    ['options', '#options', null],
    ['game',    '#game',    null],
    ['iso',     '#game',    `document.querySelector('#btn-isometric').click()`],
    ['rules',   '#game',    `document.querySelector('#btn-rules').click()`],
    ['quit',    '#game',    `document.querySelector('#btn-menu').click()`],
    ['fight',   '#game',    `(async () => {${fightSetup}
        store.setState(() => ({ phase: 'fighting', fight: { attackerIndex: 0, targetIndex: 1 } }));
        eventBus.emit('fight:start', { attacker: a, target: t });
        await new Promise(r => setTimeout(r, 1300));
    })()`],
    ['win',     '#game',    `(async () => {${fightSetup}
        document.querySelector('#battle-modal').classList.remove('hidden');
        eventBus.emit('fight:end', { winner: a, loser: t });
    })()`],
    ['trap',    '#game',    `(async () => {${fightSetup}
        eventBus.emit('trap:triggered', { playerInfo: a });
    })()`],
    ['training',       '#training', null],
    ['training-watch', '#training', `document.querySelector('#tr-toggle').click()`],
    ['training-max',   '#training', `(() => {
        document.querySelector('[data-speed="max"]').click();
        document.querySelector('#tr-toggle').click();
    })()`],
].filter(([name]) => name.includes(SCREEN_FILTER));

// Mesures exécutées dans la page
const METRICS = `(() => {
    const W = innerWidth, H = innerHeight, de = document.documentElement;
    const name = el => el.id ? '#' + el.id
        : (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : el.tagName.toLowerCase());
    const visible = el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const outside = [], scrollable = [], clipped = [];
    for (const el of [...document.querySelectorAll('#app *')].filter(visible)) {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el), ov = cs.overflowX + cs.overflowY;
        // Le plateau isométrique est projeté en 3D : sa boîte de mise en page n'est pas représentative
        if ((r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) && !el.closest('.isometric')) {
            outside.push(name(el) + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ']');
        }
        const overflows = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
        if (/auto|scroll/.test(ov) && overflows) scrollable.push(name(el));
        if (/hidden|clip/.test(ov) && overflows && !el.closest('#board')) {
            clipped.push(name(el) + ' ' + el.scrollWidth + 'x' + el.scrollHeight + ' > ' + el.clientWidth + 'x' + el.clientHeight);
        }
    }
    return {
        pageScroll: de.scrollWidth > W + 1 || de.scrollHeight > H + 1 ? de.scrollWidth + 'x' + de.scrollHeight : null,
        outside: [...new Set(outside)].slice(0, 6),
        scrollable,
        clipped: clipped.slice(0, 6),
        cellSize: document.querySelector('#board') ? getComputedStyle(document.querySelector('#board')).getPropertyValue('--cell-size').trim() : null,
    };
})()`;

// ─── Serveur statique ─────────────────────────────────────────────────────────

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
};

function startServer() {
    const server = createServer((req, res) => {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
        if (!file.startsWith(ROOT + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(readFileSync(file));
    });
    return new Promise(res => server.listen(0, '127.0.0.1', () => res(server)));
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ];
    return candidates.find(p => p && existsSync(p));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connectChrome(chromePath, profileDir) {
    const port   = 9300 + Math.floor(Math.random() * 600);
    const chrome = spawn(chromePath, [
        '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
        '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });

    let wsUrl;
    for (let i = 0; i < 50 && !wsUrl; i++) {
        await sleep(200);
        try {
            const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            wsUrl = targets.find(t => t.type === 'page')?.webSocketDebuggerUrl;
        } catch { /* Chrome pas encore prêt */ }
    }
    if (!wsUrl) { chrome.kill(); throw new Error('Chrome DevTools endpoint not reachable'); }

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', e => {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const send = (method, params = {}) => new Promise(res => {
        const msgId = ++id;
        pending.set(msgId, res);
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
    const evaluate = async expression => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error(ex.exception?.description ?? ex.text);
        return r.result?.result?.value;
    };
    const close = () => { ws.close(); chrome.kill(); };

    return { send, evaluate, close };
}

// ─── Exécution ────────────────────────────────────────────────────────────────

const chromePath = findChrome();
if (!chromePath) {
    console.error('Chrome not found. Set CHROME_PATH to the Chrome / Chromium / Edge executable.');
    process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const profileDir = mkdtempSync(join(tmpdir(), 'bgr-ui-check-'));
const server     = await startServer();
const base       = `http://127.0.0.1:${server.address().port}/index.html`;
const browser    = await connectChrome(chromePath, profileDir);

await browser.send('Page.enable');
await browser.send('Runtime.enable');
await browser.send('Network.enable');
await browser.send('Network.setCacheDisabled', { cacheDisabled: true });

const report = {};
let failures = 0;

for (const [vName, width, height, mobile] of VIEWPORTS) {
    await browser.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height,
    });

    for (const [sName, route, action] of SCREENS) {
        const key = `${vName}/${sName}`;
        const issues = [];
        try {
            await browser.send('Page.navigate', { url: `${base}${route}` });
            await sleep(900);
            if (action) { await browser.evaluate(action); await sleep(1700); }

            const m = await browser.evaluate(METRICS);
            report[key] = m;
            if (m.pageScroll)        issues.push(`page scroll ${m.pageScroll}`);
            if (m.outside.length)    issues.push(`outside viewport: ${m.outside.join(' | ')}`);
            if (m.scrollable.length) issues.push(`scrollable: ${m.scrollable.join(' | ')}`);
            if (m.clipped.length)    issues.push(`clipped: ${m.clipped.join(' | ')}`);

            const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(OUT, `${vName}-${sName}.png`), Buffer.from(shot.result.data, 'base64'));
        } catch (err) {
            issues.push(`error: ${err.message}`);
        }

        if (issues.length) failures++;
        const cell = report[key]?.cellSize ? ` cell=${report[key].cellSize}` : '';
        console.log(`${issues.length ? 'FAIL' : 'ok  '} ${key}${cell}${issues.map(i => `\n       ${i}`).join('')}`);
    }
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
browser.close();
server.close();
await sleep(500);
try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* fichiers encore verrouillés par Chrome */ }

const total = VIEWPORTS.length * SCREENS.length;
console.log(`\n${total - failures}/${total} cases without issue — screenshots in ${OUT}`);
process.exit(failures ? 1 : 0);
