/* Tundra Expedition: deterministic rules, shared by the browser and Node checks. */
(function (root) {
  'use strict';
  const W = typeof module !== 'undefined' && module.exports ? require('./world.js') : root.ExpeditionWorld;
  const COLS = 6,
    ROWS = 6,
    HOME = 18,
    BENCH = 8,
    LAST_STAGE = W.CHAPTERS.length * W.FLOORS - 1;
  const RULESET = 'companions-22';
  const LEGACY_RULESET = 'twelve-1';
  const TYPES = {
    guard: {
      name: '苔石守卫',
      faction: 'forest',
      role: 'guardian',
      cost: 2,
      hp: 240,
      atk: 22,
      armor: 22,
      range: 1,
      interval: 1.4,
      mana: 25,
      color: '#afc58b',
      skill: '山林壁垒',
      desc: '获得持续 5 秒的 90 + 80% 攻击护盾，并嘲讽 3 格内敌人 2.5 秒。',
      flavor: '古老的山石，也有想守护的东西。',
    },
    ranger: {
      name: '逐风游侠',
      faction: 'forest',
      role: 'ranger',
      cost: 2,
      hp: 132,
      atk: 31,
      armor: 4,
      range: 4,
      interval: 1.1,
      mana: 0,
      color: '#b7cf8b',
      skill: '追风连射',
      desc: '对当前目标射出三箭，共造成 240% 攻击的物理伤害。',
      flavor: '箭矢穿过枝叶，像风一样轻。',
    },
    healer: {
      name: '蘑菇药师',
      faction: 'forest',
      role: 'support',
      cost: 3,
      hp: 160,
      atk: 20,
      armor: 6,
      range: 3,
      interval: 1.35,
      mana: 45,
      color: '#deae8c',
      skill: '复苏孢子',
      desc: '治疗最虚弱的两名友军 55 + 140% 攻击，并清除眩晕、减速与凋零。',
      flavor: '口袋里装着整个春天。',
    },
    knight: {
      name: '曙光骑士',
      faction: 'astral',
      role: 'guardian',
      cost: 3,
      hp: 270,
      atk: 29,
      armor: 26,
      range: 1,
      interval: 1.45,
      mana: 30,
      color: '#dfc685',
      skill: '晨曦誓约',
      desc: '自身与相邻友军获得 55 + 70% 攻击的护盾，持续 5 秒。',
      flavor: '即使在长夜里，也要举起光。',
    },
    mage: {
      name: '星灯法师',
      faction: 'astral',
      role: 'mage',
      cost: 3,
      hp: 130,
      atk: 34,
      armor: 3,
      range: 4,
      interval: 1.45,
      mana: 20,
      color: '#b4a6df',
      skill: '坠星',
      desc: '对目标及距其 1 格内的敌人造成 210% 攻击的魔法伤害。',
      flavor: '她的灯里，收藏着一颗迷路的星。',
    },
    oracle: {
      name: '月泉祭司',
      faction: 'astral',
      role: 'support',
      cost: 4,
      hp: 155,
      atk: 22,
      armor: 8,
      range: 3,
      interval: 1.4,
      mana: 50,
      color: '#99d2cc',
      skill: '星泉祈愿',
      desc: '为法力最低的两名其他友军恢复 38 法力与 90% 攻击的生命。',
      flavor: '听见水声的人，便不会迷失。',
    },
    rogue: {
      name: '暮影刺客',
      faction: 'moon',
      role: 'assassin',
      cost: 3,
      hp: 155,
      atk: 37,
      armor: 9,
      range: 1,
      interval: 1.05,
      mana: 20,
      color: '#a1b9d0',
      skill: '影袭',
      desc: '开场潜伏 1.5 秒再跃向后排，落地后 1 秒不可被选中（仍受范围伤害）；施法突袭最虚弱的敌人，造成 230% 攻击的物理伤害。',
      flavor: '月光照不到的地方，是她的捷径。',
    },
    frost: {
      name: '霜枝女巫',
      faction: 'moon',
      role: 'mage',
      cost: 3,
      hp: 140,
      atk: 28,
      armor: 5,
      range: 4,
      interval: 1.4,
      mana: 35,
      color: '#a6cbdc',
      skill: '凛冬之拥',
      desc: '造成 150% 攻击的魔法伤害，眩晕目标 1.5 秒并减速邻近敌人 3 秒。',
      flavor: '枝头落下的，不只是霜雪。',
    },
    hunter: {
      name: '银狼猎手',
      faction: 'moon',
      role: 'ranger',
      cost: 4,
      hp: 155,
      atk: 37,
      armor: 8,
      range: 4,
      interval: 1.2,
      mana: 10,
      color: '#bfc4d8',
      skill: '破甲银矢',
      desc: '向距离最远的两名敌人各造成 160% 攻击的真实伤害，无视护甲。',
      flavor: '银色的箭头，记得所有归途。',
    },
    warden: {
      name: '蕨羽守望',
      faction: 'forest',
      role: 'support',
      cost: 3,
      hp: 185,
      atk: 23,
      armor: 12,
      range: 3,
      interval: 1.4,
      mana: 55,
      color: '#91bfa3',
      skill: '归巢羽幕',
      desc: '为生命比例最低的两名友军施加 65 + 100% 攻击护盾，持续 5 秒；击退各目标相邻的一名敌人 1 格并减速 2 秒。可在后排保护脆弱伙伴。',
      flavor: '羽翼展开的地方，就是归途。',
    },
    breaker: {
      name: '碎星工匠',
      faction: 'astral',
      role: 'mage',
      cost: 4,
      hp: 175,
      atk: 32,
      armor: 10,
      range: 3,
      interval: 1.5,
      mana: 30,
      color: '#e2b98c',
      skill: '裂界棱镜',
      desc: '优先瞄准护盾最厚且可被选中的敌人，摧毁至多 100 + 200% 攻击护盾，再造成 170% 攻击的魔法伤害。',
      flavor: '裂纹里，照进新的星光。',
    },
    hexer: {
      name: '夜蛾织咒',
      faction: 'moon',
      role: 'mage',
      cost: 3,
      hp: 145,
      atk: 25,
      armor: 5,
      range: 4,
      interval: 1.45,
      mana: 40,
      color: '#cf9fc5',
      skill: '枯月鳞粉',
      desc: '对目标及其 1 格内敌人造成 140% 攻击的魔法伤害，施加 5 秒凋零：所受治疗和生命回复减半。药师的净化可以移除凋零。',
      flavor: '翅膀掠过，喧闹的泉水归于寂静。',
    },
    oakmaul: {
      name: '橡角斗卫',
      faction: 'forest',
      role: 'guardian',
      cost: 3,
      hp: 255,
      atk: 27,
      armor: 16,
      range: 1,
      interval: 1.5,
      mana: 35,
      color: '#b5bd89',
      skill: '横扫回春',
      desc: '对自身相邻敌人造成 170% 攻击的物理伤害；命中至少一人时，治疗自身 40 + 60% 攻击。',
      flavor: '先站稳，再为身后的人劈开道路。',
    },
    duskblade: {
      name: '暮刃旅客',
      faction: 'moon',
      role: 'assassin',
      cost: 3,
      hp: 165,
      atk: 34,
      armor: 8,
      range: 1,
      interval: 1.1,
      mana: 20,
      color: '#b5a9d1',
      skill: '汲月斩',
      desc: '对当前目标造成 230% 攻击的物理伤害，并治疗自身 45 + 80% 攻击。与所有刺客一样，开场潜伏 1.5 秒后切入，落地有 1 秒影幕保护。',
      flavor: '刀锋沾上月色，伤口便忘了疼痛。',
    },
    tideguard: {
      name: '潮锚卫士',
      faction: 'tide',
      role: 'guardian',
      cost: 2,
      hp: 245,
      atk: 19,
      armor: 18,
      range: 1,
      interval: 1.5,
      mana: 30,
      color: '#91c5c1',
      skill: '同舟之盾',
      desc: '为自身与生命比例最低的一名其他友军各施加 65 + 100% 攻击的护盾，持续 5 秒。',
      flavor: '只要锚还在，就没有人会被浪带走。',
    },
    wavecaller: {
      name: '听潮术士',
      faction: 'tide',
      role: 'mage',
      cost: 3,
      hp: 145,
      atk: 30,
      armor: 5,
      range: 4,
      interval: 1.45,
      mana: 30,
      color: '#90c8d7',
      skill: '横潮',
      desc: '潮水横扫当前目标所在的整排，对这一排的敌人造成 150% 攻击的魔法伤害。',
      flavor: '她听见的潮声，来自远方尚未落下的雨。',
    },
    pearl: {
      name: '珍珠医者',
      faction: 'tide',
      role: 'support',
      cost: 2,
      hp: 150,
      atk: 20,
      armor: 6,
      range: 3,
      interval: 1.4,
      mana: 55,
      color: '#d6d5bc',
      skill: '凝露',
      desc: '治疗生命比例最低的一名友军 95 + 200% 攻击，专注挽救一位濒危伙伴。',
      flavor: '一滴光，也足够把人拉回岸边。',
    },
    songbird: {
      name: '溪羽琴师',
      faction: 'tide',
      extraFaction: 'forest',
      role: 'support',
      cost: 4,
      hp: 170,
      atk: 24,
      armor: 7,
      range: 3,
      interval: 1.35,
      mana: 45,
      color: '#b4d5ad',
      skill: '护航和弦',
      desc: '为攻击最高的两名友军各施加 70 + 110% 攻击的护盾，持续 5 秒。同时计入林地与潮汐羁绊。',
      flavor: '林间的旋律，顺着溪水抵达每一位旅人。',
    },
    emberguard: {
      name: '炉心重卫',
      faction: 'ember',
      role: 'guardian',
      cost: 3,
      hp: 260,
      atk: 25,
      armor: 22,
      range: 1,
      interval: 1.45,
      mana: 25,
      color: '#d3a486',
      skill: '熔火壁垒',
      desc: '自身获得 75 + 100% 攻击的护盾，持续 5 秒；同时对相邻敌人造成 80% 攻击的魔法伤害。',
      flavor: '他的炉火不熄，队伍就有继续前进的理由。',
    },
    cinder: {
      name: '烬灯巫师',
      faction: 'ember',
      role: 'mage',
      cost: 4,
      hp: 145,
      atk: 40,
      armor: 4,
      range: 4,
      interval: 1.6,
      mana: 10,
      color: '#e5ae87',
      skill: '聚火',
      desc: '将火光凝成一束，对当前目标造成 330% 攻击的魔法伤害。专注击破单个敌人。',
      flavor: '把漫山的火，收进一盏小灯。',
    },
    flarebow: {
      name: '火萤弩手',
      faction: 'ember',
      role: 'ranger',
      cost: 2,
      hp: 140,
      atk: 27,
      armor: 5,
      range: 4,
      interval: 1.2,
      mana: 10,
      color: '#d8be86',
      skill: '双萤矢',
      desc: '向距离最近的两名可选敌人各射出一箭，造成 150% 攻击的物理伤害。',
      flavor: '两点火光，一起照亮前路。',
    },
    sparkscout: {
      name: '星火斥候',
      faction: 'ember',
      extraFaction: 'astral',
      role: 'assassin',
      cost: 3,
      hp: 160,
      atk: 33,
      armor: 8,
      range: 1,
      interval: 1.15,
      mana: 30,
      color: '#e0c7a6',
      skill: '闪烁断击',
      desc: '对当前目标造成 200% 攻击的物理伤害并眩晕 1 秒。开场潜伏 1.5 秒后切入，落地有 1 秒影幕保护；同时计入星辉与余烬羁绊。',
      flavor: '他追逐的星光，落地时成了火。',
    },
    ancient: {
      name: '古树守望者',
      faction: 'wild',
      role: 'guardian',
      cost: 0,
      hp: 810,
      atk: 39,
      armor: 30,
      range: 1,
      interval: 1.65,
      mana: 50,
      color: '#c6ce91',
      skill: '大地回响',
      desc: '震击全场造成 85% 攻击的魔法伤害；半血时狂怒，攻击速度提升 35%。',
      flavor: '整片森林，在它的胸膛里呼吸。',
    },
  };
  const FACTIONS = {
    forest: {
      name: '林地',
      icon: '❧',
      thresholds: [2, 3],
      desc: ['全队生命 +18%', '全队生命 +28%，每秒恢复 0.8% 最大生命'],
    },
    astral: {
      name: '星辉',
      icon: '✧',
      thresholds: [2, 3],
      desc: ['全队技能强度 +20%', '全队技能强度 +35%，初始法力 +15'],
    },
    tide: {
      name: '潮汐',
      icon: '≈',
      thresholds: [2, 3],
      desc: ['开战时全队获得 25 点护盾', '开战时全队获得 45 点护盾，治疗效果 +20%'],
    },
    ember: { name: '余烬', icon: '♨', thresholds: [2, 3], desc: ['全队攻击 +8%', '全队攻击 +14%，攻击速度 +8%'] },
    moon: {
      name: '月影',
      icon: '☽',
      thresholds: [2, 3],
      desc: ['全队普攻暴击率 +15%', '全队普攻暴击率 +30%，暴击伤害提高至 175%'],
    },
  };
  // Factions hold different numbers of companions (林地 6 … 潮汐 / 余烬 4) but share the same
  // 2 / 3 thresholds, so an unweighted tavern makes a small faction measurably harder to assemble.
  // Every companion of an under-sized faction gets one extra copy per missing member, which
  // levels the odds of meeting *some* member of each faction while keeping cost rarity inside it.
  const FACTION_ROSTER = {};
  for (const def of Object.values(TYPES)) {
    if (!def.cost) continue;
    for (const id of [def.faction, def.extraFaction]) if (id) FACTION_ROSTER[id] = (FACTION_ROSTER[id] || 0) + 1;
  }
  const LARGEST_FACTION = Math.max(...Object.values(FACTION_ROSTER));
  const shopCopies = type => {
    const def = TYPES[type];
    const smallest = Math.min(...[def.faction, def.extraFaction].filter(Boolean).map(id => FACTION_ROSTER[id]));
    return (def.cost === 4 ? 2 : 3) + (LARGEST_FACTION - smallest);
  };
  const ROLES = { guardian: '守卫', ranger: '游侠', mage: '法师', support: '辅助', assassin: '刺客' };
  const ROLE_TRAITS = {
    guardian: { name: '铁壁', icon: '⬡', desc: '2 种守卫：全队护甲 +8' },
    ranger: { name: '追风', icon: '➶', desc: '2 种游侠：游侠攻击速度 +18%' },
    support: { name: '协奏', icon: '♫', desc: '2 种辅助：辅助的治疗效果 +20%' },
    assassin: { name: '夜行', icon: '☾', desc: '2 种刺客：刺客普攻暴击率 +15%' },
    mage: { name: '共鸣', icon: '✶', desc: '2 种法师：每秒额外恢复 3 法力' },
  };
  const ITEMS = {
    blade: { name: '风纹短刃', icon: '⚔', desc: '攻击 +22%', atk: 0.22 },
    buckler: { name: '橡木圆盾', icon: '⬡', desc: '护甲 +18，生命 +12%', armor: 18, hp: 0.12 },
    wand: { name: '星屑法杖', icon: '✧', desc: '技能强度 +25%，初始法力 +20', power: 0.25, mana: 20 },
    boots: { name: '轻羽长靴', icon: '➶', desc: '攻击速度 +20%，移动速度 +25%', haste: 0.2, move: 0.25 },
    charm: { name: '复苏琥珀', icon: '❧', desc: '治疗效果 +35%，生命 +15%', healing: 0.35, hp: 0.15 },
    fang: { name: '月牙坠饰', icon: '☽', desc: '造成伤害的 18% 转为自身治疗', leech: 0.18 },
    moonlens: {
      name: '赤月透镜',
      icon: '◉',
      desc: '普攻暴击率 +20%，暴击伤害 +25 个百分点',
      crit: 0.2,
      critPower: 0.25,
    },
    channel: { name: '回响沙漏', icon: '⌛', desc: '技能强度 +10%；每次施法后恢复 12 法力', power: 0.1, castMana: 12 },
    heartwood: {
      name: '余烬木心',
      icon: '♧',
      desc: '生命 +8%；每场首次受伤后存活且生命不高于 40% 时，获得最大生命 25% 的护盾，持续 5 秒',
      hp: 0.08,
      emergencyShield: 0.25,
    },
  };
  const BASIC_ITEMS = Object.keys(ITEMS);
  for (const id of BASIC_ITEMS) {
    const basic = ITEMS[id],
      enhanced = { ...basic, name: basic.name + '·精制', desc: '' };
    for (const key of [
      'atk',
      'armor',
      'hp',
      'power',
      'mana',
      'haste',
      'move',
      'healing',
      'leech',
      'crit',
      'critPower',
      'castMana',
      'emergencyShield',
    ])
      if (basic[key]) enhanced[key] = Math.round(basic[key] * 1.6 * 10000) / 10000;
    enhanced.desc = basic.desc.replace(/\d+(?:\.\d+)?/g, n => String(Math.round(Number(n) * 1.6 * 10) / 10));
    ITEMS[id + '_plus'] = enhanced;
  }
  ITEMS.heartwood_plus.desc = '生命 +12.8%；每场首次受伤后存活且生命不高于 40% 时，获得最大生命 40% 的护盾，持续 5 秒';
  const RELICS = {
    vigor: { name: '古树之种', icon: '❧', desc: '全队最大生命 +12%' },
    edge: { name: '月光磨石', icon: '☽', desc: '全队攻击 +10%' },
    tempo: { name: '风之铃', icon: '♩', desc: '全队攻击速度 +10%' },
    spark: { name: '捕星瓶', icon: '✧', desc: '全队初始法力 +20' },
    shelter: { name: '苔原之心', icon: '⬡', desc: '开战时全队获得 35 点护盾' },
    thorns: { name: '荆棘冠冕', icon: '♜', desc: '被普攻时反弹所受生命伤害的 20%' },
    wisdom: { name: '旅人手札', icon: '▤', desc: '每次胜利额外获得 1 金币' },
    ration: { name: '守望口粮', icon: '♧', desc: '每次胜利的阵亡损耗减少 2 点，最低为 0' },
    prospector: { name: '探险徽记', icon: '♜', desc: '每次精英或首领胜利额外获得 2 金币' },
    bargain: { name: '行商信物', icon: '◈', desc: '商人所有商品便宜 2 金币，最低 1 金币' },
    bloodpact: { name: '赤月契约', icon: '☽', desc: '全队攻击 +18%，但每次胜利额外消耗 2 远征生命' },
    wardflow: {
      name: '潮汐盾纹',
      icon: '≈',
      desc: '友军护盾吸收伤害时恢复 12 法力；每名伙伴每秒最多触发一次',
      build: 'ward',
    },
    moonwell: {
      name: '赤月泉石',
      icon: '◉',
      desc: '友军普攻暴击后，治疗最虚弱友军，数值为攻击的 45%；受治疗加成和凋零影响',
      build: 'crit',
    },
    chorus: {
      name: '三重星铃',
      icon: '♬',
      desc: '每名伙伴每第三次施法，为全队提供 24 点护盾，持续 5 秒',
      build: 'cast',
    },
    overflow: {
      name: '满溢之杯',
      icon: '♧',
      desc: '友军主动治疗的溢出量有 50% 转为 5 秒护盾；最多补到目标最大生命的 25%，生命自然回复不触发',
      build: 'heal',
    },
    spring: { name: '林间泉水', icon: '♧', desc: '立即恢复 25 点远征生命' },
    purse: { name: '旅人的钱袋', icon: '◈', desc: '立即获得 7 金币' },
  };
  const CHAPTERS = W.CHAPTERS,
    NODES = W.NODES,
    AFFIXES = W.AFFIXES,
    EVENTS = W.EVENTS;
  // Every origin opens on the same value: the two starters plus the starting gold total 15
  // (月影突袭 has always been one ahead at 16). `opening` is the first tavern batch, and always
  // offers one more companion of the origin's own faction.
  const ORIGINS = {
    forest: {
      name: '林地守望',
      desc: '守卫 + 游侠 · 生命羁绊，稳健开局',
      types: ['guard', 'ranger'],
      opening: ['healer', 'frost', 'mage'],
      gold: 11,
      icon: '❧',
    },
    astral: {
      name: '群星秘术',
      desc: '骑士 + 法师 · 技能羁绊，爆发法术',
      types: ['knight', 'mage'],
      opening: ['healer', 'frost', 'mage'],
      gold: 9,
      icon: '✧',
    },
    moon: {
      name: '月影突袭',
      desc: '刺客 + 猎手 · 暴击羁绊，直取后排',
      types: ['rogue', 'hunter'],
      opening: ['healer', 'frost', 'mage'],
      gold: 9,
      icon: '☽',
    },
    tide: {
      name: '潮汐同舟',
      desc: '守卫 + 法师 · 护盾羁绊，稳步推进',
      types: ['tideguard', 'wavecaller'],
      opening: ['pearl', 'healer', 'mage'],
      gold: 10,
      icon: '≈',
    },
    ember: {
      name: '余烬行军',
      desc: '守卫 + 游侠 · 攻击羁绊，火力压制',
      types: ['emberguard', 'flarebow'],
      opening: ['sparkscout', 'healer', 'mage'],
      gold: 10,
      icon: '♨',
    },
  };
  // Enemy strength is an absolute multiplier; the shown percentage is derived from it so the
  // copy can never drift from the rule. Values are set from balance.cjs: at 冒险 the reference
  // bot finishes about four runs in five, at 险境 about one in two.
  const DIFFICULTIES = {
    story: { name: '悠游', note: '适合初次远征', scale: 0.94 },
    normal: { name: '冒险', note: '标准挑战，每一次选择都很重要', scale: 1.1 },
    hard: { name: '险境', note: '远征损耗更高，容错很小', scale: 1.19 },
  };
  for (const [id, d] of Object.entries(DIFFICULTIES)) {
    const delta = Math.round((d.scale / DIFFICULTIES.normal.scale - 1) * 100);
    d.desc = id === 'normal' ? d.note : `敌人强度 ${delta > 0 ? '+' : '−'}${Math.abs(delta)}%，${d.note}`;
  }
  const CHALLENGES = {
    none: { name: '标准远征', desc: '沿用完整规则，自由组建队伍。' },
    quartet: { name: '四人同行', desc: '最多上阵 4 人，考验升星、站位与角色取舍。' },
    scarcity: { name: '流水行囊', desc: '胜利不再获得金币利息，其他收入保持正常。' },
    bare: { name: '赤手守望', desc: '伙伴不能穿戴装备，依靠羁绊与遗物通关。' },
  };
  const maxCapacity = s => (s.challenge === 'quartet' ? 4 : 6);
  function parseSeed(input) {
    const value = String(input ?? '').trim();
    if (!value) return { seed: null };
    if (!/^\d{1,10}$/.test(value) || Number(value) < 1 || Number(value) > 4294967295)
      return { error: '种子请输入 1 至 4294967295 的整数，或留空随机生成。' };
    return { seed: Number(value) };
  }
  function runConfig(s) {
    return {
      seed: s.seed,
      origin: s.origin,
      difficulty: s.difficulty,
      challenge: s.challenge || 'none',
      rules: RULESET,
    };
  }
  function runQuery(s) {
    return new URLSearchParams(runConfig(s)).toString();
  }
  function parseRunLink(search) {
    const params = new URLSearchParams(search);
    if (!params.has('seed')) return null;
    for (const key of ['seed', 'origin', 'difficulty', 'challenge', 'rules'])
      if (params.getAll(key).length > 1) return { error: '分享链接含有重复配置，请使用完整的新链接。' };
    const parsed = parseSeed(params.get('seed'));
    if (parsed.error || parsed.seed === null) return { error: parsed.error || '分享链接缺少有效种子。' };
    const origin = params.get('origin') || 'forest',
      difficulty = params.get('difficulty') || 'normal',
      challenge = params.get('challenge') || 'none';
    if (
      !Object.hasOwn(ORIGINS, origin) ||
      !Object.hasOwn(DIFFICULTIES, difficulty) ||
      !Object.hasOwn(CHALLENGES, challenge)
    )
      return { error: '分享链接中的开局、难度或挑战无效。' };
    if (params.has('rules') && params.get('rules') !== RULESET)
      return { error: '链接来自不同规则版本。可手动输入种子，按当前规则开启远征。' };
    return { ...parsed, origin, difficulty, challenge, rules: RULESET };
  }
  function buildAdvice(s) {
    const party = deployed(s),
      hasType = t => party.some(u => u.type === t),
      hasItem = id => party.some(u => u.item === id || u.item === id + '_plus'),
      hasRelic = id => s.relics.includes(id),
      t = traits(party);
    const builds = [
      {
        id: 'ward',
        name: '护盾回流',
        relic: 'wardflow',
        ready:
          ['guard', 'knight', 'warden', 'tideguard', 'songbird', 'emberguard'].some(hasType) ||
          t.tide >= 2 ||
          hasItem('heartwood') ||
          ['shelter', 'chorus', 'overflow'].some(hasRelic),
        source: '护盾伙伴、两种潮汐、木心或护盾遗物',
        desc: '护盾承伤 → 恢复法力 → 更快释放下一层护盾。',
        tip: '蕨羽守望可把回流带到后排；碎星工匠的直接破盾不触发法力恢复。',
      },
      {
        id: 'crit',
        name: '赤月续航',
        relic: 'moonwell',
        ready: t.moon >= 2 || t.assassin >= 2 || hasItem('moonlens'),
        source: '两种月影、两种刺客或赤月透镜',
        desc: '普攻暴击 → 治疗最虚弱友军 → 用持续攻击稳住队伍。',
        tip: '透镜提高暴击率，复苏琥珀能放大持有者触发的治疗；凋零会削弱收益。',
      },
      {
        id: 'cast',
        name: '星铃连奏',
        relic: 'chorus',
        ready:
          t.mage >= 2 ||
          t.astral >= 3 ||
          hasType('oracle') ||
          hasItem('channel') ||
          hasRelic('spark') ||
          hasRelic('wardflow'),
        source: '回响沙漏、法力羁绊或法力支援',
        desc: '加快施法 → 每名伙伴第三次施法生成全队护盾。',
        tip: '单人分别计数；月泉祭司、回响沙漏和双法师可以加速连奏。',
      },
      {
        id: 'heal',
        name: '满溢春潮',
        relic: 'overflow',
        ready:
          ['healer', 'oracle', 'pearl', 'oakmaul', 'duskblade'].some(hasType) ||
          hasItem('fang') ||
          hasRelic('moonwell'),
        source: '主动治疗伙伴、吸血或赤月泉石',
        desc: '超过生命上限的主动治疗 → 转为护盾 → 满血时治疗仍有价值。',
        tip: '复苏琥珀增加溢出量；最多补到目标 25% 最大生命的护盾，自然回复不触发。',
      },
    ];
    return builds.map(b => ({ ...b, owned: hasRelic(b.relic), active: hasRelic(b.relic) && b.ready }));
  }
  const clone = x => JSON.parse(JSON.stringify(x));
  const random = W.random;
  function shuffle(a, s) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function choose(a, s) {
    return a[Math.floor(random(s) * a.length)];
  }
  const count = (a, id) => a.filter(x => x === id).length;
  const deployed = s => s.units.filter(u => u.pos !== null);
  const reserves = s => s.units.filter(u => u.pos === null);
  const statScale = star => [1, 1.8, 3.25][star - 1];
  function unit(s, type, pos = null, star = 1) {
    return { id: 'u' + s.nextId++, type, pos, star, item: null };
  }
  function newRun({ seed = Date.now() >>> 0, origin = 'forest', difficulty = 'normal', challenge = 'none' } = {}) {
    if (!Object.hasOwn(ORIGINS, origin)) origin = 'forest';
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) difficulty = 'normal';
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Invalid expedition seed');
    if (!Object.hasOwn(CHALLENGES, challenge)) throw Error('Invalid challenge');
    const map = W.generate(seed || 1);
    const s = {
      version: 3,
      ruleset: RULESET,
      rng: seed || 1,
      seed: seed || 1,
      nextId: 1,
      origin,
      difficulty,
      challenge,
      stage: 0,
      nodeId: map[0].id,
      map,
      visited: [map[0].id],
      completed: [],
      phase: 'prep',
      life: 100,
      gold: ORIGINS[origin].gold,
      capacity: 3,
      streak: 0,
      freeRefresh: 1,
      locked: false,
      units: [],
      shop: [],
      relics: [],
      bag: ['buckler'],
      rewards: [],
      report: null,
      battle: null,
      nodeResult: null,
      merchant: [],
      history: [],
      totalGold: 0,
      startedAt: Date.now(),
      recorded: false,
    };
    s.units = ORIGINS[origin].types.map(t => unit(s, t, TYPES[t].range === 1 ? 20 : 32));
    if (s.units[0].pos === s.units[1].pos) s.units[1].pos++;
    s.shop = [...ORIGINS[origin].types, ...ORIGINS[origin].opening];
    return s;
  }
  const factionIds = type => [TYPES[type].faction, ...(TYPES[type].extraFaction ? [TYPES[type].extraFaction] : [])];
  const hasFaction = (type, faction) => factionIds(type).includes(faction);
  function traits(roster) {
    const result = {};
    for (const f of Object.keys(FACTIONS))
      result[f] = new Set(roster.filter(u => hasFaction(u.type, f)).map(u => u.type)).size;
    for (const r of Object.keys(ROLE_TRAITS))
      result[r] = new Set(roster.filter(u => TYPES[u.type].role === r).map(u => u.type)).size;
    return result;
  }
  function stats(u, roster, relics = [], scale = 1) {
    const d = TYPES[u.type],
      t = traits(roster),
      i = ITEMS[u.item] || {},
      star = statScale(u.star);
    const hp = Math.round(
      d.hp *
        star *
        scale *
        (1 + (t.forest >= 3 ? 0.28 : t.forest >= 2 ? 0.18 : 0) + count(relics, 'vigor') * 0.12 + (i.hp || 0)),
    );
    return {
      maxHp: hp,
      atk: Math.round(
        d.atk *
          star *
          scale *
          (1 +
            (t.ember >= 3 ? 0.14 : t.ember >= 2 ? 0.08 : 0) +
            count(relics, 'edge') * 0.1 +
            count(relics, 'bloodpact') * 0.18 +
            (i.atk || 0)),
      ),
      armor: d.armor + (t.guardian >= 2 ? 8 : 0) + (i.armor || 0),
      range: d.range,
      interval:
        d.interval /
        (1 +
          (t.ember >= 3 ? 0.08 : 0) +
          count(relics, 'tempo') * 0.1 +
          (i.haste || 0) +
          (d.role === 'ranger' && t.ranger >= 2 ? 0.18 : 0)),
      moveInterval: 0.36 / (1 + (i.move || 0)),
      power: 1 + (t.astral >= 3 ? 0.35 : t.astral >= 2 ? 0.2 : 0) + (i.power || 0),
      mana: Math.min(100, d.mana + (t.astral >= 3 ? 15 : 0) + count(relics, 'spark') * 20 + (i.mana || 0)),
      manaRegen: 3 + (t.mage >= 2 ? 3 : 0),
      regen: t.forest >= 3 ? 0.008 : 0,
      crit: Math.min(
        0.9,
        (t.moon >= 3 ? 0.3 : t.moon >= 2 ? 0.15 : 0) +
          (d.role === 'assassin' && t.assassin >= 2 ? 0.15 : 0) +
          (i.crit || 0),
      ),
      critPower: (t.moon >= 3 ? 1.75 : 1.5) + (i.critPower || 0),
      healing: 1 + (t.tide >= 3 ? 0.2 : 0) + (d.role === 'support' && t.support >= 2 ? 0.2 : 0) + (i.healing || 0),
      leech: i.leech || 0,
      thorns: count(relics, 'thorns') * 0.2,
      startShield: count(relics, 'shelter') * 35 + (t.tide >= 3 ? 45 : t.tide >= 2 ? 25 : 0),
      shieldMana: count(relics, 'wardflow') * 12,
      critHeal: count(relics, 'moonwell') * 0.45,
      castWard: count(relics, 'chorus') * 24,
      overflow: count(relics, 'overflow') * 0.5,
      castMana: i.castMana || 0,
      emergencyShield: i.emergencyShield || 0,
    };
  }
  function rollShop(s) {
    const pool = Object.keys(TYPES)
      .filter(t => TYPES[t].cost > 0)
      .flatMap(t => Array(shopCopies(t)).fill(t));
    const offers = Array.from({ length: 5 }, () => choose(pool, s));
    const owned = s.units.filter(u => u.star < 3 && !s.units.some(v => v.type === u.type && v.star === 3));
    const pairs = owned.filter(u => u.star === 1 && owned.filter(v => v.type === u.type && v.star === 1).length === 2);
    if (owned.length) offers[Math.floor(random(s) * 5)] = choose(pairs.length ? pairs : owned, s).type;
    return offers;
  }
  function merge(s) {
    const events = [];
    for (const type of Object.keys(TYPES)) {
      for (let star = 1; star < 3; star++) {
        let same = s.units.filter(u => u.type === type && u.star === star);
        while (same.length >= 3) {
          same.sort((a, b) => (a.pos === null) - (b.pos === null));
          const keep = same[0],
            removed = same.slice(1, 3);
          for (const u of removed)
            if (u.item) {
              if (!keep.item) keep.item = u.item;
              else s.bag.push(u.item);
            }
          keep.star++;
          s.units = s.units.filter(u => !removed.includes(u));
          events.push({ type: 'merge', unit: keep.id, name: TYPES[type].name, star: keep.star });
          same = s.units.filter(u => u.type === type && u.star === star);
        }
      }
    }
    return events;
  }
  function buy(s, index) {
    if (!canManage(s)) return { error: '战斗或结算期间不能招募' };
    const type = s.shop[index];
    if (!type || !TYPES[type]) return { error: '这位伙伴已经加入队伍' };
    if (s.gold < TYPES[type].cost) return { error: '金币不足，保留金币或完成战斗再来招募' };
    const matches = s.units.filter(u => u.type === type && u.star === 1).length;
    if (reserves(s).length >= BENCH && matches < 2) return { error: '备战席已满，上阵、出售或合成后再招募' };
    s.gold -= TYPES[type].cost;
    s.shop[index] = null;
    const u = unit(s, type);
    s.units.push(u);
    return { unit: u, events: merge(s) };
  }
  function move(s, id, pos) {
    if (!canManage(s)) return { error: '只能在准备阶段调整队伍' };
    const u = s.units.find(u => u.id === id);
    if (!u) return { error: '请先选择一位伙伴' };
    if (pos !== null && (!Number.isInteger(pos) || pos < HOME || pos >= COLS * ROWS))
      return { error: '请放在下方三排的我方阵地' };
    const target = pos !== null ? s.units.find(v => v.pos === pos) : null;
    if (target === u) return {};
    if (pos === null && u.pos !== null && reserves(s).length >= BENCH) return { error: '备战席已满' };
    if (pos !== null && u.pos === null && !target && deployed(s).length >= s.capacity)
      return { error: '上阵人口已满，可与场上伙伴交换或扩充人口' };
    if (target) target.pos = u.pos;
    u.pos = pos;
    return {};
  }
  function sell(s, id) {
    if (!canManage(s)) return { error: '准备阶段才能出售伙伴' };
    const u = s.units.find(u => u.id === id);
    if (!u) return { error: '没有找到这位伙伴' };
    if (u.item) s.bag.push(u.item);
    const value = TYPES[u.type].cost * 3 ** (u.star - 1);
    s.gold += value;
    s.units = s.units.filter(v => v !== u);
    return { gold: value };
  }
  function equip(s, id, bagIndex) {
    if (!canManage(s)) return { error: '准备阶段才能更换装备' };
    const u = s.units.find(u => u.id === id);
    if (!u) return { error: '先选择一位我方伙伴' };
    if (bagIndex === -1) {
      if (u.item) {
        s.bag.push(u.item);
        u.item = null;
      }
      return {};
    }
    if (s.challenge === 'bare') return { error: '赤手守望挑战中不能穿戴装备' };
    const item = s.bag[bagIndex];
    if (!ITEMS[item]) return { error: '这件装备已不在行囊里' };
    s.bag.splice(bagIndex, 1);
    if (u.item) s.bag.push(u.item);
    u.item = item;
    return {};
  }
  function refresh(s) {
    if (!canManage(s)) return { error: '准备阶段才能刷新酒馆' };
    if (!s.freeRefresh && s.gold < 2) return { error: '刷新需要 2 金币' };
    if (s.freeRefresh) s.freeRefresh--;
    else s.gold -= 2;
    s.shop = rollShop(s);
    return {};
  }
  function expandCost(s) {
    return [0, 0, 0, 4, 6, 8][s.capacity] || 0;
  }
  function expand(s) {
    if (!canManage(s)) return { error: '准备阶段才能扩充人口' };
    if (s.capacity >= maxCapacity(s)) return { error: '已达到本次远征的人口上限' };
    const cost = expandCost(s);
    if (s.gold < cost) return { error: `扩充人口需要 ${cost} 金币` };
    s.gold -= cost;
    s.capacity++;
    return {};
  }
  function autoDeploy(s) {
    if (!canManage(s)) return { error: '准备阶段才能自动布阵' };
    const ranked = [...s.units].sort(
      (a, b) =>
        statScale(b.star) * (TYPES[b.type].hp / 10 + TYPES[b.type].atk) -
        statScale(a.star) * (TYPES[a.type].hp / 10 + TYPES[a.type].atk),
    );
    const chosen = [];
    const add = u => {
      if (u && !chosen.includes(u) && chosen.length < s.capacity) chosen.push(u);
    };
    add(ranked.find(u => TYPES[u.type].role === 'guardian'));
    add(ranked.find(u => TYPES[u.type].range > 1 && TYPES[u.type].role !== 'support'));
    if (s.capacity >= 4) add(ranked.find(u => TYPES[u.type].role === 'support'));
    for (const u of ranked) add(u);
    // Keep bench capacity valid when a full bench and deployed party are both present.
    while (s.units.length - chosen.length > BENCH) add(ranked.find(u => !chosen.includes(u)));
    s.units.forEach(u => (u.pos = null));
    let front = 0,
      back = 0;
    const frontSlots = [20, 21, 19, 22, 18, 23],
      backSlots = [32, 33, 31, 34, 30, 35];
    chosen.forEach(u => (u.pos = TYPES[u.type].range === 1 ? frontSlots[front++] : backSlots[back++]));
    return {};
  }
  const currentNode = s => s.map.find(n => n.id === s.nodeId);
  const canManage = s => ['prep', 'map', 'camp', 'merchant', 'event', 'treasure'].includes(s.phase);
  const isCombat = n => ['battle', 'elite', 'boss'].includes(n.kind);
  const enemyScale = s => currentNode(s).scale * DIFFICULTIES[s.difficulty].scale;
  function getStage(s) {
    const n = currentNode(s);
    return { ...n, enemy: n.name, tag: NODES[n.kind].name };
  }
  function enemyRoster(s) {
    const node = currentNode(s);
    if (!isCombat(node)) return [];
    let front = 0,
      back = 0;
    const formations = [
      [
        [8, 9, 7, 10, 6, 11],
        [2, 3, 1, 4, 0, 5],
      ],
      [
        [6, 10, 8, 11, 9, 7],
        [0, 5, 2, 4, 1, 3],
      ],
      [
        [9, 8, 10, 7, 11, 6],
        [4, 1, 5, 0, 3, 2],
      ],
    ];
    const [a, b] = formations[node.formation];
    return node.types.map((type, i) => ({
      id: 'e' + i,
      type,
      pos: TYPES[type].range === 1 ? a[front++] : b[back++],
      star: node.stars[i],
      item: node.act >= 1 && i === 1 ? (TYPES[type].role === 'mage' ? 'wand' : 'blade') : null,
    }));
  }
  function unitStats(s, u, side = 0, roster = side ? enemyRoster(s) : deployed(s)) {
    const st = stats(u, roster, side ? [] : s.relics, side ? enemyScale(s) : 1);
    if (side) {
      switch (currentNode(s).affix) {
        case 'armored':
          st.armor += 16;
          break;
        case 'swift':
          st.interval /= 1.12;
          st.moveInterval /= 1.2;
          break;
        case 'charged':
          st.mana = Math.min(100, st.mana + 25);
          break;
        case 'warded':
          st.startShield += 45;
          break;
        case 'thorns':
          st.thorns += 0.25;
          break;
        case 'convergence':
          st.mana = Math.min(100, st.mana + 25);
          st.manaRegen += 2;
          break;
        case 'lastwood':
          st.startShield += 60;
          break;
      }
    }
    return st;
  }
  const distance = (a, b) => Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) + Math.abs((a % COLS) - (b % COLS));
  function neighbors(pos) {
    return [pos - COLS, pos + 1, pos + COLS, pos - 1].filter(p => p >= 0 && p < COLS * ROWS && distance(pos, p) === 1);
  }
  function pathStep(from, goals, occupied) {
    const queue = [from],
      seen = new Set([from]),
      first = new Map();
    for (let q = 0; q < queue.length; q++) {
      const here = queue[q];
      if (here !== from && goals.has(here)) return first.get(here);
      for (const p of neighbors(here)) {
        if (seen.has(p) || occupied.has(p)) continue;
        seen.add(p);
        first.set(p, here === from ? p : first.get(here));
        queue.push(p);
      }
    }
    return null;
  }
  function createBattle(s) {
    if (s.phase !== 'prep' || !isCombat(currentNode(s))) return { error: '当前不能开始战斗' };
    const allies = deployed(s);
    if (!allies.length) return { error: '至少上阵一位伙伴再出发' };
    const foes = enemyRoster(s);
    const b = {
      rng: (s.seed ^ ((s.stage + 1) * 2654435761)) >>> 0 || 1,
      time: 0,
      tick: 0,
      units: [],
      events: [],
      result: null,
      enrage: false,
      telemetryVersion: 1,
      mechanicsVersion: 1,
      startCapacity: s.capacity,
    };
    for (const [roster, side] of [
      [allies, 0],
      [foes, 1],
    ])
      for (const u of roster) {
        const st = unitStats(s, u, side, roster);
        b.units.push({
          ...clone(u),
          ...st,
          side,
          targetId: null,
          targetReason: null,
          deathAt: null,
          killerId: null,
          taken: 0,
          takenKinds: { physical: 0, magic: 0, true: 0 },
          hp: st.maxHp,
          shield: st.startShield,
          tempShield: 0,
          shieldUntil: 0,
          shieldLayers: [],
          attackCd: 0.35 + random(b) * 0.4,
          moveCd: 0,
          stun: 0,
          slow: 0,
          taunt: 0,
          damage: 0,
          healed: 0,
          blocked: 0,
          kills: 0,
          casts: 0,
          dead: false,
          critCount: 0,
          baseInterval: st.interval,
        });
      }
    for (const u of b.units.filter(u => TYPES[u.type].role === 'assassin')) {
      u.ambushPending = true;
      u.stealthUntil = 2.5;
    }
    s.phase = 'battle';
    s.battle = b;
    return { battle: b };
  }
  const alive = (b, side) => b.units.filter(u => !u.dead && (side === undefined || u.side === side));
  function proc(b, u, name) {
    u.procCount = (u.procCount || 0) + 1;
    b.events.push({ type: 'proc', id: u.id, pos: u.pos, name });
  }
  function consumeShield(u, amount) {
    u.shield = Math.max(0, u.shield - amount);
    u.tempShield = Math.max(0, (u.tempShield || 0) - amount);
    if (u.shieldLayers) {
      let remaining = amount;
      for (const layer of u.shieldLayers) {
        const used = Math.min(layer.value, remaining);
        layer.value -= used;
        remaining -= used;
        if (!remaining) break;
      }
      u.shieldLayers = u.shieldLayers.filter(l => l.value > 0);
    }
  }
  function heal(b, source, target, amount) {
    if (target.dead) return;
    const offered = Math.round(amount * source.healing * (target.wither > b.time ? 0.5 : 1)),
      value = Math.min(target.maxHp - target.hp, offered);
    if (value > 0) {
      target.hp += value;
      source.healed += value;
      b.events.push({ type: 'heal', id: target.id, value, pos: target.pos, from: source.pos });
    }
    if (source.overflow && offered > value) {
      const extra = Math.floor(Math.min((offered - value) * source.overflow, target.maxHp * 0.25 - target.shield));
      if (extra > 0) {
        shield(b, source, target, extra);
        proc(b, source, '满溢之杯');
      }
    }
  }
  function hurt(b, source, target, raw, kind = 'physical', isBasic = false, critical = false) {
    if (target.dead) return 0;
    const mitigation = kind === 'true' ? 1 : 100 / (100 + target.armor * (kind === 'magic' ? 0.45 : 1));
    let value = Math.max(1, Math.round(raw * mitigation));
    const absorbed = Math.min(target.shield, value);
    consumeShield(target, absorbed);
    target.blocked += absorbed;
    value -= absorbed;
    if (absorbed && target.shieldMana && b.time >= (target.wardReady || 0)) {
      target.mana = Math.min(100, target.mana + target.shieldMana);
      target.wardReady = b.time + 1;
      proc(b, target, '潮汐盾纹');
    }
    value = Math.min(target.hp, value);
    target.hp = Math.max(0, target.hp - value);
    source.damage += value;
    if (b.telemetryVersion === 1) {
      target.taken += value;
      target.takenKinds[kind] += value;
    }
    target.mana = Math.min(100, target.mana + 6);
    b.events.push({
      type: 'damage',
      id: target.id,
      value,
      absorbed,
      pos: target.pos,
      kind,
      critical,
      from: source.pos,
    });
    if (target.hp <= 0) {
      target.dead = true;
      if (b.telemetryVersion === 1) {
        target.deathAt = b.time;
        target.killerId = source.id;
      }
      source.kills++;
      b.events.push({ type: 'death', id: target.id, pos: target.pos });
    } else if (value && target.emergencyShield && !target.emergencyUsed && target.hp <= target.maxHp * 0.4) {
      target.emergencyUsed = true;
      shield(b, target, target, target.maxHp * target.emergencyShield);
      proc(b, target, '余烬木心');
    }
    if (source.leech && value) heal(b, source, source, value * source.leech);
    if (isBasic && target.thorns && !source.dead && value) {
      hurt(b, target, source, value * target.thorns, 'true');
    }
    if (isBasic && critical && source.critHeal && !source.dead) {
      const friend = alive(b, source.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      heal(b, source, friend, source.atk * source.critHeal);
      proc(b, source, '赤月泉石');
    }
    return value;
  }
  function shield(b, source, target, value, duration = 5) {
    if (target.dead) return;
    const added = Math.round(value);
    target.shield += added;
    target.tempShield = (target.tempShield || 0) + added;
    target.shieldUntil = b.time + duration;
    if (target.shieldLayers) target.shieldLayers.push({ value: added, until: b.time + duration });
    b.events.push({ type: 'shield', id: target.id, value: added, pos: target.pos });
  }
  function cast(b, u, target) {
    if (target.stealthUntil > b.time) return;
    u.mana = 0;
    u.casts++;
    const power = u.power,
      atk = u.atk;
    const foes = alive(b, 1 - u.side),
      friends = alive(b, u.side);
    b.events.push({ type: 'cast', id: u.id, pos: u.pos, name: TYPES[u.type].skill, unitType: u.type, to: target.pos });
    switch (u.type) {
      case 'guard':
        shield(b, u, u, (90 + atk * 0.8) * power);
        u.taunt = b.time + 2.5;
        break;
      case 'knight':
        friends.filter(v => distance(v.pos, u.pos) <= 1).forEach(v => shield(b, u, v, (55 + atk * 0.7) * power));
        break;
      case 'ranger':
        for (let i = 0; i < 3; i++) {
          b.events.push({ type: 'volley', from: u.pos, to: target.pos, unitType: u.type, delay: i * 0.07 });
          hurt(b, u, target, atk * 0.8 * power);
        }
        break;
      case 'mage':
        foes.filter(v => distance(v.pos, target.pos) <= 1).forEach(v => hurt(b, u, v, atk * 2.1 * power, 'magic'));
        break;
      case 'healer':
        friends
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
          .slice(0, 2)
          .forEach(v => {
            v.stun = 0;
            v.slow = 0;
            v.wither = 0;
            heal(b, u, v, (55 + atk * 1.4) * power);
          });
        break;
      case 'oracle':
        friends
          .filter(v => v !== u)
          .sort((a, b) => a.mana - b.mana)
          .slice(0, 2)
          .forEach(v => {
            v.mana = Math.min(100, v.mana + 38 * power);
            heal(b, u, v, atk * 0.9 * power);
          });
        break;
      case 'rogue': {
        const victim = foes.filter(v => !(v.stealthUntil > b.time)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const p = neighbors(victim.pos)
          .filter(p => !alive(b).some(v => v.pos === p))
          .sort((a, b) => distance(a, u.pos) - distance(b, u.pos))[0];
        if (p !== undefined) {
          b.events.push({ type: 'blink', id: u.id, from: u.pos, to: p });
          u.pos = p;
        }
        // A blocked landing never grants a melee strike across the whole board.
        const struck = distance(u.pos, victim.pos) <= 1 ? victim : target;
        u.targetId = struck.id;
        u.targetReason = 'skill';
        hurt(b, u, struck, atk * 2.3 * power);
        break;
      }
      case 'frost':
        hurt(b, u, target, atk * 1.5 * power, 'magic');
        target.stun = Math.max(target.stun, b.time + 1.5);
        foes.filter(v => distance(v.pos, target.pos) <= 1).forEach(v => (v.slow = Math.max(v.slow, b.time + 3)));
        break;
      case 'hunter':
        foes
          .filter(v => !(v.stealthUntil > b.time))
          .sort((a, b) => distance(u.pos, b.pos) - distance(u.pos, a.pos))
          .slice(0, 2)
          .forEach((v, i) => {
            if (i === 0) {
              u.targetId = v.id;
              u.targetReason = 'skill';
            }
            b.events.push({ type: 'volley', from: u.pos, to: v.pos, unitType: u.type, delay: 0 });
            hurt(b, u, v, atk * 1.6 * power, 'true');
          });
        break;
      case 'warden':
        friends
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || TYPES[b.type].range - TYPES[a.type].range)
          .slice(0, 2)
          .forEach(v => {
            shield(b, u, v, (65 + atk) * power);
            const threat = foes.find(e => !e.dead && distance(e.pos, v.pos) <= 1);
            if (threat) {
              const p = neighbors(threat.pos)
                .filter(p => !alive(b).some(e => e.pos === p) && distance(p, v.pos) > distance(threat.pos, v.pos))
                .sort((a, b) => distance(b, v.pos) - distance(a, v.pos))[0];
              if (p !== undefined) {
                b.events.push({ type: 'push', id: threat.id, from: threat.pos, to: p });
                threat.pos = p;
              }
              threat.slow = Math.max(threat.slow, b.time + 2);
            }
          });
        break;
      case 'breaker': {
        const victim = foes
          .filter(v => !(v.stealthUntil > b.time))
          .sort((a, b) => b.shield - a.shield || distance(u.pos, a.pos) - distance(u.pos, b.pos))[0];
        u.targetId = victim.id;
        u.targetReason = 'skill';
        const broken = Math.min(victim.shield, Math.round((100 + atk * 2) * power));
        consumeShield(victim, broken);
        b.events.push({ type: 'shatter', id: victim.id, pos: victim.pos, from: u.pos, value: broken });
        hurt(b, u, victim, atk * 1.7 * power, 'magic');
        break;
      }
      case 'hexer':
        foes
          .filter(v => distance(v.pos, target.pos) <= 1)
          .forEach(v => {
            hurt(b, u, v, atk * 1.4 * power, 'magic');
            v.wither = Math.max(v.wither || 0, b.time + 5);
          });
        break;
      case 'oakmaul': {
        const struck = foes.filter(v => distance(u.pos, v.pos) <= 1);
        struck.forEach(v => hurt(b, u, v, atk * 1.7 * power));
        if (struck.length) heal(b, u, u, (40 + atk * 0.6) * power);
        break;
      }
      case 'duskblade':
        hurt(b, u, target, atk * 2.3 * power);
        heal(b, u, u, (45 + atk * 0.8) * power);
        break;
      case 'tideguard': {
        shield(b, u, u, (65 + atk) * power);
        const ally = friends.filter(v => v !== u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ally) shield(b, u, ally, (65 + atk) * power);
        break;
      }
      case 'wavecaller':
        foes
          .filter(v => Math.floor(v.pos / COLS) === Math.floor(target.pos / COLS))
          .forEach(v => hurt(b, u, v, atk * 1.5 * power, 'magic'));
        break;
      case 'pearl':
        heal(b, u, friends.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0], (95 + atk * 2) * power);
        break;
      case 'songbird':
        friends
          .sort((a, b) => b.atk - a.atk)
          .slice(0, 2)
          .forEach(v => shield(b, u, v, (70 + atk * 1.1) * power));
        break;
      case 'emberguard':
        shield(b, u, u, (75 + atk) * power);
        foes.filter(v => distance(u.pos, v.pos) <= 1).forEach(v => hurt(b, u, v, atk * 0.8 * power, 'magic'));
        break;
      case 'cinder':
        hurt(b, u, target, atk * 3.3 * power, 'magic');
        break;
      case 'flarebow':
        foes
          .filter(v => !(v.stealthUntil > b.time))
          .sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))
          .slice(0, 2)
          .forEach(v => {
            b.events.push({ type: 'volley', from: u.pos, to: v.pos, unitType: u.type, delay: 0 });
            hurt(b, u, v, atk * 1.5 * power);
          });
        break;
      case 'sparkscout':
        hurt(b, u, target, atk * 2 * power);
        target.stun = Math.max(target.stun, b.time + 1);
        break;
      case 'ancient':
        foes.forEach(v => hurt(b, u, v, atk * 0.85 * power, 'magic'));
        break;
    }
    if (!u.dead && u.castMana) {
      u.mana = Math.min(100, u.mana + u.castMana);
      proc(b, u, '回响沙漏');
    }
    if (!u.dead && u.castWard && u.casts % 3 === 0) {
      alive(b, u.side).forEach(v => shield(b, u, v, u.castWard));
      proc(b, u, '三重星铃');
    }
  }
  function step(b, dt = 0.1) {
    if (b.result) return b.result;
    b.events = [];
    b.time = Math.round((b.time + dt) * 1000) / 1000;
    b.tick++;
    if (b.time >= 50 && !b.enrage) {
      b.enrage = true;
      b.events.push({ type: 'overtime', name: '长夜将至 · 全体伤害提升，治疗减半' });
    }
    for (const u of alive(b)) {
      if (u.shieldLayers) {
        const expired = u.shieldLayers.filter(l => l.until <= b.time).reduce((n, l) => n + l.value, 0);
        u.shieldLayers = u.shieldLayers.filter(l => l.until > b.time);
        u.shield = Math.max(0, u.shield - expired);
        u.tempShield = u.shieldLayers.reduce((n, l) => n + l.value, 0);
      } else if (u.shieldUntil < b.time && u.tempShield) {
        u.shield = Math.max(0, u.shield - u.tempShield);
        u.tempShield = 0;
      }
      u.mana = Math.min(100, u.mana + u.manaRegen * dt);
      u.attackCd = Math.max(0, u.attackCd - dt);
      u.moveCd = Math.max(0, u.moveCd - dt);
      if (u.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.regen * dt * (u.wither > b.time ? 0.5 : 1));
      if (u.type === 'ancient' && u.hp / u.maxHp <= 0.5 && !u.furious) {
        u.furious = true;
        u.interval = u.baseInterval / 1.35;
        b.events.push({ type: 'cast', id: u.id, pos: u.pos, name: '古树狂怒', unitType: 'ancient', to: u.pos });
      }
      if (b.enrage && !u.overtime) {
        u.overtime = true;
        u.atk = Math.round(u.atk * 1.6);
        u.healing *= 0.5;
        u.regen = 0;
      }
    }
    for (const u of alive(b).filter(u => u.ambushPending && b.time >= 1.5 && u.stun <= b.time)) {
      u.ambushPending = false;
      u.stealthUntil = b.time + 1;
      const targets = alive(b, 1 - u.side)
        .filter(v => !(v.stealthUntil > b.time))
        .sort((a, b) => TYPES[b.type].range - TYPES[a.type].range || a.maxHp - b.maxHp);
      const p = targets.length
        ? neighbors(targets[0].pos)
            .filter(p => !alive(b).some(v => v.pos === p))
            .sort((a, b) => distance(a, u.pos) - distance(b, u.pos))[0]
        : undefined;
      if (p !== undefined) {
        b.events.push({ type: 'blink', from: u.pos, to: p, id: u.id });
        u.pos = p;
      }
    }
    for (const u of b.units) {
      u.targetId = null;
      u.targetReason = null;
    }
    for (const u of shuffle(alive(b), b)) {
      if (u.dead || u.stun > b.time || u.ambushPending) continue;
      const foes = alive(b, 1 - u.side).filter(v => !(v.stealthUntil > b.time));
      if (!foes.length) continue;
      const sorted = foes.sort(
        (a, v) => distance(u.pos, a.pos) - distance(u.pos, v.pos) || a.hp - v.hp || a.id.localeCompare(v.id),
      );
      const taunter = sorted.find(v => v.taunt > b.time && distance(u.pos, v.pos) <= 3);
      const inRange = sorted.filter(v => distance(u.pos, v.pos) <= u.range);
      let target = taunter || inRange[0] || sorted[0];
      u.targetId = target.id;
      u.targetReason = taunter ? 'taunt' : 'nearest';
      if (distance(u.pos, target.pos) > u.range) {
        if (u.moveCd > 0) continue;
        const occupied = new Set(
          alive(b)
            .filter(v => v !== u)
            .map(v => v.pos),
        );
        let next = null;
        for (const candidate of taunter ? [taunter] : sorted) {
          const goals = new Set(
            Array.from({ length: COLS * ROWS }, (_, i) => i).filter(
              p => distance(p, candidate.pos) <= u.range && !occupied.has(p),
            ),
          );
          next = pathStep(u.pos, goals, occupied);
          if (next !== null) {
            target = candidate;
            break;
          }
        }
        u.targetId = target.id;
        if (next !== null) {
          b.events.push({ type: 'move', id: u.id, from: u.pos, to: next });
          u.pos = next;
        }
        u.moveCd = u.moveInterval * (u.slow > b.time ? 1.5 : 1);
        continue;
      }
      if (u.attackCd > 0) continue;
      if (u.mana >= 100) {
        cast(b, u, target);
        u.attackCd = u.interval * 0.8;
      } else {
        const critical = random(b) < u.crit;
        const raw = u.atk * (0.96 + random(b) * 0.08) * (critical ? u.critPower : 1);
        b.events.push({ type: 'attack', id: u.id, from: u.pos, to: target.pos, unitType: u.type, ranged: u.range > 1 });
        hurt(b, u, target, raw, 'physical', true, critical);
        u.mana = Math.min(100, u.mana + 21);
        u.attackCd = u.interval * (u.slow > b.time ? 1.4 : 1);
        if (critical) u.critCount++;
      }
    }
    const a = alive(b, 0),
      e = alive(b, 1);
    if (!a.length || !e.length || b.time >= 80) {
      b.result = {
        won: a.length > 0 && !e.length,
        draw: a.length > 0 && e.length > 0,
        survivors: e.length,
        time: b.time,
      };
      b.events.push({ type: 'finish', ...b.result });
    }
    return b.result;
  }
  function interest(s) {
    return s.challenge === 'scarcity' ? 0 : Math.min(2, Math.floor(s.gold / 10));
  }
  function lootFor(s, kind = 'item') {
    const node = currentNode(s),
      rng = { rng: node.lootSeed };
    const pool =
      kind === 'item'
        ? BASIC_ITEMS
        : Object.keys(RELICS).filter(id => !['spring', 'purse'].includes(id) && count(s.relics, id) < 2);
    return pool.length ? kind + ':' + choose(pool, rng) : 'item:' + choose(BASIC_ITEMS, rng);
  }
  function grant(s, key) {
    const [kind, id] = key.split(':');
    if (kind === 'item') s.bag.push(id);
    else if (id === 'purse') {
      s.gold += 7;
      s.totalGold += 7;
    } else if (id === 'spring') s.life = Math.min(100, s.life + 25);
    else s.relics.push(id);
  }
  function makeRewards(s) {
    const rng = { rng: currentNode(s).lootSeed };
    const pool = Object.keys(RELICS).filter(id => !['spring', 'purse'].includes(id) && count(s.relics, id) < 2);
    const picks = shuffle(pool, rng)
      .slice(0, 3)
      .map(id => 'relic:' + id);
    while (picks.length < 3) {
      const item = 'item:' + choose(BASIC_ITEMS, rng);
      if (!picks.includes(item)) picks.push(item);
    }
    return picks;
  }
  function settlement(s) {
    if (s.phase !== 'battle' || !s.battle?.result) return { error: '战斗尚未结束' };
    const node = currentNode(s),
      b = s.battle,
      r = b.result;
    let income = 0,
      loss = 0,
      loot = null;
    const detail = { base: 0, interest: 0, streak: 0, path: 0, relic: 0 };
    const casualties = b.units.filter(u => !u.side && u.dead).length;
    if (r.won) {
      detail.base = 5 + node.act;
      detail.interest = interest(s);
      s.streak++;
      detail.streak = s.streak >= 3 ? 1 : 0;
      detail.path = node.kind === 'boss' ? 5 : node.kind === 'elite' ? 3 : 0;
      detail.relic =
        count(s.relics, 'wisdom') + (['elite', 'boss'].includes(node.kind) ? count(s.relics, 'prospector') * 2 : 0);
      income = Object.values(detail).reduce((a, b) => a + b, 0);
      loss =
        Math.max(0, Math.min(8, casualties * 2) - count(s.relics, 'ration') * 2) + count(s.relics, 'bloodpact') * 2;
      if (s.difficulty === 'hard' && casualties) loss += 1;
      if (node.kind === 'battle' && node.lootRoll < 0.22) {
        loot = lootFor(s);
        grant(s, loot);
      }
    } else {
      loss =
        node.kind === 'boss'
          ? s.life
          : 12 + node.act * 4 + Math.min(6, r.survivors * 2) + (s.difficulty === 'hard' ? 3 : 0);
      income = node.kind === 'boss' ? 0 : 3 + node.act;
      s.streak = 0;
    }
    loss = Math.min(s.life, loss);
    s.life -= loss;
    s.gold += income;
    s.totalGold += income;
    s.report = {
      nodeId: node.id,
      stage: s.stage,
      name: node.name,
      kind: node.kind,
      won: r.won,
      draw: !!r.draw,
      time: r.time,
      income,
      loss,
      lifeAfter: s.life,
      casualties,
      detail,
      loot,
      telemetryVersion: b.telemetryVersion || 0,
      mechanicsVersion: b.mechanicsVersion || 0,
      startCapacity: b.startCapacity ?? null,
      units: b.units.map(u => ({
        id: u.id,
        type: u.type,
        side: u.side,
        star: u.star,
        damage: Math.round(u.damage),
        healed: Math.round(u.healed),
        blocked: Math.round(u.blocked),
        kills: u.kills,
        casts: u.casts,
        alive: !u.dead,
        ...(b.mechanicsVersion === 1 ? { procCount: u.procCount || 0 } : {}),
        ...(b.telemetryVersion === 1
          ? { deathAt: u.deathAt, killerId: u.killerId, taken: Math.round(u.taken), takenKinds: clone(u.takenKinds) }
          : {}),
      })),
    };
    s.history.push({ nodeId: node.id, stage: s.stage, kind: node.kind, won: r.won, time: r.time, loss, income });
    s.phase = 'result';
    return { report: s.report };
  }
  function reportInsights(report, side = 0) {
    if (report.telemetryVersion !== 1) return null;
    const party = report.units.filter(u => u.side === side),
      foes = report.units.filter(u => u.side !== side);
    const dead = party.filter(u => u.deathAt !== null).sort((a, b) => a.deathAt - b.deathAt),
      first = dead[0] || null;
    const guards = party.filter(u => TYPES[u.type].role === 'guardian');
    const guardTime = guards.length ? guards.reduce((n, u) => n + (u.deathAt ?? report.time), 0) / guards.length : null;
    const received = party.reduce((n, u) => n + u.taken, 0),
      magic = party.reduce((n, u) => n + u.takenKinds.magic, 0),
      trueDamage = party.reduce((n, u) => n + u.takenKinds.true, 0);
    const damage = party.reduce((n, u) => n + u.damage, 0),
      enemyHealing = foes.reduce((n, u) => n + u.healed, 0),
      advice = [];
    if (side === 0 && party.length < report.startCapacity)
      advice.push({
        title: '还有可用人口',
        evidence: `开战上阵 ${party.length} / ${report.startCapacity} 人。`,
        action: '合成可能暂时减少人数。招募后检查备战席，把空余人口补上。',
      });
    if (first && TYPES[first.type].role !== 'guardian' && first.deathAt <= 10) {
      const killer = foes.find(u => u.id === first.killerId);
      advice.push({
        title: '优先保护输出与辅助',
        evidence: `${TYPES[first.type].name} 在 ${first.deathAt.toFixed(1)} 秒首先阵亡${killer ? '，最后一击来自' + TYPES[killer.type].name : ''}。`,
        action:
          killer?.type === 'rogue'
            ? '尝试留一名守卫靠近后排，避免让核心伙伴独自面对刺客。'
            : '尝试把脆弱伙伴后移，让守卫更靠前，并比较生命或护盾装备。',
      });
    }
    if (guardTime !== null && guardTime < Math.min(10, report.time * 0.55))
      advice.push({
        title: '守卫较早倒下',
        evidence: `守卫平均存活 ${guardTime.toFixed(1)} 秒，本场持续 ${report.time.toFixed(1)} 秒。`,
        action: '优先检查守卫星级和装备；治疗伙伴也需要安全的施法位置。',
      });
    if (received > 0 && magic / received >= 0.45)
      advice.push({
        title: '法术承伤较高',
        evidence: `实际生命损失中，魔法伤害占 ${Math.round((magic / received) * 100)}%。`,
        action: '可尝试分散站位，减少相邻伙伴同时受到范围法术伤害；兼顾生命和治疗。',
      });
    else if (received > 0 && trueDamage / received >= 0.3)
      advice.push({
        title: '留意真实伤害',
        evidence: `实际生命损失中，真实伤害占 ${Math.round((trueDamage / received) * 100)}%。`,
        action: '真实伤害无视护甲。可比较生命、护盾或输出装备，尽快处理伤害来源。',
      });
    if (report.time >= 15 && enemyHealing > damage * 0.25)
      advice.push({
        title: '对手持续恢复',
        evidence: `对方有效治疗 ${enemyHealing}，我方造成 ${damage} 生命伤害。`,
        action: '尝试让刺客或爆发技能威胁治疗伙伴，避免与恢复阵容长时间消耗。',
      });
    const silent = dead.filter(u => u.casts === 0 && ['mage', 'support'].includes(TYPES[u.type].role));
    if (silent.length)
      advice.push({
        title: '关键技能没有释放',
        evidence: `${silent.map(u => TYPES[u.type].name).join('、')} 阵亡前未施法。`,
        action: '比较初始法力装备，并调整保护位置，争取放出第一轮技能。',
      });
    return { first, guardTime, received, magic, trueDamage, advice: advice.slice(0, 3) };
  }
  function finishNode(s) {
    if (!s.completed.includes(s.nodeId)) s.completed.push(s.nodeId);
    s.battle = null;
    s.rewards = [];
    if (s.life <= 0) s.phase = 'lost';
    else if (!currentNode(s).next.length) s.phase = 'won';
    else s.phase = 'map';
    return {};
  }
  function continueResult(s) {
    if (s.phase !== 'result') return { error: '没有待结算的战报' };
    s.battle = null;
    if (s.life > 0 && s.report.won && ['elite', 'boss'].includes(currentNode(s).kind) && currentNode(s).next.length) {
      s.rewards = makeRewards(s);
      s.phase = 'reward';
      return {};
    }
    return finishNode(s);
  }
  function takeReward(s, key) {
    if (s.phase !== 'reward' || !s.rewards.includes(key)) return { error: '请选择这次远征提供的馈赠' };
    grant(s, key);
    return finishNode(s);
  }
  function skipReward(s) {
    if (s.phase !== 'reward') return { error: '当前没有遗物可放弃' };
    return finishNode(s);
  }
  function availableNodes(s) {
    return s.phase === 'map' ? currentNode(s).next.map(id => s.map.find(n => n.id === id)) : [];
  }
  function enterNode(s, id) {
    const node = availableNodes(s).find(n => n.id === id);
    if (!node) return { error: '只能沿当前连接的路线前进' };
    s.nodeId = id;
    s.stage = node.act * W.FLOORS + node.floor;
    s.visited.push(id);
    s.battle = null;
    s.nodeResult = null;
    s.merchant = [];
    if (isCombat(node)) {
      s.phase = 'prep';
      s.freeRefresh = s.report && !s.report.won ? 2 : 1;
      if (!s.locked) s.shop = rollShop(s);
    } else {
      s.phase = node.kind;
      if (node.kind === 'merchant') {
        const rng = { rng: node.lootSeed },
          builds = buildAdvice(s),
          discount = count(s.relics, 'bargain') * 2;
        const missing = builds.find(b => b.owned && !b.ready),
          gearHint = missing
            ? { ward: 'heartwood', crit: 'moonlens', cast: 'channel', heal: 'fang' }[missing.id]
            : deployed(s).some(u => TYPES[u.type].role === 'support')
              ? 'charm'
              : deployed(s).some(u => TYPES[u.type].role === 'mage')
                ? 'channel'
                : 'heartwood';
        const gear = [
          gearHint,
          ...shuffle(
            BASIC_ITEMS.filter(id => id !== gearHint),
            rng,
          ).slice(0, 1),
        ];
        const core = choose(
            builds.filter(b => b.ready && !b.owned),
            rng,
          ),
          relic = core ? 'relic:' + core.relic : lootFor(s, 'relic');
        s.merchant = [
          ...gear.map((id, i) => ({
            key: 'item:' + id,
            price: 7 + node.act,
            ...(!i ? { hint: missing ? '补足「' + missing.name + '」的装备' : '适合队伍的配装' } : {}),
          })),
          { key: relic, price: 13 + node.act * 2, ...(core ? { hint: '开启「' + core.name + '」的核心' } : {}) },
          { key: 'heal:18', price: 7 },
        ].map((o, i) => ({ ...o, id: String(i), price: Math.max(1, o.price - discount), sold: false }));
      }
    }
    return {};
  }
  function completeService(s, title, message) {
    s.nodeResult = { title, message };
    s.history.push({
      nodeId: s.nodeId,
      stage: s.stage,
      kind: currentNode(s).kind,
      won: null,
      time: 0,
      loss: 0,
      income: 0,
    });
    s.phase = 'node-result';
    return {};
  }
  function continueNode(s) {
    if (s.phase !== 'node-result') return { error: '当前没有待结束的事件' };
    return finishNode(s);
  }
  function campOptions(s) {
    const gear = [
      ...s.units
        .filter(u => u.item && BASIC_ITEMS.includes(u.item))
        .map(u => ({ slot: 'unit:' + u.id, item: u.item, name: TYPES[u.type].name })),
      ...s.bag.flatMap((id, i) => (BASIC_ITEMS.includes(id) ? [{ slot: 'bag:' + i, item: id, name: '行囊' }] : [])),
    ];
    return gear;
  }
  function camp(s, choice, slot = '') {
    if (s.phase !== 'camp') return { error: '只能在营地休整' };
    if (choice === 'heal') {
      const gained = Math.min(26, 100 - s.life);
      s.life += gained;
      return completeService(s, '篝火渐暖', `恢复了 ${gained} 点远征生命。伙伴已经准备好继续前行。`);
    }
    if (choice === 'forge') {
      const target = campOptions(s).find(x => x.slot === slot);
      if (!target) return { error: '请选择一件尚未精制的装备' };
      if (slot.startsWith('unit:')) s.units.find(u => u.id === slot.slice(5)).item = target.item + '_plus';
      else s.bag[Number(slot.slice(4))] = target.item + '_plus';
      return completeService(
        s,
        '炉火中的新生',
        `${ITEMS[target.item].name} 已精制，装备加成提升 60%。本次停留不能再恢复生命。`,
      );
    }
    if (choice === 'supplies') {
      s.gold += 5;
      s.totalGold += 5;
      return completeService(s, '整顿行囊', '收集了 5 金币的物资，继续上路。');
    }
    return { error: '请选择本次营地行动' };
  }
  function merchantBuy(s, id) {
    if (s.phase !== 'merchant') return { error: '只能在商人处购买' };
    const offer = s.merchant.find(o => o.id === id);
    if (!offer || offer.sold) return { error: '这件商品已经售出' };
    if (s.gold < offer.price) return { error: '金币不足' };
    if (offer.key.startsWith('relic:') && count(s.relics, offer.key.slice(6)) >= 2)
      return { error: '这件遗物已经达到两层上限' };
    if (offer.key === 'heal:18' && s.life === 100) return { error: '远征生命已满，无需购买补给' };
    s.gold -= offer.price;
    offer.sold = true;
    if (offer.key === 'heal:18') s.life = Math.min(100, s.life + 18);
    else grant(s, offer.key);
    return {};
  }
  function leaveMerchant(s) {
    if (s.phase !== 'merchant') return { error: '当前不在商人处' };
    completeService(s, '告别行商', '下一段旅途，带上真正需要的东西。');
    return finishNode(s);
  }
  function treasure(s, choice) {
    if (s.phase !== 'treasure' || !['open', 'gold'].includes(choice)) return { error: '请选择宝箱行动' };
    if (choice === 'gold') {
      s.gold += 7;
      s.totalGold += 7;
      return completeService(s, '稳妥的收获', '收好了 7 金币，没有打开封存的珍藏。');
    }
    const key = lootFor(s, currentNode(s).roll < 0.55 ? 'relic' : 'item');
    grant(s, key);
    const [kind, id] = key.split(':');
    return completeService(
      s,
      '尘封的珍藏',
      `获得了${kind === 'item' ? '装备' : '遗物'}「${(kind === 'item' ? ITEMS : RELICS)[id].name}」。`,
    );
  }
  function eventOptions(s) {
    const node = currentNode(s),
      item = lootFor(s),
      itemName = ITEMS[item.split(':')[1]].name;
    const rng = { rng: node.lootSeed },
      cores = shuffle(['wardflow', 'moonwell', 'chorus', 'overflow'], rng).slice(0, 2),
      recipes = shuffle(['moonlens', 'channel', 'heartwood'], rng).slice(0, 2);
    const choices = {
      shrine: [
        { id: 'offer', name: '献出生命', desc: '失去 8 远征生命，获得一件随机遗物。', hp: 8 },
        { id: 'leave', name: '轻声道别', desc: '没有收益，也没有损失。' },
      ],
      bridge: [
        { id: 'ferry', name: '雇用摆渡人', desc: '花费 5 金币，带回对岸的 8 金币。', gold: 5 },
        { id: 'cross', name: '踏上断桥', desc: '60% 获得 8 金币；40% 失去 10 远征生命。' },
        { id: 'leave', name: '绕路而行', desc: '安全离开，没有收益。' },
      ],
      trader: [
        { id: 'buy', name: '买下装备', desc: `花费 4 金币，获得「${itemName}」。`, gold: 4 },
        { id: 'leave', name: '祝他好运', desc: '保留金币，继续前进。' },
      ],
      spring: [
        { id: 'drink', name: '饮下泉水', desc: '恢复 14 远征生命。' },
        { id: 'bottle', name: '提炼琥珀', desc: '获得一件复苏琥珀，放弃本次恢复。' },
      ],
      ruins: [
        { id: 'dig', name: '探索遗迹', desc: '55% 获得随机遗物；45% 触发机关，失去 12 远征生命。' },
        { id: 'salvage', name: '只收集表层物资', desc: '安全获得 3 金币。' },
      ],
      wager: [
        { id: 'bet', name: '接受赌约', desc: '花费 5 金币；50% 取回 12 金币，50% 一无所获。', gold: 5 },
        { id: 'trade', name: '换取补给', desc: '花费 4 金币，恢复 12 远征生命。', gold: 4 },
        { id: 'leave', name: '谢绝邀请', desc: '不花费任何资源。' },
      ],
      confluence: [
        ...cores.map(id => ({
          id,
          name: '缔结 · ' + RELICS[id].name,
          desc: `失去 10 远征生命并花费 4 金币，获得「${RELICS[id].name}」。${RELICS[id].desc}。${count(s.relics, id) >= 2 ? '已达两层上限。' : ''}`,
          hp: 10,
          gold: 4,
          key: 'relic:' + id,
          disabled: count(s.relics, id) >= 2,
        })),
        { id: 'leave', name: '不立下契约', desc: '保留生命与金币，安全离开。' },
      ],
      workshop: [
        ...recipes.map(id => {
          const spare = s.bag.find(item => BASIC_ITEMS.includes(item) && item !== id);
          return {
            id,
            name: '改造 · ' + ITEMS[id].name,
            desc: spare
              ? `交出「${ITEMS[spare].name}」并花费 3 金币，获得「${ITEMS[id].name}」。${ITEMS[id].desc}。`
              : '行囊中需要另一件未精制装备。可先卸下装备，或直接离开。',
            gold: 3,
            key: 'item:' + id,
            sacrificeItem: spare,
            disabled: !spare,
          };
        }),
        { id: 'leave', name: '让炉火继续等候', desc: '保留装备与金币，安全离开。' },
      ],
    };
    return choices[node.event].map(o => ({
      ...o,
      disabled: !!o.disabled || s.gold < (o.gold || 0) || s.life <= (o.hp || 0),
    }));
  }
  function takeEvent(s, id) {
    if (s.phase !== 'event') return { error: '当前没有可处理的事件' };
    const option = eventOptions(s).find(o => o.id === id);
    if (!option || option.disabled) return { error: '当前资源不足，无法选择该行动' };
    const node = currentNode(s);
    let message = '你保留了资源，继续前进。';
    s.gold -= option.gold || 0;
    const addGold = n => {
      s.gold += n;
      s.totalGold += n;
    };
    const gainRelic = () => {
      const key = lootFor(s, 'relic');
      grant(s, key);
      return `获得「${(key.startsWith('relic:') ? RELICS : ITEMS)[key.split(':')[1]].name}」。`;
    };
    if (node.event === 'confluence' && option.key) {
      s.life -= option.hp;
      grant(s, option.key);
      message = `付出 ${option.hp} 远征生命与 ${option.gold} 金币，获得「${RELICS[option.key.slice(6)].name}」。`;
    }
    if (node.event === 'workshop' && option.key) {
      s.bag.splice(s.bag.indexOf(option.sacrificeItem), 1);
      grant(s, option.key);
      message = `交出「${ITEMS[option.sacrificeItem].name}」与 ${option.gold} 金币，获得「${ITEMS[option.key.slice(5)].name}」。`;
    }
    if (node.event === 'shrine' && id === 'offer') {
      s.life -= 8;
      message = '失去 8 远征生命。' + gainRelic();
    }
    if (node.event === 'bridge' && id === 'ferry') {
      addGold(8);
      message = '支付 5 金币渡河，带回 8 金币，净赚 3 金币。';
    }
    if (node.event === 'bridge' && id === 'cross') {
      if (node.roll < 0.6) {
        addGold(8);
        message = '你平安穿过断桥，获得 8 金币。';
      } else {
        s.life = Math.max(0, s.life - 10);
        message = '桥绳断裂，失去 10 远征生命。';
      }
    }
    if (node.event === 'trader' && id === 'buy') {
      const key = lootFor(s);
      grant(s, key);
      message = `支付 4 金币，获得「${ITEMS[key.split(':')[1]].name}」。`;
    }
    if (node.event === 'spring' && id === 'drink') {
      const healed = Math.min(14, 100 - s.life);
      s.life += healed;
      message = `恢复 ${healed} 远征生命。`;
    }
    if (node.event === 'spring' && id === 'bottle') {
      s.bag.push('charm');
      message = '获得装备「复苏琥珀」，泉眼已经干涸。';
    }
    if (node.event === 'ruins' && id === 'dig') {
      if (node.roll < 0.55) message = gainRelic();
      else {
        s.life = Math.max(0, s.life - 12);
        message = '机关启动，失去 12 远征生命。';
      }
    }
    if (node.event === 'ruins' && id === 'salvage') {
      addGold(3);
      message = '安全获得 3 金币，没有继续深入遗迹。';
    }
    if (node.event === 'wager' && id === 'bet') {
      if (node.roll < 0.5) {
        addGold(12);
        message = '幸运落在你这边：支付 5 金币，取回 12 金币。';
      } else message = '硬币翻向另一面，失去了下注的 5 金币。';
    }
    if (node.event === 'wager' && id === 'trade') {
      const healed = Math.min(12, 100 - s.life);
      s.life += healed;
      message = `支付 4 金币，恢复 ${healed} 远征生命。`;
    }
    return completeService(s, EVENTS[node.event].name, message);
  }
  function runRecord(s, endedAt = Date.now()) {
    if (!['won', 'lost'].includes(s.phase)) return null;
    return {
      id: s.startedAt + ':' + s.seed,
      endedAt,
      ...runConfig(s),
      rules: s.ruleset || LEGACY_RULESET,
      won: s.phase === 'won',
      completed: s.completed.length,
      life: s.life,
      totalGold: s.totalGold,
      roster: clone(deployed(s)),
      relics: [...s.relics],
      route: s.history.map(h => ({ kind: h.kind, won: h.won })),
    };
  }
  function validRecord(r) {
    const n = (v, a, b) => Number.isInteger(v) && v >= a && v <= b,
      has = (o, k) => Object.hasOwn(o, k);
    return (
      !!r &&
      typeof r.id === 'string' &&
      /^\d+:\d+$/.test(r.id) &&
      n(r.endedAt, 0, 1e15) &&
      n(r.seed, 1, 4294967295) &&
      has(ORIGINS, r.origin) &&
      has(DIFFICULTIES, r.difficulty) &&
      has(CHALLENGES, r.challenge) &&
      [RULESET, LEGACY_RULESET].includes(r.rules) &&
      typeof r.won === 'boolean' &&
      n(r.completed, 0, 27) &&
      n(r.life, 0, 100) &&
      n(r.totalGold, 0, 99999) &&
      Array.isArray(r.roster) &&
      r.roster.length <= 6 &&
      r.roster.every(
        u =>
          u &&
          has(TYPES, u.type) &&
          TYPES[u.type].cost > 0 &&
          n(u.star, 1, 3) &&
          n(u.pos, 18, 35) &&
          (!u.item || has(ITEMS, u.item)),
      ) &&
      Array.isArray(r.relics) &&
      r.relics.length <= 60 &&
      r.relics.every(id => has(RELICS, id)) &&
      Array.isArray(r.route) &&
      r.route.length <= 27 &&
      r.route.every(h => h && has(NODES, h.kind) && (h.won === null || typeof h.won === 'boolean'))
    );
  }
  function validate(s) {
    const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    const finite = (v, min = 0, max = 1e9) => Number.isFinite(v) && v >= min && v <= max;
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    if (
      !s ||
      s.version !== 3 ||
      !integer(s.stage, 0, LAST_STAGE) ||
      !integer(s.life, 0, 100) ||
      !integer(s.gold, 0, 99999) ||
      !integer(s.capacity, 3, 6) ||
      !integer(s.rng, 1, 4294967295) ||
      !integer(s.seed, 1, 4294967295) ||
      !integer(s.nextId, 1, 999999)
    )
      return false;
    if (s.ruleset !== undefined && ![RULESET, LEGACY_RULESET].includes(s.ruleset)) return false;
    if (
      (s.challenge !== undefined && !has(CHALLENGES, s.challenge)) ||
      s.capacity > maxCapacity(s) ||
      (s.challenge === 'bare' && (!Array.isArray(s.units) || s.units.some(u => u?.item)))
    )
      return false;
    if (
      !has(ORIGINS, s.origin) ||
      !has(DIFFICULTIES, s.difficulty) ||
      ![
        'prep',
        'battle',
        'result',
        'reward',
        'map',
        'camp',
        'merchant',
        'event',
        'treasure',
        'node-result',
        'won',
        'lost',
      ].includes(s.phase)
    )
      return false;
    if (!Array.isArray(s.map) || s.map.length !== 69) return false;
    if (
      !s.map.every(
        n =>
          n &&
          typeof n.id === 'string' &&
          integer(n.act, 0, 2) &&
          integer(n.floor, 0, 8) &&
          integer(n.lane, 0, 2) &&
          n.id === `${n.act}-${n.floor}-${n.lane}` &&
          has(NODES, n.kind) &&
          has(AFFIXES, n.affix) &&
          has(EVENTS, n.event) &&
          has(W.ENCOUNTERS, n.template) &&
          typeof n.name === 'string' &&
          typeof n.tip === 'string' &&
          ['forest', 'ruin', 'moon'].includes(n.theme) &&
          Array.isArray(n.next) &&
          n.next.length <= 3 &&
          finite(n.scale, 0.1, 5) &&
          finite(n.roll, 0, 1) &&
          finite(n.lootRoll, 0, 1) &&
          integer(n.lootSeed, 1, 4294967295) &&
          integer(n.formation, 0, 2) &&
          Array.isArray(n.types) &&
          n.types.length >= 2 &&
          n.types.length <= 6 &&
          n.types.every(t => has(TYPES, t)) &&
          Array.isArray(n.stars) &&
          n.stars.length === n.types.length &&
          n.stars.every(v => integer(v, 1, 3)),
      )
    )
      return false;
    const ids = new Set(s.map.map(n => n.id));
    if (ids.size !== s.map.length) return false;
    if (
      !s.map.every(
        n =>
          new Set(n.next).size === n.next.length &&
          n.next.every(id => s.map.some(v => v.id === id && v.act * 9 + v.floor === n.act * 9 + n.floor + 1)),
      )
    )
      return false;
    const node = currentNode(s);
    if (!node || s.stage !== node.act * 9 + node.floor) return false;
    if (
      !Array.isArray(s.visited) ||
      s.visited[0] !== '0-0-1' ||
      s.visited.at(-1) !== s.nodeId ||
      s.visited.length !== s.stage + 1 ||
      !s.visited.every((id, i) => ids.has(id) && (!i || s.map.find(n => n.id === s.visited[i - 1]).next.includes(id)))
    )
      return false;
    if (
      !Array.isArray(s.completed) ||
      new Set(s.completed).size !== s.completed.length ||
      !s.completed.every(id => s.visited.includes(id))
    )
      return false;
    if (
      !Array.isArray(s.units) ||
      s.units.length > 14 ||
      !s.units.every(
        u =>
          u &&
          typeof u.id === 'string' &&
          /^u\d+$/.test(u.id) &&
          TYPES[u.type]?.cost > 0 &&
          integer(u.star, 1, 3) &&
          (u.pos === null || integer(u.pos, HOME, 35)) &&
          (!u.item || ITEMS[u.item]),
      )
    )
      return false;
    const positions = deployed(s).map(u => u.pos);
    if (
      new Set(positions).size !== positions.length ||
      new Set(s.units.map(u => u.id)).size !== s.units.length ||
      positions.length > s.capacity ||
      reserves(s).length > BENCH
    )
      return false;
    if (
      !Array.isArray(s.shop) ||
      s.shop.length !== 5 ||
      !s.shop.every(t => t === null || TYPES[t]?.cost > 0) ||
      !Array.isArray(s.bag) ||
      s.bag.length > 150 ||
      !s.bag.every(i => ITEMS[i]) ||
      !Array.isArray(s.relics) ||
      s.relics.length > 60 ||
      !s.relics.every(r => RELICS[r])
    )
      return false;
    if (
      !integer(s.freeRefresh, 0, 2) ||
      !integer(s.streak, 0, 27) ||
      typeof s.locked !== 'boolean' ||
      typeof s.recorded !== 'boolean' ||
      !integer(s.totalGold, 0, 99999) ||
      !finite(s.startedAt, 0, 1e15) ||
      !Array.isArray(s.history) ||
      s.history.length > 27 ||
      !s.history.every(
        h =>
          ids.has(h.nodeId) &&
          integer(h.stage, 0, 26) &&
          has(NODES, h.kind) &&
          (h.won === null || typeof h.won === 'boolean') &&
          finite(h.time, 0, 80) &&
          finite(h.loss, 0, 100) &&
          finite(h.income, 0, 999),
      )
    )
      return false;
    const validLoot = k =>
      typeof k === 'string' &&
      (k.startsWith('relic:') ? !!RELICS[k.slice(6)] : k.startsWith('item:') && !!ITEMS[k.slice(5)]);
    if (
      !Array.isArray(s.rewards) ||
      !s.rewards.every(validLoot) ||
      !Array.isArray(s.merchant) ||
      !s.merchant.every(
        o =>
          typeof o.id === 'string' &&
          typeof o.sold === 'boolean' &&
          integer(o.price, 1, 100) &&
          (o.key === 'heal:18' || validLoot(o.key)),
      )
    )
      return false;
    if (!s.merchant.every(o => o.hint === undefined || (typeof o.hint === 'string' && o.hint.length <= 80)))
      return false;
    if (
      s.nodeResult !== null &&
      (!s.nodeResult || typeof s.nodeResult.title !== 'string' || typeof s.nodeResult.message !== 'string')
    )
      return false;
    if (s.phase === 'battle') {
      const b = s.battle;
      if (
        !b ||
        !Array.isArray(b.units) ||
        !finite(b.time, 0, 80) ||
        !integer(b.tick, 0, 800) ||
        !integer(b.rng, 1, 4294967295) ||
        b.units.length > 12 ||
        b.units.length < 2
      )
        return false;
      const numeric = [
        'atk',
        'armor',
        'shield',
        'power',
        'healing',
        'leech',
        'thorns',
        'startShield',
        'attackCd',
        'moveCd',
        'stun',
        'slow',
        'taunt',
        'damage',
        'healed',
        'blocked',
        'kills',
        'casts',
        'baseInterval',
        'manaRegen',
        'regen',
        'crit',
        'critPower',
      ];
      if (
        !b.units.every(
          u =>
            has(TYPES, u.type) &&
            /^[ue]\d+$/.test(u.id) &&
            integer(u.pos, 0, 35) &&
            integer(u.star, 1, 3) &&
            finite(u.maxHp, 1) &&
            finite(u.hp, 0, u.maxHp) &&
            finite(u.mana, 0, 100) &&
            finite(u.interval, 0.01, 20) &&
            finite(u.moveInterval, 0.01, 5) &&
            integer(u.range, 1, 5) &&
            numeric.every(k => finite(u[k])) &&
            [0, 1].includes(u.side) &&
            typeof u.dead === 'boolean',
        )
      )
        return false;
      if (
        !b.units.every(
          u =>
            (u.ambushPending === undefined || typeof u.ambushPending === 'boolean') &&
            (u.stealthUntil === undefined || finite(u.stealthUntil, 0, 81)),
        )
      )
        return false;
      if (!b.units.every(u => u.wither === undefined || finite(u.wither, 0, 85))) return false;
      if (b.mechanicsVersion !== undefined && b.mechanicsVersion !== 1) return false;
      if (
        !b.units.every(
          u =>
            ['shieldMana', 'critHeal', 'castWard', 'overflow', 'castMana', 'emergencyShield', 'procCount'].every(
              k => u[k] === undefined || finite(u[k]),
            ) &&
            (u.wardReady === undefined || finite(u.wardReady, 0, 81)) &&
            (u.emergencyUsed === undefined || typeof u.emergencyUsed === 'boolean'),
        )
      )
        return false;
      if (
        !b.units.every(
          u =>
            u.shieldLayers === undefined ||
            (Array.isArray(u.shieldLayers) &&
              u.shieldLayers.length <= 1000 &&
              u.shieldLayers.every(l => l && finite(l.value) && finite(l.until, 0, 85))),
        )
      )
        return false;
      if (b.telemetryVersion !== undefined && b.telemetryVersion !== 1) return false;
      if (
        b.telemetryVersion === 1 &&
        (!integer(b.startCapacity, 3, 6) ||
          !b.units.every(
            u =>
              finite(u.taken) &&
              u.takenKinds &&
              ['physical', 'magic', 'true'].every(k => finite(u.takenKinds[k])) &&
              (u.deathAt === null || finite(u.deathAt, 0, b.time)) &&
              (u.killerId === null || b.units.some(v => v.id === u.killerId)),
          ))
      )
        return false;
      if (
        !b.units.every(
          u =>
            (u.targetId === undefined || u.targetId === null || b.units.some(v => v.id === u.targetId)) &&
            [undefined, null, 'nearest', 'taunt', 'skill'].includes(u.targetReason),
        )
      )
        return false;
      const occupied = b.units.filter(u => !u.dead).map(u => u.pos);
      if (new Set(occupied).size !== occupied.length || new Set(b.units.map(u => u.id)).size !== b.units.length)
        return false;
      if (
        b.units.filter(u => u.side === 0).length !== deployed(s).length ||
        b.units.filter(u => u.side === 1).length !== enemyRoster(s).length
      )
        return false;
    }
    if (s.report) {
      const r = s.report;
      if (
        typeof r.won !== 'boolean' ||
        !ids.has(r.nodeId) ||
        !integer(r.stage, 0, 26) ||
        typeof r.name !== 'string' ||
        !has(NODES, r.kind) ||
        !finite(r.time, 0, 80) ||
        !integer(r.income, 0, 9999) ||
        !integer(r.loss, 0, 100) ||
        !integer(r.casualties, 0, 6) ||
        (r.loot !== null && !validLoot(r.loot)) ||
        !r.detail ||
        !['base', 'interest', 'streak', 'path', 'relic'].every(k => finite(r.detail[k], 0, 999)) ||
        !Array.isArray(r.units) ||
        !r.units.every(
          u =>
            has(TYPES, u.type) &&
            integer(u.star, 1, 3) &&
            [0, 1].includes(u.side) &&
            ['damage', 'healed', 'blocked', 'kills', 'casts'].every(k => finite(u[k])),
        )
      )
        return false;
    }
    if (s.report?.lifeAfter !== undefined && !integer(s.report.lifeAfter, 0, 100)) return false;
    if (s.report?.mechanicsVersion !== undefined && ![0, 1].includes(s.report.mechanicsVersion)) return false;
    if (s.report?.mechanicsVersion === 1 && !s.report.units.every(u => integer(u.procCount, 0, 99999))) return false;
    if (s.report?.telemetryVersion !== undefined && ![0, 1].includes(s.report.telemetryVersion)) return false;
    if (s.report?.telemetryVersion === 1) {
      const r = s.report;
      if (
        !integer(r.startCapacity, 3, 6) ||
        !r.units.every(
          u =>
            finite(u.taken) &&
            u.takenKinds &&
            ['physical', 'magic', 'true'].every(k => finite(u.takenKinds[k])) &&
            (u.deathAt === null || finite(u.deathAt, 0, r.time)) &&
            (u.killerId === null || r.units.some(v => v.id === u.killerId)),
        )
      )
        return false;
    }
    if (['prep', 'battle', 'result', 'reward'].includes(s.phase) && !isCombat(node)) return false;
    if (s.phase === 'result' && (!s.report || s.report.nodeId !== s.nodeId)) return false;
    if (s.phase === 'map' && (!node.next.length || !s.completed.includes(s.nodeId) || s.life === 0)) return false;
    if (s.phase === 'won' && (s.stage !== 26 || s.life === 0 || !s.report?.won || !s.completed.includes(s.nodeId)))
      return false;
    if (s.phase === 'lost' && s.life !== 0) return false;
    if (s.phase === 'reward' && (s.rewards.length !== 3 || !s.report?.won || !['elite', 'boss'].includes(node.kind)))
      return false;
    if (['camp', 'merchant', 'event', 'treasure'].includes(s.phase) && s.phase !== node.kind) return false;
    if (s.phase === 'node-result' && !s.nodeResult) return false;
    return true;
  }
  const api = {
    COLS,
    ROWS,
    HOME,
    BENCH,
    LAST_STAGE,
    RULESET,
    LEGACY_RULESET,
    factionIds,
    hasFaction,
    CHALLENGES,
    maxCapacity,
    runRecord,
    validRecord,
    parseSeed,
    runConfig,
    runQuery,
    parseRunLink,
    TYPES,
    FACTIONS,
    ROLES,
    ROLE_TRAITS,
    ITEMS,
    BASIC_ITEMS,
    RELICS,
    CHAPTERS,
    NODES,
    AFFIXES,
    EVENTS,
    ORIGINS,
    DIFFICULTIES,
    buildAdvice,
    clone,
    random,
    shuffle,
    choose,
    count,
    deployed,
    reserves,
    statScale,
    unit,
    newRun,
    traits,
    stats,
    rollShop,
    merge,
    buy,
    move,
    sell,
    equip,
    refresh,
    expandCost,
    expand,
    autoDeploy,
    currentNode,
    canManage,
    isCombat,
    enemyScale,
    getStage,
    unitStats,
    enemyRoster,
    distance,
    neighbors,
    pathStep,
    createBattle,
    alive,
    heal,
    hurt,
    cast,
    step,
    interest,
    settlement,
    reportInsights,
    continueResult,
    takeReward,
    skipReward,
    availableNodes,
    enterNode,
    campOptions,
    camp,
    merchantBuy,
    leaveMerchant,
    treasure,
    eventOptions,
    takeEvent,
    continueNode,
    validate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
