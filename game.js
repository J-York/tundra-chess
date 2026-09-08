/* Boot and input: the event wiring, and the public surface the page and QA pages drive. */
'use strict';

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  audio.unlock();
  const d = button.dataset;
  if (button.hasAttribute('data-close')) {
    Tundra.closeDialog();
    return;
  }
  if (d.buy !== undefined) {
    Tundra.action(E.buy(state, Number(d.buy)), 'buy');
    return;
  }
  if (d.cell !== undefined) {
    Tundra.moveTo(Number(d.cell));
    return;
  }
  if (d.actor) {
    Tundra.selectActor(d.actor);
    return;
  }
  if (d.bench !== undefined) {
    if (d.bench) Tundra.selectActor(d.bench);
    else Tundra.moveTo(null);
    return;
  }
  if (d.equip !== undefined) {
    const id = ui.selected || (ui.activeTab === 'unit' ? ui.inspected : null);
    if (!id || !state.units.some(u => u.id === id)) {
      Tundra.notify('先在棋盘或备战席选择一位伙伴，再点击装备。');
      return;
    }
    if (Tundra.action(E.equip(state, id, Number(d.equip)), 'equip', '装备已穿戴，原装备会回到行囊。')) {
      ui.selected = id;
      ui.inspected = id;
      if (ui.dialogKind === 'equipment') {
        $('modal').close();
        ui.dialogKind = null;
      }
      Tundra.render();
      Tundra.setTab('unit');
    }
    return;
  }
  if (d.rangeMode) {
    ui.rangeMode = d.rangeMode;
    Tundra.renderInspector();
    Tundra.renderSelection();
    return;
  }
  if (d.tab) {
    Tundra.setTab(d.tab);
    audio.play('click');
    return;
  }
  if (d.inspect) {
    ui.selected = null;
    ui.inspected = d.inspect;
    Tundra.setTab('unit');
    Tundra.updateActors();
    Tundra.renderSelection();
    return;
  }
  if (d.codex) {
    Tundra.showCodex(d.codex);
    return;
  }
  if (d.trait) {
    Tundra.showTrait(d.trait);
    return;
  }
  if (d.relic) {
    Tundra.showRelic(d.relic);
    return;
  }
  if (d.reward) {
    if (Tundra.action(E.takeReward(state, d.reward), 'reward')) {
      $('modal').close();
      ui.dialogKind = null;
      ui.mapSelected = null;
      Tundra.render();
      Tundra.showPhase();
    }
    return;
  }
  if (d.mapNode) {
    ui.mapSelected = d.mapNode;
    if (ui.dialogKind === 'map') Tundra.showMap(ui.mapAct);
    else {
      Tundra.renderScouting();
      Tundra.renderTravel();
      Tundra.renderControls();
    }
    audio.play('click');
    return;
  }
  if (d.mapAct !== undefined) {
    Tundra.showMap(Number(d.mapAct));
    return;
  }
  if (d.camp) {
    Tundra.action(E.camp(state, d.camp), 'reward');
    return;
  }
  if (d.forge) {
    if (Tundra.action(E.camp(state, 'forge', d.forge), 'equip')) {
      $('modal').close();
      ui.dialogKind = null;
    }
    return;
  }
  if (d.merchant !== undefined) {
    Tundra.action(E.merchantBuy(state, d.merchant), 'buy', '商品已收入行囊。');
    return;
  }
  if (d.eventChoice) {
    Tundra.action(E.takeEvent(state, d.eventChoice), 'reward');
    return;
  }
  if (d.treasure) {
    Tundra.action(E.treasure(state, d.treasure), 'reward');
    return;
  }
  if (d.recordReplay !== undefined) {
    const r = records.runs[Number(d.recordReplay)];
    if (r) Tundra.showNewRun(r);
    return;
  }
  if (d.origin) {
    ui.newOrigin = d.origin;
    document
      .querySelectorAll('[data-origin]')
      .forEach(b => b.classList.toggle('selected', b.dataset.origin === ui.newOrigin));
    audio.play('click');
    return;
  }
  if (d.difficulty) {
    ui.newDifficulty = d.difficulty;
    document
      .querySelectorAll('[data-difficulty]')
      .forEach(b => b.classList.toggle('selected', b.dataset.difficulty === ui.newDifficulty));
    audio.play('click');
    return;
  }
  if (d.metric) {
    ui.reportMetric = d.metric;
    document
      .querySelectorAll('[data-metric]')
      .forEach(b => b.classList.toggle('active', b.dataset.metric === ui.reportMetric));
    $('report-table').innerHTML = Tundra.reportTable();
    return;
  }
  switch (button.id) {
    case 'status-toggle':
      document.querySelector('.expedition').classList.toggle('status-open');
      Tundra.renderStatus();
      break;
    case 'fight':
      Tundra.primaryAction();
      break;
    case 'open-map':
    case 'open-map-large':
      Tundra.showMap();
      break;
    case 'confirm-map-node':
      Tundra.enterSelectedNode();
      break;
    case 'camp-forge':
      Tundra.showForge();
      break;
    case 'skip-reward':
      if (Tundra.action(E.skipReward(state), 'move')) {
        $('modal').close();
        ui.dialogKind = null;
        ui.mapSelected = null;
        Tundra.render();
        Tundra.showPhase();
      }
      break;
    case 'pause':
      Tundra.togglePause();
      break;
    case 'speed':
      prefs.speed = ((prefs.speed || 1) % 3) + 1;
      audio.play('click');
      Tundra.renderControls();
      Tundra.startClock();
      break;
    case 'auto':
      Tundra.action(E.autoDeploy(state), 'move', '已按前排承伤、后排输出安排队伍。');
      break;
    case 'refresh':
      Tundra.action(E.refresh(state), 'click');
      break;
    case 'lock':
      if (E.canManage(state)) {
        state.locked = !state.locked;
        Tundra.action({}, 'click', state.locked ? '下场战斗将保留这批酒馆伙伴。' : '已解除酒馆锁定。');
      }
      break;
    case 'expand':
      Tundra.action(E.expand(state), 'buy', '人口已扩充，可以再上阵一位伙伴。');
      break;
    case 'restart':
    case 'new-from-end':
      Tundra.showNewRun();
      break;
    case 'current-seed':
      $('run-seed').value = state.seed;
      break;
    case 'share-run':
      Tundra.showShare();
      break;
    case 'copy-share':
      Tundra.copyShare();
      break;
    case 'replay-current':
      Tundra.showNewRun(E.runConfig(state));
      break;
    case 'confirm-new':
      Tundra.newGame();
      break;
    case 'open-records':
      Tundra.showRecords();
      break;
    case 'help':
      Tundra.showGuide();
      break;
    case 'all-codex':
      ui.codexFaction = 'all';
      ui.codexRole = 'all';
      Tundra.showCodex();
      break;
    case 'build-guide':
    case 'guide-builds':
      Tundra.showBuilds();
      break;
    case 'inspect-enemy':
      Tundra.showCodex(null, true);
      break;
    case 'settings':
      Tundra.showSettings();
      break;
    case 'sound':
      prefs.enabled = !prefs.enabled;
      Tundra.syncPreferences();
      if (prefs.enabled) audio.play('click');
      Tundra.notify(prefs.enabled ? '音效已开启' : '音效已关闭');
      break;
    case 'preview-sound':
      if (prefs.enabled) audio.play('victory');
      else Tundra.notify('先开启音效，再试听。');
      break;
    case 'dismiss-tip':
      prefs.tip = false;
      Tundra.savePrefs();
      $('onboarding').hidden = true;
      break;
    case 'clear-selection':
      ui.selected = null;
      ui.inspected = null;
      Tundra.render();
      break;
    case 'manage-equipment':
      Tundra.showEquipment();
      break;
    case 'unequip':
      if (Tundra.action(E.equip(state, ui.inspected, -1), 'equip')) {
        $('modal').close();
        ui.dialogKind = null;
      }
      break;
    case 'bench-unit':
      Tundra.action(E.move(state, ui.inspected, null), 'move');
      break;
    case 'sell-unit': {
      const u = state.units.find(u => u.id === ui.inspected);
      if (!u) break;
      if (Tundra.action(E.sell(state, u.id), 'buy', `${E.TYPES[u.type].name} 已离队，装备返回行囊。`)) {
        ui.inspected = null;
        Tundra.renderInspector();
      }
      break;
    }
    case 'continue-result':
      if (Tundra.action(E.continueResult(state), null)) {
        $('modal').close();
        ui.dialogKind = null;
        ui.mapSelected = null;
        Tundra.render();
        Tundra.showPhase();
      }
      break;
    case 'last-report':
      if (state.report) Tundra.showReport(state.report);
      break;
    case 'report-side':
      ui.reportSide = 1 - ui.reportSide;
      Tundra.text('report-side', ui.reportSide ? '敌方 ⇄' : '我方 ⇄');
      $('report-table').innerHTML = Tundra.reportTable();
      $('report-summary').innerHTML = Tundra.reportSummary();
      break;
  }
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'codex-faction') {
    ui.codexFaction = el.value;
    Tundra.showCodex();
    $('codex-faction').focus({ preventScroll: true });
  }
  if (el.id === 'codex-role') {
    ui.codexRole = el.value;
    Tundra.showCodex();
    $('codex-role').focus({ preventScroll: true });
  }
  if (el.id === 'run-challenge' && Object.hasOwn(E.CHALLENGES, el.value)) {
    ui.newChallenge = el.value;
    Tundra.text('challenge-description', E.CHALLENGES[ui.newChallenge].desc);
  }
  if (el.id === 'pref-volume') {
    prefs.volume = Number(el.value) / 100;
    Tundra.text('volume-value', el.value + '%');
    Tundra.syncPreferences();
  }
  if (el.id === 'pref-enabled') {
    prefs.enabled = el.checked;
    Tundra.syncPreferences();
    if (prefs.enabled) audio.unlock().then(() => audio.play('click'));
  }
  if (el.id === 'pref-music') {
    prefs.music = el.checked;
    Tundra.syncPreferences();
    audio.unlock();
  }
  if (el.id === 'pref-reduced') {
    prefs.reduced = el.checked;
    Tundra.syncPreferences();
  }
});
document.addEventListener('dragstart', event => {
  const el = event.target.closest('[data-actor],[data-bench]');
  if (!el || !E.canManage(state)) return;
  const id = el.dataset.actor || el.dataset.bench;
  if (!state.units.some(u => u.id === id)) {
    event.preventDefault();
    return;
  }
  ui.selected = id;
  ui.inspected = id;
  event.dataTransfer.setData('text/plain', id);
  event.dataTransfer.effectAllowed = 'move';
  Tundra.renderSelection();
});
document.addEventListener('dragover', event => {
  const el = event.target.closest('[data-cell],[data-actor],#bench');
  if (el && E.canManage(state)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
});
document.addEventListener('drop', event => {
  const el = event.target.closest('[data-cell],[data-actor],#bench');
  if (!el || !E.canManage(state)) return;
  event.preventDefault();
  const id = event.dataTransfer.getData('text/plain');
  if (!state.units.some(u => u.id === id)) return;
  ui.selected = id;
  if (el.id === 'bench') Tundra.moveTo(null);
  else if (el.dataset.cell !== undefined) Tundra.moveTo(Number(el.dataset.cell));
  else {
    const u = state.units.find(u => u.id === el.dataset.actor);
    if (u) Tundra.moveTo(u.pos);
    else Tundra.notify('只能布置在我方阵地。', true);
  }
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
    return;
  if (event.key === 'Escape' && !$('modal').open) {
    ui.selected = null;
    ui.inspected = null;
    Tundra.render();
    return;
  }
  if ($('modal').open) return;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
    event.preventDefault();
    audio.unlock();
    if (state.phase === 'battle') Tundra.togglePause();
    else Tundra.primaryAction();
  }
  if (event.key.toLowerCase() === 'r' && E.canManage(state)) {
    event.preventDefault();
    audio.unlock();
    Tundra.action(E.refresh(state), 'click');
  }
  if (event.key.toLowerCase() === 'm') {
    prefs.enabled = !prefs.enabled;
    audio.unlock();
    Tundra.syncPreferences();
  }
});
$('modal').addEventListener('cancel', event => {
  event.preventDefault();
  Tundra.closeDialog();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.phase === 'battle') {
      ui.paused = true;
      Tundra.stopClock();
      Tundra.syncVisuals();
      Tundra.save();
      Tundra.renderControls();
    }
    audio.setActive(false);
  } else audio.setActive(true);
});
window.addEventListener('pagehide', () => {
  Tundra.save();
  audio.stopMusic();
});
Tundra.load();
Tundra.addLog(
  state.phase === 'battle'
    ? '战斗已恢复，点击 ▶ 继续。'
    : `第 ${E.currentNode(state).act + 1} 章 · ${E.currentNode(state).name}。`,
);
Tundra.render();
Tundra.showPhase();
Tundra.openSharedRun();
