'use strict';
const assert = require('node:assert/strict');
const E = require('./engine.js');
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log('✓ ' + name);
}
function fight(s) {
  assert.ok(E.createBattle(s).battle);
  let steps = 0;
  while (!s.battle.result && steps++ < 801) E.step(s.battle);
  assert.ok(s.battle.result, 'combat must terminate');
  return s.battle;
}
function newWith(types) {
  const s = E.newRun({ seed: 123 });
  s.capacity = 6;
  s.units = types.map((t, i) => E.unit(s, t, 18 + i));
  return s;
}
function atNode(s, act, floor, kind = null) {
  const target = s.map.find(n => n.act === act && n.floor === floor && (kind === null || n.kind === kind));
  assert.ok(target, 'fixture node must exist');
  function path(id) {
    if (id === target.id) return [id];
    const n = s.map.find(n => n.id === id);
    if (n.act * 9 + n.floor >= act * 9 + floor) return null;
    for (const next of n.next) {
      const tail = path(next);
      if (tail) return [id, ...tail];
    }
    return null;
  }
  const route = path('0-0-1');
  assert.ok(route);
  s.nodeId = target.id;
  s.stage = act * 9 + floor;
  s.visited = route;
  s.completed = route.slice(0, -1);
  s.phase = E.isCombat(target) ? 'prep' : target.kind;
  s.battle = null;
  return target;
}
function asKind(s, kind) {
  const node = E.currentNode(s);
  node.kind = kind;
  s.phase = E.isCombat(node) ? 'prep' : kind;
  return node;
}
check('All origins have valid, distinct starting positions and meaningful faction bonuses', () => {
  for (const origin of Object.keys(E.ORIGINS)) {
    const s = E.newRun({ seed: 10, origin });
    assert.ok(E.validate(s));
    assert.equal(E.traits(s.units)[origin], 2);
  }
});
check('Purchases debit once, sold slots cannot be bought again, insufficient gold is rejected', () => {
  const s = E.newRun();
  const gold = s.gold;
  E.buy(s, 0);
  assert.equal(s.gold, gold - 2);
  E.buy(s, 0);
  assert.equal(s.gold, gold - 2);
  s.gold = 0;
  assert.ok(E.buy(s, 1).error);
});
check('Merging keeps deployed position, returns extra equipment and supports chain upgrades', () => {
  const s = E.newRun();
  s.units = [E.unit(s, 'guard', 20), E.unit(s, 'guard'), E.unit(s, 'guard')];
  s.units[1].item = 'blade';
  s.units[2].item = 'wand';
  E.merge(s);
  assert.equal(s.units.length, 1);
  assert.equal(s.units[0].star, 2);
  assert.equal(s.units[0].pos, 20);
  assert.equal(s.units[0].item, 'blade');
  assert.ok(s.bag.includes('wand'));
  s.units.push(E.unit(s, 'guard', null, 2), E.unit(s, 'guard', null, 2));
  E.merge(s);
  assert.equal(s.units.length, 1);
  assert.equal(s.units[0].star, 3);
});
check('Full bench allows only purchases which immediately merge', () => {
  const s = E.newRun();
  for (let i = 0; i < 8; i++) s.units.push(E.unit(s, i < 2 ? 'mage' : 'knight'));
  s.gold = 10;
  s.shop = ['ranger', 'mage', null, null, null];
  assert.ok(E.buy(s, 0).error);
  assert.ok(!E.buy(s, 1).error);
  assert.ok(E.reserves(s).length <= 8);
});
check('Deployment enforces population, territory, distinct positions and safe swapping', () => {
  const s = E.newRun();
  const a = E.unit(s, 'mage'),
    b = E.unit(s, 'healer');
  s.units.push(a, b);
  assert.ok(!E.move(s, a.id, 33).error);
  assert.ok(E.move(s, b.id, 34).error);
  assert.ok(E.move(s, b.id, 5).error);
  assert.ok(E.move(s, b.id, 36).error);
  assert.ok(!E.move(s, b.id, 33).error);
  assert.equal(a.pos, null);
  assert.equal(b.pos, 33);
  assert.ok(E.validate(s));
});
check('Equipment swaps/un-equips/sales preserve the inventory', () => {
  const s = E.newRun();
  s.bag = ['blade', 'wand'];
  const id = s.units[0].id;
  E.equip(s, id, 0);
  E.equip(s, id, 0);
  assert.equal(s.units[0].item, 'wand');
  assert.deepEqual(s.bag, ['blade']);
  E.equip(s, id, -1);
  assert.deepEqual(s.bag, ['blade', 'wand']);
  E.equip(s, id, 0);
  const gold = s.gold;
  E.sell(s, id);
  assert.equal(s.gold, gold + 2);
  assert.ok(s.bag.includes('blade'));
});
check('Duplicate types do not stack traits; three distinct forest types regenerate', () => {
  const a = newWith(['guard', 'guard', 'ranger']);
  assert.equal(E.traits(a.units).forest, 2);
  assert.equal(E.stats(a.units[0], a.units).regen, 0);
  a.units[1].type = 'healer';
  assert.equal(E.traits(a.units).forest, 3);
  assert.ok(E.stats(a.units[0], a.units).regen > 0);
  const m = newWith(['mage', 'oracle', 'knight']);
  assert.equal(E.stats(m.units[0], m.units).power, 1.35);
  assert.ok(E.stats(m.units[0], m.units).mana > E.TYPES.mage.mana);
});
check('Free refresh, escalating capacity cost and capped interest follow the visible rules', () => {
  const s = E.newRun();
  const gold = s.gold;
  E.refresh(s);
  assert.equal(s.gold, gold);
  E.refresh(s);
  assert.equal(s.gold, gold - 2);
  s.gold = 61;
  E.expand(s);
  assert.equal(s.gold, 57);
  E.expand(s);
  assert.equal(s.gold, 51);
  E.expand(s);
  assert.equal(s.gold, 43);
  E.expand(s);
  assert.equal(s.gold, 32);
  assert.equal(s.capacity, E.maxCapacity(s));
  assert.ok(E.expand(s).error);
  assert.equal(E.interest(s), 2);
});
check('BFS goes around occupied tiles and never wraps across row edges', () => {
  assert.equal(E.distance(5, 6), 6);
  assert.ok(!E.neighbors(5).includes(6));
  const step = E.pathStep(20, new Set([8]), new Set([14]));
  assert.ok([19, 21].includes(step));
  assert.equal(E.pathStep(20, new Set([8]), new Set([14, 19, 21, 26])), null);
});
check('Armor, magic, true damage and shields use different mitigation rules', () => {
  function amount(kind) {
    const s = newWith(['ranger']);
    E.createBattle(s);
    const b = s.battle,
      u = b.units[0],
      target = b.units[1];
    target.armor = 100;
    target.shield = 0;
    target.hp = 1000;
    return E.hurt(b, u, target, 100, kind);
  }
  assert.equal(amount('physical'), 50);
  assert.equal(amount('magic'), 69);
  assert.equal(amount('true'), 100);
  const s = newWith(['guard']);
  E.createBattle(s);
  const b = s.battle,
    target = b.units[0];
  target.shield = 30;
  const hp = target.hp;
  E.hurt(b, b.units[1], target, 50, 'true');
  assert.equal(hp - target.hp, 20);
  assert.equal(target.blocked, 30);
});
check('Healing does not resurrect; healer clears control; mana support excludes itself', () => {
  const s = newWith(['healer', 'guard', 'oracle']);
  E.createBattle(s);
  const b = s.battle,
    [h, g, o] = b.units;
  g.hp = 10;
  g.stun = 50;
  g.slow = 50;
  E.cast(b, h, b.units[3]);
  assert.ok(g.hp > 10);
  assert.equal(g.stun, 0);
  assert.equal(g.slow, 0);
  h.mana = 0;
  g.mana = 0;
  E.cast(b, o, b.units[3]);
  assert.ok(h.mana > 0 && g.mana > 0);
  assert.equal(o.mana, 0);
  g.dead = true;
  g.hp = 0;
  E.heal(b, h, g, 999);
  assert.equal(g.hp, 0);
});
check('Assassin landing stays unoccupied, frost controls, mage AoE is local, boss enrages', () => {
  const s = newWith(['rogue', 'frost', 'mage']);
  atNode(s, 0, 8);
  E.createBattle(s);
  const b = s.battle;
  assert.equal(new Set(b.units.map(u => u.pos)).size, b.units.length);
  const f = b.units[1],
    target = b.units[3];
  E.cast(b, f, target);
  assert.ok(target.stun > 0);
  const m = b.units[2],
    others = b.units.filter(u => u.side === 1);
  m.atk = 1;
  others.forEach((u, i) => {
    u.pos = [0, 1, 12, 24, 35][i];
    u.hp = 1000;
  });
  E.cast(b, m, others[0]);
  assert.ok(others[1].hp < 1000);
  assert.equal(others[3].hp, 1000);
  const boss = others[0];
  boss.hp = boss.maxHp * 0.49;
  E.step(b);
  assert.ok(boss.furious);
  assert.ok(boss.interval < boss.baseInterval);
});
check('Assassins wait, stay untargetable briefly, take area damage and resume without another jump', () => {
  const s = newWith(['guard', 'rogue', 'hunter']);
  E.createBattle(s);
  const b = s.battle,
    r = b.units[1],
    start = r.pos;
  assert.equal(r.ambushPending, true);
  assert.ok(!b.events.some(e => e.type === 'blink'));
  for (let i = 0; i < 14; i++) E.step(b);
  assert.equal(r.pos, start);
  assert.equal(r.damage, 0);
  assert.equal(r.hp, r.maxHp);
  assert.ok(E.validate(s));
  const restored = E.clone(s);
  E.step(b);
  E.step(restored.battle);
  assert.deepEqual(b, restored.battle);
  assert.equal(r.ambushPending, false);
  assert.ok(b.events.some(e => e.type === 'blink' && e.id === r.id));
  assert.equal(r.stealthUntil, 2.5);
  for (let i = 0; i < 9; i++) {
    E.step(b);
    assert.ok(!b.events.some(e => e.type === 'damage' && e.id === r.id));
  }
  const foe = b.units.find(u => u.side === 1),
    guard = b.units[0];
  foe.type = 'mage';
  guard.pos = 18;
  r.pos = 19;
  const hp = r.hp;
  E.cast(b, foe, guard);
  assert.ok(r.hp < hp, 'area damage must still hit a hidden assassin');
  const saved = E.clone(s);
  assert.ok(E.validate(saved));
  E.step(b);
  E.step(saved.battle);
  assert.deepEqual(b, saved.battle);
  assert.ok(!(r.stealthUntil > b.time));
  foe.pos = 13;
  foe.range = 5;
  foe.attackCd = 0;
  foe.mana = 0;
  r.pos = 7;
  guard.pos = 35;
  b.units[2].pos = 34;
  r.stun = 80;
  r.hp = r.maxHp;
  E.step(b);
  assert.ok(r.hp < r.maxHp, 'normal targeting resumes when protection ends');
  assert.ok(!b.events.some(e => e.type === 'blink' && e.id === r.id));
  const enemy = E.newRun({ seed: 8 });
  E.currentNode(enemy).types = ['rogue', 'hunter'];
  E.createBattle(enemy);
  const er = enemy.battle.units.find(u => u.side === 1 && u.type === 'rogue');
  assert.equal(er.ambushPending, true);
  assert.equal(er.stealthUntil, 2.5);
  const legacy = E.clone(s);
  for (const u of legacy.battle.units) {
    delete u.ambushPending;
    delete u.stealthUntil;
  }
  assert.ok(E.validate(legacy));
  E.step(legacy.battle);
  assert.ok(!legacy.battle.events.some(e => e.type === 'blink'));
  saved.battle.units[1].stealthUntil = Infinity;
  assert.equal(E.validate(saved), false);
});
check('Seeded battles replay exactly and retain legal occupancy throughout', () => {
  const s = E.newRun({ seed: 843 });
  E.buy(s, 2);
  E.autoDeploy(s);
  const a = E.clone(s),
    b = E.clone(s);
  fight(a);
  fight(b);
  assert.deepEqual(a.battle, b.battle);
  const c = E.clone(s);
  E.createBattle(c);
  for (let i = 0; i < 800 && !c.battle.result; i++) {
    E.step(c.battle);
    const positions = E.alive(c.battle).map(u => u.pos);
    assert.equal(new Set(positions).size, positions.length);
  }
});
check('Snapshot restore produces the same combat outcome without restarting', () => {
  const a = E.newRun({ seed: 99 });
  E.buy(a, 2);
  E.autoDeploy(a);
  E.createBattle(a);
  for (let i = 0; i < 17; i++) E.step(a.battle);
  const restored = E.clone(a);
  assert.ok(E.validate(restored));
  while (!a.battle.result) E.step(a.battle);
  while (!restored.battle.result) E.step(restored.battle);
  assert.deepEqual(a.battle, restored.battle);
});
check('Victory settles once; ordinary rewards are occasional, rare rewards persist', () => {
  const s = newWith(['guard', 'ranger', 'mage', 'healer', 'knight', 'oracle']);
  s.units.forEach(u => (u.star = 3));
  s.gold = 25;
  E.currentNode(s).lootRoll = 0.99;
  fight(s);
  E.settlement(s);
  const gold = s.gold;
  assert.equal(s.report.detail.interest, 2);
  assert.ok(E.settlement(s).error);
  assert.equal(s.gold, gold);
  assert.equal(s.report.loot, null);
  E.continueResult(s);
  assert.equal(s.phase, 'map');
  assert.ok(E.validate(s));
  const elite = E.newRun({ seed: 4 });
  asKind(elite, 'elite');
  fight(elite);
  elite.battle.result = { won: true, survivors: 0, time: elite.battle.time };
  E.settlement(elite);
  E.continueResult(elite);
  assert.equal(elite.phase, 'reward');
  const restored = E.clone(elite);
  assert.deepEqual(restored.rewards, elite.rewards);
  assert.ok(E.validate(restored));
  assert.ok(E.takeReward(elite, 'item:not-an-item').error);
  E.takeReward(elite, elite.rewards[0]);
  assert.equal(elite.phase, 'map');
  assert.ok(E.validate(elite));
  assert.ok(E.takeReward(elite, 'relic:edge').error);
});
check('Defeat advances once, preserves companions; bosses and exhausted life end a run', () => {
  const s = E.newRun({ seed: 42 }),
    party = E.clone(s.units);
  E.createBattle(s);
  s.battle.result = { won: false, survivors: 2, time: 12 };
  E.settlement(s);
  assert.equal(s.report.income, 3);
  assert.deepEqual(s.units, party);
  E.continueResult(s);
  assert.equal(s.phase, 'map');
  assert.ok(E.createBattle(s).error);
  assert.ok(E.enterNode(s, s.nodeId).error);
  E.enterNode(s, E.availableNodes(s).find(n => n.kind === 'battle').id);
  assert.equal(s.stage, 1);
  assert.equal(s.phase, 'prep');
  assert.ok(E.validate(s));
  atNode(s, 0, 8);
  E.createBattle(s);
  s.battle.result = { won: false, survivors: 1, time: 12 };
  E.settlement(s);
  E.continueResult(s);
  assert.equal(s.life, 0);
  assert.equal(s.phase, 'lost');
  assert.ok(E.validate(s));
});
check('Three chapters and 27 nodes complete with real combat and normal node transitions', () => {
  const s = newWith(['guard', 'ranger', 'healer', 'knight', 'mage', 'oracle']);
  s.units.forEach(u => (u.star = 3));
  let battles = 0;
  for (let i = 0; i < 120 && !['won', 'lost'].includes(s.phase); i++) {
    if (s.phase === 'prep') {
      fight(s);
      assert.ok(s.battle.result.won, 'battle ' + s.stage);
      E.settlement(s);
      E.continueResult(s);
      battles++;
    } else if (s.phase === 'reward') E.takeReward(s, s.rewards.find(k => k !== 'relic:bloodpact') || s.rewards[0]);
    else if (s.phase === 'map') {
      const options = E.availableNodes(s);
      const next = options.find(n => n.kind === 'camp') || options.find(n => n.kind === 'battle') || options[0];
      E.enterNode(s, next.id);
    } else if (s.phase === 'camp') E.camp(s, 'heal');
    else if (s.phase === 'merchant') E.leaveMerchant(s);
    else if (s.phase === 'event') {
      const opts = E.eventOptions(s);
      E.takeEvent(s, (opts.find(o => o.id === 'leave') || opts.find(o => !o.disabled)).id);
    } else if (s.phase === 'treasure') E.treasure(s, 'gold');
    else if (s.phase === 'node-result') E.continueNode(s);
    else assert.fail('unhandled phase ' + s.phase);
    assert.ok(E.validate(s), 'invalid phase ' + s.phase + ' at ' + s.stage);
  }
  assert.equal(s.phase, 'won');
  assert.equal(s.completed.length, 27);
  assert.ok(battles >= 15);
  assert.equal(new Set(s.history.map(h => h.nodeId)).size, s.history.length);
});
check('Shop lock survives travel; noncombat stops do not grant free refreshes', () => {
  const s = E.newRun();
  s.locked = true;
  const shop = E.clone(s.shop);
  s.freeRefresh = 0;
  s.phase = 'map';
  s.completed = [s.nodeId];
  const next = E.availableNodes(s).find(n => n.kind === 'battle');
  E.enterNode(s, next.id);
  assert.deepEqual(s.shop, shop);
  assert.equal(s.freeRefresh, 1);
  const camp = E.currentNode(s);
  camp.kind = 'camp';
  s.phase = 'camp';
  s.freeRefresh = 0;
  s.life = 50;
  E.camp(s, 'heal');
  assert.equal(s.life, 76);
  assert.equal(s.freeRefresh, 0);
  assert.ok(E.camp(s, 'heal').error);
  E.continueNode(s);
  assert.ok(E.validate(s));
});
check('Corrupt saves with bad units, positions, inventory and phase are rejected', () => {
  for (const change of [
    s => (s.units[0].type = 'garbage'),
    s => (s.units[0].pos = 100),
    s => (s.gold = -1),
    s => (s.phase = 'oops'),
    s => s.bag.push('oops'),
    s => (s.units[1].pos = s.units[0].pos),
    s => (s.capacity = 9),
  ]) {
    const s = E.newRun();
    change(s);
    assert.equal(E.validate(s), false);
  }
});

check('Temporary shields expire without deleting permanent opening protection', () => {
  const s = newWith(['guard']);
  s.relics = ['shelter'];
  E.createBattle(s);
  const b = s.battle,
    u = b.units[0];
  E.cast(b, u, b.units[1]);
  assert.ok(u.shield > 35);
  b.units.forEach(v => {
    v.attackCd = 100;
    v.moveCd = 100;
  });
  for (let i = 0; i < 53; i++) E.step(b);
  assert.equal(u.shield, 35);
  assert.equal(u.tempShield, 0);
});
check('Ranger volley produces three hits, lifesteal heals and thorns do not recurse', () => {
  const s = newWith(['ranger']);
  s.units[0].item = 'fang';
  E.createBattle(s);
  const b = s.battle,
    u = b.units[0],
    target = b.units[1];
  target.hp = target.maxHp = 999;
  u.hp = 20;
  b.events = [];
  E.cast(b, u, target);
  assert.equal(b.events.filter(e => e.type === 'damage').length, 3);
  assert.equal(b.events.filter(e => e.type === 'volley').length, 3);
  assert.ok(u.hp > 20);
  u.thorns = 0.2;
  target.thorns = 0.2;
  const hp = u.hp;
  E.hurt(b, u, target, 40, 'physical', true);
  assert.ok(u.hp < hp + 10);
  assert.ok(Number.isFinite(u.hp));
});
check('An attack does not accumulate free rapid attacks while walking', () => {
  const s = newWith(['guard']);
  E.createBattle(s);
  const b = s.battle,
    u = b.units[0];
  u.pos = 35;
  u.mana = 0;
  u.manaRegen = 0;
  const times = [];
  for (let i = 0; i < 300 && !b.result; i++) {
    E.step(b);
    if (b.events.some(e => e.type === 'attack' && e.id === u.id)) times.push(b.time);
  }
  assert.ok(times.length >= 2);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 1.3, 'walking must not bank attacks');
});
check('Formation protects the backline and materially changes combat performance', () => {
  function simulate(positions) {
    const s = E.newRun({ seed: 17 });
    const node = atNode(s, 0, 5, 'battle');
    Object.assign(node, {
      types: ['knight', 'mage', 'frost', 'oracle', 'hunter'],
      stars: [2, 2, 1, 1, 1],
      scale: 1.1,
      affix: 'none',
      formation: 0,
      act: 0,
    });
    s.capacity = 6;
    s.units = ['guard', 'knight', 'ranger', 'mage', 'healer', 'frost'].map((t, i) =>
      E.unit(s, t, positions[i], i < 3 ? 2 : 1),
    );
    fight(s);
    return { mage: s.battle.units[3].damage, hp: E.alive(s.battle, 0).reduce((n, u) => n + u.hp, 0) };
  }
  const defended = simulate([19, 22, 30, 35, 32, 33]),
    exposed = simulate([31, 34, 19, 20, 21, 22]);
  assert.ok(defended.mage > exposed.mage * 2);
  assert.ok(defended.hp > exposed.hp);
});
check('Overtime fires once, reduces healing and resolves stalled battles at 80 seconds', () => {
  const s = newWith(['guard']);
  E.createBattle(s);
  const b = s.battle;
  for (const u of b.units) {
    u.attackCd = 100;
    u.moveCd = 100;
  }
  let events = 0;
  while (!b.result) {
    E.step(b);
    events += b.events.filter(e => e.type === 'overtime').length;
  }
  assert.equal(events, 1);
  assert.equal(b.result.time, 80);
  assert.ok(b.result.draw);
  assert.equal(b.units[0].healing, 0.5);
});
check('Random rosters terminate without overlapping living units, NaN stats or invalid snapshots', () => {
  const rng = { rng: 7712 },
    types = Object.keys(E.TYPES).filter(t => E.TYPES[t].cost);
  for (let n = 0; n < 75; n++) {
    const s = E.newRun({ seed: n + 100 });
    s.capacity = 6;
    atNode(s, n % 3, (n % 3) * 3, 'battle');
    s.units = Array.from({ length: 1 + (n % 6) }, (_, i) => E.unit(s, E.choose(types, rng), 18 + i, 1 + ((n + i) % 3)));
    E.createBattle(s);
    for (let i = 0; i < 801 && !s.battle.result; i++) {
      E.step(s.battle);
      if (i % 20 === 0) assert.ok(E.validate(s), 'snapshot must validate, roster ' + n + ' tick ' + i);
    }
    assert.ok(s.battle.result);
    E.settlement(s);
    assert.ok(E.validate(s));
  }
});
check('Invalid battle and report fields are rejected before they can break a resumed UI', () => {
  const s = E.newRun();
  E.createBattle(s);
  for (const change of [
    x => delete x.battle.units[0].power,
    x => (x.battle.units[0].interval = 0),
    x => (x.battle.units[0].hp = NaN),
    x => (x.battle.units[0].pos = x.battle.units[1].pos),
  ]) {
    const copy = E.clone(s);
    change(copy);
    assert.ok(!E.validate(copy));
  }
  s.battle.result = { won: true, survivors: 0, time: 1 };
  E.settlement(s);
  s.report.units[0].type = 'missing';
  assert.ok(!E.validate(s));
});
check('Seeded maps are connected, acyclic and varied, with a reachable pre-boss camp', () => {
  const maps = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.newRun({ seed }),
      again = E.newRun({ seed });
    assert.deepEqual(s.map, again.map);
    assert.ok(E.validate(s));
    maps.add(JSON.stringify(s.map.map(n => [n.kind, n.template, n.affix])));
    const reachable = new Set(['0-0-1']);
    for (const n of s.map) {
      if (reachable.has(n.id)) n.next.forEach(id => reachable.add(id));
      if (n.floor === 6) assert.ok(n.next.some(id => s.map.find(v => v.id === id).kind === 'camp'));
    }
    assert.equal(reachable.size, 69);
    assert.equal(s.map.filter(n => n.kind === 'boss').length, 3);
  }
  assert.equal(maps.size, 100);
});
check('Only connected nodes may be entered; money cannot reroll the generated map', () => {
  const s = E.newRun({ seed: 31 }),
    map = E.clone(s.map);
  E.refresh(s);
  assert.deepEqual(s.map, map);
  assert.ok(E.enterNode(s, '2-8-1').error);
  s.phase = 'map';
  s.completed = [s.nodeId];
  assert.ok(E.enterNode(s, '2-8-1').error);
  E.enterNode(s, E.availableNodes(s)[0].id);
  assert.ok(E.validate(s));
});
check('Winning casualties consume expedition life without losing or injuring owned units', () => {
  const s = newWith(['guard', 'ranger', 'healer']),
    party = E.clone(s.units);
  E.createBattle(s);
  s.battle.units[0].dead = true;
  s.battle.units[0].hp = 0;
  s.battle.result = { won: true, survivors: 0, time: 10 };
  E.settlement(s);
  assert.equal(s.report.loss, 2);
  assert.equal(s.life, 98);
  assert.deepEqual(s.units, party);
  const r = E.newRun();
  r.relics = ['ration', 'bloodpact'];
  E.createBattle(r);
  r.battle.units[0].dead = true;
  r.battle.result = { won: true, survivors: 0, time: 5 };
  E.settlement(r);
  assert.equal(r.report.loss, 2);
});
check('Camp forging upgrades exactly one item and cannot also heal', () => {
  const s = E.newRun();
  asKind(s, 'camp');
  s.life = 40;
  E.equip(s, s.units[0].id, 0);
  const hp = E.stats(s.units[0], s.units).maxHp;
  E.camp(s, 'forge', 'unit:' + s.units[0].id);
  assert.equal(s.units[0].item, 'buckler_plus');
  assert.ok(E.stats(s.units[0], s.units).maxHp > hp);
  assert.equal(s.life, 40);
  assert.ok(E.camp(s, 'heal').error);
  E.continueNode(s);
  assert.equal(s.phase, 'map');
});
check('Merchant purchases debit once, preserve offers after reload and reject insufficient funds', () => {
  const s = E.newRun();
  s.phase = 'map';
  s.completed = [s.nodeId];
  const next = E.availableNodes(s)[0];
  next.kind = 'merchant';
  E.enterNode(s, next.id);
  s.gold = 30;
  const copy = E.clone(s);
  assert.deepEqual(copy.merchant, s.merchant);
  assert.ok(E.validate(copy));
  const o = s.merchant[0],
    g = s.gold;
  E.merchantBuy(s, o.id);
  assert.equal(s.gold, g - o.price);
  assert.ok(E.merchantBuy(s, o.id).error);
  s.gold = 0;
  assert.ok(E.merchantBuy(s, '1').error);
  E.leaveMerchant(s);
  assert.equal(s.phase, 'map');
});
check('Event risks are fixed across reloads, optional, and can end an expedition', () => {
  const s = E.newRun({ seed: 128 });
  const n = asKind(s, 'event');
  n.event = 'bridge';
  n.roll = 0.8;
  s.life = 6;
  const r = E.clone(s);
  E.takeEvent(s, 'cross');
  E.takeEvent(r, 'cross');
  assert.deepEqual(s, r);
  assert.equal(s.life, 0);
  assert.ok(E.takeEvent(s, 'leave').error);
  E.continueNode(s);
  assert.equal(s.phase, 'lost');
  assert.ok(E.validate(s));
  const e = E.newRun();
  asKind(e, 'event').event = 'shrine';
  e.life = 8;
  assert.ok(E.takeEvent(e, 'offer').error);
  E.takeEvent(e, 'leave');
  assert.equal(e.life, 8);
});
check('Ordinary drops respect their threshold; optional treasures are single use', () => {
  for (const roll of [0.219, 0.22]) {
    const s = E.newRun();
    E.currentNode(s).lootRoll = roll;
    E.createBattle(s);
    s.battle.result = { won: true, survivors: 0, time: 1 };
    E.settlement(s);
    assert.equal(!!s.report.loot, roll < 0.22);
  }
  const s = E.newRun();
  asKind(s, 'treasure');
  const g = s.gold;
  E.treasure(s, 'gold');
  assert.equal(s.gold, g + 7);
  assert.ok(E.treasure(s, 'open').error);
  E.continueNode(s);
  assert.ok(E.validate(s));
});
check('Corrupt maps, routes, merchant offers and service phases are rejected', () => {
  for (const change of [
    s => s.map[0].next.push('missing'),
    s => (s.map[0].next = ['0-0-1']),
    s => s.visited.push('2-8-1'),
    s => (s.map[0].scale = NaN),
    s => (s.nodeId = 'missing'),
    s => (s.phase = 'camp'),
    s => (s.map[0].types[0] = 'missing'),
    s => (s.merchant = [{ id: '0', price: -1, key: 'item:blade', sold: false }]),
  ]) {
    const s = E.newRun();
    change(s);
    assert.ok(!E.validate(s));
  }
});
check('Retreat funds scale by chapter and only the next battle gets two free refreshes', () => {
  for (let act = 0; act < 3; act++) {
    const s = E.newRun({ seed: 71 });
    atNode(s, act, 0, 'battle');
    E.createBattle(s);
    s.battle.result = { won: false, survivors: 2, time: 1 };
    E.settlement(s);
    assert.equal(s.report.income, 3 + act);
    assert.ok(E.settlement(s).error);
    E.continueResult(s);
    const next = E.availableNodes(s).find(n => n.kind === 'battle');
    E.enterNode(s, next.id);
    assert.equal(s.freeRefresh, 2);
    const gold = s.gold;
    E.refresh(s);
    E.refresh(s);
    assert.equal(s.gold, gold);
    E.refresh(s);
    assert.equal(s.gold, gold - 2);
    assert.ok(E.validate(s));
    E.createBattle(s);
    s.battle.result = { won: true, survivors: 0, time: 1 };
    E.settlement(s);
    E.continueResult(s);
    const fight = E.availableNodes(s).find(n => n.kind === 'battle');
    if (fight) {
      E.enterNode(s, fight.id);
      assert.equal(s.freeRefresh, 1);
    }
  }
});
check('Shop growth slot completes a pair, including beside an existing two-star unit', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.newRun({ seed });
    s.units = [E.unit(s, 'guard', 20, 2), E.unit(s, 'guard'), E.unit(s, 'guard')];
    s.shop = E.rollShop(s);
    assert.ok(s.shop.includes('guard'));
    s.gold = 2;
    E.buy(s, s.shop.indexOf('guard'));
    assert.equal(s.units.filter(u => u.type === 'guard' && u.star === 2).length, 2);
    assert.equal(s.units.length, 2);
  }
  const s = E.newRun({ seed: 3 });
  s.units = [E.unit(s, 'guard', 20, 2), E.unit(s, 'guard'), E.unit(s, 'guard')];
  s.shop = ['guard', null, null, null, null];
  s.gold = 2;
  require('./balance.cjs').manage(s, 'forest');
  assert.equal(
    s.units.filter(u => u.type === 'guard' && u.star === 2).length,
    2,
    'simulation strategy must not refuse the upgrade',
  );
});
check('Early ordinary battles cap their size and chapter two staggers size and star growth', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.newRun({ seed });
    for (const n of s.map.filter(n => n.act === 0 && E.isCombat(n) && n.kind !== 'boss'))
      assert.ok(n.types.length <= (n.kind === 'elite' ? 5 : 4));
    const floors = Array.from({ length: 8 }, (_, f) => s.map.find(n => n.act === 1 && n.floor === f));
    for (let i = 1; i < floors.length; i++)
      if (floors[i].types.length > floors[i - 1].types.length)
        assert.equal(floors[i].stars.filter(v => v === 2).length, floors[i - 1].stars.filter(v => v === 2).length);
  }
});
check('Combat records target reasons, actual damage types, death times and compatible old saves', () => {
  const s = E.newRun({ seed: 843 });
  E.buy(s, 2);
  E.autoDeploy(s);
  E.currentNode(s).formation = 0;
  E.createBattle(s);
  const b = s.battle,
    guard = b.units[0];
  guard.taunt = 5;
  E.step(b);
  assert.ok(b.units.some(u => u.side === 1 && u.targetId === guard.id && u.targetReason === 'taunt'));
  const resumed = E.clone(s);
  assert.ok(E.validate(resumed));
  while (!b.result) E.step(b);
  while (!resumed.battle.result) E.step(resumed.battle);
  assert.deepEqual(b, resumed.battle);
  E.settlement(s);
  const r = s.report;
  assert.equal(r.telemetryVersion, 1);
  for (const u of r.units) {
    assert.ok(Math.abs(u.taken - Object.values(u.takenKinds).reduce((a, b) => a + b, 0)) <= 0.5);
    assert.equal(u.deathAt === null, u.alive);
    if (!u.alive) {
      assert.ok(u.deathAt <= r.time);
      assert.ok(r.units.some(v => v.id === u.killerId));
    }
  }
  assert.ok(Math.abs(r.units.reduce((n, u) => n + u.taken - u.damage, 0)) <= r.units.length);
  assert.ok(E.reportInsights(r));
  const corrupt = E.clone(s);
  corrupt.report.units[0].takenKinds.magic = NaN;
  assert.equal(E.validate(corrupt), false);
  const legacy = E.clone(resumed);
  delete legacy.battle.telemetryVersion;
  delete legacy.battle.startCapacity;
  delete legacy.battle.startGold;
  for (const u of legacy.battle.units)
    for (const key of ['startPos', 'targetId', 'targetReason', 'deathAt', 'killerId', 'taken', 'takenKinds'])
      delete u[key];
  assert.ok(E.validate(legacy));
  E.settlement(legacy);
  assert.equal(legacy.report.telemetryVersion, 0);
  assert.equal(E.reportInsights(legacy.report), null);
  assert.ok(E.validate(legacy));
});
check('Report advice distinguishes recorded evidence from unavailable older details', () => {
  const s = E.newRun({ seed: 19 });
  E.createBattle(s);
  const b = s.battle,
    guard = b.units[0],
    ranger = b.units[1],
    foe = b.units[2];
  b.time = 3;
  E.hurt(b, foe, ranger, 9999, 'magic');
  b.time = 9;
  E.hurt(b, foe, guard, 9999, 'true');
  b.result = { won: false, survivors: 2, time: 9 };
  E.settlement(s);
  const info = E.reportInsights(s.report);
  assert.equal(info.first.type, 'ranger');
  assert.equal(info.first.deathAt, 3);
  assert.equal(info.guardTime, 9);
  assert.ok(info.advice.some(a => a.evidence.includes('3.0')));
  assert.equal(E.reportInsights({ units: s.report.units }), null);
});
check('Thirty companions recruit, merge and leave alternate choices in every faction and role', () => {
  const types = Object.keys(E.TYPES).filter(t => E.TYPES[t].cost);
  assert.equal(types.length, 30);
  for (const faction of Object.keys(E.FACTIONS)) {
    const options = types.filter(t => E.hasFaction(t, faction));
    // Every faction can reach its own top tier, and still reach the tier below it with any one
    // member missing from the tavern.
    assert.ok(options.length >= Math.max(...E.FACTIONS[faction].thresholds));
    for (let omitted = 0; omitted < options.length; omitted++)
      assert.ok(E.traits(options.filter((_, i) => i !== omitted).map(type => ({ type })))[faction] >= 4);
  }
  for (const [role, trait] of Object.entries(E.ROLE_TRAITS)) {
    const options = types.filter(t => E.TYPES[t].role === role);
    assert.ok(options.length >= Math.max(...trait.thresholds), role + ' must have enough companions for its top tier');
  }
  for (const type of ['warden', 'breaker', 'hexer']) {
    const s = E.newRun();
    s.gold = 99;
    s.shop = Array(5).fill(type);
    for (let i = 0; i < 3; i++) assert.ok(!E.buy(s, i).error);
    assert.ok(s.units.some(u => u.type === type && u.star === 2));
    assert.ok(E.validate(s));
  }
  const offered = new Set();
  for (let seed = 1; seed < 140; seed++) E.rollShop(E.newRun({ seed })).forEach(t => offered.add(t));
  assert.equal(offered.size, 30);
  const foes = new Set();
  for (let seed = 1; seed < 20; seed++) E.newRun({ seed }).map.forEach(n => n.types.forEach(t => foes.add(t)));
  for (const t of ['warden', 'breaker', 'hexer']) assert.ok(foes.has(t));
});
check('Warden shields wounded backline and displaces an adjacent attacker without collision', () => {
  const s = newWith(['warden', 'ranger', 'guard']);
  E.createBattle(s);
  const b = s.battle,
    [w, r, g, foe] = b.units;
  w.pos = 35;
  r.pos = 32;
  g.pos = 20;
  r.hp = 20;
  foe.pos = 31;
  E.cast(b, w, foe);
  assert.ok(r.shield > 0);
  assert.ok(foe.slow > b.time);
  assert.ok(E.distance(foe.pos, r.pos) > 1);
  assert.equal(new Set(E.alive(b).map(u => u.pos)).size, E.alive(b).length);
  assert.ok(E.validate(s));
});
check('Breaker prioritizes shields, excludes stealth and does not misreport shield removal as HP damage', () => {
  const s = newWith(['breaker']);
  E.createBattle(s);
  const b = s.battle,
    [u, a, z] = b.units;
  a.shield = 10;
  z.shield = 1000;
  z.tempShield = 1000;
  z.stealthUntil = 5;
  E.cast(b, u, a);
  assert.equal(z.shield, 1000);
  b.time = 6;
  E.cast(b, u, a);
  assert.equal(u.targetId, z.id);
  assert.ok(z.shield < 1000);
  assert.equal(z.hp, z.maxHp);
  assert.equal(z.taken, 0);
  assert.equal(z.tempShield, z.shield);
  assert.ok(b.events.some(e => e.type === 'shatter' && e.value > 0));
});
check('Wither halves direct healing and regeneration, expires and can be cleansed', () => {
  const s = newWith(['healer', 'guard', 'ranger']);
  E.createBattle(s);
  const b = s.battle,
    [h, g, r, caster] = b.units;
  caster.type = 'hexer';
  h.pos = 35;
  g.pos = 20;
  r.pos = 21;
  E.cast(b, caster, g);
  assert.ok(g.wither > b.time && r.wither > b.time);
  assert.equal(h.wither, undefined);
  g.hp = 10;
  g.wither = 5;
  E.heal(b, h, g, 40);
  assert.equal(g.hp, 30);
  g.regen = 0.01;
  b.units.forEach(u => {
    u.stun = 80;
    u.attackCd = 100;
    u.moveCd = 100;
  });
  const hp = g.hp;
  E.step(b);
  assert.ok(Math.abs(g.hp - hp - g.maxHp * 0.01 * 0.1 * 0.5) < 0.0001);
  E.cast(b, h, caster);
  assert.equal(g.wither, 0);
  g.hp = 10;
  E.heal(b, h, g, 40);
  assert.equal(g.hp, 50);
  g.wither = 1;
  b.time = 2;
  g.hp = 10;
  E.heal(b, h, g, 40);
  assert.equal(g.hp, 50);
  const saved = E.clone(s);
  saved.battle.units[0].wither = -1;
  assert.equal(E.validate(saved), false);
});
check('New companions complete deterministic battles and resume their effects', () => {
  for (const type of ['warden', 'breaker', 'hexer']) {
    const s = newWith([type, 'guard', 'healer']);
    E.createBattle(s);
    for (let i = 0; i < 80; i++) E.step(s.battle);
    const resumed = E.clone(s);
    assert.ok(E.validate(resumed));
    while (!s.battle.result) E.step(s.battle);
    while (!resumed.battle.result) E.step(resumed.battle);
    assert.deepEqual(s.battle, resumed.battle);
  }
});
check('Shield damage fuels mana once per second per unit; direct shatter is excluded', () => {
  const s = newWith(['guard']);
  s.relics = ['shelter', 'wardflow'];
  E.createBattle(s);
  const b = s.battle,
    [g, a] = b.units;
  g.shield = 500;
  g.mana = 0;
  E.hurt(b, a, g, 10, 'true');
  assert.equal(g.mana, 18);
  assert.equal(g.procCount, 1);
  E.hurt(b, a, g, 10, 'true');
  assert.equal(g.mana, 24);
  assert.equal(g.procCount, 1);
  b.time = 1;
  E.hurt(b, a, g, 10, 'true');
  assert.equal(g.mana, 42);
  assert.equal(g.procCount, 2);
  a.type = 'breaker';
  g.mana = 0;
  b.time = 2;
  a.atk = 0;
  E.cast(b, a, g);
  assert.equal(g.procCount, 3, 'only the spell damage, not destroyed shield, may trigger');
});
check('Critical healing uses the wounded ally and can feed capped overheal shields', () => {
  const s = newWith(['ranger', 'guard']);
  s.relics = ['moonwell', 'overflow'];
  s.units[0].item = 'moonlens';
  E.createBattle(s);
  const b = s.battle,
    [r, g, foe] = b.units;
  g.hp = 10;
  const hp = g.hp;
  E.hurt(b, r, foe, 5, 'true', true, true);
  assert.equal(g.hp - hp, Math.round(r.atk * 0.45));
  assert.equal(r.procCount, 1);
  assert.equal(r.crit, 0.2);
  assert.equal(r.critPower, 1.75);
  E.hurt(b, r, foe, 5, 'true', true, false);
  assert.equal(r.procCount, 1);
  g.hp = g.maxHp;
  r.hp = r.maxHp;
  E.hurt(b, r, foe, 5, 'true', true, true);
  assert.ok(r.shield > 0 || g.shield > 0);
});
check('Overflow converts only excess active healing, respects wither and caps protection', () => {
  const s = newWith(['healer', 'guard']);
  s.relics = ['overflow'];
  E.createBattle(s);
  const b = s.battle,
    [h, g] = b.units;
  g.hp = g.maxHp - 10;
  E.heal(b, h, g, 100);
  assert.equal(g.hp, g.maxHp);
  assert.equal(g.shield, 45);
  assert.equal(h.healed, 10);
  E.heal(b, h, g, 1000);
  assert.ok(g.shield <= g.maxHp * 0.25);
  const capped = g.shield;
  E.heal(b, h, g, 1000);
  assert.equal(g.shield, capped);
  g.shield = 0;
  g.tempShield = 0;
  g.wither = 5;
  E.heal(b, h, g, 80);
  assert.equal(g.shield, 20);
  g.dead = true;
  g.hp = 0;
  E.heal(b, h, g, 1000);
  assert.equal(g.hp, 0);
  assert.equal(g.shield, 20);
});
check('Chorus tracks every third cast per companion and hourglass refunds after casting', () => {
  const s = newWith(['mage', 'ranger']);
  s.relics = ['chorus'];
  s.units[0].item = 'channel';
  E.createBattle(s);
  const b = s.battle,
    [m, r, foe] = b.units;
  foe.hp = foe.maxHp = 9999;
  E.cast(b, m, foe);
  assert.equal(m.mana, 12);
  assert.equal(m.shield, 0);
  E.cast(b, m, foe);
  assert.equal(m.shield, 0);
  E.cast(b, m, foe);
  assert.equal(m.shield, 24);
  assert.equal(r.shield, 24);
  assert.equal(m.procCount, 4);
  E.cast(b, r, foe);
  assert.equal(r.shield, 24, 'another unit does not inherit cast count');
});
check('Heartwood triggers only once on surviving injury; forging preserves threshold and duration', () => {
  const s = newWith(['guard']);
  s.units[0].item = 'heartwood';
  E.createBattle(s);
  const b = s.battle,
    [g, foe] = b.units;
  g.hp = g.maxHp * 0.5;
  E.hurt(b, foe, g, g.maxHp * 0.2, 'true');
  assert.equal(g.emergencyUsed, true);
  assert.equal(g.shield, Math.round(g.maxHp * 0.25));
  g.shield = 0;
  g.tempShield = 0;
  E.hurt(b, foe, g, 1, 'true');
  assert.equal(g.shield, 0);
  const t = newWith(['guard']);
  t.units[0].item = 'heartwood';
  E.createBattle(t);
  E.hurt(t.battle, t.battle.units[1], t.battle.units[0], 9999, 'true');
  assert.equal(t.battle.units[0].dead, true);
  assert.equal(t.battle.units[0].emergencyUsed, undefined);
  assert.ok(E.ITEMS.heartwood_plus.desc.includes('不高于 40%'));
  assert.ok(E.ITEMS.heartwood_plus.desc.includes('持续 5 秒'));
  assert.equal(E.ITEMS.heartwood_plus.emergencyShield, 0.4);
});
check('Combination readiness follows deployed gear and trigger counters survive saves and reports', () => {
  const s = newWith(['guard', 'healer', 'mage', 'rogue', 'hunter', 'oracle']);
  s.relics = ['wardflow', 'moonwell', 'chorus', 'overflow'];
  s.units[2].item = 'channel';
  s.units[0].item = 'heartwood';
  s.units[4].item = 'moonlens';
  assert.equal(E.buildAdvice(s).filter(b => b.active).length, 4);
  E.createBattle(s);
  for (let i = 0; i < 60 && !s.battle.result; i++) E.step(s.battle);
  const restored = E.clone(s);
  assert.ok(E.validate(restored));
  while (!s.battle.result) E.step(s.battle);
  while (!restored.battle.result) E.step(restored.battle);
  assert.deepEqual(s.battle, restored.battle);
  E.settlement(s);
  assert.ok(E.validate(s));
  assert.ok(s.report.units.some(u => u.procCount > 0));
  const bad = E.clone(s);
  bad.report.units[0].procCount = -1;
  assert.equal(E.validate(bad), false);
  const badBattle = E.clone(restored);
  badBattle.battle.units[0].castWard = NaN;
  assert.equal(E.validate(badBattle), false);
  const empty = newWith(['ranger']);
  empty.relics = ['moonwell'];
  assert.equal(E.buildAdvice(empty).find(b => b.id === 'crit').active, false);
  empty.units[0].item = 'moonlens';
  assert.equal(E.buildAdvice(empty).find(b => b.id === 'crit').active, true);
  empty.units[0].pos = null;
  assert.equal(E.buildAdvice(empty).find(b => b.id === 'crit').active, false);
});
check('Timed shield layers expire separately after refresh, damage, shatter and save restore', () => {
  const s = newWith(['guard']);
  s.relics = ['shelter'];
  E.createBattle(s);
  const b = s.battle,
    [g, foe] = b.units;
  E.cast(b, g, foe);
  const first = g.shield - 35;
  b.time = 3;
  E.cast(b, g, foe);
  const second = g.shield - 35 - first;
  E.hurt(b, foe, g, 20, 'true');
  assert.equal(g.shield, 35 + first + second - 20);
  b.units.forEach(u => {
    u.stun = 80;
    u.attackCd = 100;
    u.moveCd = 100;
  });
  b.time = 4.9;
  const resumed = E.clone(s);
  E.step(b);
  E.step(resumed.battle);
  assert.equal(g.shield, 35 + second);
  assert.deepEqual(b, resumed.battle);
  b.time = 7.9;
  E.step(b);
  assert.equal(g.shield, 35);
  assert.equal(g.shieldLayers.length, 0);
  const invalid = E.clone(resumed);
  invalid.battle.units[0].shieldLayers[0].until = NaN;
  assert.equal(E.validate(invalid), false);
});
check('Merchants offer build complements and freeze recommendations across roster edits and reloads', () => {
  const s = E.newRun({ seed: 120 });
  s.relics = ['moonwell'];
  s.phase = 'map';
  s.completed = [s.nodeId];
  const next = E.availableNodes(s)[0];
  next.kind = 'merchant';
  E.enterNode(s, next.id);
  assert.equal(s.merchant[0].key, 'item:moonlens');
  assert.ok(s.merchant[0].hint.includes('赤月续航'));
  assert.equal(new Set(s.merchant.map(o => o.key)).size, s.merchant.length);
  const offers = E.clone(s.merchant);
  s.units[0].type = 'mage';
  assert.deepEqual(s.merchant, offers);
  assert.deepEqual(E.clone(s).merchant, offers);
  assert.ok(E.validate(s));
  s.gold = 99;
  const relic = s.merchant.find(o => o.key.startsWith('relic:'));
  s.relics.push(relic.key.slice(6), relic.key.slice(6));
  assert.ok(E.merchantBuy(s, relic.id).error);
  assert.equal(s.gold, 99);
});
check('Confluence provides fixed alternatives with exact costs, caps and a safe decline', () => {
  const s = E.newRun({ seed: 32 });
  asKind(s, 'event').event = 'confluence';
  s.gold = 20;
  s.life = 50;
  const before = E.clone(s),
    options = E.eventOptions(s);
  assert.equal(options.length, 3);
  assert.deepEqual(E.eventOptions(E.clone(s)), options);
  const o = options[0];
  E.takeEvent(s, o.id);
  assert.equal(s.gold, 16);
  assert.equal(s.life, 40);
  assert.ok(s.relics.includes(o.key.slice(6)));
  assert.ok(E.takeEvent(s, o.id).error);
  assert.ok(E.validate(s));
  const poor = E.clone(before);
  poor.life = 10;
  assert.ok(E.eventOptions(poor)[0].disabled);
  assert.ok(E.takeEvent(poor, o.id).error);
  assert.equal(poor.gold, 20);
  E.takeEvent(poor, 'leave');
  assert.equal(poor.life, 10);
  assert.equal(poor.gold, 20);
  const full = E.clone(before);
  full.relics = [o.id, o.id];
  assert.ok(E.eventOptions(full).find(x => x.id === o.id).disabled);
  assert.ok(E.takeEvent(full, o.id).error);
});
check('Workshop exchanges one spare basic item, preserves equipped and refined gear, and commits once', () => {
  const s = E.newRun({ seed: 72 });
  asKind(s, 'event').event = 'workshop';
  s.gold = 10;
  s.units[0].item = 'blade';
  s.bag = ['buckler_plus', 'charm', 'charm'];
  const opts = E.eventOptions(s);
  const o = opts[0];
  assert.equal(o.sacrificeItem, 'charm');
  const copy = E.clone(s);
  E.takeEvent(s, o.id);
  E.takeEvent(copy, o.id);
  assert.deepEqual(s, copy);
  assert.equal(s.gold, 7);
  assert.equal(s.units[0].item, 'blade');
  assert.equal(s.bag.filter(i => i === 'charm').length, 1);
  assert.ok(s.bag.includes('buckler_plus'));
  assert.ok(s.bag.includes(o.key.slice(5)));
  assert.ok(E.takeEvent(s, o.id).error);
  assert.ok(E.validate(s));
  const empty = E.newRun();
  asKind(empty, 'event').event = 'workshop';
  empty.bag = ['blade_plus'];
  assert.ok(
    E.eventOptions(empty)
      .slice(0, 2)
      .every(x => x.disabled),
  );
  const before = E.clone(empty);
  assert.ok(E.takeEvent(empty, E.eventOptions(empty)[0].id).error);
  assert.deepEqual(empty, before);
  E.takeEvent(empty, 'leave');
  assert.equal(empty.bag[0], 'blade_plus');
});
check('Seed input validates bounds, blank randomness and rejects ambiguous formats', () => {
  assert.deepEqual(E.parseSeed(''), { seed: null });
  assert.deepEqual(E.parseSeed(' 001 '), { seed: 1 });
  assert.equal(E.parseSeed('4294967295').seed, 4294967295);
  for (const seed of ['0', '-1', '1.2', '1e3', '0x12', '4294967296', 'NaN', 'Infinity', '<script>'])
    assert.ok(E.parseSeed(seed).error, seed);
  for (const seed of [NaN, Infinity, -1, 1.5, 4294967296]) assert.throws(() => E.newRun({ seed }));
});
check('Share configuration preserves seed, origin and difficulty without accepting prototype keys', () => {
  for (const seed of [1, 123456, 4294967295])
    for (const origin of Object.keys(E.ORIGINS))
      for (const difficulty of Object.keys(E.DIFFICULTIES)) {
        const s = E.newRun({ seed, origin, difficulty }),
          config = E.parseRunLink('?' + E.runQuery(s));
        assert.equal(config.seed, seed);
        assert.equal(config.origin, origin);
        assert.equal(config.difficulty, difficulty);
        const again = E.newRun(config);
        assert.deepEqual(again.map, s.map);
        assert.deepEqual(again.units, s.units);
        assert.deepEqual(again.shop, s.shop);
        assert.ok(E.validate(again));
      }
  assert.equal(E.parseRunLink('?unrelated=1'), null);
  for (const query of [
    '?seed=',
    '?seed=1&seed=2',
    '?seed=1&origin=constructor',
    '?seed=1&difficulty=__proto__',
    '?seed=1&rules=old',
    '?seed=1&origin=moon&origin=forest',
  ])
    assert.ok(E.parseRunLink(query).error, query);
});
check('Shared configurations produce identical fights and keep older save compatibility', () => {
  const a = E.newRun({ seed: 771, origin: 'moon', difficulty: 'hard' }),
    b = E.newRun(E.parseRunLink(E.runQuery(a)));
  fight(a);
  fight(b);
  assert.deepEqual(a.battle, b.battle);
  const old = E.clone(a);
  delete old.ruleset;
  assert.ok(E.validate(old));
  old.ruleset = 'unknown';
  assert.equal(E.validate(old), false);
});
check('Challenges enforce capacity, interest and equipment across save and share boundaries', () => {
  for (const challenge of Object.keys(E.CHALLENGES)) {
    const s = E.newRun({ seed: 551, challenge });
    s.gold = 100;
    while (s.capacity < E.maxCapacity(s)) assert.ok(!E.expand(s).error);
    assert.ok(E.expand(s).error);
    assert.equal(E.interest(s), challenge === 'scarcity' ? 0 : 2);
    const result = E.equip(s, s.units[0].id, 0);
    assert.equal(!!result.error, challenge === 'bare');
    assert.ok(E.validate(s));
    const config = E.parseRunLink(E.runQuery(s));
    assert.equal(config.challenge, challenge);
    assert.equal(E.newRun(config).challenge, challenge);
    const old = E.newRun();
    delete old.challenge;
    assert.ok(E.validate(old));
  }
  const q = E.newRun({ challenge: 'quartet' });
  q.capacity = 5;
  assert.equal(E.validate(q), false);
  const b = E.newRun({ challenge: 'bare' });
  b.units[0].item = 'blade';
  assert.equal(E.validate(b), false);
  assert.throws(() => E.newRun({ challenge: 'constructor' }));
  assert.ok(E.parseRunLink('?seed=1&challenge=constructor').error);
  assert.ok(E.parseRunLink('?seed=1&challenge=bare&challenge=quartet').error);
  const s = E.newRun({ challenge: 'scarcity' });
  s.gold = 25;
  fight(s);
  E.settlement(s);
  assert.equal(s.report.detail.interest, 0);
});
check('Journal snapshots keep final formation, gear, route and challenge without sharing mutable data', () => {
  const s = E.newRun({ seed: 123, challenge: 'quartet' });
  assert.equal(E.runRecord(s), null);
  s.phase = 'lost';
  s.units[0].item = 'blade';
  s.relics = ['moonwell'];
  s.history = [{ kind: 'battle', won: false }];
  const r = E.runRecord(s, 123456);
  assert.ok(E.validRecord(r));
  s.units[0].star = 3;
  s.relics.push('spark');
  assert.equal(r.roster[0].star, 1);
  assert.equal(r.relics.length, 1);
  assert.equal(r.roster[0].item, 'blade');
  assert.equal(r.challenge, 'quartet');
  assert.equal(r.route[0].won, false);
  for (const mutate of [
    r => (r.roster[0].type = '<script>'),
    r => (r.relics = ['constructor']),
    r => (r.completed = 28),
    r => (r.seed = -1),
    r => (r.route = [null]),
    r => (r.id = '<script>'),
    r => (r.challenge = '__proto__'),
  ]) {
    const bad = E.clone(r);
    mutate(bad);
    assert.equal(E.validRecord(bad), false);
  }
});
check('Dual factions bridge compositions without double-counting duplicates or bench units', () => {
  const s = newWith(['songbird', 'songbird', 'tideguard', 'guard', 'sparkscout', 'knight']);
  const t = E.traits(s.units);
  assert.equal(t.forest, 2);
  assert.equal(t.tide, 2);
  assert.equal(t.astral, 2);
  assert.equal(t.ember, 1);
  assert.equal(t.support, 1);
  s.units[2].pos = null;
  assert.equal(E.traits(E.deployed(s)).tide, 1);
  assert.deepEqual(E.factionIds('songbird'), ['tide', 'forest']);
  assert.deepEqual(E.factionIds('sparkscout'), ['ember', 'astral']);
  assert.equal(Object.keys(E.FACTIONS).length, 5);
  assert.equal(Object.keys(E.ROLE_TRAITS).length, 5);
});
check('New faction and role bonuses have distinct, bounded effects and feed existing builds', () => {
  // The numbers come from the trait table itself: tuning a tier stays legal, wiring it to the
  // wrong stat or to the wrong companions does not.
  const tide = E.TRAIT_DEFS.tide.tiers,
    ember = E.TRAIT_DEFS.ember.tiers,
    wind = E.TRAIT_DEFS.ranger.tiers,
    song = E.TRAIT_DEFS.support.tiers,
    night = E.TRAIT_DEFS.assassin.tiers;
  let s = newWith(['tideguard', 'wavecaller', 'guard']);
  assert.equal(E.stats(s.units[2], s.units).startShield, tide[0].shield);
  s.units.push(E.unit(s, 'pearl', 25));
  assert.equal(E.stats(s.units[2], s.units).startShield, tide[1].shield);
  assert.equal(E.stats(s.units[2], s.units).healing, 1 + tide[1].healing);
  s.relics = ['wardflow'];
  assert.ok(E.buildAdvice(s).find(b => b.id === 'ward').active);
  s = newWith(['cinder', 'flarebow', 'ranger']);
  assert.equal(E.stats(s.units[2], s.units).atk, Math.round(E.TYPES.ranger.atk * (1 + ember[0].atk)));
  s.units.push(E.unit(s, 'emberguard', 25));
  assert.equal(E.stats(s.units[2], s.units).atk, Math.round(E.TYPES.ranger.atk * (1 + ember[1].atk)));
  assert.equal(E.stats(s.units[2], s.units).interval, E.TYPES.ranger.interval / (1 + ember[1].haste + wind[0].haste));
  s = newWith(['pearl', 'healer', 'guard']);
  assert.equal(E.stats(s.units[0], s.units).healing, 1 + song[0].healing);
  assert.equal(E.stats(s.units[2], s.units).healing, 1);
  s = newWith(['sparkscout', 'duskblade', 'guard']);
  assert.equal(E.stats(s.units[0], s.units).crit, night[0].crit);
  assert.equal(E.stats(s.units[2], s.units).crit, 0);
  s.relics = ['moonwell'];
  assert.ok(E.buildAdvice(s).find(b => b.id === 'crit').active);
});
check('Cleave and furnace skills affect adjacent enemies but have different defensive payoffs', () => {
  for (const type of ['oakmaul', 'emberguard']) {
    const s = newWith([type]);
    E.createBattle(s);
    const b = s.battle,
      u = b.units[0],
      foes = b.units.filter(v => v.side);
    u.pos = 20;
    u.hp = 50;
    foes.forEach((v, i) => {
      v.pos = i ? 0 : 19;
      v.hp = v.maxHp = 1000;
      v.shield = 0;
    });
    const hp = u.hp;
    E.cast(b, u, foes[0]);
    assert.ok(foes[0].hp < 1000);
    assert.equal(foes[1].hp, 1000);
    if (type === 'oakmaul') {
      assert.ok(u.hp > hp);
      assert.equal(u.shield, 0);
    } else {
      assert.equal(u.hp, hp);
      assert.ok(u.shield > 0);
    }
  }
});
check('Tide protection picks a wounded ally, pearl rescues one, and songbird protects strongest attackers', () => {
  const s = newWith(['tideguard', 'ranger', 'guard', 'pearl', 'songbird']);
  E.createBattle(s);
  const b = s.battle,
    [t, r, g, p, h] = b.units,
    foe = b.units.find(u => u.side);
  b.units.forEach(u => {
    u.shield = 0;
    u.shieldLayers = [];
  });
  g.hp = 10;
  r.hp = 60;
  t.hp = t.maxHp;
  E.cast(b, t, foe);
  assert.ok(t.shield > 0);
  assert.ok(g.shield > 0);
  assert.equal(r.shield, 0);
  const beforeR = r.hp;
  E.cast(b, p, foe);
  assert.ok(g.hp > 10);
  assert.equal(r.hp, beforeR);
  b.units
    .filter(u => !u.side)
    .forEach(u => {
      u.shield = 0;
      u.shieldLayers = [];
    });
  r.atk = 200;
  g.atk = 180;
  E.cast(b, h, foe);
  assert.ok(r.shield > 0);
  assert.ok(g.shield > 0);
  assert.equal(t.shield, 0);
  assert.equal(p.shield, 0);
  const solo = newWith(['tideguard']);
  E.createBattle(solo);
  const a = solo.battle.units[0];
  a.shield = 0;
  E.cast(solo.battle, a, solo.battle.units[1]);
  assert.equal(a.shield, Math.round(65 + a.atk), 'solo guard gains exactly one shield');
});
check('Horizontal wave respects rows and cinder concentrates damage on a single target', () => {
  for (const type of ['wavecaller', 'cinder']) {
    const s = newWith([type]);
    E.createBattle(s);
    const b = s.battle,
      u = b.units[0],
      foes = b.units.filter(v => v.side);
    foes[0].pos = 0;
    foes[1].pos = 5;
    foes.forEach(v => {
      v.hp = v.maxHp = 1000;
      v.shield = 0;
    });
    E.cast(b, u, foes[0]);
    assert.ok(foes[0].hp < 1000);
    assert.equal(foes[1].hp < 1000, type === 'wavecaller');
  }
});
check('Flarebow selects nearest two visible foes and new assassins inherit delayed safe entry', () => {
  const s = newWith(['flarebow']);
  E.createBattle(s);
  const b = s.battle,
    u = b.units[0],
    foes = b.units.filter(v => v.side);
  u.pos = 20;
  const third = { ...E.clone(foes[0]), id: 'e-extra', pos: 2 };
  b.units.push(third);
  foes.push(third);
  foes.forEach((v, i) => {
    v.pos = [19, 14, 2][i];
    v.hp = v.maxHp = 1000;
    v.shield = 0;
  });
  E.cast(b, u, foes[0]);
  assert.ok(foes[0].hp < 1000 && foes[1].hp < 1000);
  assert.equal(third.hp, 1000);
  foes[0].stealthUntil = 10;
  third.hp = 1000;
  E.cast(b, u, foes[1]);
  assert.ok(third.hp < 1000);
  for (const type of ['duskblade', 'sparkscout']) {
    const q = newWith([type]);
    E.createBattle(q);
    const a = q.battle.units[0],
      pos = a.pos;
    for (let i = 0; i < 14; i++) E.step(q.battle);
    assert.equal(a.pos, pos);
    assert.equal(a.damage, 0);
    assert.ok(a.ambushPending);
    E.step(q.battle);
    assert.equal(a.ambushPending, false);
    assert.ok(a.stealthUntil > q.battle.time);
  }
});
check('Duskblade self-heals while sparkscout interrupts the struck target', () => {
  for (const type of ['duskblade', 'sparkscout']) {
    const s = newWith([type]);
    E.createBattle(s);
    const b = s.battle,
      u = b.units[0],
      foe = b.units.find(v => v.side);
    u.hp = 30;
    foe.hp = foe.maxHp = 9999;
    foe.shield = 0;
    E.cast(b, u, foe);
    assert.ok(foe.hp < 9999);
    if (type === 'duskblade') assert.ok(u.hp > 30);
    else {
      assert.equal(u.hp, 30);
      assert.equal(foe.stun, b.time + 1);
    }
  }
});
check('All ten additions recruit, star up, appear as enemies and survive deterministic battle saves', () => {
  const added = [
    'oakmaul',
    'duskblade',
    'tideguard',
    'wavecaller',
    'pearl',
    'songbird',
    'emberguard',
    'cinder',
    'flarebow',
    'sparkscout',
  ];
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) E.newRun({ seed }).map.forEach(n => n.types.forEach(t => seen.add(t)));
  for (const type of added) {
    assert.ok(seen.has(type), type);
    const s = E.newRun({ seed: 441 });
    s.gold = 99;
    s.shop = Array(5).fill(type);
    for (let i = 0; i < 3; i++) assert.ok(!E.buy(s, i).error);
    const u = s.units.find(u => u.type === type);
    assert.equal(u.star, 2);
    assert.ok(!E.move(s, u.id, 31).error);
    E.createBattle(s);
    for (let i = 0; i < 25 && !s.battle.result; i++) E.step(s.battle);
    const resumed = E.clone(s);
    assert.ok(E.validate(resumed));
    while (!s.battle.result) E.step(s.battle);
    while (!resumed.battle.result) E.step(resumed.battle);
    assert.deepEqual(s.battle, resumed.battle);
  }
});
check('Old twelve-hero saves and journal records remain readable while old share links identify their version', () => {
  const fixture = require('./tests/legacy-twelve-save.json'),
    s = E.clone(fixture.save);
  assert.ok(E.validate(s));
  while (!s.battle.result) E.step(s.battle);
  assert.equal(
    require('node:crypto').createHash('sha256').update(JSON.stringify(s.battle)).digest('hex'),
    fixture.battleDigest,
  );
  assert.ok(E.parseRunLink('?seed=771&rules=twelve-1').error);
  s.phase = 'lost';
  s.life = 0;
  const r = E.runRecord(s);
  assert.equal(r.rules, 'twelve-1');
  assert.ok(E.validRecord(r));
});
check('Every faction is equally reachable in the tavern and every origin opens on comparable value', () => {
  const recruitable = Object.keys(E.TYPES).filter(t => E.TYPES[t].cost > 0);
  // Sample the offer pool through the public shop roll, ignoring the growth slot that
  // deliberately repeats a companion the player already owns.
  const s = E.newRun({ seed: 4242 });
  s.units = [];
  const seen = {};
  for (let i = 0; i < 8000; i++) for (const type of E.rollShop(s)) seen[type] = (seen[type] || 0) + 1;
  const perFaction = {};
  let total = 0;
  for (const type of recruitable) {
    total += seen[type] || 0;
    for (const faction of E.factionIds(type)) perFaction[faction] = (perFaction[faction] || 0) + (seen[type] || 0);
  }
  assert.equal(Object.keys(perFaction).length, Object.keys(E.FACTIONS).length, 'every faction must be offered');
  const shares = Object.values(perFaction).map(n => n / total);
  assert.ok(
    Math.max(...shares) / Math.min(...shares) < 1.15,
    'faction offer rates must stay within 15%: ' + JSON.stringify(perFaction),
  );

  const values = [];
  for (const [id, origin] of Object.entries(E.ORIGINS)) {
    const run = E.newRun({ seed: 99, origin: id });
    assert.ok(E.validate(run), id + ' must start valid');
    assert.equal(E.traits(run.units)[id], 2, id + ' must open on its own two-companion bond');
    assert.ok(
      origin.opening.some(t => E.hasFaction(t, id)),
      id + ' must be offered a third companion of its own faction',
    );
    assert.equal(new Set(run.units.map(u => u.pos)).size, run.units.length, id + ' starters must not overlap');
    values.push(origin.types.reduce((n, t) => n + E.TYPES[t].cost, 0) + origin.gold);
  }
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, 'origins must open within one gold of each other');
});
check('Difficulty ladder is ordered and its shown percentage is derived from the multiplier', () => {
  const scales = Object.values(E.DIFFICULTIES).map(d => d.scale);
  assert.deepEqual(
    scales,
    [...scales].sort((a, b) => a - b),
    'difficulties must be ordered by enemy strength',
  );
  const base = E.DIFFICULTIES.normal.scale;
  for (const [id, d] of Object.entries(E.DIFFICULTIES)) {
    if (id === 'normal') continue;
    const delta = Math.round((d.scale / base - 1) * 100);
    assert.ok(d.desc.includes(`${delta > 0 ? '+' : '\u2212'}${Math.abs(delta)}%`), id + ' must state its real delta');
  }
  // The multiplier has to reach the battle, not just the description.
  const s = E.newRun({ seed: 5, difficulty: 'hard' });
  const easy = E.newRun({ seed: 5, difficulty: 'story' });
  assert.ok(E.enemyScale(s) > E.enemyScale(easy) * 1.2);
});

check('Refined equipment scales only its stats, and every description is generated from them', () => {
  for (const id of E.BASIC_ITEMS) {
    const basic = E.ITEMS[id],
      refined = E.ITEMS[id + '_plus'];
    assert.ok(refined, id + ' must have a refined form');
    assert.equal(refined.name, basic.name + '·精制');
    const stats = Object.keys(basic).filter(k => !['name', 'icon', 'desc'].includes(k));
    assert.ok(stats.length, id + ' must carry at least one stat');
    for (const key of stats)
      assert.equal(refined[key], Math.round(basic[key] * 1.6 * 10000) / 10000, id + '.' + key + ' scales by 1.6');
    assert.deepEqual(Object.keys(refined).sort(), Object.keys(basic).sort(), id + ' must gain no stray field');
    // Every stat has to be readable in its own description, at both tiers.
    for (const [item, label] of [
      [basic, id],
      [refined, id + '_plus'],
    ])
      for (const key of stats) {
        const shown = key === 'armor' || key === 'mana' || key === 'castMana' ? item[key] : item[key] * 100;
        assert.ok(
          item.desc.includes(String(Math.round(shown * 10) / 10)),
          label + ' description must state ' + key + ' as ' + shown + ': ' + item.desc,
        );
      }
  }
  // The bug this replaces: a regex over the prose also scaled numbers fixed by the rule.
  const heartwood = E.ITEMS.heartwood_plus.desc;
  assert.ok(heartwood.includes('不高于 40%'), 'the trigger threshold must not scale: ' + heartwood);
  assert.ok(heartwood.includes('持续 5 秒'), 'the shield duration must not scale: ' + heartwood);
  assert.ok(heartwood.includes('最大生命 40% 的护盾'), 'the shield size must scale: ' + heartwood);
  assert.ok(E.ITEMS.heartwood.desc.includes('最大生命 25% 的护盾'));
});

check('Every skill number comes from its params, and every description is rendered from them', () => {
  const source = require('node:fs').readFileSync(require.resolve('./engine.js'), 'utf8');
  const body = source.slice(source.indexOf('function cast(b, u, target)'), source.indexOf('function step(b, dt'));
  assert.ok(body.includes('SKILLS[u.type].params'), 'cast must read its numbers from the params table');
  // Anything tunable has to live in params. What may stay inline: 0 and 1 (identity and
  // adjacency), MAX_MANA's own arithmetic, the chorus cadence, and the volley draw delay.
  const allowed = new Set(['0', '1', '3', '0.07']);
  const literals = [...body.matchAll(/[^\w.$]([0-9]+(?:\.[0-9]+)?)/g)]
    .map(m => m[1])
    .filter(value => !allowed.has(value));
  assert.deepEqual(literals, [], 'move these numbers into SKILLS params: ' + literals.join(', '));

  for (const [type, def] of Object.entries(E.TYPES)) {
    const skill = E.SKILLS[type];
    assert.ok(skill, type + ' must declare its skill params');
    assert.equal(def.desc, skill.text(skill.params), type + ' description must be rendered from its params');
    assert.ok(Object.keys(skill.params).length, type + ' must declare at least one number');
  }

  // The link has to be live: change a number and the description must follow it.
  for (const [type, skill] of Object.entries(E.SKILLS)) {
    for (const key of Object.keys(skill.params)) {
      const tweaked = { ...skill.params, [key]: skill.params[key] * 2 + 1 };
      assert.notEqual(
        skill.text(tweaked),
        skill.text(skill.params),
        type + '.' + key + ' is declared but never reaches the description',
      );
    }
  }

  // Numbers the rules share with the prose really are the ones the battle uses.
  const s = E.newRun({ seed: 31 });
  s.units = [E.unit(s, 'guard', 20), E.unit(s, 'rogue', 32)];
  E.createBattle(s);
  const rogue = s.battle.units.find(u => u.type === 'rogue' && !u.side);
  assert.equal(rogue.stealthUntil, 2.5, 'ambush plus stealth must match the described 1.5 + 1 seconds');
});

check('Every mid-chapter stop offers a real choice, and the guaranteed stops move with the seed', () => {
  const merchantFloors = new Set(),
    restShapes = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const map = E.newRun({ seed }).map;
    for (const n of map) {
      if (n.floor >= 1 && n.floor <= 6)
        assert.ok(n.next.length >= 2, `${seed}: ${n.id} must offer a second road, got ${n.next.length}`);
      assert.equal(new Set(n.next).size, n.next.length, `${seed}: ${n.id} must not repeat a road`);
    }
    for (let act = 0; act < 3; act++) {
      const chapter = map.filter(n => n.act === act);
      // A fight is always available, whatever the forced placements did to the floor.
      for (let floor = 1; floor <= 7; floor++)
        assert.ok(
          chapter.some(n => n.floor === floor && n.kind === 'battle'),
          `${seed}: act ${act} floor ${floor} must offer a fight`,
        );
      const merchants = chapter.filter(n => n.kind === 'merchant');
      assert.ok(merchants.length, `${seed}: act ${act} must offer a merchant`);
      merchants.forEach(n => merchantFloors.add(n.floor));
      const rest = chapter.filter(n => n.floor === 7);
      assert.equal(rest.filter(n => n.kind === 'camp').length, 2, `${seed}: two lanes must rest before the boss`);
      assert.equal(rest.filter(n => n.kind === 'battle').length, 1);
      restShapes.add(rest.map(n => n.kind).join('+'));
    }
  }
  // The pre-boss rest floor and the merchant must not be pinned to one shape or one floor.
  assert.equal(restShapes.size, 3, 'the fighting lane before a boss must vary: ' + [...restShapes]);
  for (const floor of [3, 4, 5]) assert.ok(merchantFloors.has(floor), 'guaranteed merchants must reach floor ' + floor);
});

check('Every relic number is rendered into its own description and reaches the rules', () => {
  for (const [id, def] of Object.entries(E.RELIC_DEFS)) {
    assert.equal(E.RELICS[id].desc, def.text(def.values), id + ' description must be rendered from its values');
    assert.ok(Object.keys(def.values).length, id + ' must declare at least one number');
    for (const key of Object.keys(def.values)) {
      const tweaked = { ...def.values, [key]: def.values[key] * 2 + 1 };
      assert.notEqual(
        def.text(tweaked),
        def.text(def.values),
        id + '.' + key + ' is declared but never reaches the description',
      );
    }
  }
  // The described strength is the strength the rules apply, and it stacks per copy.
  const roster = [{ id: 'u1', type: 'guard', pos: 20, star: 1, item: null }];
  // Health and attack are rounded by stats(), so compare the rounded stat, not a ratio.
  for (const [id, key, base, read] of [
    ['vigor', 'hp', E.TYPES.guard.hp, s => s.maxHp],
    ['edge', 'atk', E.TYPES.guard.atk, s => s.atk],
  ])
    for (const copies of [1, 2]) {
      const actual = read(E.stats(roster[0], roster, Array(copies).fill(id)));
      const expected = Math.round(base * (1 + E.RELIC_VALUES[id][key] * copies));
      assert.equal(actual, expected, `${id} ×${copies} should reach ${expected}, rules gave ${actual}`);
    }
  const base = E.stats(roster[0], roster, []);
  for (const [id, key, read] of [
    ['thorns', 'reflect', s => s.thorns],
    ['shelter', 'shield', s => s.startShield],
    ['spark', 'mana', s => s.mana - base.mana],
    ['wardflow', 'mana', s => s.shieldMana],
    ['moonwell', 'ratio', s => s.critHeal],
    ['chorus', 'shield', s => s.castWard],
    ['overflow', 'share', s => s.overflow],
  ])
    for (const copies of [1, 2]) {
      const actual = read(E.stats(roster[0], roster, Array(copies).fill(id)));
      const expected = E.RELIC_VALUES[id][key] * copies;
      assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${id} ×${copies} should grant ${expected} for ${key}, rules gave ${actual}`,
      );
    }

  // Values the description states as flat caps must not scale with the number of copies.
  const s = E.newRun({ seed: 12 });
  s.relics = ['bargain', 'bargain'];
  s.gold = 99;
  s.phase = 'map';
  s.completed = [s.nodeId];
  const merchantNode = s.map.find(n => n.kind === 'merchant' && n.act === 0);
  s.nodeId = merchantNode.id;
  s.stage = merchantNode.act * 9 + merchantNode.floor;
  s.visited = [s.nodeId];
  E.enterNode(s, s.nodeId);
  for (const offer of s.merchant)
    assert.ok(offer.price >= E.RELIC_VALUES.bargain.floor, 'the discount floor must hold: ' + offer.price);
});

check('Every interface module resolves: nothing is called that no module exports', () => {
  const fs = require('node:fs');
  const modules = ['ui-store.js', 'ui-effects.js', 'ui-map.js', 'ui-board.js', 'ui-battle.js', 'ui-dialogs.js'];
  const owner = new Map();
  const defined = new Map();
  for (const file of modules) {
    const source = fs.readFileSync(require('node:path').join(__dirname, file), 'utf8');
    for (const m of source.matchAll(/^ {2}T\.(\w+) = (\w+);$/gm)) {
      assert.equal(m[1], m[2], file + ' should export ' + m[2] + ' under its own name');
      assert.ok(!owner.has(m[1]), m[1] + ' is exported by both ' + owner.get(m[1]) + ' and ' + file);
      owner.set(m[1], file);
    }
    defined.set(file, new Set([...source.matchAll(/^ {2}(?:async )?function (\w+)\(/gm)].map(m => m[1])));
    // A module may only export something it actually declares.
    for (const [name, from] of owner)
      if (from === file) assert.ok(defined.get(file).has(name), file + ' exports a name it does not declare: ' + name);
  }
  // eslint cannot catch T.foo() where foo was never exported: that only fails at runtime.
  const sources = [...modules, 'game.js'].map(file => [
    file,
    fs.readFileSync(require('node:path').join(__dirname, file), 'utf8'),
  ]);
  const missing = [];
  for (const [file, source] of sources)
    for (const m of source.matchAll(/\b(?:T|Tundra)\.(\w+)\b/g))
      if (!owner.has(m[1]) && m[1] !== 'ui') missing.push(file + ' calls ' + m[1] + ', which no module exports');
  assert.deepEqual(missing, [], missing.join('; '));
  assert.ok(owner.size >= 50, 'expected the shared surface to be substantial, got ' + owner.size);

  // The page, the QA harnesses and browser-test.cjs drive these by name. Trimming exports to
  // what other modules call would otherwise drop them, and only a browser run would notice.
  for (const name of [
    'showNewRun',
    'showCodex',
    'showBuilds',
    'showRecords',
    'showRewards',
    'showDialog',
    'closeDialog',
    'syncPreferences',
    'beginBattle',
    'render',
  ])
    assert.ok(owner.has(name), 'the public surface must keep exporting ' + name);
});

check('Faction and role traits pay their tiers in order and stop at the top threshold', () => {
  const forest = ['guard', 'ranger', 'healer', 'warden', 'oakmaul'];
  const life = n => {
    const s = newWith(forest.slice(0, n));
    return E.stats(s.units[0], s.units).maxHp;
  };
  assert.ok(life(1) < life(2) && life(2) < life(3) && life(3) < life(4), 'each forest tier must add life');
  assert.equal(life(5), life(4), 'a fifth member cannot pay past the last tier');
  assert.equal(E.tierIndex('forest', 1), -1);
  assert.equal(E.tierIndex('forest', 4), 2);
  assert.equal(E.tierIndex('forest', 9), 2);
  const three = newWith(forest.slice(0, 3)),
    four = newWith(forest.slice(0, 4));
  assert.ok(
    E.stats(four.units[0], four.units).regen > E.stats(three.units[0], three.units).regen,
    'the top tier must regenerate faster',
  );
  // Role traits reach only the companions that carry them, and higher tiers add new effects.
  const guards = newWith(['guard', 'knight', 'tideguard', 'hunter']);
  assert.equal(E.stats(guards.units[3], guards.units).regen, 0, 'a hunter gets armour but not guardian regeneration');
  assert.ok(E.stats(guards.units[0], guards.units).regen > 0);
  assert.equal(E.stats(guards.units[3], guards.units).armor, E.TYPES.hunter.armor + 16);
  const rangers = newWith(['ranger', 'hunter', 'flarebow', 'guard']);
  assert.equal(E.stats(rangers.units[0], rangers.units).trueShot, 0.15);
  assert.equal(E.stats(rangers.units[3], rangers.units).trueShot, 0, 'the guardian shoots nothing extra');
  const singers = newWith(['healer', 'oracle', 'pearl', 'emberdrum']);
  const cast = E.stats(singers.units[0], singers.units);
  assert.equal(cast.healing, 1.5);
  assert.ok(cast.castMana >= 15 && cast.mana >= E.TYPES.healer.mana + 30);
  for (const [id, trait] of Object.entries({ ...E.FACTIONS, ...E.ROLE_TRAITS })) {
    assert.equal(trait.desc.length, trait.thresholds.length, id + ' must describe every tier it declares');
    assert.deepEqual(
      [...trait.thresholds].sort((a, b) => a - b),
      trait.thresholds,
      id + ' thresholds must ascend',
    );
  }
});
check('An emblem grants exactly one extra faction and never counts a duplicate twice', () => {
  const s = newWith(['guard', 'ranger', 'mage']);
  assert.equal(E.traits(s.units).astral, 1);
  s.units[0].item = 'emblem_astral';
  assert.equal(E.traits(s.units).astral, 2, 'the emblem must complete the second astral type');
  assert.equal(E.traits(s.units).forest, 2, 'the bearer keeps its own faction');
  const twins = newWith(['mage', 'mage', 'guard']);
  twins.units[0].item = 'emblem_forest';
  twins.units[1].item = 'emblem_forest';
  assert.equal(E.traits(twins.units).forest, 2, 'two copies of one type still count once');
  const native = newWith(['guard', 'ranger']);
  native.units[0].item = 'emblem_forest';
  assert.equal(E.traits(native.units).forest, 2, 'an emblem for a faction already held adds nothing');
  // Emblems stay out of the drop tables and out of the forge.
  for (const id of E.EMBLEM_ITEMS) {
    assert.ok(E.ITEMS[id] && !E.BASIC_ITEMS.includes(id));
    assert.equal(E.ITEMS[id + '_plus'], undefined);
    assert.ok(E.ITEMS[id].desc.includes(E.FACTIONS[E.ITEMS[id].faction].name));
  }
  const run = E.newRun({ seed: 4711 });
  run.bag.push('emblem_tide');
  assert.ok(E.validate(run));
  assert.ok(!E.campOptions(run).some(o => o.item.startsWith('emblem_')), 'emblems cannot be refined at camp');
});
check('Marks amplify damage, weaken reduces it and both keep only their strongest layer', () => {
  const s = newWith(['stargazer', 'mistcaller', 'guard']);
  E.createBattle(s);
  const b = s.battle,
    [star, mist] = b.units,
    foe = b.units.find(u => u.side === 1);
  foe.armor = 0;
  foe.shield = 0;
  foe.hp = foe.maxHp = 9000;
  const plain = E.hurt(b, star, foe, 100, 'true');
  E.applyMark(b, star, foe, 0.25, 6);
  const marked = E.hurt(b, star, foe, 100, 'true');
  assert.equal(marked, Math.round(plain * 1.25));
  E.applyMark(b, star, foe, 0.1, 9);
  assert.equal(foe.markAmp, 0.25, 'a weaker mark cannot overwrite a stronger one');
  assert.equal(foe.markUntil, b.time + 9, 'but a longer mark still extends the window');
  b.time = 20;
  assert.equal(E.hurt(b, star, foe, 100, 'true'), plain, 'an expired mark stops amplifying');
  // Weakening is stored on the attacker and cuts everything it deals.
  mist.weaken = 0.2;
  mist.weakenUntil = b.time + 4;
  assert.equal(E.hurt(b, mist, foe, 100, 'true'), Math.round(plain * 0.8));
  const beacon = newWith(['stargazer', 'guard']);
  beacon.relics = ['beacon'];
  assert.equal(E.stats(beacon.units[0], beacon.units, beacon.relics).markBonus, E.RELIC_VALUES.beacon.amp);
  const hunter = newWith(['vineclaw', 'guard']);
  hunter.relics = ['hunt'];
  assert.equal(E.stats(hunter.units[0], hunter.units, hunter.relics).execute, E.RELIC_VALUES.hunt.bonus);
});
check('Execution bonuses stack with the pounce, and a barrier answers damage without recursion', () => {
  const s = newWith(['vineclaw', 'guard']);
  E.createBattle(s);
  const b = s.battle,
    cat = b.units[0],
    foe = b.units.find(u => u.side === 1);
  foe.armor = 0;
  foe.shield = 0;
  foe.maxHp = 10000;
  foe.hp = 10000;
  cat.atk = 100;
  E.cast(b, cat, foe);
  const healthy = 10000 - foe.hp;
  foe.hp = 3000;
  cat.mana = 100;
  E.cast(b, cat, foe);
  const wounded = 3000 - foe.hp;
  assert.ok(wounded > healthy * 1.5, 'a companion below the threshold takes the execution ratio');
  // Two barriers facing each other settle instead of bouncing damage forever.
  const duel = newWith(['nightdew', 'guard']);
  E.createBattle(duel);
  const d = duel.battle,
    wall = d.units[0],
    enemy = d.units.find(u => u.side === 1);
  E.cast(d, wall, enemy);
  assert.ok(wall.shield > 0 && wall.reflectUntil > d.time);
  enemy.reflect = 0.5;
  enemy.reflectUntil = d.time + 5;
  enemy.shield = 10;
  enemy.hp = enemy.maxHp = 5000;
  const before = enemy.hp;
  E.hurt(d, enemy, wall, 200, 'physical', true);
  assert.ok(enemy.hp < before, 'the barrier must return part of what it soaked');
  wall.shield = 0;
  const quiet = enemy.hp;
  E.hurt(d, enemy, wall, 200, 'physical', true);
  assert.equal(enemy.hp, quiet, 'a barrier without a shield left stops answering');
  assert.ok(E.validate(duel));
});
check('Ember splash, ranger true shots and drum tempo change what a plain attack does', () => {
  function attackOnce(prepare) {
    const s = newWith(['guard']);
    E.createBattle(s);
    const b = s.battle,
      ally = b.units[0],
      foes = b.units.filter(u => u.side === 1);
    foes.slice(2).forEach(f => (f.dead = true));
    const [near, neighbour] = foes;
    ally.pos = 20;
    near.pos = 14;
    neighbour.pos = 8;
    for (const f of [near, neighbour]) {
      f.stun = 99;
      f.armor = 0;
      f.shield = 0;
      f.hp = f.maxHp = 4000;
    }
    ally.attackCd = 0;
    ally.mana = 0;
    ally.crit = 0;
    ally.atk = 100;
    prepare(ally);
    E.step(b, 0.1);
    return { b, ally, near, neighbour };
  }
  const plain = attackOnce(() => {});
  assert.equal(plain.neighbour.hp, plain.neighbour.maxHp, 'an ordinary swing only reaches its target');
  const splash = attackOnce(a => (a.splash = 0.5));
  assert.ok(splash.neighbour.hp < splash.neighbour.maxHp, 'the fourth ember tier must splash onto neighbours');
  assert.ok(splash.neighbour.takenKinds.magic > 0);
  const shot = attackOnce(a => {
    a.trueShot = 0.2;
    a.armor = 0;
  });
  assert.ok(shot.near.takenKinds.true > 0, 'the third ranger tier adds true damage to the basic attack');
  const fast = attackOnce(a => {
    a.hasteBuff = 0.35;
    a.hasteUntil = 99;
  });
  assert.ok(fast.ally.attackCd < plain.ally.attackCd, 'a drum beat shortens the wait between swings');
  // The buff belongs to the target of the drum, not to the drummer's own speed.
  const s = newWith(['emberdrum', 'ranger', 'guard']);
  E.createBattle(s);
  const b = s.battle,
    [drum, ranger] = b.units;
  E.cast(
    b,
    drum,
    b.units.find(u => u.side === 1),
  );
  assert.equal(ranger.hasteBuff, E.SKILLS.emberdrum.params.haste);
  assert.ok(ranger.hasteUntil > b.time);
  assert.equal(ranger.interval, E.stats(s.units[1], s.units).interval, 'the companion keeps its own attack interval');
});
check('Spell criticals multiply an entire skill and take the stronger of moon and relic', () => {
  const s = newWith(['cinder', 'guard']);
  E.createBattle(s);
  const b = s.battle,
    mage = b.units[0],
    foe = b.units.find(u => u.side === 1);
  foe.armor = 0;
  foe.shield = 0;
  foe.hp = foe.maxHp = 20000;
  mage.spellCrit = 0;
  E.cast(b, mage, foe);
  const plain = 20000 - foe.hp;
  foe.hp = 20000;
  mage.mana = 100;
  mage.spellCrit = 1;
  mage.crit = 1;
  E.cast(b, mage, foe);
  assert.equal(20000 - foe.hp, Math.round(plain * mage.critPower), 'a critical skill scales by the crit multiplier');
  const moon = newWith(['rogue', 'frost', 'hunter', 'hexer']);
  assert.equal(E.traits(moon.units).moon, 4);
  assert.equal(E.stats(moon.units[0], moon.units).spellCrit, 0.5, 'the fourth moon tier unlocks spell criticals');
  const relic = newWith(['guard', 'ranger']);
  assert.equal(E.stats(relic.units[0], relic.units, ['prism']).spellCrit, E.RELIC_VALUES.prism.share);
  assert.equal(E.stats(moon.units[0], moon.units, ['prism', 'prism']).spellCrit, 1, 'the share is capped at certain');
});
check('The eight new companions each target what their description promises', () => {
  const s = newWith(['driftbow', 'stargazer', 'saltforge', 'prismguard']);
  atNode(s, 1, 5, 'battle');
  E.createBattle(s);
  const b = s.battle,
    [bow, star, forge, prism] = b.units,
    foes = b.units.filter(u => u.side === 1);
  foes.forEach((f, i) => {
    f.pos = i;
    f.armor = 0;
    f.shield = 0;
    f.hp = f.maxHp = 4000;
  });
  // A pierced column, not a row.
  foes[0].pos = 2;
  foes[1].pos = 8;
  foes[2].pos = 3;
  E.cast(b, bow, foes[0]);
  assert.ok(foes[1].hp < foes[1].maxHp, 'the arrow continues down the column');
  assert.equal(foes[2].hp, foes[2].maxHp, 'the neighbouring column is untouched');
  // The stargazer picks the farthest enemy and leaves a mark on it.
  star.pos = 32;
  const far = foes.reduce((a, f) => (E.distance(star.pos, f.pos) > E.distance(star.pos, a.pos) ? f : a), foes[0]);
  E.cast(b, star, foes[0]);
  assert.ok(far.markUntil > b.time, 'the mark lands on the farthest enemy');
  // The forge shields whoever carries the least protection.
  const friends = b.units.filter(u => u.side === 0);
  friends.forEach((f, i) => (f.shield = i * 100));
  E.cast(b, forge, foes[0]);
  const thinnest = friends.slice(0, E.SKILLS.saltforge.params.targets);
  assert.ok(thinnest.every(f => f.shield > 0));
  // The prism guard shields itself and refills the nearest allies.
  friends.forEach(f => (f.mana = 0));
  prism.pos = 20;
  E.cast(b, prism, foes[0]);
  assert.ok(prism.shield > 0);
  assert.equal(
    friends.filter(f => f !== prism && f.mana > 0).length,
    E.SKILLS.prismguard.params.targets,
    'exactly the promised number of allies are refilled',
  );
  // Every addition finishes a deterministic battle that also survives a save and resume.
  for (const type of [
    'driftbow',
    'stargazer',
    'emberdrum',
    'vineclaw',
    'nightdew',
    'saltforge',
    'mistcaller',
    'prismguard',
  ]) {
    const run = newWith([type, 'guard', 'healer']);
    E.createBattle(run);
    for (let i = 0; i < 60; i++) E.step(run.battle);
    const resumed = E.clone(run);
    assert.ok(E.validate(resumed), type + ' must produce a valid snapshot');
    while (!run.battle.result) E.step(run.battle);
    while (!resumed.battle.result) E.step(resumed.battle);
    assert.deepEqual(run.battle, resumed.battle, type + ' must resume identically');
  }
});
check('Every companion has both a silhouette and its engraving, and every SVG parses', () => {
  const source = require('node:fs').readFileSync(require.resolve('./art.js'), 'utf8');
  const table = name => {
    const start = source.indexOf('const ' + name + ' = {');
    assert.ok(start > 0, 'art.js must declare ' + name);
    return new Set([...source.slice(start, source.indexOf('\n  };', start)).matchAll(/^ {4}(\w+):/gm)].map(m => m[1]));
  };
  const shapes = table('ornaments'),
    engraving = table('details');
  for (const type of Object.keys(E.TYPES)) {
    assert.ok(shapes.has(type), type + ' has no silhouette in art.js');
    // A missing engraving used to render the string "undefined" into the portrait's SVG.
    assert.ok(engraving.has(type), type + ' has no engraving detail in art.js');
  }
  // Tags must be balanced and every path must carry a d attribute, checked without a DOM.
  for (const [, drawing] of source.matchAll(/^ {4}\w+:\s*(?:`([^`]*)`|'([^']*)')/gm)) {
    const markup = drawing ?? '';
    const opened = [...markup.matchAll(/<(\w+)[^>]*?(\/?)>/g)];
    for (const tag of opened) assert.ok(tag[2] === '/', 'every element in art.js must be self-closing: ' + tag[1]);
    for (const path of markup.matchAll(/<path\b([^>]*)>/g))
      assert.ok(/\sd="[^"]+"/.test(path[1]), 'a path in art.js carries no geometry');
  }
});
check('Every affix the map can roll is actually implemented by the rules', () => {
  const source = require('node:fs').readFileSync(require.resolve('./engine.js'), 'utf8');
  const body = source.slice(source.indexOf('function unitStats'), source.indexOf('const distance ='));
  const W = require('./world.js');
  for (const id of Object.keys(W.AFFIXES)) {
    assert.ok(typeof W.AFFIXES[id].desc === 'string' && W.AFFIXES[id].desc.length > 8, id + ' must explain itself');
    if (id === 'none') continue;
    assert.ok(body.includes(`case '${id}'`), id + ' is offered on the map but changes nothing in combat');
  }
  // A tampered snapshot cannot smuggle an endless mark or barrier back into a resumed battle.
  const guard = E.newRun({ seed: 78 });
  guard.units = [E.unit(guard, 'nightdew', 20), E.unit(guard, 'stargazer', 32)];
  E.createBattle(guard);
  assert.ok(E.validate(guard));
  for (const [key, value] of [
    ['markUntil', 900],
    ['weaken', 4],
    ['reflectUntil', 900],
    ['hasteBuff', 50],
    ['rampStacks', 999],
  ]) {
    const tampered = E.clone(guard);
    tampered.battle.units[0][key] = value;
    assert.equal(E.validate(tampered), false, key + ' must be bounded in a saved battle');
  }
  // The two newest ones reach the enemy the way their copy promises.
  const s = E.newRun({ seed: 77 });
  const node = E.currentNode(s);
  const foe = E.enemyRoster(s)[0];
  node.affix = 'resonant';
  assert.equal(E.unitStats(s, foe, 1).spellCrit, 0.5);
  node.affix = 'brand';
  assert.ok(E.unitStats(s, foe, 1).mark > 0);
  node.affix = 'none';
  assert.equal(E.unitStats(s, foe, 1).mark, 0);
});
check('A seven-strong party fits the board, the ledger and the merchant that supports it', () => {
  const s = E.newRun({ seed: 909 });
  s.gold = 99;
  while (s.capacity < E.maxCapacity(s)) assert.ok(!E.expand(s).error);
  assert.equal(s.capacity, 7);
  for (const type of ['guard', 'knight', 'oakmaul', 'tideguard', 'emberguard', 'nightdew', 'prismguard'])
    s.units.push(E.unit(s, type));
  assert.ok(!E.autoDeploy(s).error);
  const board = E.deployed(s).map(u => u.pos);
  assert.equal(new Set(board).size, board.length, 'seven melee companions must not share a tile');
  assert.ok(board.every(p => p >= E.HOME && p < E.COLS * E.ROWS));
  assert.equal(board.length, 7);
  assert.ok(E.validate(s));
  const battle = E.createBattle(s);
  assert.ok(battle.battle && E.validate(s));
  // The merchant sells the emblem that is closest to finishing a tier.
  const trip = E.newRun({ seed: 909 });
  trip.units = [E.unit(trip, 'tideguard', 20), E.unit(trip, 'wavecaller', 32), E.unit(trip, 'guard', 21)];
  const stop = trip.map.find(n => n.kind === 'merchant' && n.act === 0),
    from = trip.map.find(n => n.next.includes(stop.id));
  trip.phase = 'map';
  trip.nodeId = from.id;
  trip.stage = from.act * 9 + from.floor;
  trip.visited = [trip.nodeId];
  trip.completed = [trip.nodeId];
  assert.ok(!E.enterNode(trip, stop.id).error, 'the merchant must be reachable from its own predecessor');
  const emblem = trip.merchant.find(o => o.key.startsWith('item:emblem_'));
  assert.ok(emblem, 'a merchant must offer an emblem');
  assert.equal(emblem.key, 'item:emblem_tide', 'the offer follows the tier the party can finish next');
  trip.gold = 99;
  assert.ok(!E.merchantBuy(trip, emblem.id).error);
  assert.ok(trip.bag.includes('emblem_tide'));
});
console.log(`\n${checks} rule checks passed.`);
