/* Reproducible economy-only bots: no bonus money, units or stars are injected. */
'use strict';
const E = require('./engine.js');
function manage(s, style) {
  const favorites = Object.keys(E.TYPES).filter(t => E.hasFaction(t, style));
  const wanted = [...favorites, 'guard', 'healer', 'mage'];
  const desired = Math.min(E.maxCapacity(s), 3 + Math.floor((s.stage + 1) / 3));
  while (s.capacity < desired && s.gold >= E.expandCost(s) + 3) E.expand(s);
  const good = t => {
    const own = s.units.filter(u => u.type === t);
    if (own.some(u => u.star === 3)) return false;
    if (own.length && own.every(u => u.star === 2) && s.units.length >= s.capacity + 4) return false;
    return wanted.includes(t) && (favorites.includes(t) || !own.length || own.some(u => u.star === 1));
  };
  for (let pass = 0; pass < 4; pass++) {
    for (const { i, t } of s.shop
      .map((t, i) => ({ t, i }))
      .filter(x => x.t)
      .sort((a, b) => {
        const score = t =>
          s.units.filter(u => u.type === t && u.star === 1).length * 4 + (favorites.includes(t) ? 3 : 0);
        return score(b.t) - score(a.t);
      }))
      if (good(t) && s.gold >= E.TYPES[t].cost) E.buy(s, i);
    if (pass < 3 && (s.freeRefresh || s.gold >= 7)) E.refresh(s);
    else break;
  }
  // Pick a composition using the same public stats as the player, with role coverage.
  let best = [],
    bestScore = -1;
  const amount = Math.min(s.capacity, s.units.length);
  function find(start, party) {
    if (party.length === amount) {
      const traits = E.traits(party);
      let score = party.reduce((v, u) => {
        const st = E.stats(u, party, s.relics);
        return v + st.maxHp * 0.1 + (st.atk / st.interval) * 2 + (E.TYPES[u.type].role === 'support' ? 15 : 0);
      }, 0);
      if (!party.some(u => E.TYPES[u.type].role === 'guardian')) score *= 0.8;
      if (traits[style] >= 3) score *= 1.1;
      if (score > bestScore) {
        bestScore = score;
        best = [...party];
      }
      return;
    }
    for (let i = start; i <= s.units.length - (amount - party.length); i++) find(i + 1, [...party, s.units[i]]);
  }
  find(0, []);
  s.units.forEach(u => {
    if (u.pos !== null) E.move(s, u.id, null);
  });
  let f = 0,
    b = 0;
  const spread = E.enemyRoster(s).filter(u => ['mage', 'frost'].includes(u.type)).length >= 2;
  const fronts = spread ? [18, 23, 20, 22, 19, 21] : [20, 21, 19, 22, 18, 23],
    backs = spread ? [30, 35, 32, 34, 31, 33] : [32, 33, 31, 34, 30, 35];
  for (const u of best) E.move(s, u.id, E.TYPES[u.type].range === 1 ? fronts[f++] : backs[b++]);
  // Equip appropriate roles, using the normal equip action.
  for (let i = s.bag.length - 1; i >= 0; i--) {
    const item = s.bag[i].replace('_plus', '');
    const ordered = [...best].sort((a, b) => {
      const value = u =>
        E.statScale(u.star) *
        (item === 'buckler'
          ? E.TYPES[u.type].role === 'guardian'
            ? 4
            : 1
          : item === 'wand'
            ? ['mage', 'support'].includes(E.TYPES[u.type].role)
              ? 4
              : 1
            : item === 'charm'
              ? E.TYPES[u.type].role === 'support'
                ? 4
                : 1
              : E.TYPES[u.type].atk / 15);
      return value(b) - value(a);
    });
    const target = ordered.find(u => !u.item);
    if (target) E.equip(s, target.id, i);
  }
}
function rewardScore(s, key) {
  if (key === 'relic:bloodpact') return s.life > 80 ? 3 : -2;
  if (key === 'relic:ration') return 14;
  if (key === 'relic:wisdom') return s.stage < 15 ? 13 : 4;
  if (key === 'relic:edge' || key === 'relic:vigor' || key === 'relic:tempo') return 11;
  if (key === 'relic:bargain') return 4;
  return 8;
}
function routeScore(s, n, risky = false) {
  if (n.kind === 'boss') return 10;
  if (n.kind === 'camp') return s.life < 75 ? 14 : 3;
  if (n.kind === 'treasure') return 12;
  if (n.kind === 'merchant') return s.gold >= 17 ? 7 : 0;
  if (n.kind === 'event') return s.life < 40 ? 8 : 3;
  if (n.kind === 'elite')
    return risky ? 13 : s.life > 65 && E.deployed(s).filter(u => u.star >= 2).length >= 2 + n.act ? 7 : 0;
  return 5;
}
function advance(s, origin, risky = false) {
  if (s.phase === 'prep') {
    manage(s, origin);
    if (!E.validate(s)) throw Error('Bot produced an invalid preparation state');
    const result = E.createBattle(s);
    if (result.error) throw Error(result.error);
    let steps = 0;
    while (!s.battle.result && steps++ < 801) E.step(s.battle);
    E.settlement(s);
    return;
  }
  if (s.phase === 'result') {
    E.continueResult(s);
    return;
  }
  if (s.phase === 'reward') {
    E.takeReward(s, [...s.rewards].sort((a, b) => rewardScore(s, b) - rewardScore(s, a))[0]);
    return;
  }
  if (s.phase === 'map') {
    const options = E.availableNodes(s);
    // Look one stop ahead using only the visible map, so low life can route toward a camp.
    const score = n =>
      routeScore(s, n, risky) +
      Math.max(
        0,
        ...n.next.map(id =>
          routeScore(
            s,
            s.map.find(x => x.id === id),
            risky,
          ),
        ),
      ) *
        0.35;
    E.enterNode(s, [...options].sort((a, b) => score(b) - score(a))[0].id);
    return;
  }
  if (s.phase === 'camp') {
    const gear = E.campOptions(s).sort(
      (a, b) => (b.slot.startsWith('unit:') ? 1 : 0) - (a.slot.startsWith('unit:') ? 1 : 0),
    );
    if (s.life < 80) E.camp(s, 'heal');
    else if (gear.length) E.camp(s, 'forge', gear[0].slot);
    else E.camp(s, 'supplies');
    return;
  }
  if (s.phase === 'merchant') {
    for (const o of [...s.merchant].sort((a, b) => rewardScore(s, b.key) - rewardScore(s, a.key))) {
      if (o.sold) continue;
      if (o.key === 'heal:18') {
        if (s.life < 70 && s.gold >= o.price) E.merchantBuy(s, o.id);
      } else if (s.gold >= o.price + 6 && (o.key.startsWith('relic:') || E.deployed(s).some(u => !u.item)))
        E.merchantBuy(s, o.id);
    }
    E.leaveMerchant(s);
    return;
  }
  if (s.phase === 'treasure') {
    E.treasure(s, 'open');
    return;
  }
  if (s.phase === 'event') {
    const priorities = {
      shrine: s.life > 50 ? 'offer' : 'leave',
      bridge: s.gold >= 5 ? 'ferry' : 'leave',
      trader: s.gold >= 10 ? 'buy' : 'leave',
      spring: s.life < 85 ? 'drink' : 'bottle',
      ruins: risky ? 'dig' : 'salvage',
      wager: s.life < 80 && s.gold >= 4 ? 'trade' : 'leave',
    };
    const options = E.eventOptions(s);
    E.takeEvent(
      s,
      (options.find(o => o.id === priorities[E.currentNode(s).event] && !o.disabled) || options.find(o => !o.disabled))
        .id,
    );
    return;
  }
  if (s.phase === 'node-result') {
    E.continueNode(s);
    return;
  }
  throw Error('Unhandled phase ' + s.phase);
}
function run(seed, origin = 'forest', difficulty = 'normal', risky = false, challenge = 'none') {
  const s = E.newRun({ seed, origin, difficulty, challenge });
  let steps = 0;
  while (!['won', 'lost'].includes(s.phase) && steps++ < 160) {
    advance(s, origin, risky);
    if (!E.validate(s)) throw Error('Invalid state ' + s.phase + ' ' + s.stage);
  }
  if (!['won', 'lost'].includes(s.phase)) throw Error('Campaign failed to terminate');
  return {
    won: s.phase === 'won',
    stage: s.stage + 1,
    life: s.life,
    attempts: s.history.filter(h => h.won !== null).length,
    stars: s.units.map(u => u.star).sort(),
    state: s,
  };
}
if (require.main === module) {
  const n = Number(process.argv[2] || 12),
    rows = [];
  for (const difficulty of ['story', 'normal', 'hard'])
    for (const origin of ['forest', 'astral', 'moon']) {
      const runs = Array.from({ length: n }, (_, i) => run(1000 + i * 37, origin, difficulty));
      rows.push({
        difficulty,
        origin,
        wins: runs.filter(r => r.won).length + '/' + n,
        meanStage: (runs.reduce((a, b) => a + b.stage, 0) / n).toFixed(1),
        meanAttempts: (runs.reduce((a, b) => a + b.attempts, 0) / n).toFixed(1),
        meanLife: (runs.reduce((a, b) => a + b.life, 0) / n).toFixed(1),
      });
    }
  console.table(rows);
}
module.exports = { manage, advance, run };
