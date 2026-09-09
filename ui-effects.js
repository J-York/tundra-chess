/* Combat animation: floaters, rings, projectiles, spell marks and the event player. */
(function (T) {
  'use strict';

  function effectPos(pos) {
    return { x: ((pos % 6) + 0.5) * 100, y: (Math.floor(pos / 6) + 0.5) * 100 };
  }
  const reducedMotion = () => prefs.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function transient(el, frames, duration, delay = 0) {
    const layer = el.parentElement;
    const limit = layer.id === 'floaters' ? 32 : 64;
    while (layer.children.length > limit) {
      const oldest = layer.firstElementChild;
      for (const animation of oldest.getAnimations()) animation.cancel();
      oldest.remove();
    }
    const anim = el.animate(frames, {
      duration: duration / (prefs.speed || 1),
      delay: delay / (prefs.speed || 1),
      easing: 'ease-out',
      fill: 'both',
    });
    anim.onfinish = anim.oncancel = () => el.remove();
    if (ui.paused) anim.pause();
    return anim;
  }

  function syncVisuals() {
    const arena = $('arena');
    arena.classList.toggle('visual-paused', ui.paused);
    arena.style.setProperty('--combat-speed', prefs.speed || 1);
    for (const anim of arena.getAnimations({ subtree: true })) {
      if (reducedMotion()) {
        if (anim.effect?.target?.closest('#effects,#floaters')) anim.effect.target.remove();
      } else if (ui.paused) anim.pause();
      else if (anim.playState === 'paused') anim.play();
    }
  }

  function floatText(pos, label, kind = '') {
    if (reducedMotion()) return;
    const el = document.createElement('span');
    const sameCell = [...$('floaters').children].filter(node => node.dataset.pos === String(pos));
    if (sameCell.length >= 3) {
      for (const animation of sameCell[0].getAnimations()) animation.cancel();
      sameCell[0].remove();
    }
    const occupied = [...$('floaters').children]
      .filter(node => node.dataset.pos === String(pos))
      .map(node => Number(node.dataset.lane));
    const lane = [0, 1, 2].find(value => !occupied.includes(value));
    el.dataset.lane = lane;
    el.dataset.pos = pos;
    el.style.marginLeft = (lane - 1) * 12 + 'px';
    el.style.marginTop = -lane * 15 + 'px';
    el.className = 'floater ' + kind;
    el.textContent = label;
    el.style.left = (((pos % 6) + 0.5) * 100) / 6 + '%';
    el.style.top = ((Math.floor(pos / 6) + 0.2) * 100) / 6 + '%';
    $('floaters').append(el);
    transient(
      el,
      [
        { transform: 'translate(-50%,0)', opacity: 1 },
        { transform: 'translate(-50%,-32px)', opacity: 0 },
      ],
      kind === 'cast-label' ? 1400 : 950,
    );
  }

  function ring(pos, color, radius = 55) {
    if (reducedMotion()) return;
    const p = effectPos(pos),
      el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', p.x);
    el.setAttribute('cy', p.y);
    el.setAttribute('r', radius);
    el.setAttribute('fill', color + '22');
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', '3');
    el.classList.add('spell-ring');
    $('effects').append(el);
    transient(
      el,
      [
        { transform: 'scale(.5)', opacity: 0.9 },
        { transform: 'scale(1.4)', opacity: 0 },
      ],
      650,
    );
  }

  function projectile(from, to, type, delay = 0) {
    if (reducedMotion()) return;
    const a = effectPos(from),
      b = effectPos(to),
      svg = 'http://www.w3.org/2000/svg',
      el = document.createElementNS(svg, 'line');
    const mage = E.TYPES[type]?.role === 'mage' || type === 'oracle',
      color = mage ? E.TYPES[type].color : '#e3ddb0';
    el.setAttribute('x1', a.x);
    el.setAttribute('y1', a.y);
    el.setAttribute('x2', a.x + (b.x - a.x) * 0.16);
    el.setAttribute('y2', a.y + (b.y - a.y) * 0.16);
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', mage ? '5' : '2');
    el.classList.add('projectile', mage ? 'arcane' : 'arrow');
    $('effects').append(el);
    transient(
      el,
      [
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${b.x - a.x}px,${b.y - a.y}px)`, opacity: 0.7 },
      ],
      230,
      delay,
    );
  }

  function impact(pos, kind) {
    if (reducedMotion()) return;
    const p = effectPos(pos);
    const shapes = {
      physical: ['#f0d5a1', 'M-22 16 20-18M-12 22 25-10'],
      magic: ['#d8c5fa', 'M0-25 18 0 0 25-18 0ZM-28 0h8m40 0h8'],
      true: ['#f7efdc', 'M-22 0h44M0-22v44'],
      heal: ['#bce4aa', 'M-18 0h36M0-18v36'],
      shield: ['#aeddef', 'M0-26 22-15 18 12 0 27-18 12-22-15Z'],
      shatter: ['#f1b291', 'M-8-24-22-15-18 12-5 24M8-24 22-15 18 12 5 24M4-18-5-4 6 5-3 17'],
      mark: ['#e7c58f', 'M0-26 7-9 25-6 12 6 15 24 0 15-15 24-12 6-25-6-7-9Z'],
    };
    const [color, path] = shapes[kind] || shapes.physical;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    g.classList.add('impact', 'impact-' + kind);
    g.innerHTML = `<path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    $('effects').append(g);
    transient(g, [{ opacity: 0.95 }, { opacity: 0 }], kind === 'shield' ? 650 : 380);
  }

  function spellMark(pos, type) {
    if (reducedMotion()) return;
    const p = effectPos(pos),
      svg = 'http://www.w3.org/2000/svg',
      g = document.createElementNS(svg, 'g');
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    const glyphs = {
      mage: ['#e4c98f', 'M0-44 9-10 40 0 9 10 0 44-9 10-40 0-9-10Z'],
      frost: ['#bee9f5', 'M-42 0H42M0-42V42M-30-30 30 30M-30 30 30-30'],
      hexer: ['#dfb1ed', 'M0 0Q-55-45-36 12L0 28 36 12Q55-45 0 0Z'],
      breaker: ['#f3c8a1', 'M0-42 34 0 0 42-34 0ZM-5-27 10-4-8 12 4 31'],
      rogue: ['#c6c6f3', 'M-33 28 22-33 8 0 33-18-16 38Z'],
      hunter: ['#d6e6f8', 'M-36 20 36-20M13-22 36-20 27 1'],
    };
    const mark =
      glyphs[type] ||
      glyphs[
        {
          oakmaul: 'hunter',
          duskblade: 'rogue',
          sparkscout: 'mage',
          cinder: 'breaker',
          flarebow: 'hunter',
          driftbow: 'hunter',
          stargazer: 'mage',
          vineclaw: 'rogue',
          mistcaller: 'frost',
          wavecaller: 'frost',
        }[type]
      ];
    if (!mark) return;
    const path = document.createElementNS(svg, 'path');
    path.setAttribute('d', mark[1]);
    path.setAttribute('stroke', mark[0]);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', type === 'frost' ? 'none' : mark[0] + '33');
    g.append(path);
    $('effects').append(g);
    transient(g, [{ opacity: 1 }, { opacity: 0 }], 650);
  }

  function animateEvents(events) {
    const announced = new Set();
    for (const ev of events) {
      const actor = ev.id ? $('actors').querySelector(`[data-actor="${ev.id}"]`) : null;
      if (ev.type === 'volley') projectile(ev.from, ev.to, ev.unitType, ev.delay * 1000);
      if (ev.type === 'attack') {
        if (actor && !reducedMotion()) {
          actor.classList.remove('attacking');
          void actor.offsetWidth;
          actor.style.setProperty('--lunge-x', Math.sign((ev.to % 6) - (ev.from % 6)) * 5 + 'px');
          actor.style.setProperty('--lunge-y', Math.sign(Math.floor(ev.to / 6) - Math.floor(ev.from / 6)) * 3 + 'px');
          actor.classList.add('attacking');
        }
        if (ev.ranged) projectile(ev.from, ev.to, ev.unitType);
        audio.play(ev.ranged ? 'arrow' : 'hit');
      }
      if (ev.type === 'damage') {
        if (ev.value)
          floatText(
            ev.pos,
            (ev.critical ? '✦ ' : '') + '−' + Math.round(ev.value),
            ev.critical ? 'critical' : ev.kind || 'physical',
          );
        if (ev.absorbed) floatText(ev.pos, '盾 −' + Math.round(ev.absorbed), 'shield');
        if (ev.value || ev.absorbed) impact(ev.pos, ev.value ? ev.kind || 'physical' : 'shield');
        if (actor) {
          actor.classList.remove('hurt');
          void actor.offsetWidth;
          actor.classList.add('hurt');
        }
      }
      if (ev.type === 'heal' && ev.value >= 5) {
        floatText(ev.pos, '+' + Math.round(ev.value), 'heal');
        impact(ev.pos, 'heal');
      }
      if (ev.type === 'shield') {
        floatText(ev.pos, '盾 +' + Math.round(ev.value), 'shield');
        impact(ev.pos, 'shield');
      }
      if (ev.type === 'shatter') {
        floatText(ev.pos, ev.value ? '破盾 −' + ev.value : '裂界', 'critical');
        projectile(ev.from, ev.pos, 'breaker');
        impact(ev.pos, 'shatter');
      }
      if (ev.type === 'mark') {
        floatText(ev.pos, '✦ 易伤 +' + Math.round(ev.value * 100) + '%', 'critical');
        impact(ev.pos, 'mark');
      }
      if (ev.type === 'push') {
        ring(ev.from, '#b9debb', 30);
        ring(ev.to, '#b9debb', 35);
      }
      if (ev.type === 'blink') {
        ring(ev.from, '#b5b7e0', 30);
        ring(ev.to, '#b5b7e0', 40);
      }
      if (ev.type === 'cast') {
        floatText(ev.pos, ev.name, 'cast-label');
        if (actor) {
          actor.classList.remove('casting');
          void actor.offsetWidth;
          actor.classList.add('casting');
        }
        if (
          ![
            'healer',
            'oracle',
            'warden',
            'knight',
            'pearl',
            'tideguard',
            'songbird',
            'emberguard',
            'emberdrum',
            'saltforge',
            'prismguard',
          ].includes(ev.unitType)
        )
          ring(
            ['guard', 'oakmaul'].includes(ev.unitType) ? ev.pos : ev.to,
            ev.unitType === 'frost' ? '#badfee' : '#d2c7ed',
            ev.unitType === 'ancient' ? 170 : 55,
          );
        spellMark(ev.to, ev.unitType);
        if (ev.unitType === 'wavecaller')
          for (let col = 0; col < 6; col++) ring(Math.floor(ev.to / 6) * 6 + col, '#9edfe7', 30);
        if (ev.unitType === 'driftbow') for (let row = 0; row < 6; row++) ring((ev.to % 6) + row * 6, '#8fd0c8', 30);
        audio.play(
          ['healer', 'oracle', 'pearl', 'emberdrum'].includes(ev.unitType)
            ? 'heal'
            : [
                  'guard',
                  'knight',
                  'warden',
                  'tideguard',
                  'songbird',
                  'emberguard',
                  'saltforge',
                  'prismguard',
                  'nightdew',
                ].includes(ev.unitType)
              ? 'shield'
              : 'magic',
        );
        T.addLog(`${E.TYPES[ev.unitType].name} · ${ev.name}`, state.battle.time);
      }
      if (ev.type === 'proc' && !announced.has(ev.id + ev.name)) {
        announced.add(ev.id + ev.name);
        floatText(ev.pos, ev.name, 'proc-label');
        T.addLog(ev.name + ' · 触发', state.battle.time);
      }
      if (ev.type === 'death') audio.play('death');
      if (ev.type === 'overtime') {
        T.notify(ev.name);
        T.addLog(ev.name, state.battle.time);
      }
    }
  }

  // Surface other modules call. Trimmed to what is actually used across files.
  T.effectPos = effectPos;
  T.syncVisuals = syncVisuals;
  T.animateEvents = animateEvents;
})(Tundra);
