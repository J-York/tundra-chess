/* Every modal: reports, rewards, the journal, the codex, settings and the guide. */
(function (T) {
  'use strict';

  function showDialog(kind, html) {
    T.pauseForDialog();
    ui.dialogKind = kind;
    $('modal').dataset.kind = kind;
    $('modal').dataset.chapter = E.CHAPTERS[E.currentNode(state).act].theme;
    T.paint('modal-content', html);
    if (!$('modal').open) $('modal').showModal();
    $('modal-content').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (['result', 'reward'].includes(state.phase) && ['result', 'reward'].includes(ui.dialogKind)) return;
    const previous = ui.dialogKind;
    $('modal').close();
    ui.dialogKind = null;
    if (previous === 'new') showPhase();
  }

  function heading(title, subtitle = '', eyebrow = 'FIELD NOTES', close = true) {
    return `${close ? '<button class="dialog-close" data-close aria-label="关闭窗口">×</button>' : ''}<div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}`;
  }

  function reportTable() {
    const roster = ui.displayedReport.units
        .filter(u => u.side === ui.reportSide)
        .sort((a, b) => b[ui.reportMetric] - a[ui.reportMetric]),
      max = Math.max(1, ...roster.map(u => u[ui.reportMetric]));
    return roster
      .map(
        u =>
          `<div class="report-row ${u.side ? 'enemy' : ''}">${art(u.type)}<span>${E.TYPES[u.type].name}<small class="gold"> ${'★'.repeat(u.star)}</small>${ui.displayedReport.telemetryVersion === 1 ? `<small class="report-survival">${u.deathAt === null ? '存活至结束' : u.deathAt.toFixed(1) + 's 阵亡'} · 施法 ${u.casts}</small>` : ''}</span><div class="bar"><i style="width:${(u[ui.reportMetric] / max) * 100}%"></i></div><span class="value">${u[ui.reportMetric]}</span></div>`,
      )
      .join('');
  }

  function reportSummary() {
    const r = ui.displayedReport,
      info = E.reportInsights(r, ui.reportSide);
    if (!info) return '<p class="report-note">这份旧战报没有记录阵亡时间与承伤类型；新战斗会显示详细分析。</p>';
    const enemies = r.units.filter(u => u.side !== ui.reportSide),
      remaining = enemies.filter(u => u.alive).length;
    return `<div class="report-facts"><div><small>首位阵亡</small><strong>${info.first ? info.first.deathAt.toFixed(1) + 's' : '无人阵亡'}</strong><span>${info.first ? E.TYPES[info.first.type].name : '全员存活至结束'}</span></div><div><small>守卫平均存活</small><strong>${info.guardTime === null ? '未上阵' : info.guardTime.toFixed(1) + 's'}</strong><span>存活者按本场时长统计</span></div><div><small>${ui.reportSide ? '我方' : '敌方'}剩余</small><strong>${remaining} / ${enemies.length}</strong><span>${info.received ? `本侧承伤：物理 ${Math.round(((info.received - info.magic - info.trueDamage) / info.received) * 100)}% · 魔法 ${Math.round((info.magic / info.received) * 100)}% · 真实 ${Math.round((info.trueDamage / info.received) * 100)}%` : '本侧未损失生命'}</span></div></div>${!ui.reportSide && info.advice.length ? `<details class="report-advice" ${!r.won ? 'open' : ''}><summary>下一场可以怎样调整 · ${info.advice.length} 条</summary><div>${info.advice.map(a => `<article><strong>${a.title}</strong><p>${a.evidence}</p><small>${a.action}</small></article>`).join('')}</div></details>` : ''}`;
  }

  function showReport(report, required = false) {
    ui.displayedReport = report;
    ui.reportMetric = 'damage';
    ui.reportSide = 0;
    const detail = report.detail;
    const label =
      state.life <= 0
        ? '查看远征记录 →'
        : report.won && ['elite', 'boss'].includes(report.kind) && state.stage !== 26
          ? '领取稀有馈赠 →'
          : state.stage === 26 && report.won
            ? '完成远征 →'
            : '回到路线地图 →';
    showDialog(
      required ? 'result' : 'report',
      `<div class="report-scroll">${heading(report.won ? (report.casualties ? '胜利，也有它的代价。' : '稳稳拿下这一战。') : '重整队伍，记住这一战。', `${report.name} · ${report.time.toFixed(1)} 秒${report.draw ? ' · 战斗超时' : ''}`, 'BATTLE REPORT / ' + (report.won ? 'VICTORY' : 'DEFEAT'), !required)}<div class="result-heading"><div class="result-emblem">${report.won ? '❧' : '☾'}</div><div class="result-metric">+${report.income} ◈<small>远征生命 ${report.loss ? '−' + report.loss : '未损失'} · 阵亡 ${report.casualties} 名</small></div></div><div class="income-breakdown">${report.won ? `<span>基础 <b>+${detail.base}</b></span><span>利息 <b>+${detail.interest}</b></span><span>连胜 <b>+${detail.streak}</b></span><span>节点 <b>+${detail.path}</b></span><span>遗物 <b>+${detail.relic}</b></span>` : `<span>${report.kind === 'boss' ? '首领战败，远征结束。' : report.lifeAfter === 0 ? '远征生命耗尽，本次旅途结束。' : `撤退补给 +${report.income} 金币；下一场 2 次免费刷新，当前节点不重试。`}</span>`}</div>${report.loot ? `<p class="report-note">✦ 意外收获：${T.lootDescription(report.loot).name}，已放入行囊。</p>` : report.kind === 'battle' && report.won ? '<p class="report-note">本次没有额外掉落。普通战斗胜利有 22% 概率发现装备。</p>' : ''}<div id="report-summary">${reportSummary()}</div><div class="report-tabs"><button class="active" data-metric="damage">伤害</button><button data-metric="healed">治疗</button><button data-metric="blocked">护盾</button>${report.telemetryVersion === 1 ? '<button data-metric="taken" title="实际生命损失，不含护盾吸收">承伤</button>' : ''}${report.mechanicsVersion === 1 ? '<button data-metric="procCount" title="装备与遗物触发次数，包括护盾转法力、暴击治疗等">触发</button>' : ''}<button id="report-side" style="margin-left:auto">我方 ⇄</button></div><div id="report-table">${reportTable()}</div><p class="report-note">所有伙伴战后恢复；星级、装备与阵型保留。远征生命不会自动恢复。</p></div><div class="modal-actions report-actions">${required ? `<button class="primary" id="continue-result">${label}</button>` : '<button class="primary" data-close>回到旅途</button>'}</div>`,
    );
  }

  function showRewards() {
    showDialog(
      'reward',
      `${heading('冒险者应得的珍藏', '这是精英或首领的馈赠。选择一件遗物；有代价的力量也可以放弃。', 'A RARE DISCOVERY', false)}<div class="choices">${state.rewards
        .map(key => {
          const [kind, id] = key.split(':'),
            d = T.lootDescription(key);
          return `<button class="choice" data-reward="${key}"><span class="choice-tag">${kind === 'item' ? '伙伴装备' : id === 'bloodpact' ? '力量与代价' : '全队遗物'}</span><span class="choice-icon">${d.icon}</span><strong>${d.name}</strong><small>${d.desc}</small></button>`;
        })
        .join(
          '',
        )}</div><div class="modal-actions"><button class="quiet" id="skip-reward">不取遗物，继续旅途</button></div><p class="tiny" style="margin-top:14px">永久遗物最多叠加两层，持续到本次远征结束。</p>`,
    );
  }

  function recordEnd() {
    if (state.recorded) return;
    const record = E.runRecord(state);
    if (!record) return;
    if (!records.runs.some(r => r.id === record.id)) {
      records.best = Math.max(records.best, state.completed.length);
      if (record.won) records.wins++;
      records.runs.unshift(record);
      records.runs = records.runs.slice(0, 30);
    }
    try {
      localStorage.setItem(RECORDS, JSON.stringify(records));
      state.recorded = true;
      T.save();
    } catch {
      T.notify('记录暂未写入浏览器，请保留此页并稍后重试。', true);
    }
  }

  function showRecords() {
    const medals = Object.entries(E.CHALLENGES)
      .filter(([id]) => id !== 'none')
      .map(
        ([id, c]) =>
          `<span class="challenge-medal ${records.runs.some(r => r.won && r.challenge === id) ? 'earned' : ''}">${records.runs.some(r => r.won && r.challenge === id) ? '✦' : '◇'} ${c.name}</span>`,
      )
      .join('');
    showDialog(
      'records',
      `${heading('森林记得，走过的每一条路', '本浏览器最近 30 次完成的远征；历史累计凯旋保留。', 'EXPEDITION JOURNAL')}<div class="record-overview"><b>凯旋 ${records.wins} 次</b><span>最远 ${records.best} / 27 站</span></div><div class="challenge-medals">${medals}</div><p class="tiny muted">勋章按保留记录展示。旧版本只有累计次数，没有可还原的阵容。</p><div class="record-list">${records.runs.map((r, i) => `<details class="run-record"><summary><b>${r.won ? '✦ 凯旋' : '☽ 远征结束'}</b><span>${E.DIFFICULTIES[r.difficulty].name} · ${E.CHALLENGES[r.challenge].name}</span><small>${r.completed}/27 站 · ${new Date(r.endedAt).toLocaleDateString('zh-CN')}</small></summary><p class="tiny">${E.ORIGINS[r.origin].name} · 种子 ${r.seed} · 剩余生命 ${r.life} · 收入 ${r.totalGold} 金币</p><div class="record-roster">${r.roster.map(u => `<div>${art(u.type)}<b>${E.TYPES[u.type].name}</b><small>${'★'.repeat(u.star)} · 第 ${Math.floor(u.pos / 6) - 2} 排 ${(u.pos % 6) + 1} 列</small><small>${u.item ? E.ITEMS[u.item].name : '无装备'}</small></div>`).join('')}</div><p class="tiny">遗物：${r.relics.map(id => E.RELICS[id].name).join('、') || '无'}</p><div class="record-route">${r.route.map((h, i) => `<span title="第 ${i + 1} 站 · ${E.NODES[h.kind].name}${h.won === null ? '' : h.won ? ' · 胜利' : ' · 战败'}" class="${h.won === false ? 'route-loss' : ''}">${E.NODES[h.kind].icon}${h.won === false ? '×' : ''}</span>`).join('')}</div><button class="secondary" data-record-replay="${i}">用相同配置再出发 →</button></details>`).join('') || '<div class="empty-record">旅途尚未落笔。完成一轮远征后，阵容、路线与收获会留在这里。</div>'}</div><div class="modal-actions"><button class="primary" data-close>回到旅途</button></div>`,
    );
  }

  function showEnd() {
    recordEnd();
    const won = state.phase === 'won';
    showDialog(
      'end',
      `<div class="final-hero"><span>${won ? '❖' : '☽'}</span></div>${heading(won ? '古树苏醒，森林记得你。' : '长夜之后，仍有新的黎明。', won ? '你与伙伴穿过三章、二十七站旅途，守住了最后的黎明。' : '这次旅途暂时结束。带上经验，下一次走得更远。', won ? 'EXPEDITION COMPLETE' : 'UNTIL THE NEXT DAWN', false)}<div class="end-score"><div><small>完成节点</small><strong>${state.completed.length} / 27</strong></div><div><small>剩余生命</small><strong>${state.life}</strong></div><div><small>收集遗物</small><strong>${state.relics.length}</strong></div><div><small>总获金币</small><strong>${state.totalGold}</strong></div></div><div class="end-roster">${E.deployed(
        state,
      )
        .map(u => `<div>${art(u.type)}<small>${'★'.repeat(u.star)}</small></div>`)
        .join(
          '',
        )}</div><p class="tiny center">${E.DIFFICULTIES[state.difficulty].name}难度 · ${E.ORIGINS[state.origin].name} · 累计凯旋 ${records.wins} 次</p><div class="modal-actions"><button class="quiet" data-close>回望棋盘</button><button class="secondary" id="open-records">远征记录</button><button class="primary" id="new-from-end">开启新的远征 →</button></div>`,
    );
  }

  function showPhase() {
    if (state.phase === 'result') showReport(state.report, true);
    else if (state.phase === 'reward') showRewards();
    else if (['won', 'lost'].includes(state.phase)) showEnd();
  }

  function showNewRun(config = null) {
    ui.newOrigin = config?.origin || state.origin;
    ui.newDifficulty = config?.difficulty || state.difficulty;
    ui.newChallenge = config?.challenge || state.challenge || 'none';
    showDialog(
      'new',
      `${heading('每一段传奇，都有新的起点。', '选择同行的伙伴与旅途难度。', 'A NEW EXPEDITION')}<div class="choices origin-choices">${Object.entries(
        E.ORIGINS,
      )
        .map(
          ([id, o]) =>
            `<button class="choice ${id === ui.newOrigin ? 'selected' : ''}" data-origin="${id}"><div class="origin-art">${o.types.map(art).join('')}</div><strong>${o.icon} ${o.name}</strong><small>${o.desc}<br>初始金币 ${o.gold} · 橡木圆盾 ×1</small></button>`,
        )
        .join('')}</div><div class="difficulty-options">${Object.entries(E.DIFFICULTIES)
        .map(
          ([id, d]) =>
            `<button class="difficulty-option ${id === ui.newDifficulty ? 'selected' : ''}" data-difficulty="${id}"><strong>${d.name}</strong><small>${d.desc}</small></button>`,
        )
        .join(
          '',
        )}</div><label class="challenge-field" for="run-challenge">特殊挑战<select id="run-challenge">${Object.entries(
        E.CHALLENGES,
      )
        .map(([id, c]) => `<option value="${id}" ${id === ui.newChallenge ? 'selected' : ''}>${c.name}</option>`)
        .join(
          '',
        )}</select><small id="challenge-description">${E.CHALLENGES[ui.newChallenge].desc}</small></label><div class="seed-field"><label for="run-seed">地图种子 <small>留空随机生成</small></label><div><input id="run-seed" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="1 — 4294967295" aria-describedby="seed-help" value="${config?.seed ?? ''}"><button class="secondary" id="current-seed">沿用当前种子</button></div><p id="seed-help">相同种子、开局与难度可复现起点；不同招募、路线与布阵会改变后续结果。</p></div><p class="new-run-note">${config ? '配置已填入，当前远征还未改变。' : ''}${config?.rules && config.rules !== E.RULESET ? '该记录来自旧规则版本，重玩会按当前规则生成。' : ''}确认出发后才替换当前进度，累计凯旋记录会保留。</p><div class="modal-actions"><button class="quiet" data-close>继续当前旅途</button><button class="primary" id="confirm-new">准备好，出发 →</button></div>`,
    );
  }

  function newGame() {
    const parsed = E.parseSeed($('run-seed').value);
    if (parsed.error) {
      T.notify(parsed.error, true);
      $('run-seed').focus();
      return;
    }
    T.stopClock();
    state = E.newRun({
      ...(parsed.seed !== null ? { seed: parsed.seed } : {}),
      origin: ui.newOrigin,
      difficulty: ui.newDifficulty,
      challenge: ui.newChallenge,
    });
    ui.selected = null;
    ui.inspected = null;
    ui.mapSelected = null;
    ui.paused = false;
    ui.logs = [];
    ui.lastSaveTick = 0;
    ui.activeTab = 'scout';
    $('modal').close();
    ui.dialogKind = null;
    T.paint('effects', '');
    T.paint('floaters', '');
    T.save();
    T.render();
    audio.play('start');
    T.notify('新的远征开始，森林在等你。');
  }

  function showShare() {
    const url = location.origin + location.pathname + '?' + E.runQuery(state);
    showDialog(
      'share',
      `${heading('把这条路，交给下一位旅人', '分享种子、开局与难度，让朋友从同一个起点出发。', 'SAME SEED, YOUR OWN JOURNEY')}<div class="share-config"><strong>种子 ${state.seed}</strong><span>${E.ORIGINS[state.origin].name} · ${E.DIFFICULTIES[state.difficulty].name} · ${E.CHALLENGES[state.challenge || 'none'].name}</span></div><label class="share-label" for="share-url">远征链接</label><input class="share-url" id="share-url" readonly value="${escapeHTML(url)}"><p class="report-note">链接只包含开局配置，不包含你的存档。对方确认出发后才替换已有远征。${state.ruleset === E.RULESET ? '相同规则版本内，相同选择可以复现同一旅途。' : '当前是旧版远征；重玩会按新版规则生成，敌群与事件可能不同。'}</p><div class="modal-actions"><button class="secondary" id="replay-current">重玩这一种子</button><button class="primary" id="copy-share">复制链接</button></div>`,
    );
  }
  async function copyShare() {
    try {
      await navigator.clipboard.writeText($('share-url').value);
      T.notify('远征链接已复制。');
    } catch {
      $('share-url').focus();
      $('share-url').select();
      T.notify('链接已选中，可手动复制。');
    }
  }

  function openSharedRun() {
    const config = E.parseRunLink(location.search);
    if (!config) return;
    if (config.error) T.notify(config.error, true);
    else showNewRun(config);
    const url = new URL(location.href);
    for (const key of ['seed', 'origin', 'difficulty', 'challenge', 'rules']) url.searchParams.delete(key);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function showSettings() {
    showDialog(
      'settings',
      `${heading('让旅途，合你的心意。', '', 'SOUND & COMFORT')}<label class="settings-row"><span>音效<small>招募、攻击、技能与胜利提示</small></span><input id="pref-enabled" type="checkbox" ${prefs.enabled ? 'checked' : ''}></label><label class="settings-row"><span>林间轻音乐<small>原创合成旋律 · 默认为关闭</small></span><input id="pref-music" type="checkbox" ${prefs.music ? 'checked' : ''}></label><label class="settings-row"><span>音量 <b id="volume-value">${Math.round(prefs.volume * 100)}%</b><small>音效与音乐的总音量</small></span><input id="pref-volume" type="range" min="0" max="100" value="${Math.round(prefs.volume * 100)}" aria-label="总音量"></label><label class="settings-row"><span>减少动态效果<small>关闭飘字、光效与移动动画</small></span><input id="pref-reduced" type="checkbox" ${prefs.reduced ? 'checked' : ''}></label><div class="modal-actions"><button class="secondary" id="preview-sound">♫ 试听音效</button><button class="primary" data-close>回到旅途</button></div><p class="tiny" style="margin-top:14px">切换到其他页面时，战斗和声音会自动暂停。</p>`,
    );
  }

  function showGuide() {
    showDialog(
      'guide',
      `${heading('给初次远征的你', '布阵没有倒计时，慢慢想，选出自己的答案。', 'THE TRAVELER’S FIELD GUIDE')}<div class="guide-grid"><div class="guide-step"><h3>01 · 组建队伍</h3><p>酒馆招募到备战席，点击伙伴再点我方下方三排上阵，也可拖动。点击其他场上伙伴可交换。整队会自动挑选并排好伙伴。</p></div><div class="guide-step"><h3>02 · 升星与羁绊</h3><p>3 个同种、同星伙伴自动合成，最高 3 星。30 位伙伴、5 个阵营与 5 类职业。阵营分 2 / 3 / 4 三档，职业分 2 / 3 档（守卫、法师、辅助有第 4 档）；档次越高，除了数值还会解锁新效果，例如余烬四层的普攻溅射、月影四层的技能暴击。溪羽琴师、星火斥候、盐炉铸师、雾语行者各兼属两个阵营；商人出售的纹章还能为一位伙伴额外接上一个阵营。同一种棋子重复上阵不重复计算羁绊。</p></div><div class="guide-step"><h3>03 · 经济取舍</h3><p>每场战斗 1 次免费刷新，战败后下场 2 次；事件与营地不重置。酒馆成长位优先补齐已有一星对子。胜利按结算前金币每 10 枚给 1 利息，最多 2；三连胜起额外 1 金币。商人出售装备和遗物，预留金币才有选择。</p></div><div class="guide-step"><h3>04 · 观察敌人</h3><p>守卫嘲讽并抵挡伤害，刺客先潜伏 1.5 秒再切入后排，落地后有 1 秒不可选中的影幕保护（仍受范围伤害），法师擅长范围伤害。棋子的站位影响承伤、寻路与技能覆盖。战力是参考，阵型和克制仍然重要。</p></div><div class="guide-step"><h3>05 · 技能与装备</h3><p>法力达到 100 自动施法。物理伤害受护甲减免；魔法仅计 45% 护甲；真实伤害无视护甲。装备每人一件，可免费卸下与交换，出售或合成不丢装备。标记（易伤）提高目标受到的全部伤害，削弱降低对方造成的伤害，两者都只取最高的一层。</p></div><div class="guide-step"><h3>06 · 走自己的路</h3><p>三章共 27 个节点，从相连的地图节点选择路线。普通战斗给金币，22% 掉装备；精英与章节首领胜利选择遗物。营地可恢复 26 远征生命或精制装备。伙伴战后恢复，但胜利阵亡每人损失 2 远征生命，最多 8；普通战败扣更多生命后继续前进，首领战败远征结束。</p></div></div><p class="tiny">空格：开始 / 暂停 · R：刷新酒馆 · M：音效 · Esc：取消选中或关闭普通窗口。存档仅保存在当前浏览器，战斗中退出也可继续。</p><div class="modal-actions"><button class="secondary" id="all-codex">伙伴图鉴</button><button class="secondary" id="guide-builds">构筑手记</button><button class="primary" data-close>心中有数，出发 →</button></div>`,
    );
  }

  function showCodex(type = null, enemies = false) {
    const full = !type && !enemies;
    const types = type
      ? [type]
      : enemies
        ? [...new Set(E.enemyRoster(state).map(u => u.type))]
        : Object.keys(E.TYPES).filter(
            t =>
              E.TYPES[t].cost &&
              (ui.codexFaction === 'all' || E.hasFaction(t, ui.codexFaction)) &&
              (ui.codexRole === 'all' || E.TYPES[t].role === ui.codexRole),
          );
    showDialog(
      'codex',
      `${heading(enemies ? '前方的对手' : '森林伙伴图鉴', '了解技能，再选择适合你的伙伴。', 'COMPANIONS & ABILITIES')}${
        full
          ? `<div class="codex-filters"><label>阵营<select id="codex-faction"><option value="all">所有阵营</option>${Object.entries(
              E.FACTIONS,
            )
              .map(([id, f]) => `<option value="${id}" ${ui.codexFaction === id ? 'selected' : ''}>${f.name}</option>`)
              .join(
                '',
              )}</select></label><label>职业<select id="codex-role"><option value="all">所有职业</option>${Object.entries(
              E.ROLES,
            )
              .map(([id, r]) => `<option value="${id}" ${ui.codexRole === id ? 'selected' : ''}>${r}</option>`)
              .join(
                '',
              )}</select></label><small>显示 ${types.length} / ${Object.values(E.TYPES).filter(d => d.cost).length} 位</small></div><p class="tiny muted">阵营 2 / 3 / 4 档，职业 2 / 3（守卫、法师、辅助到 4）档，可以交叉搭配；双阵营伙伴同时计入两边，纹章还能为一位伙伴额外接上一个阵营。每个角色仍只有一个主动技能。</p>`
          : ''
      }<div class="codex-grid" ${types.length === 1 ? 'style="grid-template-columns:1fr"' : ''}>${
        types
          .map(id => {
            const d = E.TYPES[id];
            return `<article class="codex-card">${art(id)}<h3>${d.name}</h3><small>${T.factionName(id)} · ${E.ROLES[d.role]} · ${d.cost ? '◈ ' + d.cost : '首领'}</small><p>♥ ${d.hp} · ⚔ ${d.atk} · 护甲 ${d.armor}<br>攻击间隔 ${d.interval}s · 射程 ${d.range}</p><small>✧ ${d.skill}</small><p>${d.desc}</p></article>`;
          })
          .join('') || '<p class="tiny">这个组合目前没有伙伴。换一个阵营或职业试试。</p>'
      }</div><div class="modal-actions"><button class="primary" data-close>回到旅途</button></div>`,
    );
  }

  function showTrait(id) {
    const f = E.FACTIONS[id],
      trait = f || E.ROLE_TRAITS[id],
      roster = E.deployed(state),
      held = E.traits(roster)[id] || 0,
      reached = E.tierIndex(id, held),
      types = Object.keys(E.TYPES).filter(
        t => E.TYPES[t].cost > 0 && (f ? E.hasFaction(t, id) : E.TYPES[t].role === id),
      );
    const emblem = f ? E.ITEMS['emblem_' + id] : null;
    showDialog(
      'trait',
      `${heading(trait.icon + ' ' + trait.name, '只计算上阵的不同种类伙伴；重复棋子不会重复增加羁绊层数。', 'SYNERGY NOTES')}<div class="skill-box"><p class="tiny">当前 ${held} 种${reached >= 0 ? ` · 已达成第 ${reached + 1} 档` : ' · 尚未触发'}</p>${trait.desc.map((d, i) => `<p class="${reached === i ? 'gain' : ''}"><b>${trait.thresholds[i]} 种伙伴：</b>${d}</p>`).join('')}${emblem ? `<p class="tiny">${emblem.icon} ${emblem.name}：${emblem.desc}</p>` : ''}</div><div class="codex-grid">${types.map(t => `<article class="codex-card">${art(t)}<h3>${E.TYPES[t].name}</h3><small>${T.factionName(t)} · ${E.ROLES[E.TYPES[t].role]}</small><small>${roster.some(u => u.type === t) ? '✓ 已上阵' : '尚未上阵'}</small><button class="quiet" data-codex="${t}">查看技能 ↗</button></article>`).join('')}</div><div class="modal-actions"><button class="primary" data-close>继续布阵</button></div>`,
    );
  }

  function equipmentDelta(u, item) {
    const roster = u.pos === null ? [...E.deployed(state), u] : E.deployed(state),
      before = E.stats(u, roster, state.relics),
      after = E.stats({ ...u, item }, roster, state.relics);
    const fields = [
      ['maxHp', '生命', 0],
      ['atk', '攻击', 0],
      ['armor', '护甲', 1],
      ['interval', '攻击间隔', 2],
      ['power', '技能强度', '%'],
      ['mana', '初始法力', 0],
      ['healing', '治疗效果', '%'],
      ['leech', '吸血', '%'],
      ['moveInterval', '移动间隔', 2],
      ['crit', '暴击率', '%'],
      ['critPower', '暴击倍率', '%'],
      ['castMana', '施法回蓝', 1],
      ['emergencyShield', '木心护盾', '%'],
      ['resist', '魔法减伤', '%'],
      ['ramp', '每层攻击', '%'],
      ['mark', '技能易伤', '%'],
    ];
    return (
      fields
        .filter(([key]) => Math.abs(before[key] - after[key]) > 0.0001)
        .map(([key, name, precision]) => {
          const fmt = v =>
            precision === '%'
              ? Math.round(v * 100) + '%'
              : Number(v.toFixed(precision)) + (key.endsWith('nterval') ? 's' : '');
          const improved = key.endsWith('nterval') ? after[key] < before[key] : after[key] > before[key];
          return `<span class="${improved ? 'gain' : 'loss'}">${name} ${fmt(before[key])} → ${fmt(after[key])}</span>`;
        })
        .join('') || '<span>当前属性不变</span>'
    );
  }

  function showEquipment() {
    const u = state.units.find(u => u.id === ui.inspected);
    if (!u || !E.canManage(state)) return;
    ui.selected = u.id;
    showDialog(
      'equipment',
      `${heading('为' + E.TYPES[u.type].name + '准备行装', '按当前羁绊与遗物比较更换前后属性。每人一件，原装备返回行囊。', 'EQUIPMENT')}<div class="current-equipment"><strong>当前 · ${u.item ? E.ITEMS[u.item].name : '未装备'}</strong><p>${u.item ? E.ITEMS[u.item].desc : '下方显示更换后的属性，点击即可穿戴。'}</p></div><div class="choices equipment-choices">${state.bag.map((id, i) => `<button class="choice" data-equip="${i}"><span class="choice-icon">${E.ITEMS[id].icon}</span><strong>${E.ITEMS[id].name}</strong><small>${E.ITEMS[id].desc}</small><div class="equipment-deltas">${equipmentDelta(u, id)}</div></button>`).join('')}</div>${!state.bag.length ? '<p class="report-note">行囊暂时没有备用装备。普通战斗偶尔掉落装备，商人与事件也能获得装备。</p>' : ''}<div class="modal-actions">${u.item ? '<button class="secondary" id="unequip">卸下当前装备</button>' : ''}<button class="primary" data-close>继续布阵</button></div>`,
    );
  }

  function showBuilds() {
    const builds = E.buildAdvice(state);
    showDialog(
      'builds',
      `${heading('把行囊，变成一种打法', '按当前上阵伙伴与穿戴装备判断搭配条件。满足条件后，仍需在战斗中触发。', 'BUILD YOUR JOURNEY')}<div class="build-grid">${builds.map(b => `<article class="build-card ${b.active ? 'active' : ''}"><span class="choice-tag">${b.active ? '搭配条件齐备' : b.owned ? '已持有核心遗物' : '可探索方向'}</span><h3>${E.RELICS[b.relic].icon} ${b.name}</h3><p>${b.desc}</p><ul><li class="${b.owned ? 'ready' : ''}">${b.owned ? '✓' : '○'} ${E.RELICS[b.relic].name}</li><li class="${b.ready ? 'ready' : ''}">${b.ready ? '✓' : '○'} ${b.source}</li></ul><small>${E.RELICS[b.relic].desc}。${b.tip}</small></article>`).join('')}</div><details class="gear-catalog"><summary>装备一览 · 每人一件，可在营地精制</summary><div class="build-grid">${E.BASIC_ITEMS.map(id => `<article class="build-card"><h3>${E.ITEMS[id].icon} ${E.ITEMS[id].name}</h3><p>${E.ITEMS[id].desc}</p></article>`).join('')}</div></details><div class="modal-actions"><button class="primary" data-close>继续搭配</button></div>`,
    );
  }

  function showRelic(id) {
    const r = E.RELICS[id];
    showDialog(
      'relic',
      `${heading(r.icon + ' ' + r.name, r.desc, 'RELIC OF THE JOURNEY')}<p class="report-note">当前持有 ${E.count(state.relics, id)} 层 · 整队生效，持续本次远征。</p><div class="modal-actions"><button class="primary" data-close>收好行囊</button></div>`,
    );
  }

  function syncPreferences() {
    audio.configure(prefs);
    document.body.classList.toggle('reduce-motion', prefs.reduced);
    T.syncVisuals();
    T.savePrefs();
    T.renderControls();
  }
  // One delegated click handler keeps generated controls keyboard- and pointer-accessible.

  // Surface other modules call. Trimmed to what is actually used across files.
  T.showDialog = showDialog;
  T.closeDialog = closeDialog;
  T.heading = heading;
  T.reportTable = reportTable;
  T.reportSummary = reportSummary;
  T.showReport = showReport;
  // Driven by the QA pages and the browser harness, not by another module.
  T.showRewards = showRewards;
  T.showRecords = showRecords;
  T.showEnd = showEnd;
  T.showPhase = showPhase;
  T.showNewRun = showNewRun;
  T.newGame = newGame;
  T.showShare = showShare;
  T.copyShare = copyShare;
  T.openSharedRun = openSharedRun;
  T.showSettings = showSettings;
  T.showGuide = showGuide;
  T.showCodex = showCodex;
  T.showTrait = showTrait;
  T.showEquipment = showEquipment;
  T.showBuilds = showBuilds;
  T.showRelic = showRelic;
  T.syncPreferences = syncPreferences;
})(Tundra);
