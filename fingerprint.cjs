/* Behavioural fingerprint: a stable hash of deterministic rule output.
   Use it to prove that a refactor, reformat or rename changed no semantics.
   A rules or balance change is expected to move the hash; record the new one. */
'use strict';
const crypto = require('node:crypto');
const E = require('./engine.js');
const W = require('./world.js');
const { run } = require('./balance.cjs');

function battles() {
  const rows = [];
  const types = Object.keys(E.TYPES).filter(t => E.TYPES[t].cost > 0);
  for (let seed = 1; seed <= 40; seed++) {
    const s = E.newRun({ seed: (seed * 7919) % 4294967295 || 1 });
    s.capacity = 7;
    s.units = Array.from({ length: 7 }, (_, i) => {
      const u = E.unit(s, types[(seed * 3 + i * 5) % types.length], 18 + i);
      u.star = 1 + ((seed + i) % 3);
      // Emblems belong in the fingerprint too: they change which traits a party actually has.
      const gear = [...E.BASIC_ITEMS, ...E.EMBLEM_ITEMS];
      u.item = gear[(seed + i) % gear.length];
      return u;
    });
    s.relics = [Object.keys(E.RELICS)[seed % Object.keys(E.RELICS).length]];
    const created = E.createBattle(s);
    if (created.error) {
      rows.push({ seed, error: created.error });
      continue;
    }
    let steps = 0;
    while (!s.battle.result && steps++ < 801) E.step(s.battle);
    rows.push({
      seed,
      result: s.battle.result,
      units: s.battle.units.map(u => ({
        id: u.id,
        type: u.type,
        hp: Math.round(u.hp),
        shield: Math.round(u.shield),
        damage: Math.round(u.damage),
        healed: Math.round(u.healed),
        blocked: Math.round(u.blocked),
        casts: u.casts,
        kills: u.kills,
        dead: u.dead,
        pos: u.pos,
        deathAt: u.deathAt,
      })),
    });
  }
  return rows;
}

function maps() {
  return Array.from({ length: 60 }, (_, i) =>
    W.generate(1 + i * 104729)
      .map(n => [n.id, n.kind, n.template, n.affix, n.event, n.stars.join(''), n.next.join('|')].join(','))
      .join(';'),
  );
}

function campaigns() {
  const rows = [];
  for (const difficulty of Object.keys(E.DIFFICULTIES))
    for (const origin of Object.keys(E.ORIGINS))
      for (let i = 0; i < 4; i++) {
        const r = run(1000 + i * 37, origin, difficulty);
        rows.push({
          difficulty,
          origin,
          seed: 1000 + i * 37,
          won: r.won,
          stage: r.stage,
          life: r.life,
          attempts: r.attempts,
          stars: r.stars.join(''),
          gold: r.state.totalGold,
          relics: [...r.state.relics].sort().join('|'),
        });
      }
  return rows;
}

const payload = { battles: battles(), maps: maps(), campaigns: campaigns() };
const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
if (process.argv.includes('--dump')) process.stdout.write(JSON.stringify(payload, null, 1));
else console.log(digest);
