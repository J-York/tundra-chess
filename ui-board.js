/* The board, the panels around it and selecting or moving a companion. */
(function (T) {
  'use strict';

  function setTab(name) {
    ui.activeTab = name;
    for (const tab of ['scout', 'unit', 'log']) {
      $('tab-' + tab).setAttribute('aria-selected', String(tab === name));
      $(tab + '-panel').hidden = tab !== name;
    }
    if (name === 'unit') renderInspector();
    if (name === 'log') renderLog();
  }

  function renderStatus() {
    const roster = E.deployed(state),
      t = E.traits(roster),
      prep = E.canManage(state);
    T.text('life', state.life);
    $('life-bar').style.width = state.life + '%';
    T.text('life-status', state.life > 60 ? '状态良好' : state.life > 30 ? '稍显疲惫' : '亟需休整');
    T.text('gold', state.gold);
    T.text('population', `${roster.length} / ${state.capacity}`);
    T.paint(
      'income',
      `胜利利息 <b>+${E.interest(state)}</b> <span title="每存 10 金币获得 1 利息，最高 2；开战结算前余额计算">${state.challenge === 'scarcity' ? '· 流水行囊：无利息' : '· 每 10 金币 +1'}</span>${state.streak ? ` · <b>${state.streak} 连胜</b>` : ''}`,
    );
    T.paint(
      'expand',
      state.capacity >= E.maxCapacity(state) ? '✓ 队伍已满编' : `扩充队伍 <span>◈ ${E.expandCost(state)}</span>`,
    );
    $('expand').disabled = !prep || state.capacity >= E.maxCapacity(state) || state.gold < E.expandCost(state);
    T.paint(
      'synergies',
      Object.entries(E.FACTIONS)
        .map(([id, f]) => {
          const n = t[id],
            tier = E.tierIndex(id, n),
            // The count shown is always measured against the next tier the party can still reach,
            // so a finished trait reads 4/4 instead of pointing at a threshold that does not exist.
            goal = f.thresholds.find(x => x > n) ?? f.thresholds.at(-1);
          return `<button class="synergy ${tier >= 0 ? 'active' : ''} tier-${tier + 1}" data-trait="${id}" title="${f.desc.map((d, i) => f.thresholds[i] + ' 种：' + d).join('；')}"><span>${f.icon}</span><span class="syn-copy">${f.name}<small>${f.desc[Math.max(tier, 0)]}</small></span><b>${n}/${goal}</b></button>`;
        })
        .join('') +
        `<div class="role-traits">${Object.entries(E.ROLE_TRAITS)
          .map(([id, r]) => {
            const n = t[id],
              tier = E.tierIndex(id, n),
              goal = r.thresholds.find(x => x > n) ?? r.thresholds.at(-1);
            return `<button class="role-pill ${tier >= 0 ? 'active' : ''} tier-${tier + 1}" data-trait="${id}" title="${r.desc.map((d, i) => r.thresholds[i] + ' 种：' + d).join('；')}">${r.icon} ${r.name} ${n}/${goal}</button>`;
          })
          .join('')}</div>`,
    );
    T.text('relic-count', state.relics.length);
    T.paint(
      'relics',
      state.relics.length
        ? `<div class="relic-list">${[...new Set(state.relics)].map(id => `<button class="relic" data-relic="${id}" title="${E.RELICS[id].name} · ${E.RELICS[id].desc}">${E.RELICS[id].icon}${E.count(state.relics, id) > 1 ? `<small>×${E.count(state.relics, id)}</small>` : ''}</button>`).join('')}</div>`
        : '<p class="empty-note">精英、首领与奇遇，藏着稀有的馈赠。</p>',
    );
    $('relics').insertAdjacentHTML(
      'beforeend',
      `<button class="build-guide-button" id="build-guide">构筑手记 · ${E.buildAdvice(state).filter(b => b.active).length} 组搭配 ↗</button>`,
    );
    T.text('bag-count', state.bag.length + ' 件');
    const own = state.units.some(u => u.id === ui.selected);
    T.paint(
      'bag',
      state.bag.length
        ? state.bag
            .map(
              (id, i) =>
                `<button class="bag-item ${own && prep ? 'ready' : ''}" data-equip="${i}" title="${E.ITEMS[id].name} · ${E.ITEMS[id].desc}" aria-label="装备 ${E.ITEMS[id].name}" ${!prep ? 'disabled' : ''}>${E.ITEMS[id].icon}</button>`,
            )
            .join('')
        : '<span class="empty-note">行囊暂时空了</span>',
    );
    T.text(
      'difficulty-badge',
      E.DIFFICULTIES[state.difficulty].name +
        ' · ' +
        E.ORIGINS[state.origin].name +
        (state.challenge && state.challenge !== 'none' ? ' · ' + E.CHALLENGES[state.challenge].name : ''),
    );
    const expanded = document.querySelector('.expedition').classList.contains('status-open');
    T.text(
      'status-toggle',
      `${expanded ? '收起详情' : '羁绊与行囊'} · ${[...Object.keys(E.FACTIONS), ...Object.keys(E.ROLE_TRAITS)].filter(id => E.tierIndex(id, t[id]) >= 0).length} 组羁绊 · ${state.bag.length} 件装备 ${expanded ? '▴' : '▾'}`,
    );
    $('status-toggle').setAttribute('aria-expanded', String(expanded));
  }

  function renderScouting() {
    const current = E.currentNode(state),
      node = state.phase === 'map' ? T.selectedMapNode() : current,
      combat = E.isCombat(node);
    const preview = { ...state, nodeId: node.id },
      foes = E.enemyRoster(preview);
    T.paint(
      'enemy-portrait',
      combat ? art(foes[0].type) : `<span class="scout-symbol">${E.NODES[node.kind].icon}</span>`,
    );
    T.text('enemy-tag', `第 ${node.act + 1} 章 · ${E.NODES[node.kind].name}`);
    T.text('enemy-name', node.kind === 'event' && state.phase === 'map' ? '未知事件' : node.name);
    T.text('enemy-description', T.nodeSummary(node));
    T.paint(
      'enemy-list',
      foes
        .map(
          u =>
            `<${state.phase === 'map' ? 'div' : 'button'} class="enemy-row" ${state.phase === 'map' ? '' : `data-inspect="${u.id}" title="查看 ${E.TYPES[u.type].name}"`}>${art(u.type)}<span>${E.TYPES[u.type].name}<small>${T.factionName(u.type)} · ${E.ROLES[E.TYPES[u.type].role]}</small></span><span class="enemy-meta">${'★'.repeat(u.star)}</span></${state.phase === 'map' ? 'div' : 'button'}>`,
        )
        .join(''),
    );
    $('scout-tip').classList.toggle('boss-note', node.kind === 'boss');
    $('scout-tip').dataset.chapter = E.CHAPTERS[node.act].theme;
    T.paint(
      'scout-tip',
      `${node.kind === 'boss' ? `<p class="boss-atmosphere">${T.chapterAtmosphere(node.act).boss}</p>` : ''}<strong>✧ ${combat ? '战术手记' : '远征手记'}</strong>${combat ? E.AFFIXES[node.affix].desc + ' ' + node.tip : '每个节点只处理一次。伙伴始终保留，远征生命与金币决定你能走多远。'}`,
    );
    $('inspect-enemy').hidden = !combat || state.phase === 'map';
  }

  function buildBoard() {
    T.paint(
      'board',
      Array.from(
        { length: 36 },
        (_, i) =>
          `<button class="cell ${i >= E.HOME ? 'home' : ''}" data-cell="${i}" aria-label="${i >= E.HOME ? '我方' : '敌方'}第 ${Math.floor(i / 6) + 1} 排第 ${(i % 6) + 1} 格" ${!E.canManage(state) ? 'disabled' : ''}></button>`,
      ).join(''),
    );
  }

  function actorHTML(u) {
    return `<button class="actor ${u.side ? 'enemy' : ''} ${u.type === 'ancient' ? 'boss' : ''} star-${u.star}" data-actor="${u.id}" draggable="${E.canManage(state) && !u.side}" aria-label="${u.side ? '敌方' : '我方'} ${E.TYPES[u.type].name} ${u.star} 星">${art(u.type)}<span class="stars">${'★'.repeat(u.star)}</span>${u.item ? `<span class="equipment-mark">${E.ITEMS[u.item].icon}</span>` : ''}<span class="status-mark"></span><span class="unit-name">${E.TYPES[u.type].name}</span><span class="hp"><i></i></span><span class="mana"><i></i></span></button>`;
  }

  function updateActors(rebuild = false) {
    const units = T.liveUnits();
    if (rebuild) {
      T.paint('actors', units.map(actorHTML).join(''));
    }
    const inCombat = state.phase === 'battle' || state.phase === 'result';
    $('actors').classList.toggle('in-battle', inCombat);
    for (const u of units) {
      const el = $('actors').querySelector(`[data-actor="${u.id}"]`);
      if (!el) continue;
      el.style.left = (((u.pos % 6) + 0.5) * 100) / 6 + '%';
      el.style.top = ((Math.floor(u.pos / 6) + 0.5) * 100) / 6 + '%';
      el.style.zIndex = 2 + Math.floor(u.pos / 6);
      el.style.transitionDuration = 0.24 / (prefs.speed || 1) + 's';
      el.tabIndex = u.dead ? -1 : 0;
      el.setAttribute('aria-hidden', String(!!u.dead));
      el.classList.toggle('selected', ui.selected === u.id || (ui.inspected === u.id && ui.activeTab === 'unit'));
      el.classList.toggle('dead', !!u.dead);
      el.classList.toggle('shielded', u.shield > 0);
      el.classList.toggle('stunned', inCombat && u.stun > state.battle?.time);
      const stealthed = inCombat && !u.dead && u.stealthUntil > state.battle?.time;
      el.classList.toggle('stealthed', stealthed);
      const hp = el.querySelector('.hp'),
        mana = el.querySelector('.mana');
      hp.hidden = !inCombat;
      mana.hidden = !inCombat;
      if (inCombat) {
        hp.firstElementChild.style.width = Math.max(0, (u.hp / u.maxHp) * 100) + '%';
        mana.firstElementChild.style.width = u.mana + '%';
        const labels = statusDetails(u);
        el.querySelector('.status-mark').textContent = labels
          .filter(x => x !== '已阵亡')
          .map(x =>
            x.startsWith('潜伏')
              ? '潜伏'
              : x.startsWith('影幕')
                ? '影幕'
                : x.startsWith('眩晕')
                  ? '晕'
                  : x.startsWith('减速')
                    ? '慢'
                    : x.startsWith('正在嘲讽')
                      ? '嘲讽'
                      : x.startsWith('受嘲讽')
                        ? '受嘲'
                        : x.startsWith('凋零')
                          ? '凋零'
                          : '盾',
          )
          .join(' · ');
        el.title = E.TYPES[u.type].name + ' · ' + (labels.join(' · ') || '无异常状态');
      }
    }
    renderCombatFocus();
  }

  function statusDetails(u) {
    const t = state.battle?.time || 0,
      labels = [];
    if (u.dead) return ['已阵亡'];
    if (u.ambushPending) labels.push('潜伏待机');
    else if (u.stealthUntil > t) labels.push(`影幕 ${(u.stealthUntil - t).toFixed(1)}s`);
    if (u.stun > t) labels.push(`眩晕 ${(u.stun - t).toFixed(1)}s`);
    if (u.slow > t) labels.push(`减速 ${(u.slow - t).toFixed(1)}s`);
    if (u.taunt > t) labels.push(`正在嘲讽 ${(u.taunt - t).toFixed(1)}s`);
    if (u.targetReason === 'taunt' && u.stun <= t) labels.push('受嘲讽影响');
    if (u.wither > t) labels.push(`凋零 · 回复减半 ${(u.wither - t).toFixed(1)}s`);
    if (u.shield > 0) labels.push(`护盾 ${Math.ceil(u.shield)}`);
    return labels;
  }

  function renderCombatFocus() {
    const b = state.phase === 'battle' ? state.battle : null,
      u = b?.units.find(v => v.id === ui.inspected),
      target =
        u && !u.dead && u.stun <= b.time
          ? b.units.find(v => v.id === u.targetId && !v.dead && !(v.stealthUntil > b.time))
          : null;
    for (const el of $('actors').querySelectorAll('[data-actor]'))
      el.classList.toggle('current-target', !!target && el.dataset.actor === target.id);
    const lines = $('target-link');
    // Built once and painted once: this runs on every battle tick, and the arrow is
    // unchanged in almost all of them.
    let arrow = '';
    if (u && target) {
      const a = T.effectPos(u.pos),
        v = T.effectPos(target.pos),
        dx = v.x - a.x,
        dy = v.y - a.y,
        length = Math.hypot(dx, dy) || 1;
      const start = { x: a.x + (dx / length) * 18, y: a.y + (dy / length) * 18 },
        end = { x: v.x - (dx / length) * 24, y: v.y - (dy / length) * 24 };
      arrow = `<defs><marker id="target-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" marker-end="url(#target-arrow)"/>`;
      lines.classList.toggle('taunt-link', u.targetReason === 'taunt');
    }
    T.paint('target-link', arrow);
    const detail = $('live-status');
    if (!detail || !u) return;
    const labels = statusDetails(u),
      reason = { nearest: '按距离选择', taunt: '受嘲讽影响', skill: '技能选择的目标' };
    T.paint(
      'live-status',
      `<strong>${u.dead ? '已阵亡' : target ? '当前目标 · ' + E.TYPES[target.type].name : u.ambushPending ? '等待潜伏结束' : u.stun > b.time ? '眩晕中，无法行动' : '当前没有可攻击目标'}</strong>${target ? `<small>${reason[u.targetReason] || '当前行动目标'} · 棋盘箭头指向该目标</small>` : ''}<p>${labels.length ? labels.join(' · ') : '无控制或防护状态'}</p>`,
    );
  }

  function renderSelection() {
    const u = T.liveUnits().find(v => v.id === ui.inspected),
      own = state.units.find(v => v.id === ui.selected),
      prep = state.phase === 'prep',
      d = u && E.TYPES[u.type];
    const foes = u
      ? T.liveUnits()
          .filter(v => v.side !== u.side)
          .sort((a, b) => E.distance(u.pos, a.pos) - E.distance(u.pos, b.pos))
      : [];
    const aim = ui.previewAim ?? foes[0]?.pos,
      mode = ui.rangeMode === 'skill' && prep && u;
    let area = [];
    if (mode && u.pos !== null) {
      const all = Array.from({ length: 36 }, (_, i) => i);
      if (['guard', 'knight', 'oakmaul', 'emberguard', 'nightdew'].includes(u.type))
        area = all.filter(p => E.distance(p, u.pos) <= (['guard', 'nightdew'].includes(u.type) ? 3 : 1));
      else if (u.type === 'ancient') area = all;
      else if (
        [
          'healer',
          'oracle',
          'warden',
          'pearl',
          'tideguard',
          'songbird',
          'saltforge',
          'emberdrum',
          'prismguard',
        ].includes(u.type)
      )
        area = T.liveUnits()
          .filter(v => v.side === u.side)
          .map(v => v.pos);
      else if (['rogue', 'breaker'].includes(u.type)) area = foes.map(v => v.pos);
      else if (['hunter', 'stargazer'].includes(u.type))
        area = foes.slice(-(u.type === 'hunter' ? 2 : 1)).map(v => v.pos);
      else if (u.type === 'flarebow') area = foes.slice(0, 2).map(v => v.pos);
      else if (u.type === 'wavecaller' && aim !== undefined)
        area = all.filter(p => Math.floor(p / 6) === Math.floor(aim / 6));
      else if (u.type === 'driftbow' && aim !== undefined) area = all.filter(p => p % 6 === aim % 6);
      else if (aim !== undefined)
        area = all.filter(
          p => E.distance(p, aim) <= (['mage', 'frost', 'hexer', 'mistcaller'].includes(u.type) ? 1 : 0),
        );
    }
    $('board')
      .querySelectorAll('[data-cell]')
      .forEach(el => {
        const p = Number(el.dataset.cell);
        el.classList.toggle('selected', p === own?.pos);
        el.classList.toggle('reachable', !!own && E.canManage(state) && p >= E.HOME);
        el.classList.toggle('attack-range', !!u && u.pos !== null && prep && E.distance(u.pos, p) <= d.range);
        el.classList.toggle('skill-range', !!mode && area.includes(p));
        el.classList.toggle(
          'preview-aim',
          !!mode &&
            p === aim &&
            ['mage', 'frost', 'hexer', 'ranger', 'wavecaller', 'cinder', 'duskblade', 'sparkscout'].includes(u.type),
        );
      });
    const legend = $('range-legend');
    legend.hidden = !u || !prep || u.pos === null;
    legend.textContent = mode ? '金色：普攻射程 · 蓝色：技能预览' : '金色：普通攻击射程 · 在伙伴面板切换技能预览';
  }

  function renderBench() {
    const bench = E.reserves(state);
    T.text('bench-count', `${bench.length} / ${E.BENCH} · 可拖动上阵`);
    T.paint(
      'bench',
      Array.from({ length: E.BENCH }, (_, i) => {
        const u = bench[i];
        return `<button class="bench-slot ${u ? 'occupied' : ''} ${u?.id === ui.selected ? 'selected' : ''}" data-bench="${u?.id || ''}" draggable="${!!u && E.canManage(state)}" aria-label="${u ? E.TYPES[u.type].name + ' 备战伙伴' : '空备战席'}">${u ? `${art(u.type)}<span class="stars">${'★'.repeat(u.star)}</span><span class="unit-name">${E.TYPES[u.type].name}</span>${u.item ? `<span class="equipment-mark">${E.ITEMS[u.item].icon}</span>` : ''}` : '·'}</button>`;
      }).join(''),
    );
  }

  function renderShop() {
    const prep = E.canManage(state);
    T.paint(
      'shop-cards',
      state.shop
        .map((id, index) => {
          if (!id) return '<div class="sold"><strong>❧</strong><span>伙伴已加入旅途</span></div>';
          const d = E.TYPES[id],
            n = state.units.filter(u => u.type === id && u.star === 1).length;
          return `<article class="shop-card ${state.gold >= d.cost ? 'affordable' : ''}" style="--color:${d.color}"><div class="shop-portrait">${art(id)}<span class="card-cost">${T.icon('coin')} ${d.cost}</span><button class="card-info-button" data-codex="${id}" title="查看技能" aria-label="查看 ${d.name} 技能">${T.icon('info')}</button>${n ? `<span class="owned-badge">${n >= 2 ? '✦ 招募即可升星' : '已拥有 ' + n + ' / 3'}</span>` : ''}</div><div class="card-info"><div class="card-name">${d.name}<span>★</span></div><div class="card-tags">${T.factionName(id)} · ${E.ROLES[d.role]}</div><div class="card-stats"><span aria-label="生命 ${d.hp}">${T.icon('health')} ${d.hp}</span><span aria-label="攻击 ${d.atk}">${T.icon('attack')} ${d.atk}</span><span aria-label="护甲 ${d.armor}">${T.icon('shield')} ${d.armor}</span></div><button class="recruit" data-buy="${index}" ${!prep || state.gold < d.cost ? 'disabled' : ''}>${state.gold < d.cost ? '金币不足' : '招募伙伴'} <span>＋</span></button></div></article>`;
        })
        .join(''),
    );
    T.paint('refresh', `↻ 刷新 <span>${state.freeRefresh ? '免费 · ' + state.freeRefresh : '◈ 2'}</span>`);
    $('refresh').disabled = !prep || (!state.freeRefresh && state.gold < 2);
    $('lock').disabled = !prep;
    $('lock').textContent = state.locked ? '▣ 已锁定' : '◇ 锁定';
    $('lock').setAttribute('aria-pressed', String(state.locked));
    T.text(
      'shop-tip',
      state.locked
        ? '已锁定：下场战斗保留本批伙伴。手动刷新仍会替换。'
        : '每场 1 次免费刷新，败后下场 2 次 · 成长位优先补齐一星对子。',
    );
    $('shop-tip').classList.toggle('locked-note', state.locked);
  }

  function renderControls() {
    const fighting = state.phase === 'battle',
      prep = E.canManage(state),
      n = E.deployed(state).length,
      node = E.currentNode(state);
    let label = '开始战斗 →',
      disabled = !n;
    if (state.phase === 'map') {
      disabled = !E.availableNodes(state).some(n => n.id === T.selectedMapNode().id);
      label = disabled ? '选择可达节点' : '前往下一站 →';
    } else if (state.phase === 'merchant') {
      label = '告别商人 →';
      disabled = false;
    } else if (state.phase === 'node-result') {
      label = state.life ? '继续旅途 →' : '查看远征记录';
      disabled = false;
    } else if (['camp', 'event', 'treasure'].includes(state.phase)) {
      label = '先选择本次行动';
      disabled = true;
    } else if (['won', 'lost'].includes(state.phase)) {
      label = '查看远征记录';
      disabled = false;
    } else if (state.phase !== 'prep') disabled = true;
    $('fight').disabled = disabled;
    $('fight').textContent = label;
    $('auto').disabled = !prep;
    $('pause').disabled = !fighting;
    $('pause').textContent = ui.paused ? '▶' : 'Ⅱ';
    $('pause').setAttribute('aria-label', ui.paused ? '继续战斗' : '暂停战斗');
    const phases = {
      map: '规划路线',
      camp: '营地休整',
      merchant: '游商交易',
      event: '林间奇遇',
      treasure: '发现宝箱',
      'node-result': '旅途回响',
      reward: '稀有馈赠',
      result: '战斗结算',
      won: '远征凯旋',
      lost: '旅途暂歇',
      prep: '准备阶段',
    };
    T.text('phase', fighting ? (ui.paused ? '战斗已暂停' : '自动战斗中') : phases[state.phase]);
    $('phase').classList.toggle('fighting', fighting);
    T.text(
      'hint',
      fighting
        ? ui.paused
          ? '已暂停 · 点击伙伴查看目标与状态'
          : '技能会随法力自动释放'
        : state.phase === 'map'
          ? '地图亮边节点可前往'
          : ui.selected
            ? '点击目标棋格或伙伴交换位置'
            : '伙伴保留 · 战后恢复生命',
    );
    T.text(
      'battle-time',
      fighting
        ? `${state.battle.time.toFixed(1)} 秒 · 50 秒后进入加时`
        : state.phase === 'prep'
          ? node.kind === 'boss'
            ? '首领战败则结束远征'
            : '胜利每名阵亡 −2 远征生命，最多 −8'
          : '路线、掉落与事件均按种子保存',
    );
    T.text('speed', '×' + (prefs.speed || 1));
    T.paint('sound', T.icon(prefs.enabled ? 'sound' : 'mute'));
    T.paint('settings', T.icon('settings'));
    $('sound').setAttribute('aria-label', prefs.enabled ? '关闭音效' : '开启音效');
    $('sound').setAttribute('aria-pressed', String(prefs.enabled));
  }

  function primaryAction() {
    if (state.phase === 'prep') T.beginBattle();
    else if (state.phase === 'map') T.enterSelectedNode();
    else if (state.phase === 'merchant') {
      T.action(E.leaveMerchant(state), 'move');
      ui.mapSelected = null;
      render();
    } else if (state.phase === 'node-result') {
      T.action(E.continueNode(state), 'move');
      ui.mapSelected = null;
      render();
      T.showPhase();
    } else if (['won', 'lost'].includes(state.phase)) T.showEnd();
  }

  function renderInspector() {
    const u = state.units.find(u => u.id === ui.inspected) || E.enemyRoster(state).find(u => u.id === ui.inspected);
    if (!u) {
      T.paint('unit-panel', '<div class="unit-empty">❧<br>点击棋盘或备战席伙伴<br>查看技能、属性与装备。</div>');
      return;
    }
    const own = state.units.some(v => v.id === u.id),
      roster = own ? (u.pos === null ? [...E.deployed(state), u] : E.deployed(state)) : E.enemyRoster(state);
    const base = E.unitStats(state, u, own ? 0 : 1, roster),
      d = E.TYPES[u.type],
      live = state.battle?.units.find(v => v.id === u.id),
      prep = E.canManage(state),
      st = state.phase === 'battle' && live ? live : base;
    const value = d.cost * 3 ** (u.star - 1);
    T.paint(
      'unit-panel',
      `<div class="inspector-title"><span class="tiny muted">${own ? '我方伙伴' : '敌方侦察'}${u.pos === null ? ' · 备战席' : ''}</span><button class="quiet" id="clear-selection" title="取消选择">×</button></div><div class="inspect-art">${art(u.type)}</div><div class="inspect-name">${d.name}</div><div class="inspect-tags">${T.factionName(u.type)} · ${E.ROLES[d.role]}${!own ? ' · 敌方' : ''}</div><div class="inspect-stars">${'★'.repeat(u.star)}</div>${state.phase === 'battle' ? '<div class="live-status" id="live-status"></div>' : ''}<div class="stat-grid"><div><small>生命</small><b>${live && state.phase === 'battle' ? Math.ceil(live.hp) + '/' : ''}${st.maxHp}</b></div><div><small>攻击</small><b>${st.atk}</b></div><div><small>护甲</small><b>${st.armor}</b></div><div><small>攻击间隔</small><b>${st.interval.toFixed(2)}s</b></div><div><small>射程</small><b>${st.range} 格</b></div><div><small>技能强度</small><b>${Math.round(st.power * 100)}%</b></div></div><div class="item-equipped">${u.item ? `${E.ITEMS[u.item].icon} ${E.ITEMS[u.item].name}` : '◇ 尚未装备'}${own && prep ? '<button id="manage-equipment">更换装备</button>' : ''}</div>${state.phase === 'prep' && u.pos !== null ? `<div class="range-controls"><button data-range-mode="attack" class="${ui.rangeMode === 'attack' ? 'active' : ''}">普攻射程</button><button data-range-mode="skill" class="${ui.rangeMode === 'skill' ? 'active' : ''}">技能预览</button></div><p class="range-help">${['mage', 'frost', 'hexer', 'ranger', 'wavecaller', 'cinder', 'duskblade', 'sparkscout', 'mistcaller', 'vineclaw', 'driftbow'].includes(u.type) ? '点击敌方棋格或敌人选择预览位置；超出金色射程时需先靠近。' : ['guard', 'nightdew'].includes(u.type) ? '蓝色为嘲讽范围，战斗中影响范围内敌人。' : u.type === 'knight' ? '蓝色为自身与相邻友军的护盾范围。' : ['oakmaul', 'emberguard'].includes(u.type) ? '蓝色为相邻技能范围，需接近敌人后施放。' : ['healer', 'oracle', 'warden', 'pearl', 'tideguard', 'songbird', 'saltforge', 'emberdrum', 'prismguard'].includes(u.type) ? '蓝色为可选友军；技能自动按生命、护盾、攻击或距离选取。' : u.type === 'rogue' ? '蓝色为可能的突袭目标；血量和空位决定实际落点。' : u.type === 'hunter' ? '预览当前最远的两名敌人，目标随站位变化。' : u.type === 'stargazer' ? '预览当前最远的一名敌人，标记随站位变化。' : u.type === 'flarebow' ? '预览当前最近的两名敌人，目标随站位变化。' : u.type === 'breaker' ? '蓝色为可选敌人；优先击破最厚护盾，潜伏敌人不能被选中。' : '蓝色为全场技能范围。'}</p>` : ''}<div class="skill-box"><strong>✧ ${d.skill}</strong><p>${d.desc}</p><small>100 法力自动释放 · 普攻 +21，受击 +6 · 初始 ${Math.round(base.mana)} 法力</small><small>${own && u.pos === null ? '预览假设上阵该伙伴后的羁绊；实际上阵人口仍受限制。' : '属性已计入当前羁绊、装备与遗物。'}</small></div>${u.item ? `<p class="equipped-desc">${E.ITEMS[u.item].desc}</p>` : ''}${own ? `<div class="inspect-actions"><button class="secondary" id="bench-unit" ${!prep || u.pos === null ? 'disabled' : ''}>撤至备战席</button><button class="danger" id="sell-unit" ${!prep ? 'disabled' : ''}>出售 ◈ ${value}</button></div>` : ''}<p class="flavor">“${d.flavor}”</p>`,
    );
    renderCombatFocus();
  }

  function renderLog() {
    T.paint(
      'log',
      ui.logs.length
        ? ui.logs
            .map(
              l => `<div>${l.time !== null ? `<time>${l.time.toFixed(1)}s</time>` : ''}${escapeHTML(l.message)}</div>`,
            )
            .join('')
        : '<p class="empty-note">先调整队伍，森林在等你出发。</p>',
    );
    $('last-report').disabled = !state.report;
  }

  function render() {
    const node = E.currentNode(state);
    T.renderRoute();
    renderStatus();
    renderScouting();
    renderBench();
    renderShop();
    buildBoard();
    updateActors(true);
    renderSelection();
    renderControls();
    setTab(ui.activeTab);
    T.text('stage-label', `第 ${node.act + 1} 章 / ${node.floor + 1} · 9`);
    T.text('stage-title', node.name);
    $('arena').className = 'arena theme-' + node.theme;
    T.paint(
      'stage-modifier',
      `<span>${E.NODES[node.kind].icon} ${E.NODES[node.kind].name}</span><strong>${E.isCombat(node) ? E.AFFIXES[node.affix].name : '一次停留，一次选择'}</strong>`,
    );
    if (state.battle && ['battle', 'result'].includes(state.phase)) {
      T.text(
        'enemy-power',
        `${E.alive(state.battle, 1).length} / ${state.battle.units.filter(u => u.side === 1).length} 存活`,
      );
      T.text(
        'formation-power',
        `${E.alive(state.battle, 0).length} / ${state.battle.units.filter(u => u.side === 0).length} 存活`,
      );
    } else {
      T.text(
        'enemy-power',
        `${E.enemyRoster(state).length} 人 · 战力 ${T.power(E.enemyRoster(state), [], T.enemyScale())}`,
      );
      T.text('formation-power', `${E.deployed(state).length} 人 · 战力 ${T.power(E.deployed(state), state.relics)}`);
    }
    $('onboarding').hidden = !prefs.tip;
    $('battle-progress-bar').style.width =
      state.phase === 'battle' ? Math.min(100, (state.battle.time / 80) * 100) + '%' : '0%';
    T.renderTravel();
  }

  function selectActor(id) {
    const own = state.units.find(u => u.id === id);
    if (!E.canManage(state)) {
      ui.inspected = id;
      setTab('unit');
      updateActors();
      return;
    }
    const enemy = E.enemyRoster(state).find(u => u.id === id);
    if (ui.rangeMode === 'skill' && ui.selected && enemy) {
      ui.previewAim = enemy.pos;
      renderSelection();
      return;
    }
    if (ui.inspected !== id) {
      ui.previewAim = null;
      ui.rangeMode = 'attack';
    }
    if (ui.selected === id) {
      ui.selected = null;
      ui.inspected = id;
      render();
      return;
    }
    if (ui.selected && own && own.pos !== null && ui.selected !== id) {
      const source = state.units.find(u => u.id === ui.selected);
      if (source) {
        const movedId = source.id;
        T.action(E.move(state, source.id, own.pos), 'move');
        ui.inspected = movedId;
        setTab('unit');
        return;
      }
    }
    ui.selected = own ? id : null;
    ui.inspected = id;
    ui.activeTab = 'unit';
    audio.play('click');
    render();
  }

  function moveTo(pos) {
    if (ui.rangeMode === 'skill' && ui.selected && pos !== null && pos < E.HOME) {
      ui.previewAim = pos;
      renderSelection();
      return;
    }
    if (!ui.selected) {
      if (pos !== null) {
        const u = state.units.find(u => u.pos === pos);
        if (u) selectActor(u.id);
      } else T.notify('先选择一位场上的伙伴');
      return;
    }
    const id = ui.selected;
    if (T.action(E.move(state, id, pos), 'move')) {
      ui.selected = id;
      ui.inspected = id;
      render();
    }
  }

  // Surface other modules call. Trimmed to what is actually used across files.
  T.setTab = setTab;
  T.renderStatus = renderStatus;
  T.renderScouting = renderScouting;
  T.updateActors = updateActors;
  T.renderSelection = renderSelection;
  T.renderControls = renderControls;
  T.primaryAction = primaryAction;
  T.renderInspector = renderInspector;
  T.renderLog = renderLog;
  T.render = render;
  T.selectActor = selectActor;
  T.moveTo = moveTo;
})(Tundra);
