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
const artDirectory = process.argv.find(arg => arg.startsWith('--art-dir='))?.slice('--art-dir='.length);

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Page errors are collected here rather than inside the session, so a run that dies early —
// a checkpoint that never arrives — can still say what the page complained about.
const pageErrors = [];

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
  const consoleErrors = pageErrors;
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
      throw Error(
        'Page threw on: ' +
          expression.slice(0, 120) +
          '\n  ' +
          (result.exceptionDetails.exception?.description || result.exceptionDetails.text),
      );
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

async function verifyChapters({ call, evaluate, consoleErrors }) {
  fs.mkdirSync(artDirectory, { recursive: true });
  for (const [width, height] of [
    [1366, 900],
    [390, 844],
  ]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (let act = 0; act < 3; act++) {
      for (const kind of ['camp', 'merchant', 'event', 'treasure', 'boss', 'map']) {
        await evaluate(`(() => {
          document.getElementById('modal').close();
          ui.dialogKind = null;
          ui.mapSelected = null;
          state = E.newRun({seed:4242});
          const target = state.map.find(n => n.act === ${act} && n.kind === '${kind === 'map' ? 'boss' : kind}');
          if (!target) throw Error('Missing chapter fixture');
          state.nodeId = state.map.find(n => n.next.includes(target.id)).id;
          state.phase = 'map';
          const entered = E.enterNode(state, target.id);
          if (entered.error) throw Error(entered.error);
          Tundra.render();
          if ('${kind}' === 'map') {
            Tundra.showMap(${act});
            if (document.getElementById('modal').dataset.chapter !== E.CHAPTERS[${act}].theme) throw Error('Wrong preview theme');
            // Preview a different chapter while the active journey stays put.
            Tundra.showMap((${act} + 1) % 3);
            if (document.getElementById('modal').dataset.chapter !== E.CHAPTERS[(${act} + 1) % 3].theme) throw Error('Stale preview theme');
            Tundra.showMap(${act});
            if ([...document.querySelectorAll('.map-node.kind-event')].some(n => Object.values(E.EVENTS).some(e => n.getAttribute('aria-label').includes(e.name)))) throw Error('Unknown event leaked');
          } else {
            const surface = document.getElementById('${kind === 'boss' ? 'scout-tip' : 'travel-surface'}');
            surface.scrollIntoView({block:'center'});
            if (surface.scrollWidth > surface.clientWidth + 1) throw Error('Surface horizontal overflow');
            if ('${kind}' === 'merchant' && document.querySelectorAll('.merchant-offer').length !== 4) throw Error('Missing offers');
          }
          if (document.documentElement.scrollWidth > innerWidth) throw Error('Page horizontal overflow');
        })()`);
        await sleep(130);
        const shot = await call('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(
          path.join(artDirectory, `chapter-${act + 1}-${kind}-${width}.png`),
          Buffer.from(shot.data, 'base64'),
        );
      }
      console.log(`chapter ${act + 1}: six surfaces at ${width}px, cross-chapter preview and hidden events verified`);
    }
  }
  if (consoleErrors.length) throw Error(consoleErrors.join(' | '));
}

async function verifyFeedback({ call, evaluate }) {
  fs.mkdirSync(artDirectory, { recursive: true });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

  await evaluate(`(() => {
        document.getElementById('art-gallery')?.remove();
        state = E.newRun({seed:4242});
        state.units.push(E.unit(state, 'mage', 28));
        E.createBattle(state);
        prefs.reduced = false;
        document.body.classList.remove('reduce-motion');
        ui.paused = true;
        Tundra.render();
        const units = state.battle.units;
        const samples = [
          {type:'damage',kind:'physical',value:14,absorbed:6,critical:true},
          {type:'damage',kind:'magic',value:23},
          {type:'heal',value:20},
          {type:'shield',value:30},
          {type:'shatter',value:15,from:units[0].pos},
        ];
        Tundra.animateEvents(samples.map((event,i)=>({...event,id:units[i].id,pos:units[i].pos})));
        const text = document.getElementById('floaters').textContent;
        if (!text.includes('盾 −6') || !text.includes('−14')) throw Error('Partial absorption missing: ' + text + '; reduced=' + matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (document.querySelectorAll('.impact').length !== 5) throw Error('Expected five distinct feedback marks');
        if (document.getElementById('effects').getAnimations({subtree:true}).some(a=>a.playState!=='paused')) throw Error('New effects must respect pause');
      })()`);
  const feedback = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artDirectory, 'feedback-1366.png'), Buffer.from(feedback.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.getElementById('arena').scrollIntoView({block:'center'})");
  const mobileFeedback = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artDirectory, 'feedback-390.png'), Buffer.from(mobileFeedback.data, 'base64'));
  await evaluate(`(() => {
        const unit = state.battle.units[0];
        Tundra.animateEvents(Array.from({length:90},()=>({type:'damage',kind:'physical',value:1,id:unit.id,pos:unit.pos})));
        if ([...document.querySelectorAll('#floaters > *')].filter(el=>el.dataset.pos===String(unit.pos)).length>3) throw Error('Too many labels in one cell');
        if (document.getElementById('effects').children.length>64) throw Error('Too many effects');
        prefs.reduced = true;
        Tundra.syncVisuals();
        Tundra.animateEvents([{type:'heal',value:20,pos:unit.pos,id:unit.id}]);
        if(document.querySelectorAll('#effects > *,#floaters > *').length) throw Error('Reduced motion must clear and suppress transient feedback');
      })()`);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate(`(() => {
    prefs.reduced = false;
    Tundra.animateEvents([{type:'shield',value:30,pos:18}]);
    if(document.querySelectorAll('#effects > *,#floaters > *').length) throw Error('System reduced motion must suppress feedback');
  })()`);
  console.log('feedback: partial shield, shape distinction, pause, density, app and system reduced motion verified');
}

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
      // Visual QA may open another tab; background throttling must not stall the test clock.
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
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

    if (process.argv.includes('--chapter-only')) {
      if (!artDirectory) throw Error('--chapter-only requires --art-dir');
      await verifyChapters(session);
      return;
    }

    if (process.argv.includes('--feedback-only')) {
      if (!artDirectory) throw Error('--feedback-only requires --art-dir');
      await verifyFeedback(session);
      return;
    }

    // A fresh, seeded expedition through the real dialog, with motion off so the DOM settles.
    await evaluate(`(() => {
      localStorage.clear();
      prefs.reduced = true;
      prefs.enabled = false;
      prefs.music = false;
      // The battle advances in fixed steps, so a faster clock shortens the run without
      // changing a single outcome. Motion is off, so nothing else depends on the rate.
      prefs.speed = 6;
      Tundra.syncPreferences();
    })()`);
    await evaluate('Tundra.showNewRun()');
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
      ['codex dialog', 'Tundra.showCodex()'],
      ['builds dialog', 'Tundra.showBuilds()'],
      ['records dialog', 'Tundra.showRecords()'],
    ]) {
      await evaluate(script);
      await settle();
      await record(name);
      await evaluate("Tundra.closeDialog(); document.getElementById('modal').close();");
      await settle();
    }

    // Economy controls: refresh, lock, and expanding the deployment cap.
    await evaluate(`(() => {
      document.getElementById('refresh').click();
      document.getElementById('lock').click();
      const expand = document.getElementById('expand');
      if (!expand.disabled) expand.click();
    })()`);
    await settle();
    await record('after tavern refresh, lock and expand');

    // Equipment: open a deployed companion, wear the starting shield, then take it off.
    const equipped = await evaluate(`(() => {
      const deployed = state.units.find(u => u.pos !== null);
      if (!deployed) return 'nobody deployed';
      // Select through the board the way a player does, rather than reaching into the page.
      document.querySelector('[data-actor="' + deployed.id + '"]').click();
      document.getElementById('tab-unit').click();
      const manage = document.getElementById('manage-equipment');
      if (!manage) return 'no equipment button';
      manage.click();
      const slot = document.querySelector('#modal-content [data-equip]');
      if (!slot) return 'no bag item';
      slot.click();
      return state.units.find(u => u.id === deployed.id).item || 'nothing worn';
    })()`);
    await settle();
    await record('after wearing ' + equipped);

    await evaluate(`(() => {
      const off = document.getElementById('unequip');
      if (off) off.click();
    })()`);
    await settle();
    await record('after taking the equipment off');

    // Auto-arrange, then fight through the real controls, pausing and changing speed midway.
    await evaluate("document.getElementById('auto').click()");
    await settle();
    await record('after auto-arrange');

    await evaluate("document.getElementById('fight').click()");
    await waitFor('the battle to start', () => evaluate("state.phase === 'battle'"), 40);
    await sleep(250);
    await evaluate("document.getElementById('pause').click()");
    await settle();
    const held = await record('battle paused');
    await evaluate("document.getElementById('speed').click()");
    await settle();
    await evaluate("document.getElementById('pause').click()");
    await waitFor('the battle to resolve', () => evaluate("state.phase === 'result'"), 600);
    await settle();
    const report = await record('battle report');

    // Walk the expedition through whatever it meets, using the controls a player would press.
    const walkScript = prefer => `(() => {
      const click = selector => {
        const el = document.querySelector(selector);
        if (el && !el.disabled) {
          el.click();
          return true;
        }
        return false;
      };
      switch (state.phase) {
        case 'result':
          return click('#continue-result') ? 'left the report' : 'report stuck';
        case 'reward':
          return click('#modal-content [data-reward]') || click('#skip-reward') ? 'took a reward' : 'reward stuck';
        case 'map': {
          const options = GameEngine.availableNodes(state);
          // Prefer a stop that is not a fight, so services get exercised too.
          const wanted =
            options.find(n => n.kind === '${prefer}') ||
            options.find(n => !GameEngine.isCombat(n)) ||
            options[0];
          click('[data-map-node="' + wanted.id + '"]');
          return click('#confirm-map-node') || click('#fight') ? 'travelled to ' + wanted.kind : 'map stuck';
        }
        case 'prep': {
          // Spend what the tavern offers, so the party grows and elite rewards get reached.
          let bought = 0;
          for (let i = 0; i < 5; i++)
            if (click('#shop-cards [data-buy]:not([disabled])')) bought++;
          click('#expand');
          click('#auto');
          return click('#fight') ? 'started a battle after ' + bought + ' recruits' : 'prep stuck';
        }
        case 'camp':
          return click('[data-camp]') ? 'rested' : 'camp stuck';
        case 'merchant':
          click('[data-merchant]:not([disabled])');
          return click('#fight') ? 'traded' : 'merchant stuck';
        case 'event':
          return click('[data-event-choice]:not([disabled])') ? 'answered an event' : 'event stuck';
        case 'treasure':
          return click('[data-treasure]') ? 'opened a chest' : 'treasure stuck';
        case 'node-result':
          return click('#fight') ? 'moved on' : 'result stuck';
        default:
          return 'stop:' + state.phase;
      }
    })()`;
    const seen = new Set();
    const walk = async (label, steps, prefer) => {
      const script = walkScript(prefer);
      for (let step = 0; step < steps; step++) {
        const phase = await evaluate('state.phase');
        if (phase === 'won' || phase === 'lost' || phase === 'battle') break;
        const outcome = await evaluate(script);
        if (String(outcome).startsWith('stop:')) break;
        if (await evaluate("state.phase === 'battle'"))
          await waitFor('a battle to resolve', () => evaluate("state.phase !== 'battle'"), 600);
        await settle();
        const point = await record(`${label} ${String(step + 1).padStart(2, '0')}: ${outcome}`);
        seen.add(point.phase);
        if (String(outcome).endsWith('stuck')) throw Error('The walk could not act during ' + point.phase);
      }
    };
    await walk('walk', 30, 'treasure');

    // A second, gentler expedition that seeks merchants, so trading and relic rewards run too.
    await evaluate('Tundra.showNewRun()');
    await evaluate(`(() => {
      document.querySelector('[data-origin="astral"]').click();
      document.querySelector('[data-difficulty="story"]').click();
      document.getElementById('run-seed').value = '${SEED + 7}';
      document.getElementById('confirm-new').click();
    })()`);
    await settle();
    await record('second expedition, prep phase');
    await walk('trade', 20, 'merchant');

    // The relic reward only follows an elite win, which a scripted party cannot be relied on to
    // reach. Seed the phase through the engine, then take the reward with a real click, so the
    // reward dialog and its handler are covered like every other surface.
    const rewarded = await evaluate(`(() => {
      const pool = Object.keys(GameEngine.RELICS).filter(id => !['spring', 'purse'].includes(id));
      state.phase = 'reward';
      state.rewards = pool.slice(0, 3).map(id => 'relic:' + id);
      Tundra.showRewards();
      const pick = document.querySelector('#modal-content [data-reward]');
      if (!pick) return 'no reward offered';
      pick.click();
      return state.relics.join(',') || 'nothing granted';
    })()`);
    await settle();
    await record('after taking a relic reward (' + rewarded + ')');

    // Reload and make sure the saved expedition comes back the same.
    await call('Page.navigate', { url: ORIGIN });
    await waitFor('the reload to boot', () =>
      evaluate("document.readyState === 'complete' && typeof state === 'object'"),
    );
    await settle();
    await record('after reload');

    // Optional visual acceptance: real chapter nodes drive the same render path as play.
    // Usage: npm run browser-test -- --art-dir=/tmp/tundra-art
    if (artDirectory) {
      fs.mkdirSync(artDirectory, { recursive: true });
      const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'release-files.json'), 'utf8'));
      for (const [width, height] of [
        [1366, 900],
        [390, 844],
      ]) {
        await call('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        for (let act = 0; act < 3; act++) {
          const scene = await evaluate(`(async () => {
            state = E.newRun({seed: 4242});
            state.units.push(E.unit(state, 'mage', 28));
            ui.selected = state.units[0].id;
            const node = state.map.find(n => n.act === ${act} && n.kind === 'battle');
            state.nodeId = node.id;
            state.stage = node.act * 9 + node.floor;
            document.getElementById('modal').close();
            Tundra.render();
            const arena = document.getElementById('arena');
            const background = getComputedStyle(arena).backgroundImage;
            const file = 'assets/chapter-' + node.theme + '.webp';
            if (!background.includes(file)) throw Error('Wrong chapter background: ' + background);
            const image = new Image();
            image.src = file;
            await image.decode();
            if (image.naturalWidth !== 1536 || image.naturalHeight !== 1024) throw Error('Invalid scene size');
            if (document.documentElement.scrollWidth > innerWidth) throw Error('Horizontal overflow');
            arena.scrollIntoView({block: 'center'});
            return {file, theme: node.theme};
          })()`);
          if (!manifest.includes(scene.file)) throw Error('Scene missing from release: ' + scene.file);
          await settle();
          const screenshot = await call('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(
            path.join(artDirectory, `${scene.theme}-${width}.png`),
            Buffer.from(screenshot.data, 'base64'),
          );
          console.log(`art: ${scene.theme} ${width}×${height}, loaded, no overflow`);
        }
      }
    }

    if (artDirectory) {
      await call('Emulation.setDeviceMetricsOverride', {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(`(() => {
        const gallery = document.createElement('section');
        gallery.id = 'art-gallery';
        gallery.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#142421;padding:28px;display:grid;grid-template-columns:repeat(8,1fr);gap:16px;overflow:auto';
        for (const type of Object.keys(E.TYPES)) {
          const svg = UnitArt(type);
          const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
          if (parsed.querySelector('parsererror')) throw Error('Invalid portrait: ' + type);
          const card = document.createElement('div');
          card.style.cssText = 'text-align:center;border:1px solid #40584d;border-radius:12px;background:linear-gradient(#263d35,#182b28);padding:12px';
          card.innerHTML = svg + '<div>' + E.TYPES[type].name + '</div>';
          card.firstElementChild.style.cssText = 'width:100%;height:180px';
          gallery.append(card);
        }
        document.body.append(gallery);
        const ids = [...document.querySelectorAll('svg [id]')].map(el => el.id);
        if (new Set(ids).size !== ids.length) throw Error('Duplicate SVG IDs');
        for (const el of gallery.querySelectorAll('[fill]')) {
          const fill = el.getAttribute('fill');
          if (fill.startsWith('url(#') && !document.getElementById(fill.slice(5, -1))) throw Error('Unresolved paint: ' + fill);
        }
        scrollTo(0,0);
      })()`);
      const galleryShot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artDirectory, 'roster-1366.png'), Buffer.from(galleryShot.data, 'base64'));
      console.log('art: entire roster SVGs parsed, paint references resolved, IDs unique');
    }

    if (artDirectory) {
      await verifyFeedback(session);
      await verifyChapters(session);
    }

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
      console.log('\npaused mid-battle at: ' + held.labels.hint);
      console.log('battle result: ' + report.labels.phase + ' / life ' + report.life);
      console.log('phases exercised: ' + [...seen].sort().join(', '));
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
    try {
      fs.rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 30, retryDelay: 200 });
    } catch {
      // A leftover temp profile must never mask the result of the run.
    }
  }
}

main().catch(error => {
  console.error(error.message);
  if (pageErrors.length) console.error('console errors: ' + pageErrors.join(' | '));
  process.exitCode = 1;
});
