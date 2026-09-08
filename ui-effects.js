/* Combat animation: floaters, rings, projectiles, spell marks and the event player. */
(function (T) {
  'use strict';

  function effectPos(pos) {
    return { x: ((pos % 6) + 0.5) * 100, y: (Math.floor(pos / 6) + 0.5) * 100 };
  }
  const reducedMotion = () => prefs.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function transient(el, frames, duration, delay = 0) {
    const anim = el.animate(frames, {
      duration: duration / (prefs.speed || 1),
      delay: delay / (prefs.speed || 1),
      easing: 'ease-out',
      fill: 'both',
    });
    anim.onfinish = () => el.remove();
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
      color = mage ? '#d0dbff' : '#e3ddb0';
    el.setAttribute('x1', a.x);
    el.setAttribute('y1', a.y);
    el.setAttribute('x2', a.x + (b.x - a.x) * 0.16);
    el.setAttribute('y2', a.y + (b.y - a.y) * 0.16);
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', mage ? '5' : '2');
    el.classList.add('projectile');
    $('effects').append(el);
    transient(
      el,
      [
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${b.x - a.x}px,${b.y - a.y}px)`, opacity: 0 },
      ],
      230,
      delay,
    );
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
        { oakmaul: 'hunter', duskblade: 'rogue', sparkscout: 'mage', cinder: 'breaker', flarebow: 'hunter' }[type]
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
          floatText(ev.pos, (ev.critical ? '✦ ' : '') + '−' + Math.round(ev.value), ev.critical ? 'critical' : '');
        else if (ev.absorbed) floatText(ev.pos, '⬡ ' + Math.round(ev.absorbed), 'shield');
        if (actor) {
          actor.classList.remove('hurt');
          void actor.offsetWidth;
          actor.classList.add('hurt');
        }
      }
      if (ev.type === 'heal' && ev.value >= 5) {
        floatText(ev.pos, '+' + Math.round(ev.value), 'heal');
        if (ev.value >= 20) ring(ev.pos, '#b5dfa3', 32);
      }
      if (ev.type === 'shield') {
        floatText(ev.pos, '⬡ +' + ev.value, 'shield');
        ring(ev.pos, '#a7d7e8', 45);
      }
      if (ev.type === 'shatter') {
        floatText(ev.pos, ev.value ? '破盾 −' + ev.value : '裂界', 'critical');
        projectile(ev.from, ev.pos, 'breaker');
        ring(ev.pos, '#edc297', 55);
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
          !['healer', 'oracle', 'warden', 'knight', 'pearl', 'tideguard', 'songbird', 'emberguard'].includes(
            ev.unitType,
          )
        )
          ring(
            ['guard', 'oakmaul'].includes(ev.unitType) ? ev.pos : ev.to,
            ev.unitType === 'frost' ? '#badfee' : '#d2c7ed',
            ev.unitType === 'ancient' ? 170 : 55,
          );
        spellMark(ev.to, ev.unitType);
        if (ev.unitType === 'wavecaller')
          for (let col = 0; col < 6; col++) ring(Math.floor(ev.to / 6) * 6 + col, '#9edfe7', 30);
        audio.play(
          ['healer', 'oracle', 'pearl'].includes(ev.unitType)
            ? 'heal'
            : ['guard', 'knight', 'warden', 'tideguard', 'songbird', 'emberguard'].includes(ev.unitType)
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
