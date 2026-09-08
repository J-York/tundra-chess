/* Drives the real page in a headless browser and hashes what it produces.

   This is the UI counterpart of fingerprint.cjs: it walks a fixed script of interactions —
   recruit, deploy by click, deploy by drag, open dialogs, fight a battle, travel the map,
   reload and resume — and records a normalised snapshot at every checkpoint. A refactor that
   changes no behaviour leaves the digest untouched; a behaviour change is expected to move it.

   Usage:  npm run browser-test            print the digest and a per-checkpoint summary
           npm run browser-test -- --dump  print the full transcript for diffing

   It starts its own static server and its own Chrome, on their own ports and profile, and
   never touches a browser session already running on the machine. */
'use strict';
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 8971;
const DEBUG_PORT = 41971;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SEED = 4242;
const dump = process.argv.includes('--dump');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw Error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.');
  return found;
}

async function waitFor(label, probe, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await probe()) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw Error('Timed out waiting for ' + label);
}

/* A single CDP session against one page target. */
async function connect() {
  const target = await (
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?` + encodeURIComponent('about:blank'), { method: 'PUT' })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const consoleErrors = [];
  let nextId = 1;
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(Error('Could not open a CDP session'));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error')
      consoleErrors.push(message.params.entry.text);
    if (message.method === 'Runtime.exceptionThrown')
      consoleErrors.push(
        message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text,
      );
    const waiting = pending.get(message.id);
    if (!waiting) return;
    pending.delete(message.id);
    clearTimeout(waiting.timer);
    message.error ? waiting.reject(Error(message.error.message)) : waiting.resolve(message.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('CDP timed out: ' + method));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails)
      throw Error('Page threw on: ' + expression.slice(0, 120) + '\n' + JSON.stringify(result.exceptionDetails.text));
    return result.result.value;
  };
  return { call, evaluate, consoleErrors, close: () => ws.close(), targetId: target.id };
}

/* Injected into the page. Returns a stable description of what the player can currently see. */
const SNAPSHOT = `(() => {
  const digest = value => {
    // Collapse whitespace so formatting changes in markup do not register as behaviour changes.
    const text = String(value).replace(/\\s+/g, ' ').trim();
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
    return hash.toString(16).padStart(8, '0') + ':' + text.length;
  };
  const html = id => (document.getElementById(id) ? digest(document.getElementById(id).innerHTML) : 'absent');
  const text = id => (document.getElementById(id) ? document.getElementById(id).textContent.replace(/\\s+/g, ' ').trim() : 'absent');
  const actors = [...document.querySelectorAll('[data-actor]')].map(el => ({
    id: el.dataset.actor,
    label: el.getAttribute('aria-label'),
    left: el.style.left,
    top: el.style.top,
    classes: [...el.classList].sort().join(' '),
  }));
  return {
    phase: state.phase,
    stage: state.stage,
    node: state.nodeId,
    life: state.life,
    gold: state.gold,
    capacity: state.capacity,
    units: state.units.map(u => u.type + '/' + u.star + '/' + u.pos + '/' + (u.item || '-')).sort(),
    shop: state.shop.map(t => t || '-'),
    bag: [...state.bag].sort(),
    relics: [...state.relics].sort(),
    valid: GameEngine.validate(state),
    // Rendered surfaces, hashed rather than quoted so the transcript stays readable.
    dom: {
      route: html('route'),
      board: html('board'),
      bench: html('bench'),
      shop: html('shop-cards'),
      synergies: html('synergies'),
      relicPanel: html('relics'),
      bagPanel: html('bag'),
      scout: html('scout-panel'),
      unitPanel: html('unit-panel'),
      travel: html('travel-surface'),
      modal: document.getElementById('modal').open ? html('modal-content') : 'closed',
    },
    labels: {
      stage: text('stage-title'),
      phase: text('phase'),
      life: text('life'),
      gold: text('gold'),
      population: text('population'),
      benchCount: text('bench-count'),
      hint: text('hint'),
      fight: text('fight'),
      income: text('income'),
    },
    actors,
    focus: { selectedCount: document.querySelectorAll('.actor.selected').length },
  };
})()`;

/* Synthesises the drag sequence the board listens for; dataTransfer is not scriptable
   through CDP input events, so the events are constructed with a stub. */
const DRAG = `((fromSelector, toSelector) => {
  const from = document.querySelector(fromSelector), to = document.querySelector(toSelector);
  if (!from || !to) return 'missing:' + (from ? toSelector : fromSelector);
  const store = new Map();
  const dataTransfer = {
    effectAllowed: '', dropEffect: '',
    setData: (k, v) => store.set(k, String(v)),
    getData: k => store.get(k) || '',
    setDragImage: () => {},
  };
  const fire = (node, type) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    node.dispatchEvent(event);
  };
  fire(from, 'dragstart');
  fire(to, 'dragover');
  fire(to, 'drop');
  return 'ok';
})`;

async function main() {
  const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'tundra-browser-'));
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: __dirname,
    stdio: 'ignore',
  });
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--no-sandbox',
      '--disable-gpu',
      // Without this the renderer dies on small /dev/shm, which looks like a page hang.
      '--disable-dev-shm-usage',
      `--user-data-dir=${chromeProfile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const checkpoints = [];
  let session = null;
  try {
    await waitFor('the static server', async () => (await fetch(ORIGIN)).ok);
    await waitFor('Chrome', async () => (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).ok);
    session = await connect();
    const { call, evaluate } = session;
    await call('Page.enable');
    await call('Log.enable');
    await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const record = async name => {
      const snapshot = await evaluate(SNAPSHOT);
      checkpoints.push({ name, ...snapshot });
      return snapshot;
    };
    const settle = async () => {
      await sleep(120);
    };

    await call('Page.navigate', { url: ORIGIN });
    await waitFor('the page to boot', () =>
      evaluate("document.readyState === 'complete' && typeof state === 'object'"),
    );

    // A fresh, seeded expedition through the real dialog, with motion off so the DOM settles.
    await evaluate(`(() => {
      localStorage.clear();
      prefs.reduced = true;
      prefs.enabled = false;
      prefs.music = false;
      syncPreferences();
    })()`);
    await evaluate('showNewRun()');
    await evaluate(`(() => {
      document.querySelector('[data-origin="forest"]').click();
      document.querySelector('[data-difficulty="normal"]').click();
      document.getElementById('run-seed').value = '${SEED}';
      document.getElementById('confirm-new').click();
    })()`);
    await settle();
    await record('fresh run, prep phase');

    // Recruit whatever the first affordable tavern card offers.
    await evaluate(`(() => {
      const card = [...document.querySelectorAll('#shop-cards [data-buy]')].find(b => !b.disabled);
      if (card) card.click();
    })()`);
    await settle();
    await record('after recruiting from the tavern');

    // Deploy by selecting a reserve and clicking a home cell.
    await evaluate(`(() => {
      const reserve = document.querySelector('#bench [data-bench]');
      if (reserve) reserve.click();
      const cell = [...document.querySelectorAll('[data-cell]')].find(
        c => Number(c.dataset.cell) >= GameEngine.HOME && !state.units.some(u => u.pos === Number(c.dataset.cell)),
      );
      if (cell) cell.click();
    })()`);
    await settle();
    await record('after deploying by click');

    // Deploy by dragging a reserve onto an empty home cell.
    const dragResult = await evaluate(`(() => {
      const reserve = document.querySelector('#bench [data-bench]');
      if (!reserve) return 'no reserve';
      const free = [...document.querySelectorAll('[data-cell]')].find(
        c => Number(c.dataset.cell) >= GameEngine.HOME && !state.units.some(u => u.pos === Number(c.dataset.cell)),
      );
      if (!free) return 'no free cell';
      return (${DRAG})('#bench [data-bench]', '[data-cell="' + free.dataset.cell + '"]');
    })()`);
    await settle();
    await record('after deploying by drag (' + dragResult + ')');

    // The tab strip and the companion panel.
    await evaluate("document.getElementById('tab-unit').click()");
    await settle();
    await record('companion panel');

    // Dialogs the QA pages care about.
    for (const [name, script] of [
      ['guide dialog', "document.getElementById('help').click()"],
      ['codex dialog', 'showCodex()'],
      ['builds dialog', 'showBuilds()'],
      ['records dialog', 'showRecords()'],
    ]) {
      await evaluate(script);
      await settle();
      await record(name);
      await evaluate("closeDialog(); document.getElementById('modal').close();");
      await settle();
    }

    // Auto-arrange, then fight the battle through the real controls.
    await evaluate("document.getElementById('auto').click()");
    await settle();
    await record('after auto-arrange');

    await evaluate("document.getElementById('fight').click()");
    await waitFor('the battle to resolve', () => evaluate("state.phase === 'result'"), 400);
    await settle();
    const report = await record('battle report');

    await evaluate(`(() => {
      const button = document.getElementById('continue-result');
      if (button) button.click();
    })()`);
    await settle();
    await record('after leaving the report');

    // Travel: pick the first reachable node through the map surface.
    await evaluate(`(() => {
      if (state.phase !== 'map') return;
      const next = GameEngine.availableNodes(state)[0];
      const node = document.querySelector('[data-map-node="' + next.id + '"]');
      if (node) node.click();
      const go = document.getElementById('confirm-map-node');
      if (go) go.click();
    })()`);
    await settle();
    await record('after choosing a road');

    // Reload and make sure the saved expedition comes back the same.
    await call('Page.navigate', { url: ORIGIN });
    await waitFor('the reload to boot', () =>
      evaluate("document.readyState === 'complete' && typeof state === 'object'"),
    );
    await settle();
    await record('after reload');

    const errors = session.consoleErrors;
    const transcript = { seed: SEED, checkpoints };
    const digest = crypto.createHash('sha256').update(JSON.stringify(transcript)).digest('hex');
    if (dump) {
      process.stdout.write(JSON.stringify(transcript, null, 1) + '\n');
    } else {
      for (const point of checkpoints)
        console.log(
          '  ' +
            point.name.padEnd(34) +
            point.phase.padEnd(8) +
            ('units ' + point.units.length).padEnd(10) +
            ('gold ' + point.gold).padEnd(9) +
            (point.valid ? 'valid' : 'INVALID STATE'),
        );
      console.log('\nbattle result: ' + report.labels.phase + ' / life ' + report.life);
      console.log('console errors: ' + (errors.length ? errors.join(' | ') : 'none'));
      console.log('\nUI fingerprint: ' + digest);
    }
    if (errors.length) throw Error('The page logged errors: ' + errors.join(' | '));
    if (checkpoints.some(p => !p.valid)) throw Error('A checkpoint produced an invalid expedition state');
  } finally {
    session?.close();
    chrome.kill();
    server.kill();
    // Chrome flushes its profile on the way out, so removal has to tolerate a slow exit.
    await new Promise(resolve => chrome.once('exit', resolve).once('error', resolve));
    fs.rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
