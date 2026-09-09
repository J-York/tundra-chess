/* Expedition content and seeded map generation. No DOM, network or combat side effects. */
(function (root) {
  'use strict';
  const FLOORS = 9;
  const NODES = {
    battle: { name: '遭遇战', icon: '⚔', desc: '胜利获得金币；22% 概率发现一件装备。' },
    elite: { name: '精英', icon: '♜', desc: '更强的阵容与词缀；胜利额外金币，并选择一件遗物。' },
    camp: { name: '营地', icon: '♨', desc: '恢复远征生命，或强化一件装备。没有战斗。' },
    merchant: { name: '商人', icon: '◈', desc: '花费金币购买装备、遗物或补给；可以空手离开。' },
    event: { name: '未知事件', icon: '?', desc: '未知的相遇。抵达后再决定是否承担风险。' },
    treasure: { name: '遗落宝箱', icon: '▣', desc: '打开宝箱获得一份随机珍藏，或取走固定金币。' },
    boss: { name: '首领', icon: '❖', desc: '必须击败才能进入下一章；失败则远征结束。' },
  };
  const AFFIXES = {
    none: { name: '无词缀', desc: '观察对手的职业与站位，减少己方阵亡。' },
    armored: { name: '铁甲', desc: '敌方护甲 +16。魔法与真实伤害更有效。' },
    swift: { name: '疾行', desc: '敌方攻击速度 +12%、移动速度 +20%。保护后排。' },
    charged: { name: '蓄能', desc: '敌方初始法力 +25。分散站位，防备第一轮技能。' },
    warded: { name: '结界', desc: '敌方开战获得 45 点护盾。持续输出可以突破。' },
    thorns: { name: '荆棘王冠', desc: '敌方反弹普攻造成的生命伤害的 25%。用技能突破。' },
    convergence: { name: '星泉共振', desc: '敌方初始法力 +25，每秒额外恢复 2 法力。优先突破法术后排。' },
    lastwood: { name: '古树庇护', desc: '敌方获得 60 点开场护盾；古树半血狂怒。兼顾输出与生存。' },
    resonant: { name: '回响之地', desc: '敌方技能可以暴击，暴击率为普攻的一半。压低施法次数，或抢先击破法术后排。' },
    brand: {
      name: '灼印',
      desc: '敌方技能命中会标记目标 4 秒，被标记者受到的伤害提高 18%。轮换承伤，避免一人被持续集火。',
    },
  };
  const ENCOUNTERS = {
    estuary: {
      name: '浅滩守望',
      types: ['tideguard', 'wavecaller', 'pearl', 'songbird', 'ranger', 'knight', 'driftbow'],
      tip: '潮汐提供开场护盾。分散到不同横排减少横潮命中，也别把远程挤在同一列上给贯穿箭。',
    },
    furnace: {
      name: '炉火行军',
      types: ['emberguard', 'flarebow', 'cinder', 'sparkscout', 'guard', 'healer', 'emberdrum'],
      tip: '余烬增强攻击，战鼓还会临时提高攻速。让坚固前排承伤，先打断鼓手的节奏。',
    },
    wanderers: {
      name: '溪月旅团',
      types: ['oakmaul', 'duskblade', 'songbird', 'frost', 'tideguard', 'ranger', 'vineclaw'],
      tip: '橡角近身横扫、暮刃自疗，猎豹专挑残血。保持血线，别让伙伴停在斩杀线附近。',
    },
    crossroads: {
      name: '星火同盟',
      types: ['knight', 'sparkscout', 'pearl', 'mage', 'flarebow', 'warden', 'stargazer'],
      tip: '跨阵营伙伴串起护盾、法术与普攻。观星射手会标记最远的人，后排要有治疗照应。',
    },
    patrol: {
      name: '迷途巡林者',
      types: ['guard', 'ranger', 'healer', 'guard', 'ranger', 'hunter', 'warden'],
      tip: '前排守卫吸引火力，尽量让输出伙伴安全存活。',
    },
    grove: {
      name: '孢子守望',
      types: ['guard', 'healer', 'warden', 'ranger', 'healer', 'knight', 'mistcaller'],
      tip: '治疗和羽幕擅长持久战；凋零可以压制治疗，碎星工匠可以破盾。',
    },
    ambush: {
      name: '月下伏兵',
      types: ['guard', 'rogue', 'hunter', 'frost', 'rogue', 'ranger', 'nightdew'],
      tip: '刺客会跳入后排。留一名守卫保护远程伙伴，夜露的壁垒会反弹伤害。',
    },
    stars: {
      name: '失落观星者',
      types: ['knight', 'mage', 'oracle', 'breaker', 'mage', 'hunter', 'prismguard'],
      tip: '碎星工匠会击破厚盾；分散站位，搭配治疗应对连锁法术。',
    },
    frost: {
      name: '霜枝巡猎',
      types: ['guard', 'frost', 'hunter', 'rogue', 'knight', 'frost', 'mistcaller'],
      tip: '控制会拖慢施法节奏，迷雾还会削弱伤害；药师可以清除眩晕与减速。',
    },
    bulwark: {
      name: '无声誓卫',
      types: ['knight', 'guard', 'hunter', 'ranger', 'oracle', 'mage', 'prismguard'],
      tip: '双守卫护甲很高，银狼的真实伤害与法师能打开缺口。',
    },
    chase: {
      name: '逐风猎群',
      types: ['guard', 'ranger', 'hunter', 'rogue', 'frost', 'knight', 'driftbow'],
      tip: '远程火力密集。用护盾掩护前进，或突袭其侧翼。',
    },
    twilight: {
      name: '暮影双刃',
      types: ['knight', 'rogue', 'hexer', 'hunter', 'rogue', 'oracle', 'nightdew'],
      tip: '两侧后排可能被切入，织咒会压制治疗。羽幕可以保护后排，药师能净化凋零。',
    },
    tempest: {
      name: '逆浪船队',
      types: ['tideguard', 'driftbow', 'pearl', 'wavecaller', 'saltforge', 'breaker', 'songbird'],
      tip: '铸师把护盾铺给最薄的人，贯穿箭沿着整列推进。碎盾、真实伤害与错列站位都有用。',
    },
    observatory: {
      name: '星轨观测所',
      types: ['prismguard', 'mage', 'oracle', 'stargazer', 'breaker', 'knight', 'hexer'],
      tip: '被标记的伙伴承受更多伤害。先救被标记的人，或抢在星轨箭之前压掉后排。',
    },
    mistfen: {
      name: '雾语沼林',
      types: ['nightdew', 'mistcaller', 'healer', 'oakmaul', 'hexer', 'vineclaw', 'duskblade'],
      tip: '迷雾削弱伤害、凋零削弱治疗，猎豹再收残血。净化和爆发技能能打破这个循环。',
    },
  };
  const CHAPTERS = [
    {
      name: '苔林边境',
      theme: 'forest',
      subtitle: '在旧林里，找到同行的人。',
      pool: ['patrol', 'grove', 'ambush', 'chase', 'estuary', 'wanderers', 'mistfen'],
      boss: {
        name: '荆棘树王',
        types: ['ancient', 'ranger', 'healer', 'guard'],
        stars: [1, 1, 1, 2],
        scale: 0.78,
        affix: 'thorns',
        tip: '荆棘反伤惩罚密集普攻。保留治疗，准备法术输出，古树半血后会狂怒。',
      },
    },
    {
      name: '沉星回廊',
      theme: 'ruin',
      subtitle: '星光之下，每一次停留都有代价。',
      pool: ['stars', 'bulwark', 'frost', 'grove', 'estuary', 'furnace', 'crossroads', 'observatory', 'tempest'],
      boss: {
        name: '星泉议会',
        types: ['knight', 'mage', 'oracle', 'frost', 'mage', 'hunter'],
        stars: [2, 2, 1, 2, 1, 2],
        scale: 0.95,
        affix: 'convergence',
        tip: '法力支援会让范围法术连续释放。不要挤在一起，尝试从侧翼快速击破法师。',
      },
    },
    {
      name: '长夜之心',
      theme: 'moon',
      subtitle: '带着一路的选择，走向最后的黎明。',
      pool: [
        'twilight',
        'stars',
        'frost',
        'bulwark',
        'chase',
        'furnace',
        'wanderers',
        'crossroads',
        'observatory',
        'tempest',
        'mistfen',
      ],
      boss: {
        name: '永夜守望者',
        types: ['ancient', 'knight', 'mage', 'healer', 'rogue', 'hunter', 'nightdew'],
        stars: [1, 2, 2, 2, 2, 2, 2],
        scale: 1.0,
        affix: 'lastwood',
        tip: '前排护盾和后排突袭同时出现。治疗只能争取时间，还需要足够输出在狂怒后结束战斗。',
      },
    },
  ];
  const EVENTS = {
    shrine: { name: '无声的祈愿', icon: '✧', text: '树根间悬着一枚古老的护符。碑文写着：森林不接受免费的愿望。' },
    bridge: { name: '断桥渡口', icon: '≈', text: '河对岸遗落着一袋金币。桥绳已经腐朽，摆渡人伸出了手。' },
    trader: { name: '迷路的行商', icon: '◈', text: '一位行商匆忙收拾货物。他愿意低价卖出最后一件装备。' },
    spring: { name: '银月泉眼', icon: '♧', text: '泉水只能盛满一只小碗。是现在饮下，还是提炼成随身的琥珀？' },
    ruins: { name: '埋星遗迹', icon: '▤', text: '残垣里闪着微光。继续挖掘可能找到遗物，也可能惊动沉睡的机关。' },
    wager: { name: '旅人的赌约', icon: '☽', text: '陌生旅人抛起一枚硬币。你也可以拒绝赌局，用金币换取实在的补给。' },
    confluence: {
      name: '四象交汇',
      icon: '✣',
      text: '两枚古老的印记浮出石台。守门人愿意让你选择一枚，代价是旅途中的鲜血与盘缠。',
    },
    workshop: {
      name: '星匠的旧炉',
      icon: '⚒',
      text: '星匠能把备用行装改造成另一种工具。只取行囊中的未精制装备；你也可以先卸下一件再作决定。',
    },
  };
  function random(s) {
    let x = s.rng | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s.rng = x >>> 0 || 1;
    return s.rng / 4294967296;
  }
  function pick(a, s) {
    return a[Math.floor(random(s) * a.length)];
  }
  function generate(seed) {
    const rng = { rng: (seed ^ 0x6a09e667) >>> 0 || 1 },
      nodes = [];
    const kindPool = [
      'battle',
      'battle',
      'battle',
      'battle',
      'elite',
      'elite',
      'event',
      'event',
      'camp',
      'merchant',
      'treasure',
    ];
    const REST_FLOOR = FLOORS - 2;
    for (let act = 0; act < CHAPTERS.length; act++) {
      const chapter = CHAPTERS[act];
      // The guaranteed stops move with the seed instead of sitting on a fixed floor and lane,
      // so the middle of a chapter is not the same shape in every expedition.
      const merchantFloor = 3 + Math.floor(random(rng) * 3);
      const merchantLane = Math.floor(random(rng) * 3);
      const restFight = Math.floor(random(rng) * 3);
      for (let floor = 0; floor < FLOORS; floor++) {
        const lanes = floor === 0 || floor === FLOORS - 1 ? [1] : [0, 1, 2];
        let kinds = lanes.map(() => (floor === 0 ? 'battle' : floor === 8 ? 'boss' : pick(kindPool, rng)));
        if (lanes.length === 3) {
          if (floor === 1) kinds = kinds.map(k => (k === 'elite' ? 'battle' : k));
          if (floor === merchantFloor) kinds[merchantLane] = 'merchant';
          // Two of the three lanes before a boss rest, so a camp is always reachable.
          if (floor === REST_FLOOR) kinds = [0, 1, 2].map(lane => (lane === restFight ? 'battle' : 'camp'));
          // Every floor offers a fight, with a meaningful alternative. This runs after the
          // placements above, which previously could overwrite the only battle on the floor.
          if (!kinds.includes('battle')) {
            // Never overwrite the guaranteed merchant; any other lane will do, and the pool can
            // roll merchants on its own, so searching for a non-merchant lane is not enough.
            const reserved = floor === merchantFloor ? merchantLane : -1;
            kinds[[0, 1, 2].find(lane => lane !== reserved)] = 'battle';
          }
          if (kinds.every(k => k === 'battle')) kinds[2] = 'event';
        }
        lanes.forEach((lane, i) => {
          const kind = kinds[i],
            template = act === 0 && floor === 0 ? 'patrol' : pick(chapter.pool, rng);
          const encounter = ENCOUNTERS[template],
            boss = chapter.boss;
          const n =
            kind === 'boss'
              ? boss.types.length
              : act === 0
                ? Math.min(kind === 'elite' ? 5 : 4, 2 + Math.floor((floor + 1) / 2))
                : act === 1
                  ? 4 + Math.floor((floor + 1) / 4)
                  : 6 + (floor >= 6 ? 1 : 0);
          const stars = Array.from({ length: n }, (_, j) =>
            act === 0
              ? floor >= 4 && j === 0
                ? 2
                : 1
              : act === 1
                ? j < 2 + Math.floor(floor / 4)
                  ? 2
                  : 1
                : kind === 'elite' && floor >= 5 && j === 0
                  ? 3
                  : j < 4 + Math.floor(floor / 3)
                    ? 2
                    : 1,
          );
          if (kind === 'elite' && act === 0 && floor >= 2) stars[0] = 2;
          const affix =
            kind === 'boss'
              ? boss.affix
              : kind === 'elite' || (act > 0 && random(rng) < 0.45)
                ? pick(['armored', 'swift', 'charged', 'warded', 'resonant', 'brand'], rng)
                : 'none';
          nodes.push({
            id: `${act}-${floor}-${lane}`,
            act,
            floor,
            lane,
            kind,
            next: [],
            template,
            name: kind === 'boss' ? boss.name : ['battle', 'elite'].includes(kind) ? encounter.name : NODES[kind].name,
            theme: chapter.theme,
            tip: kind === 'boss' ? boss.tip : encounter.tip,
            types: kind === 'boss' ? [...boss.types] : encounter.types.slice(0, n),
            stars: kind === 'boss' ? [...boss.stars] : stars,
            scale:
              kind === 'boss'
                ? boss.scale
                : (act === 0 ? 0.81 + floor * 0.017 : act === 1 ? 0.94 + floor * 0.016 : 0.99 + floor * 0.016) *
                  (kind === 'elite' ? 1.13 : 1),
            affix,
            formation: Math.floor(random(rng) * 3),
            event: pick(Object.keys(EVENTS), rng),
            roll: random(rng),
            lootRoll: random(rng),
            lootSeed: Math.floor(random(rng) * 4294967295) || 1,
          });
        });
      }
    }
    for (const node of nodes) {
      const next = nodes.filter(n => n.act === node.act && n.floor === node.floor + 1);
      if (node.floor === 8) {
        node.next = nodes.filter(n => n.act === node.act + 1 && n.floor === 0).map(n => n.id);
        continue;
      }
      if (next.length === 1 || node.floor === 0) node.next = next.map(n => n.id);
      else {
        // Always offer a second road, so every stop in the middle of a chapter is a decision.
        node.next = [next.find(n => n.lane === node.lane).id];
        const adjacent = next.filter(n => Math.abs(n.lane - node.lane) === 1);
        node.next.push(pick(adjacent, rng).id);
        // A rest stop must be reachable before a boss, even from the central lane.
        if (node.floor === 6 && !node.next.some(id => next.find(n => n.id === id).kind === 'camp'))
          node.next.push(next.find(n => n.kind === 'camp').id);
        // Avoid forcing consecutive elites along any route.
        if (node.kind === 'elite' && node.next.every(id => next.find(n => n.id === id).kind === 'elite')) {
          const safe = next.find(n => n.kind !== 'elite');
          node.next.push(safe.id);
        }
      }
    }
    return nodes;
  }
  const api = { FLOORS, NODES, AFFIXES, ENCOUNTERS, CHAPTERS, EVENTS, random, generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExpeditionWorld = api;
})(typeof window !== 'undefined' ? window : globalThis);
