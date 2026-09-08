/* The battle clock: starting, stepping, pausing and settling a fight. */
(function (T) {
  'use strict';

  function stopClock() {
    clearInterval(ui.clock);
    ui.clock = null;
  }

  function startClock() {
    stopClock();
    T.syncVisuals();
    if (state.phase === 'battle' && !ui.paused) ui.clock = setInterval(battleTick, 100 / (prefs.speed || 1));
  }

  function beginBattle() {
    ui.lastSaveTick = 0;
    if (T.action(E.createBattle(state), 'start')) {
      ui.selected = null;
      ui.inspected = null;
      ui.activeTab = 'log';
      ui.paused = false;
      ui.logs = [];
      T.addLog(`第 ${E.currentNode(state).act + 1} 章 · ${E.currentNode(state).name}，战斗开始。`);
      T.render();
      T.animateEvents(state.battle.events);
      startClock();
    }
  }

  function battleTick() {
    if (ui.paused || state.phase !== 'battle') return;
    const result = E.step(state.battle);
    T.updateActors();
    T.animateEvents(state.battle.events);
    T.text(
      'enemy-power',
      `${E.alive(state.battle, 1).length} / ${state.battle.units.filter(u => u.side === 1).length} 存活`,
    );
    T.text(
      'formation-power',
      `${E.alive(state.battle, 0).length} / ${state.battle.units.filter(u => u.side === 0).length} 存活`,
    );
    T.text(
      'battle-time',
      `${state.battle.time.toFixed(1)} 秒 · ${state.battle.enrage ? '加时：伤害 +60%，治疗减半' : '50 秒后进入加时'}`,
    );
    $('battle-progress-bar').style.width = Math.min(100, (state.battle.time / 80) * 100) + '%';
    if (state.battle.tick - ui.lastSaveTick >= 10) {
      ui.lastSaveTick = state.battle.tick;
      T.save();
      if (ui.activeTab === 'unit') T.renderInspector();
    }
    if (result) {
      stopClock();
      E.settlement(state);
      T.save();
      audio.play(result.won ? 'victory' : 'defeat');
      T.addLog(
        result.won ? `战斗胜利，获得 ${state.report.income} 金币。` : `战斗失利，远征生命 −${state.report.loss}。`,
        state.battle.time,
      );
      T.renderStatus();
      T.renderControls();
      T.showReport(state.report, true);
    }
  }

  function togglePause() {
    if (state.phase !== 'battle') return;
    ui.paused = !ui.paused;
    audio.play('click');
    if (ui.paused) {
      stopClock();
      T.save();
    } else startClock();
    T.syncVisuals();
    T.renderControls();
  }

  function pauseForDialog() {
    if (state.phase === 'battle') {
      ui.paused = true;
      stopClock();
      T.syncVisuals();
      T.save();
      T.renderControls();
    }
  }

  // Surface other modules call. Trimmed to what is actually used across files.
  T.stopClock = stopClock;
  T.startClock = startClock;
  T.beginBattle = beginBattle;
  T.togglePause = togglePause;
  T.pauseForDialog = pauseForDialog;
})(Tundra);
