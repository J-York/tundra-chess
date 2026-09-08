/* The route strip, the chapter map and the travel surface for non-combat stops. */
(function (T) {
  'use strict';

  function renderRoute() {
    const node = E.currentNode(state),
      chapter = E.CHAPTERS[node.act];
    T.paint(
      'route',
      `<button id="open-map" class="route-map-button" title="查看三章路线与首领">⌘ 远征地图 <span>第 ${node.act + 1} 章 · ${chapter.name}</span></button><div class="journey-progress">${Array.from({ length: 9 }, (_, i) => `<span class="journey-step ${i === node.floor ? 'active' : i < node.floor ? 'done' : ''}" title="本章第 ${i + 1} 个节点">${i < node.floor ? '✓' : i === 8 ? '❖' : i + 1}</span>`).join('')}</div><button class="journey-seed" id="share-run" title="分享或重玩相同远征">种子 ${state.seed} ↗</button>`,
    );
  }

  function selectedMapNode() {
    const current = E.currentNode(state),
      options = E.availableNodes(state);
    return state.map.find(n => n.id === ui.mapSelected) || options[0] || current;
  }

  function nodeSummary(node) {
    if (E.isCombat(node))
      return `${node.types.length} 位敌人 · ${E.AFFIXES[node.affix].name} · ${node.kind === 'boss' ? '战败远征结束' : node.kind === 'elite' ? '胜利必选遗物' : '胜利 22% 装备掉落'}`;
    return E.NODES[node.kind].desc;
  }

  function mapHTML(act, large = false) {
    const nodes = state.map.filter(n => n.act === act),
      selected = selectedMapNode(),
      available = E.availableNodes(state).map(n => n.id);
    const x = n => 46 + n.floor * 76,
      y = n => 30 + n.lane * 76;
    const edges = nodes
      .flatMap(n =>
        n.next
          .map(id => state.map.find(m => m.id === id))
          .filter(m => m.act === act)
          .map(
            m =>
              `<path class="${state.visited.includes(n.id) && state.visited.includes(m.id) ? 'walked' : ''}" d="M ${x(n)} ${y(n)} L ${x(m)} ${y(m)}"/>`,
          ),
      )
      .join('');
    return `<div class="map-scroll ${large ? 'large' : ''}"><div class="map-canvas"><svg class="map-lines" viewBox="0 0 704 212" aria-hidden="true">${edges}</svg>${nodes.map(n => `<button class="map-node kind-${n.kind} ${state.completed.includes(n.id) ? 'visited' : ''} ${n.id === state.nodeId ? 'current' : ''} ${available.includes(n.id) ? 'available' : ''} ${selected.id === n.id ? 'selected' : ''}" style="left:${(x(n) / 704) * 100}%;top:${(y(n) / 212) * 100}%" data-map-node="${n.id}" aria-label="第 ${n.floor + 1} 层 ${E.NODES[n.kind].name} ${n.kind === 'event' ? '' : n.name}${available.includes(n.id) ? '，可前往' : ''}${state.completed.includes(n.id) ? '，已完成' : ''}" aria-pressed="${selected.id === n.id}"><b>${state.completed.includes(n.id) ? '✓' : E.NODES[n.kind].icon}</b><small>${E.NODES[n.kind].name}</small></button>`).join('')}</div></div>`;
  }

  function chapterTabs(act) {
    return `<div class="map-chapters">${E.CHAPTERS.map((c, i) => `<button data-map-act="${i}" class="${i === act ? 'active' : ''}">${i + 1} · ${c.name}</button>`).join('')}</div>`;
  }

  function renderTravel() {
    const node = E.currentNode(state),
      travel = ['map', 'camp', 'merchant', 'event', 'treasure', 'node-result'].includes(state.phase);
    $('arena').classList.toggle('travel-mode', travel);
    $('travel-surface').hidden = !travel;
    if (!travel) return;
    const title = (label, subtitle) =>
      `<div class="travel-heading"><span class="eyebrow">${E.CHAPTERS[node.act].name} · 第 ${node.floor + 1} 站</span><h3>${label}</h3><p>${subtitle}</p></div>`;
    if (state.phase === 'map') {
      T.paint(
        'travel-surface',
        `<div class="map-title"><strong>选择下一段旅途</strong><button class="quiet" id="open-map-large">展开地图 ↗</button></div>${mapHTML(node.act)}<p class="map-footnote">亮边节点可前往 · 点击查看，右下角确认 · 首领：${E.CHAPTERS[node.act].boss.name}</p>`,
      );
    } else if (state.phase === 'camp') {
      T.paint(
        'travel-surface',
        title('篝火旁的片刻', '只能选择一项。伙伴生命已恢复；此处补充的是远征生命。') +
          `<div class="travel-choices"><button class="travel-choice" data-camp="heal"><b>♨ 休息</b><span>恢复 ${Math.min(26, 100 - state.life)} / 26 远征生命</span></button><button class="travel-choice" id="camp-forge" ${!E.campOptions(state).length ? 'disabled' : ''}><b>⚒ 精制装备</b><span>一件装备的加成提升 60%</span></button><button class="travel-choice" data-camp="supplies"><b>◈ 搜集物资</b><span>获得 5 金币，放弃休息与精制</span></button></div>`,
      );
    } else if (state.phase === 'merchant') {
      T.paint(
        'travel-surface',
        title(
          '游商的行囊',
          `现有 ${state.gold} 金币。标记的商品可补足队伍搭配；可以买多件，也可以不买，商品不会刷新。`,
        ) +
          `<div class="merchant-grid">${state.merchant
            .map(o => {
              const d = lootDescription(o.key);
              return `<button class="merchant-offer ${o.sold ? 'purchased' : ''}" data-merchant="${o.id}" ${o.sold || state.gold < o.price || (o.key === 'heal:18' && state.life === 100) || (o.key.startsWith('relic:') && E.count(state.relics, o.key.slice(6)) >= 2) ? 'disabled' : ''}><span>${d.icon}</span><div><strong>${d.name}</strong>${o.hint ? `<em>${escapeHTML(o.hint)}</em>` : ''}<small>${d.desc}</small></div><b>${o.sold ? '已购' : '◈ ' + o.price}</b></button>`;
            })
            .join('')}</div>`,
      );
    } else if (state.phase === 'event') {
      const ev = E.EVENTS[node.event];
      T.paint(
        'travel-surface',
        title(ev.icon + ' ' + ev.name, ev.text) +
          `<div class="travel-choices">${E.eventOptions(state)
            .map(
              o =>
                `<button class="travel-choice" data-event-choice="${o.id}" ${o.disabled ? 'disabled' : ''}><b>${o.name}</b><span>${o.desc}</span></button>`,
            )
            .join('')}</div><p class="map-footnote">结果在本次旅途中固定，刷新不会改变运气。</p>`,
      );
    } else if (state.phase === 'treasure') {
      T.paint(
        'travel-surface',
        title('苔藓覆盖的旧箱', '封蜡还完好。你可以取出珍藏，也可以只带走箱边的金币。') +
          `<div class="travel-choices"><button class="travel-choice" data-treasure="open"><b>▣ 打开珍藏</b><span>55% 随机遗物，45% 随机装备</span></button><button class="travel-choice" data-treasure="gold"><b>◈ 稳妥收获</b><span>固定获得 7 金币</span></button></div>`,
      );
    } else
      T.paint(
        'travel-surface',
        `<div class="travel-outcome"><span>${state.life ? '✧' : '☽'}</span><h3>${escapeHTML(state.nodeResult.title)}</h3><p>${escapeHTML(state.nodeResult.message)}</p><small>远征生命 ${state.life} / 100 · 金币 ${state.gold}</small></div>`,
      );
  }

  function lootDescription(key) {
    if (key === 'heal:18') return { icon: '♥', name: '旅途补给', desc: '立即恢复 18 远征生命' };
    const [kind, id] = key.split(':');
    return kind === 'item' ? E.ITEMS[id] : E.RELICS[id];
  }

  function showMap(act = E.currentNode(state).act) {
    if (selectedMapNode().act !== act)
      ui.mapSelected = (
        E.availableNodes(state).find(n => n.act === act) || state.map.find(n => n.act === act && n.kind === 'boss')
      ).id;
    ui.mapAct = act;
    const node = selectedMapNode(),
      reachable = E.availableNodes(state).some(n => n.id === node.id);
    T.showDialog(
      'map',
      `${T.heading('走向下一片森林', '先看路线与首领，再决定这一站冒多大的风险。', 'THE EXPEDITION MAP')}${chapterTabs(act)}<p class="map-boss-note">❖ 本章首领 · ${E.CHAPTERS[act].boss.name}：${E.CHAPTERS[act].boss.tip}</p>${mapHTML(act, true)}<div class="map-preview"><strong>${E.NODES[node.kind].icon} ${node.kind === 'event' ? '未知事件' : node.name}</strong><p>${nodeSummary(node)}</p></div><div class="map-legend">⚔ 遭遇 · ♜ 精英 · ♨ 营地 · ◈ 商人 · ? 事件 · ▣ 宝箱 · ❖ 首领</div><div class="modal-actions"><button class="quiet" data-close>回到旅途</button>${state.phase === 'map' ? `<button class="primary" id="confirm-map-node" ${!reachable ? 'disabled' : ''}>${reachable ? '前往选中节点 →' : '请选择相连的亮边节点'}</button>` : '<span class="tiny muted">完成当前节点后，才能前往下一站。</span>'}</div>`,
    );
  }

  function enterSelectedNode() {
    const node = selectedMapNode();
    if (T.action(E.enterNode(state, node.id), 'move')) {
      ui.mapSelected = null;
      ui.selected = null;
      ui.inspected = null;
      ui.activeTab = 'scout';
      $('modal').close();
      ui.dialogKind = null;
      T.render();
      T.notify(`抵达${node.kind === 'event' ? '未知事件' : node.name}`);
    }
  }

  function showForge() {
    T.showDialog(
      'forge',
      `${T.heading('把这次停留，变成锋芒', '精制一件装备，加成提升 60%；本次营地不再恢复远征生命。', 'CAMP WORKSHOP')}<div class="choices">${E.campOptions(
        state,
      )
        .map(
          o =>
            `<button class="choice" data-forge="${o.slot}"><span class="choice-icon">${E.ITEMS[o.item].icon}</span><strong>${E.ITEMS[o.item].name}</strong><small>${o.name} · 精制后：${E.ITEMS[o.item + '_plus'].desc}</small></button>`,
        )
        .join('')}</div><div class="modal-actions"><button class="quiet" data-close>再想一想</button></div>`,
    );
  }

  // Surface other modules call. Trimmed to what is actually used across files.
  T.renderRoute = renderRoute;
  T.selectedMapNode = selectedMapNode;
  T.nodeSummary = nodeSummary;
  T.renderTravel = renderTravel;
  T.lootDescription = lootDescription;
  T.showMap = showMap;
  T.enterSelectedNode = enterSelectedNode;
  T.showForge = showForge;
})(Tundra);
