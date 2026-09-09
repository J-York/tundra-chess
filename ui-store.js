/* Shared data and the namespace every interface module registers on.

   These bindings are deliberately global: index.html loads the modules as plain scripts, and
   the tests/*-qa.html harnesses read `state` and `prefs` the same way the page does. Behaviour
   lives on `Tundra` instead, so the window is not carrying seventy-seven loose functions. */
'use strict';
const E = GameEngine,
  $ = id => document.getElementById(id),
  SAVE = 'tundra-expedition-v3',
  PREFS = 'tundra-preferences-v2',
  RECORDS = 'tundra-records-v3';
const audio = new ForestAudio();
let state;
// Everything the interface remembers between events, in one place instead of twenty-one
// module-level flags. `state` stays separate: that is the expedition, not the view.
const ui = {
  selected: null, // companion the player is moving
  inspected: null, // companion shown in the side panel
  activeTab: 'scout',
  rangeMode: 'attack', // 'attack' or 'skill' preview on the board
  previewAim: null, // cell the skill preview points at
  paused: false,
  clock: null, // battle interval handle
  lastSaveTick: 0,
  toastTimer: null,
  dialogKind: null, // which dialog is open, so the phase dialogs cannot be dismissed
  logs: [],
  reportMetric: 'damage',
  reportSide: 0,
  displayedReport: null,
  codexFaction: 'all',
  codexRole: 'all',
  mapSelected: null, // node highlighted on the map, before confirming
  mapAct: 0, // chapter the enlarged map is showing
  newOrigin: 'forest', // pending choices in the new-expedition dialog
  newDifficulty: 'normal',
  newChallenge: 'none',
};
const prefs = { enabled: true, music: false, volume: 0.45, reduced: false, tip: true };
let records = { wins: 0, best: 0, runs: [] };
try {
  const p = JSON.parse(localStorage.getItem(PREFS));
  if (p) {
    for (const key of ['enabled', 'music', 'reduced', 'tip']) if (typeof p[key] === 'boolean') prefs[key] = p[key];
    if (Number.isFinite(p.volume)) prefs.volume = Math.max(0, Math.min(1, p.volume));
  }
  const r = JSON.parse(localStorage.getItem(RECORDS));
  if (r && Number.isInteger(r.wins) && r.wins >= 0 && Number.isInteger(r.best) && r.best >= 0 && r.best <= 27)
    records = {
      wins: r.wins,
      best: r.best,
      runs: Array.isArray(r.runs) ? r.runs.filter(E.validRecord).slice(0, 30) : [],
    };
} catch {}
audio.configure(prefs);
document.body.classList.toggle('reduce-motion', prefs.reduced);
const art = type => UnitArt(type);
const escapeHTML = value =>
  String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const Tundra = {};

(function (T) {
  'use strict';

  const icons = {
    info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    map: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
    sound: 'M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14',
    mute: 'M3 9h4l5-5v16l-5-5H3ZM16 9l6 6M22 9l-6 6',
    settings: 'M9 3h6l1 4 4 1v8l-4 1-1 4H9l-1-4-4-1V8l4-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    shield: 'M12 3 21 7l-2 9-7 5-7-5-2-9Z',
    attack: 'M5 19 19 5V3h-2L5 15M3 13l8 8M4 20l2-2',
    health: 'M12 20 4 12C-2 4 8 0 12 7 16 0 26 4 20 12Z',
    coin: 'M12 2 22 12 12 22 2 12ZM12 7l5 5-5 5-5-5Z',
  };
  function icon(name) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${icons[name] || icons.info}"/></svg>`;
  }

  // Rewriting a container throws away its DOM, and with it any focus, scroll position or
  // in-progress selection inside. Two thirds of the rewrites during play produce exactly the
  // markup already on screen, so remember what each container last received and skip those.
  function paint(id, html) {
    const node = $(id);
    // Compare against the DOM itself, not a remembered string. renderStatus appends the build
    // note to #relics after painting it, and a cache would not see that: the container would
    // never be reset and the note would pile up on every render.
    if (!node || node.innerHTML === html) return false;
    node.innerHTML = html;
    return true;
  }
  function text(id, value) {
    $(id).textContent = value;
  }

  function save() {
    try {
      localStorage.setItem(SAVE, JSON.stringify(state));
      paint('save-status', '<i></i> 进度已保存');
      return true;
    } catch {
      $('save-status').textContent = '存储不可用 · 请勿关闭页面';
      return false;
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE);
      if (raw) {
        const candidate = JSON.parse(raw);
        if (E.validate(candidate)) {
          state = candidate;
          ui.paused = state.phase === 'battle';
          return;
        }
        // Retain an unreadable save for recovery, instead of overwriting the only copy.
        localStorage.setItem(SAVE + '-recovery', raw);
      }
    } catch {}
    state = E.newRun();
  }

  function notify(message, error = false) {
    text('toast', message);
    $('toast').className = 'show' + (error ? ' error' : '');
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => ($('toast').className = ''), 2600);
    if (error) audio.play('error');
  }

  function addLog(message, time = null) {
    ui.logs.unshift({ message, time });
    ui.logs = ui.logs.slice(0, 45);
    T.renderLog();
  }

  function action(result, sound = 'click', message = '') {
    if (result?.error) {
      notify(result.error, true);
      return false;
    }
    if (result?.events?.length) {
      for (const ev of result.events)
        if (ev.type === 'merge') {
          audio.play('merge');
          notify(`${ev.name} 升至 ${ev.star} 星！装备已保留。`);
          addLog(`${ev.name} 合成为 ${ev.star} 星。`);
        }
    } else if (sound) audio.play(sound);
    if (message) notify(message);
    ui.selected = null;
    save();
    T.render();
    return true;
  }

  function factionName(type) {
    return E.factionIds(type)
      .map(id => E.FACTIONS[id]?.name || '古树')
      .join(' · ');
  }

  function power(roster, relics = [], scale = 1) {
    return Math.round(
      roster.reduce((n, u) => {
        const s = E.stats(u, roster, relics, scale);
        return n + s.maxHp * 0.12 + (s.atk / s.interval) * 2 + s.armor * 0.35;
      }, 0),
    );
  }

  function enemyScale() {
    return E.enemyScale(state);
  }

  function liveUnits() {
    return state.phase === 'battle' || (state.phase === 'result' && state.battle)
      ? state.battle.units
      : [...E.deployed(state).map(u => ({ ...u, side: 0 })), ...E.enemyRoster(state).map(u => ({ ...u, side: 1 }))];
  }

  // Surface other modules call. Trimmed to what is actually used across files.
  T.icon = icon;
  T.paint = paint;
  T.text = text;
  T.save = save;
  T.savePrefs = savePrefs;
  T.load = load;
  T.notify = notify;
  T.addLog = addLog;
  T.action = action;
  T.factionName = factionName;
  T.power = power;
  T.enemyScale = enemyScale;
  T.liveUnits = liveUnits;
})(Tundra);
