'use strict';
const E=GameEngine, $=id=>document.getElementById(id), SAVE='tundra-expedition-v3', PREFS='tundra-preferences-v2', RECORDS='tundra-records-v3';
const audio=new ForestAudio();
let state, selected=null, inspected=null, activeTab='scout', paused=false, clock=null, toastTimer, dialogKind=null, lastSaveTick=0, logs=[], reportMetric='damage', reportSide=0, displayedReport=null;
let codexFaction='all',codexRole='all';
let newOrigin='forest',newDifficulty='normal',newChallenge='none',mapSelected=null,mapAct=0,rangeMode='attack',previewAim=null;
let prefs={enabled:true,music:false,volume:.45,reduced:false,tip:true};
let records={wins:0,best:0,runs:[]};
try{const p=JSON.parse(localStorage.getItem(PREFS));if(p){for(const key of ['enabled','music','reduced','tip'])if(typeof p[key]==='boolean')prefs[key]=p[key];if(Number.isFinite(p.volume))prefs.volume=Math.max(0,Math.min(1,p.volume));}const r=JSON.parse(localStorage.getItem(RECORDS));if(r&&Number.isInteger(r.wins)&&r.wins>=0&&Number.isInteger(r.best)&&r.best>=0&&r.best<=27)records={wins:r.wins,best:r.best,runs:Array.isArray(r.runs)?r.runs.filter(E.validRecord).slice(0,30):[]};}catch{}
audio.configure(prefs);document.body.classList.toggle('reduce-motion',prefs.reduced);
const art=type=>UnitArt(type);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function text(id,value){$(id).textContent=value;}
function save(){
  try{localStorage.setItem(SAVE,JSON.stringify(state));$('save-status').innerHTML='<i></i> 进度已保存';return true;}
  catch{$('save-status').textContent='存储不可用 · 请勿关闭页面';return false;}
}
function savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify(prefs));}catch{}}
function load(){
  try{const raw=localStorage.getItem(SAVE);if(raw){const candidate=JSON.parse(raw);if(E.validate(candidate)){state=candidate;paused=state.phase==='battle';return;}
    // Retain an unreadable save for recovery, instead of overwriting the only copy.
    localStorage.setItem(SAVE+'-recovery',raw);
  }}catch{}
  state=E.newRun();
}
function notify(message,error=false){text('toast',message);$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',2600);if(error)audio.play('error');}
function addLog(message,time=null){logs.unshift({message,time});logs=logs.slice(0,45);renderLog();}
function action(result,sound='click',message=''){
  if(result?.error){notify(result.error,true);return false;}
  if(result?.events?.length){for(const ev of result.events)if(ev.type==='merge'){audio.play('merge');notify(`${ev.name} 升至 ${ev.star} 星！装备已保留。`);addLog(`${ev.name} 合成为 ${ev.star} 星。`);}}else if(sound)audio.play(sound);
  if(message)notify(message);selected=null;save();render();return true;
}
function factionName(type){return E.factionIds(type).map(id=>E.FACTIONS[id]?.name||'古树').join(' · ');}
function power(roster,relics=[],scale=1){return Math.round(roster.reduce((n,u)=>{const s=E.stats(u,roster,relics,scale);return n+s.maxHp*.12+s.atk/s.interval*2+s.armor*.35;},0));}
function enemyScale(){return E.enemyScale(state);}
function liveUnits(){return state.phase==='battle'||(state.phase==='result'&&state.battle)?state.battle.units:[...E.deployed(state).map(u=>({...u,side:0})),...E.enemyRoster(state).map(u=>({...u,side:1}))];}
function setTab(name){activeTab=name;for(const tab of ['scout','unit','log']){$('tab-'+tab).setAttribute('aria-selected',String(tab===name));$(tab+'-panel').hidden=tab!==name;}if(name==='unit')renderInspector();if(name==='log')renderLog();}
function renderRoute(){
  const node=E.currentNode(state),chapter=E.CHAPTERS[node.act];
  $('route').innerHTML=`<button id="open-map" class="route-map-button" title="查看三章路线与首领">⌘ 远征地图 <span>第 ${node.act+1} 章 · ${chapter.name}</span></button><div class="journey-progress">${Array.from({length:9},(_,i)=>`<span class="journey-step ${i===node.floor?'active':i<node.floor?'done':''}" title="本章第 ${i+1} 个节点">${i<node.floor?'✓':i===8?'❖':i+1}</span>`).join('')}</div><button class="journey-seed" id="share-run" title="分享或重玩相同远征">种子 ${state.seed} ↗</button>`;
}
function selectedMapNode(){
  const current=E.currentNode(state),options=E.availableNodes(state);
  return state.map.find(n=>n.id===mapSelected)||options[0]||current;
}
function nodeSummary(node){
  if(E.isCombat(node))return `${node.types.length} 位敌人 · ${E.AFFIXES[node.affix].name} · ${node.kind==='boss'?'战败远征结束':node.kind==='elite'?'胜利必选遗物':'胜利 22% 装备掉落'}`;
  return E.NODES[node.kind].desc;
}
function mapHTML(act,large=false){
  const nodes=state.map.filter(n=>n.act===act),selected=selectedMapNode(),available=E.availableNodes(state).map(n=>n.id);
  const x=n=>46+n.floor*76,y=n=>30+n.lane*76;
  const edges=nodes.flatMap(n=>n.next.map(id=>state.map.find(m=>m.id===id)).filter(m=>m.act===act).map(m=>`<path class="${state.visited.includes(n.id)&&state.visited.includes(m.id)?'walked':''}" d="M ${x(n)} ${y(n)} L ${x(m)} ${y(m)}"/>`)).join('');
  return `<div class="map-scroll ${large?'large':''}"><div class="map-canvas"><svg class="map-lines" viewBox="0 0 704 212" aria-hidden="true">${edges}</svg>${nodes.map(n=>`<button class="map-node kind-${n.kind} ${state.completed.includes(n.id)?'visited':''} ${n.id===state.nodeId?'current':''} ${available.includes(n.id)?'available':''} ${selected.id===n.id?'selected':''}" style="left:${x(n)/704*100}%;top:${y(n)/212*100}%" data-map-node="${n.id}" aria-label="第 ${n.floor+1} 层 ${E.NODES[n.kind].name} ${n.kind==='event'?'':n.name}${available.includes(n.id)?'，可前往':''}${state.completed.includes(n.id)?'，已完成':''}" aria-pressed="${selected.id===n.id}"><b>${state.completed.includes(n.id)?'✓':E.NODES[n.kind].icon}</b><small>${E.NODES[n.kind].name}</small></button>`).join('')}</div></div>`;
}
function chapterTabs(act){return `<div class="map-chapters">${E.CHAPTERS.map((c,i)=>`<button data-map-act="${i}" class="${i===act?'active':''}">${i+1} · ${c.name}</button>`).join('')}</div>`;}
function renderTravel(){
  const node=E.currentNode(state),travel=['map','camp','merchant','event','treasure','node-result'].includes(state.phase);
  $('arena').classList.toggle('travel-mode',travel);$('travel-surface').hidden=!travel;if(!travel)return;
  const title=(label,subtitle)=>`<div class="travel-heading"><span class="eyebrow">${E.CHAPTERS[node.act].name} · 第 ${node.floor+1} 站</span><h3>${label}</h3><p>${subtitle}</p></div>`;
  if(state.phase==='map'){
    const choice=selectedMapNode();
    $('travel-surface').innerHTML=`<div class="map-title"><strong>选择下一段旅途</strong><button class="quiet" id="open-map-large">展开地图 ↗</button></div>${mapHTML(node.act)}<p class="map-footnote">亮边节点可前往 · 点击查看，右下角确认 · 首领：${E.CHAPTERS[node.act].boss.name}</p>`;
  }else if(state.phase==='camp'){
    $('travel-surface').innerHTML=title('篝火旁的片刻','只能选择一项。伙伴生命已恢复；此处补充的是远征生命。')+`<div class="travel-choices"><button class="travel-choice" data-camp="heal"><b>♨ 休息</b><span>恢复 ${Math.min(26,100-state.life)} / 26 远征生命</span></button><button class="travel-choice" id="camp-forge" ${!E.campOptions(state).length?'disabled':''}><b>⚒ 精制装备</b><span>一件装备的加成提升 60%</span></button><button class="travel-choice" data-camp="supplies"><b>◈ 搜集物资</b><span>获得 5 金币，放弃休息与精制</span></button></div>`;
  }else if(state.phase==='merchant'){
    $('travel-surface').innerHTML=title('游商的行囊',`现有 ${state.gold} 金币。标记的商品可补足队伍搭配；可以买多件，也可以不买，商品不会刷新。`)+`<div class="merchant-grid">${state.merchant.map(o=>{const d=lootDescription(o.key);return `<button class="merchant-offer ${o.sold?'purchased':''}" data-merchant="${o.id}" ${o.sold||state.gold<o.price||o.key==='heal:18'&&state.life===100||o.key.startsWith('relic:')&&E.count(state.relics,o.key.slice(6))>=2?'disabled':''}><span>${d.icon}</span><div><strong>${d.name}</strong>${o.hint?`<em>${escapeHTML(o.hint)}</em>`:''}<small>${d.desc}</small></div><b>${o.sold?'已购':'◈ '+o.price}</b></button>`;}).join('')}</div>`;
  }else if(state.phase==='event'){
    const ev=E.EVENTS[node.event];$('travel-surface').innerHTML=title(ev.icon+' '+ev.name,ev.text)+`<div class="travel-choices">${E.eventOptions(state).map(o=>`<button class="travel-choice" data-event-choice="${o.id}" ${o.disabled?'disabled':''}><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div><p class="map-footnote">结果在本次旅途中固定，刷新不会改变运气。</p>`;
  }else if(state.phase==='treasure'){
    $('travel-surface').innerHTML=title('苔藓覆盖的旧箱','封蜡还完好。你可以取出珍藏，也可以只带走箱边的金币。')+`<div class="travel-choices"><button class="travel-choice" data-treasure="open"><b>▣ 打开珍藏</b><span>55% 随机遗物，45% 随机装备</span></button><button class="travel-choice" data-treasure="gold"><b>◈ 稳妥收获</b><span>固定获得 7 金币</span></button></div>`;
  }else $('travel-surface').innerHTML=`<div class="travel-outcome"><span>${state.life?'✧':'☽'}</span><h3>${escapeHTML(state.nodeResult.title)}</h3><p>${escapeHTML(state.nodeResult.message)}</p><small>远征生命 ${state.life} / 100 · 金币 ${state.gold}</small></div>`;
}
function lootDescription(key){
  if(key==='heal:18')return {icon:'♥',name:'旅途补给',desc:'立即恢复 18 远征生命'};
  const [kind,id]=key.split(':');return kind==='item'?E.ITEMS[id]:E.RELICS[id];
}
function showMap(act=E.currentNode(state).act){
  if(selectedMapNode().act!==act)mapSelected=(E.availableNodes(state).find(n=>n.act===act)||state.map.find(n=>n.act===act&&n.kind==='boss')).id;
  mapAct=act;const node=selectedMapNode(),reachable=E.availableNodes(state).some(n=>n.id===node.id);
  showDialog('map',`${heading('走向下一片森林','先看路线与首领，再决定这一站冒多大的风险。','THE EXPEDITION MAP')}${chapterTabs(act)}<p class="map-boss-note">❖ 本章首领 · ${E.CHAPTERS[act].boss.name}：${E.CHAPTERS[act].boss.tip}</p>${mapHTML(act,true)}<div class="map-preview"><strong>${E.NODES[node.kind].icon} ${node.kind==='event'?'未知事件':node.name}</strong><p>${nodeSummary(node)}</p></div><div class="map-legend">⚔ 遭遇 · ♜ 精英 · ♨ 营地 · ◈ 商人 · ? 事件 · ▣ 宝箱 · ❖ 首领</div><div class="modal-actions"><button class="quiet" data-close>回到旅途</button>${state.phase==='map'?`<button class="primary" id="confirm-map-node" ${!reachable?'disabled':''}>${reachable?'前往选中节点 →':'请选择相连的亮边节点'}</button>`:'<span class="tiny muted">完成当前节点后，才能前往下一站。</span>'}</div>`);
}
function enterSelectedNode(){
  const node=selectedMapNode();if(action(E.enterNode(state,node.id),'move')){mapSelected=null;selected=null;inspected=null;activeTab='scout';$('modal').close();dialogKind=null;render();notify(`抵达${node.kind==='event'?'未知事件':node.name}`);}
}
function showForge(){showDialog('forge',`${heading('把这次停留，变成锋芒','精制一件装备，加成提升 60%；本次营地不再恢复远征生命。','CAMP WORKSHOP')}<div class="choices">${E.campOptions(state).map(o=>`<button class="choice" data-forge="${o.slot}"><span class="choice-icon">${E.ITEMS[o.item].icon}</span><strong>${E.ITEMS[o.item].name}</strong><small>${o.name} · 精制后：${E.ITEMS[o.item+'_plus'].desc}</small></button>`).join('')}</div><div class="modal-actions"><button class="quiet" data-close>再想一想</button></div>`);}
function renderStatus(){
  const roster=E.deployed(state),t=E.traits(roster),prep=E.canManage(state);
  text('life',state.life);$('life-bar').style.width=state.life+'%';text('life-status',state.life>60?'状态良好':state.life>30?'稍显疲惫':'亟需休整');text('gold',state.gold);text('population',`${roster.length} / ${state.capacity}`);
  $('income').innerHTML=`胜利利息 <b>+${E.interest(state)}</b> <span title="每存 10 金币获得 1 利息，最高 2；开战结算前余额计算">${state.challenge==='scarcity'?'· 流水行囊：无利息':'· 每 10 金币 +1'}</span>${state.streak?` · <b>${state.streak} 连胜</b>`:''}`;
  $('expand').innerHTML=state.capacity>=E.maxCapacity(state)?'✓ 队伍已满编':`扩充队伍 <span>◈ ${E.expandCost(state)}</span>`;$('expand').disabled=!prep||state.capacity>=E.maxCapacity(state)||state.gold<E.expandCost(state);
  $('synergies').innerHTML=Object.entries(E.FACTIONS).map(([id,f])=>{const n=t[id],tier=n>=3?1:0;return `<button class="synergy ${n>=2?'active':''}" data-trait="${id}" title="${f.desc.join('；')}"><span>${f.icon}</span><span class="syn-copy">${f.name}<small>${n>=2?f.desc[tier]:f.desc[0]}</small></span><b>${n}/${n>=2?3:2}</b></button>`;}).join('')+`<div class="role-traits">${Object.entries(E.ROLE_TRAITS).map(([id,r])=>`<button class="role-pill ${t[id]>=2?'active':''}" data-trait="${id}" title="${r.desc}">${r.icon} ${r.name} ${t[id]}/2</button>`).join('')}</div>`;
  text('relic-count',state.relics.length);$('relics').innerHTML=state.relics.length?`<div class="relic-list">${[...new Set(state.relics)].map(id=>`<button class="relic" data-relic="${id}" title="${E.RELICS[id].name} · ${E.RELICS[id].desc}">${E.RELICS[id].icon}${E.count(state.relics,id)>1?`<small>×${E.count(state.relics,id)}</small>`:''}</button>`).join('')}</div>`:'<p class="empty-note">精英、首领与奇遇，藏着稀有的馈赠。</p>';
  $('relics').insertAdjacentHTML('beforeend',`<button class="build-guide-button" id="build-guide">构筑手记 · ${E.buildAdvice(state).filter(b=>b.active).length} 组搭配 ↗</button>`);
  text('bag-count',state.bag.length+' 件');const own=state.units.some(u=>u.id===selected);
  $('bag').innerHTML=state.bag.length?state.bag.map((id,i)=>`<button class="bag-item ${own&&prep?'ready':''}" data-equip="${i}" title="${E.ITEMS[id].name} · ${E.ITEMS[id].desc}" aria-label="装备 ${E.ITEMS[id].name}" ${!prep?'disabled':''}>${E.ITEMS[id].icon}</button>`).join(''):'<span class="empty-note">行囊暂时空了</span>';
  text('difficulty-badge',E.DIFFICULTIES[state.difficulty].name+' · '+E.ORIGINS[state.origin].name+(state.challenge&&state.challenge!=='none'?' · '+E.CHALLENGES[state.challenge].name:''));
  const expanded=document.querySelector('.expedition').classList.contains('status-open');text('status-toggle',`${expanded?'收起详情':'羁绊与行囊'} · ${Object.keys(E.FACTIONS).filter(f=>t[f]>=2).length} 组羁绊 · ${state.bag.length} 件装备 ${expanded?'▴':'▾'}`);$('status-toggle').setAttribute('aria-expanded',String(expanded));
}
function renderScouting(){
  const current=E.currentNode(state),node=state.phase==='map'?selectedMapNode():current,combat=E.isCombat(node);
  const preview={...state,nodeId:node.id},foes=E.enemyRoster(preview);
  $('enemy-portrait').innerHTML=combat?art(foes[0].type):`<span class="scout-symbol">${E.NODES[node.kind].icon}</span>`;
  text('enemy-tag',`第 ${node.act+1} 章 · ${E.NODES[node.kind].name}`);text('enemy-name',node.kind==='event'&&state.phase==='map'?'未知事件':node.name);
  text('enemy-description',nodeSummary(node));
  $('enemy-list').innerHTML=foes.map(u=>`<${state.phase==='map'?'div':'button'} class="enemy-row" ${state.phase==='map'?'':`data-inspect="${u.id}" title="查看 ${E.TYPES[u.type].name}"`}>${art(u.type)}<span>${E.TYPES[u.type].name}<small>${factionName(u.type)} · ${E.ROLES[E.TYPES[u.type].role]}</small></span><span class="enemy-meta">${'★'.repeat(u.star)}</span></${state.phase==='map'?'div':'button'}>`).join('');
  $('scout-tip').innerHTML=`<strong>✧ ${combat?'战术手记':'远征手记'}</strong>${combat?E.AFFIXES[node.affix].desc+' '+node.tip:'每个节点只处理一次。伙伴始终保留，远征生命与金币决定你能走多远。'}`;
  $('inspect-enemy').hidden=!combat||state.phase==='map';
}
function buildBoard(){
  $('board').innerHTML=Array.from({length:36},(_,i)=>`<button class="cell ${i>=E.HOME?'home':''}" data-cell="${i}" aria-label="${i>=E.HOME?'我方':'敌方'}第 ${Math.floor(i/6)+1} 排第 ${i%6+1} 格" ${!E.canManage(state)?'disabled':''}></button>`).join('');
}
function actorHTML(u){
  return `<button class="actor ${u.side?'enemy':''} ${u.type==='ancient'?'boss':''} star-${u.star}" data-actor="${u.id}" draggable="${E.canManage(state)&&!u.side}" aria-label="${u.side?'敌方':'我方'} ${E.TYPES[u.type].name} ${u.star} 星">${art(u.type)}<span class="stars">${'★'.repeat(u.star)}</span>${u.item?`<span class="equipment-mark">${E.ITEMS[u.item].icon}</span>`:''}<span class="status-mark"></span><span class="unit-name">${E.TYPES[u.type].name}</span><span class="hp"><i></i></span><span class="mana"><i></i></span></button>`;
}
function updateActors(rebuild=false){
  const units=liveUnits();if(rebuild){$('actors').innerHTML=units.map(actorHTML).join('');}
  const inCombat=state.phase==='battle'||state.phase==='result';$('actors').classList.toggle('in-battle',inCombat);
  for(const u of units){const el=$('actors').querySelector(`[data-actor="${u.id}"]`);if(!el)continue;
    el.style.left=((u.pos%6+.5)*100/6)+'%';el.style.top=((Math.floor(u.pos/6)+.5)*100/6)+'%';el.style.zIndex=2+Math.floor(u.pos/6);el.style.transitionDuration=(.24/(prefs.speed||1))+'s';el.tabIndex=u.dead?-1:0;el.setAttribute('aria-hidden',String(!!u.dead));
    el.classList.toggle('selected',selected===u.id||inspected===u.id&&activeTab==='unit');el.classList.toggle('dead',!!u.dead);el.classList.toggle('shielded',u.shield>0);el.classList.toggle('stunned',inCombat&&u.stun>state.battle?.time);
    const stealthed=inCombat&&!u.dead&&u.stealthUntil>state.battle?.time;el.classList.toggle('stealthed',stealthed);
    const hp=el.querySelector('.hp'),mana=el.querySelector('.mana');hp.hidden=!inCombat;mana.hidden=!inCombat;
    if(inCombat){hp.firstElementChild.style.width=Math.max(0,u.hp/u.maxHp*100)+'%';mana.firstElementChild.style.width=u.mana+'%';const labels=statusDetails(u);el.querySelector('.status-mark').textContent=labels.filter(x=>x!=='已阵亡').map(x=>x.startsWith('潜伏')?'潜伏':x.startsWith('影幕')?'影幕':x.startsWith('眩晕')?'晕':x.startsWith('减速')?'慢':x.startsWith('正在嘲讽')?'嘲讽':x.startsWith('受嘲讽')?'受嘲':x.startsWith('凋零')?'凋零':'盾').join(' · ');el.title=E.TYPES[u.type].name+' · '+(labels.join(' · ')||'无异常状态');}
  }
  renderCombatFocus();
}
function statusDetails(u){
  const t=state.battle?.time||0,labels=[];
  if(u.dead)return ['已阵亡'];
  if(u.ambushPending)labels.push('潜伏待机');
  else if(u.stealthUntil>t)labels.push(`影幕 ${(u.stealthUntil-t).toFixed(1)}s`);
  if(u.stun>t)labels.push(`眩晕 ${(u.stun-t).toFixed(1)}s`);
  if(u.slow>t)labels.push(`减速 ${(u.slow-t).toFixed(1)}s`);
  if(u.taunt>t)labels.push(`正在嘲讽 ${(u.taunt-t).toFixed(1)}s`);
  if(u.targetReason==='taunt'&&u.stun<=t)labels.push('受嘲讽影响');
  if(u.wither>t)labels.push(`凋零 · 回复减半 ${(u.wither-t).toFixed(1)}s`);
  if(u.shield>0)labels.push(`护盾 ${Math.ceil(u.shield)}`);
  return labels;
}
function renderCombatFocus(){
  const b=state.phase==='battle'?state.battle:null,u=b?.units.find(v=>v.id===inspected),target=u&&!u.dead&&u.stun<=b.time?b.units.find(v=>v.id===u.targetId&&!v.dead&&!(v.stealthUntil>b.time)):null;
  for(const el of $('actors').querySelectorAll('[data-actor]'))el.classList.toggle('current-target',!!target&&el.dataset.actor===target.id);
  const lines=$('target-link');lines.innerHTML='';
  if(u&&target){const a=effectPos(u.pos),v=effectPos(target.pos),dx=v.x-a.x,dy=v.y-a.y,length=Math.hypot(dx,dy)||1;const start={x:a.x+dx/length*18,y:a.y+dy/length*18},end={x:v.x-dx/length*24,y:v.y-dy/length*24};lines.innerHTML=`<defs><marker id="target-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" marker-end="url(#target-arrow)"/>`;lines.classList.toggle('taunt-link',u.targetReason==='taunt');}
  const detail=$('live-status');if(!detail||!u)return;
  const labels=statusDetails(u),reason={nearest:'按距离选择',taunt:'受嘲讽影响',skill:'技能选择的目标'};
  detail.innerHTML=`<strong>${u.dead?'已阵亡':target?'当前目标 · '+E.TYPES[target.type].name:u.ambushPending?'等待潜伏结束':u.stun>b.time?'眩晕中，无法行动':'当前没有可攻击目标'}</strong>${target?`<small>${reason[u.targetReason]||'当前行动目标'} · 棋盘箭头指向该目标</small>`:''}<p>${labels.length?labels.join(' · '):'无控制或防护状态'}</p>`;
}
function renderSelection(){
  const u=liveUnits().find(v=>v.id===inspected),own=state.units.find(v=>v.id===selected),prep=state.phase==='prep',d=u&&E.TYPES[u.type];
  const foes=u?liveUnits().filter(v=>v.side!==u.side).sort((a,b)=>E.distance(u.pos,a.pos)-E.distance(u.pos,b.pos)):[];
  const aim=previewAim??foes[0]?.pos,mode=rangeMode==='skill'&&prep&&u;
  let area=[];
  if(mode&&u.pos!==null){
    const all=Array.from({length:36},(_,i)=>i);
    if(['guard','knight','oakmaul','emberguard'].includes(u.type))area=all.filter(p=>E.distance(p,u.pos)<=(u.type==='guard'?3:1));
    else if(u.type==='ancient')area=all;
    else if(['healer','oracle','warden','pearl','tideguard','songbird'].includes(u.type))area=liveUnits().filter(v=>v.side===u.side).map(v=>v.pos);
    else if(['rogue','breaker'].includes(u.type))area=foes.map(v=>v.pos);
    else if(u.type==='hunter')area=foes.slice(-2).map(v=>v.pos);
    else if(u.type==='flarebow')area=foes.slice(0,2).map(v=>v.pos);
    else if(u.type==='wavecaller'&&aim!==undefined)area=all.filter(p=>Math.floor(p/6)===Math.floor(aim/6));
    else if(aim!==undefined)area=all.filter(p=>E.distance(p,aim)<=(['mage','frost','hexer'].includes(u.type)?1:0));
  }
  $('board').querySelectorAll('[data-cell]').forEach(el=>{const p=Number(el.dataset.cell);el.classList.toggle('selected',p===own?.pos);el.classList.toggle('reachable',!!own&&E.canManage(state)&&p>=E.HOME);el.classList.toggle('attack-range',!!u&&u.pos!==null&&prep&&E.distance(u.pos,p)<=d.range);el.classList.toggle('skill-range',!!mode&&area.includes(p));el.classList.toggle('preview-aim',!!mode&&p===aim&&['mage','frost','hexer','ranger','wavecaller','cinder','duskblade','sparkscout'].includes(u.type));});
  const legend=$('range-legend');legend.hidden=!u||!prep||u.pos===null;
  legend.textContent=mode?'金色：普攻射程 · 蓝色：技能预览':'金色：普通攻击射程 · 在伙伴面板切换技能预览';
}
function renderBench(){
  const bench=E.reserves(state);text('bench-count',`${bench.length} / ${E.BENCH} · 可拖动上阵`);
  $('bench').innerHTML=Array.from({length:E.BENCH},(_,i)=>{const u=bench[i];return `<button class="bench-slot ${u?'occupied':''} ${u?.id===selected?'selected':''}" data-bench="${u?.id||''}" draggable="${!!u&&E.canManage(state)}" aria-label="${u?E.TYPES[u.type].name+' 备战伙伴':'空备战席'}">${u?`${art(u.type)}<span class="stars">${'★'.repeat(u.star)}</span><span class="unit-name">${E.TYPES[u.type].name}</span>${u.item?`<span class="equipment-mark">${E.ITEMS[u.item].icon}</span>`:''}`:'·'}</button>`;}).join('');
}
function renderShop(){
  const prep=E.canManage(state);$('shop-cards').innerHTML=state.shop.map((id,index)=>{
    if(!id)return '<div class="sold"><strong>❧</strong><span>伙伴已加入旅途</span></div>';
    const d=E.TYPES[id],n=state.units.filter(u=>u.type===id&&u.star===1).length;
    return `<article class="shop-card ${state.gold>=d.cost?'affordable':''}" style="--color:${d.color}"><div class="shop-portrait">${art(id)}<span class="card-cost">◈ ${d.cost}</span><button class="card-info-button" data-codex="${id}" title="查看技能" aria-label="查看 ${d.name} 技能">i</button>${n?`<span class="owned-badge">${n>=2?'✦ 招募即可升星':'已拥有 '+n+' / 3'}</span>`:''}</div><div class="card-info"><div class="card-name">${d.name}<span>★</span></div><div class="card-tags">${factionName(id)} · ${E.ROLES[d.role]}</div><div class="card-stats"><span>♥ ${d.hp}</span><span>⚔ ${d.atk}</span><span>⬡ ${d.armor}</span></div><button class="recruit" data-buy="${index}" ${!prep||state.gold<d.cost?'disabled':''}>${state.gold<d.cost?'金币不足':'招募伙伴'} <span>＋</span></button></div></article>`;
  }).join('');
  $('refresh').innerHTML=`↻ 刷新 <span>${state.freeRefresh?'免费 · '+state.freeRefresh:'◈ 2'}</span>`;$('refresh').disabled=!prep||!state.freeRefresh&&state.gold<2;$('lock').disabled=!prep;$('lock').textContent=state.locked?'▣ 已锁定':'◇ 锁定';$('lock').setAttribute('aria-pressed',String(state.locked));
  text('shop-tip',state.locked?'已锁定：下场战斗保留本批伙伴。手动刷新仍会替换。':'每场 1 次免费刷新，败后下场 2 次 · 成长位优先补齐一星对子。');$('shop-tip').classList.toggle('locked-note',state.locked);
}
function renderControls(){
  const fighting=state.phase==='battle',prep=E.canManage(state),n=E.deployed(state).length,node=E.currentNode(state);
  let label='开始战斗 →',disabled=!n;
  if(state.phase==='map'){disabled=!E.availableNodes(state).some(n=>n.id===selectedMapNode().id);label=disabled?'选择可达节点':'前往下一站 →';}
  else if(state.phase==='merchant'){label='告别商人 →';disabled=false;}
  else if(state.phase==='node-result'){label=state.life?'继续旅途 →':'查看远征记录';disabled=false;}
  else if(['camp','event','treasure'].includes(state.phase)){label='先选择本次行动';disabled=true;}
  else if(['won','lost'].includes(state.phase)){label='查看远征记录';disabled=false;}
  else if(state.phase!=='prep')disabled=true;
  $('fight').disabled=disabled;$('fight').textContent=label;$('auto').disabled=!prep;$('pause').disabled=!fighting;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'继续战斗':'暂停战斗');
  const phases={map:'规划路线',camp:'营地休整',merchant:'游商交易',event:'林间奇遇',treasure:'发现宝箱','node-result':'旅途回响',reward:'稀有馈赠',result:'战斗结算',won:'远征凯旋',lost:'旅途暂歇',prep:'准备阶段'};
  text('phase',fighting?(paused?'战斗已暂停':'自动战斗中'):phases[state.phase]);$('phase').classList.toggle('fighting',fighting);
  text('hint',fighting?(paused?'已暂停 · 点击伙伴查看目标与状态':'技能会随法力自动释放'):state.phase==='map'?'地图亮边节点可前往':selected?'点击目标棋格或伙伴交换位置':'伙伴保留 · 战后恢复生命');
  text('battle-time',fighting?`${state.battle.time.toFixed(1)} 秒 · 50 秒后进入加时`:state.phase==='prep'?(node.kind==='boss'?'首领战败则结束远征':'胜利每名阵亡 −2 远征生命，最多 −8'):'路线、掉落与事件均按种子保存');
  text('speed','×'+(prefs.speed||1));text('sound',prefs.enabled?'♫':'♪');$('sound').setAttribute('aria-label',prefs.enabled?'关闭音效':'开启音效');$('sound').setAttribute('aria-pressed',String(prefs.enabled));
}
function primaryAction(){
  if(state.phase==='prep')beginBattle();
  else if(state.phase==='map')enterSelectedNode();
  else if(state.phase==='merchant'){action(E.leaveMerchant(state),'move');mapSelected=null;render();}
  else if(state.phase==='node-result'){action(E.continueNode(state),'move');mapSelected=null;render();showPhase();}
  else if(['won','lost'].includes(state.phase))showEnd();
}
function renderInspector(){
  const u=state.units.find(u=>u.id===inspected)||E.enemyRoster(state).find(u=>u.id===inspected);
  if(!u){$('unit-panel').innerHTML='<div class="unit-empty">❧<br>点击棋盘或备战席伙伴<br>查看技能、属性与装备。</div>';return;}
  const own=state.units.some(v=>v.id===u.id),roster=own?(u.pos===null?[...E.deployed(state),u]:E.deployed(state)):E.enemyRoster(state);
  const base=E.unitStats(state,u,own?0:1,roster),d=E.TYPES[u.type],live=state.battle?.units.find(v=>v.id===u.id),prep=E.canManage(state),st=state.phase==='battle'&&live?live:base;
  const value=d.cost*3**(u.star-1);
  $('unit-panel').innerHTML=`<div class="inspector-title"><span class="tiny muted">${own?'我方伙伴':'敌方侦察'}${u.pos===null?' · 备战席':''}</span><button class="quiet" id="clear-selection" title="取消选择">×</button></div><div class="inspect-art">${art(u.type)}</div><div class="inspect-name">${d.name}</div><div class="inspect-tags">${factionName(u.type)} · ${E.ROLES[d.role]}${!own?' · 敌方':''}</div><div class="inspect-stars">${'★'.repeat(u.star)}</div>${state.phase==='battle'?'<div class="live-status" id="live-status"></div>':''}<div class="stat-grid"><div><small>生命</small><b>${live&&state.phase==='battle'?Math.ceil(live.hp)+'/':''}${st.maxHp}</b></div><div><small>攻击</small><b>${st.atk}</b></div><div><small>护甲</small><b>${st.armor}</b></div><div><small>攻击间隔</small><b>${st.interval.toFixed(2)}s</b></div><div><small>射程</small><b>${st.range} 格</b></div><div><small>技能强度</small><b>${Math.round(st.power*100)}%</b></div></div><div class="item-equipped">${u.item?`${E.ITEMS[u.item].icon} ${E.ITEMS[u.item].name}`:'◇ 尚未装备'}${own&&prep?'<button id="manage-equipment">更换装备</button>':''}</div>${state.phase==='prep'&&u.pos!==null?`<div class="range-controls"><button data-range-mode="attack" class="${rangeMode==='attack'?'active':''}">普攻射程</button><button data-range-mode="skill" class="${rangeMode==='skill'?'active':''}">技能预览</button></div><p class="range-help">${['mage','frost','hexer','ranger','wavecaller','cinder','duskblade','sparkscout'].includes(u.type)?'点击敌方棋格或敌人选择预览位置；超出金色射程时需先靠近。':u.type==='guard'?'蓝色为嘲讽范围，战斗中影响范围内敌人。':u.type==='knight'?'蓝色为自身与相邻友军的护盾范围。':['oakmaul','emberguard'].includes(u.type)?'蓝色为相邻技能范围，需接近敌人后施放。':['healer','oracle','warden','pearl','tideguard','songbird'].includes(u.type)?'蓝色为可选友军；技能自动按生命或法力选取。':u.type==='rogue'?'蓝色为可能的突袭目标；血量和空位决定实际落点。':u.type==='hunter'?'预览当前最远的两名敌人，目标随站位变化。':u.type==='flarebow'?'预览当前最近的两名敌人，目标随站位变化。':u.type==='breaker'?'蓝色为可选敌人；优先击破最厚护盾，潜伏敌人不能被选中。':'蓝色为全场技能范围。'}</p>`:''}<div class="skill-box"><strong>✧ ${d.skill}</strong><p>${d.desc}</p><small>100 法力自动释放 · 普攻 +21，受击 +6 · 初始 ${Math.round(base.mana)} 法力</small><small>${own&&u.pos===null?'预览假设上阵该伙伴后的羁绊；实际上阵人口仍受限制。':'属性已计入当前羁绊、装备与遗物。'}</small></div>${u.item?`<p class="equipped-desc">${E.ITEMS[u.item].desc}</p>`:''}${own?`<div class="inspect-actions"><button class="secondary" id="bench-unit" ${!prep||u.pos===null?'disabled':''}>撤至备战席</button><button class="danger" id="sell-unit" ${!prep?'disabled':''}>出售 ◈ ${value}</button></div>`:''}<p class="flavor">“${d.flavor}”</p>`;
  renderCombatFocus();
}
function renderLog(){
  $('log').innerHTML=logs.length?logs.map(l=>`<div>${l.time!==null?`<time>${l.time.toFixed(1)}s</time>`:''}${escapeHTML(l.message)}</div>`).join(''):'<p class="empty-note">先调整队伍，森林在等你出发。</p>';$('last-report').disabled=!state.report;
}
function render(){
  const node=E.currentNode(state);
  renderRoute();renderStatus();renderScouting();renderBench();renderShop();buildBoard();updateActors(true);renderSelection();renderControls();setTab(activeTab);
  text('stage-label',`第 ${node.act+1} 章 / ${node.floor+1} · 9`);text('stage-title',node.name);$('arena').className='arena theme-'+node.theme;
  $('stage-modifier').innerHTML=`<span>${E.NODES[node.kind].icon} ${E.NODES[node.kind].name}</span><strong>${E.isCombat(node)?E.AFFIXES[node.affix].name:'一次停留，一次选择'}</strong>`;
  if(state.battle&&['battle','result'].includes(state.phase)){text('enemy-power',`${E.alive(state.battle,1).length} / ${state.battle.units.filter(u=>u.side===1).length} 存活`);text('formation-power',`${E.alive(state.battle,0).length} / ${state.battle.units.filter(u=>u.side===0).length} 存活`);}else{text('enemy-power',`${E.enemyRoster(state).length} 人 · 战力 ${power(E.enemyRoster(state),[],enemyScale())}`);text('formation-power',`${E.deployed(state).length} 人 · 战力 ${power(E.deployed(state),state.relics)}`);}
  $('onboarding').hidden=!prefs.tip;$('battle-progress-bar').style.width=state.phase==='battle'?Math.min(100,state.battle.time/80*100)+'%':'0%';renderTravel();
}
function selectActor(id){
  const own=state.units.find(u=>u.id===id);
  if(!E.canManage(state)){inspected=id;setTab('unit');updateActors();return;}
  const enemy=E.enemyRoster(state).find(u=>u.id===id);if(rangeMode==='skill'&&selected&&enemy){previewAim=enemy.pos;renderSelection();return;}
  if(inspected!==id){previewAim=null;rangeMode='attack';}
  if(selected===id){selected=null;inspected=id;render();return;}
  if(selected&&own&&own.pos!==null&&selected!==id){const source=state.units.find(u=>u.id===selected);if(source){const movedId=source.id;action(E.move(state,source.id,own.pos),'move');inspected=movedId;setTab('unit');return;}}
  selected=own?id:null;inspected=id;activeTab='unit';audio.play('click');render();
}
function moveTo(pos){if(rangeMode==='skill'&&selected&&pos!==null&&pos<E.HOME){previewAim=pos;renderSelection();return;}if(!selected){if(pos!==null){const u=state.units.find(u=>u.pos===pos);if(u)selectActor(u.id);}else notify('先选择一位场上的伙伴');return;}const id=selected;if(action(E.move(state,id,pos),'move')){selected=id;inspected=id;render();}}
function effectPos(pos){return {x:(pos%6+.5)*100,y:(Math.floor(pos/6)+.5)*100};}
const reducedMotion=()=>prefs.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
function transient(el,frames,duration,delay=0){
  const anim=el.animate(frames,{duration:duration/(prefs.speed||1),delay:delay/(prefs.speed||1),easing:'ease-out',fill:'both'});anim.onfinish=()=>el.remove();return anim;
}
function syncVisuals(){
  const arena=$('arena');arena.classList.toggle('visual-paused',paused);arena.style.setProperty('--combat-speed',prefs.speed||1);
  for(const anim of arena.getAnimations({subtree:true})){if(reducedMotion()){if(anim.effect?.target?.closest('#effects,#floaters'))anim.effect.target.remove();}else if(paused)anim.pause();else if(anim.playState==='paused')anim.play();}
}
function floatText(pos,label,kind=''){
  if(reducedMotion())return;
  const el=document.createElement('span');el.className='floater '+kind;el.textContent=label;el.style.left=((pos%6+.5)*100/6)+'%';el.style.top=((Math.floor(pos/6)+.2)*100/6)+'%';$('floaters').append(el);transient(el,[{transform:'translate(-50%,0)',opacity:1},{transform:'translate(-50%,-32px)',opacity:0}],kind==='cast-label'?1400:950);
}
function ring(pos,color,radius=55){
  if(reducedMotion())return;const p=effectPos(pos),el=document.createElementNS('http://www.w3.org/2000/svg','circle');el.setAttribute('cx',p.x);el.setAttribute('cy',p.y);el.setAttribute('r',radius);el.setAttribute('fill',color+'22');el.setAttribute('stroke',color);el.setAttribute('stroke-width','3');el.classList.add('spell-ring');$('effects').append(el);transient(el,[{transform:'scale(.5)',opacity:.9},{transform:'scale(1.4)',opacity:0}],650);
}
function projectile(from,to,type,delay=0){
  if(reducedMotion())return;const a=effectPos(from),b=effectPos(to),svg='http://www.w3.org/2000/svg',el=document.createElementNS(svg,'line');const mage=E.TYPES[type]?.role==='mage'||type==='oracle',color=mage?'#d0dbff':'#e3ddb0';
  el.setAttribute('x1',a.x);el.setAttribute('y1',a.y);el.setAttribute('x2',a.x+(b.x-a.x)*.16);el.setAttribute('y2',a.y+(b.y-a.y)*.16);el.setAttribute('stroke',color);el.setAttribute('stroke-width',mage?'5':'2');el.classList.add('projectile');$('effects').append(el);
  transient(el,[{transform:'translate(0,0)',opacity:1},{transform:`translate(${b.x-a.x}px,${b.y-a.y}px)`,opacity:0}],230,delay);
}
function spellMark(pos,type){
  if(reducedMotion())return;const p=effectPos(pos),svg='http://www.w3.org/2000/svg',g=document.createElementNS(svg,'g');g.setAttribute('transform',`translate(${p.x},${p.y})`);
  const glyphs={mage:['#e4c98f','M0-44 9-10 40 0 9 10 0 44-9 10-40 0-9-10Z'],frost:['#bee9f5','M-42 0H42M0-42V42M-30-30 30 30M-30 30 30-30'],hexer:['#dfb1ed','M0 0Q-55-45-36 12L0 28 36 12Q55-45 0 0Z'],breaker:['#f3c8a1','M0-42 34 0 0 42-34 0ZM-5-27 10-4-8 12 4 31'],rogue:['#c6c6f3','M-33 28 22-33 8 0 33-18-16 38Z'],hunter:['#d6e6f8','M-36 20 36-20M13-22 36-20 27 1']};
  const mark=glyphs[type]||glyphs[({oakmaul:'hunter',duskblade:'rogue',sparkscout:'mage',cinder:'breaker',flarebow:'hunter'})[type]];if(!mark)return;const path=document.createElementNS(svg,'path');path.setAttribute('d',mark[1]);path.setAttribute('stroke',mark[0]);path.setAttribute('stroke-width','3');path.setAttribute('fill',type==='frost'?'none':mark[0]+'33');g.append(path);$('effects').append(g);transient(g,[{opacity:1},{opacity:0}],650);
}
function animateEvents(events){
  const announced=new Set();
  for(const ev of events){const actor=ev.id?$('actors').querySelector(`[data-actor="${ev.id}"]`):null;
    if(ev.type==='volley')projectile(ev.from,ev.to,ev.unitType,ev.delay*1000);
    if(ev.type==='attack'){if(actor&&!reducedMotion()){actor.classList.remove('attacking');void actor.offsetWidth;actor.style.setProperty('--lunge-x',Math.sign(ev.to%6-ev.from%6)*5+'px');actor.style.setProperty('--lunge-y',Math.sign(Math.floor(ev.to/6)-Math.floor(ev.from/6))*3+'px');actor.classList.add('attacking');}if(ev.ranged)projectile(ev.from,ev.to,ev.unitType);audio.play(ev.ranged?'arrow':'hit');}
    if(ev.type==='damage'){if(ev.value)floatText(ev.pos,(ev.critical?'✦ ':'')+'−'+Math.round(ev.value),ev.critical?'critical':'');else if(ev.absorbed)floatText(ev.pos,'⬡ '+Math.round(ev.absorbed),'shield');if(actor){actor.classList.remove('hurt');void actor.offsetWidth;actor.classList.add('hurt');}}
    if(ev.type==='heal'&&ev.value>=5){floatText(ev.pos,'+'+Math.round(ev.value),'heal');if(ev.value>=20)ring(ev.pos,'#b5dfa3',32);}
    if(ev.type==='shield'){floatText(ev.pos,'⬡ +'+ev.value,'shield');ring(ev.pos,'#a7d7e8',45);}
    if(ev.type==='shatter'){floatText(ev.pos,ev.value?'破盾 −'+ev.value:'裂界','critical');projectile(ev.from,ev.pos,'breaker');ring(ev.pos,'#edc297',55);}
    if(ev.type==='push'){ring(ev.from,'#b9debb',30);ring(ev.to,'#b9debb',35);}
    if(ev.type==='blink'){ring(ev.from,'#b5b7e0',30);ring(ev.to,'#b5b7e0',40);}
    if(ev.type==='cast'){
      floatText(ev.pos,ev.name,'cast-label');if(actor){actor.classList.remove('casting');void actor.offsetWidth;actor.classList.add('casting');}
      if(!['healer','oracle','warden','knight','pearl','tideguard','songbird','emberguard'].includes(ev.unitType))ring(['guard','oakmaul'].includes(ev.unitType)?ev.pos:ev.to,ev.unitType==='frost'?'#badfee':'#d2c7ed',ev.unitType==='ancient'?170:55);spellMark(ev.to,ev.unitType);if(ev.unitType==='wavecaller')for(let col=0;col<6;col++)ring(Math.floor(ev.to/6)*6+col,'#9edfe7',30);
      audio.play(['healer','oracle','pearl'].includes(ev.unitType)?'heal':['guard','knight','warden','tideguard','songbird','emberguard'].includes(ev.unitType)?'shield':'magic');addLog(`${E.TYPES[ev.unitType].name} · ${ev.name}`,state.battle.time);
    }
    if(ev.type==='proc'&&!announced.has(ev.id+ev.name)){announced.add(ev.id+ev.name);floatText(ev.pos,ev.name,'proc-label');addLog(ev.name+' · 触发',state.battle.time);}
    if(ev.type==='death')audio.play('death');
    if(ev.type==='overtime'){notify(ev.name);addLog(ev.name,state.battle.time);}
  }
}
function stopClock(){clearInterval(clock);clock=null;}
function startClock(){stopClock();syncVisuals();if(state.phase==='battle'&&!paused)clock=setInterval(battleTick,100/(prefs.speed||1));}
function beginBattle(){
  lastSaveTick=0;
  if(action(E.createBattle(state),'start')){selected=null;inspected=null;activeTab='log';paused=false;logs=[];addLog(`第 ${E.currentNode(state).act+1} 章 · ${E.currentNode(state).name}，战斗开始。`);render();animateEvents(state.battle.events);startClock();}
}
function battleTick(){
  if(paused||state.phase!=='battle')return;
  const result=E.step(state.battle);updateActors();animateEvents(state.battle.events);text('enemy-power',`${E.alive(state.battle,1).length} / ${state.battle.units.filter(u=>u.side===1).length} 存活`);text('formation-power',`${E.alive(state.battle,0).length} / ${state.battle.units.filter(u=>u.side===0).length} 存活`);text('battle-time',`${state.battle.time.toFixed(1)} 秒 · ${state.battle.enrage?'加时：伤害 +60%，治疗减半':'50 秒后进入加时'}`);$('battle-progress-bar').style.width=Math.min(100,state.battle.time/80*100)+'%';
  if(state.battle.tick-lastSaveTick>=10){lastSaveTick=state.battle.tick;save();if(activeTab==='unit')renderInspector();}
  if(result){stopClock();E.settlement(state);save();audio.play(result.won?'victory':'defeat');addLog(result.won?`战斗胜利，获得 ${state.report.income} 金币。`:`战斗失利，远征生命 −${state.report.loss}。`,state.battle.time);renderStatus();renderControls();showReport(state.report,true);}
}
function togglePause(){if(state.phase!=='battle')return;paused=!paused;audio.play('click');if(paused){stopClock();save();}else startClock();syncVisuals();renderControls();}
function pauseForDialog(){if(state.phase==='battle'){paused=true;stopClock();syncVisuals();save();renderControls();}}
function showDialog(kind,html){pauseForDialog();dialogKind=kind;$('modal').dataset.kind=kind;$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();$('modal-content').querySelector('button:not(:disabled)')?.focus({preventScroll:true});}
function closeDialog(){
  if(['result','reward'].includes(state.phase)&&['result','reward'].includes(dialogKind))return;
  const previous=dialogKind;$('modal').close();dialogKind=null;if(previous==='new')showPhase();
}
function heading(title,subtitle='',eyebrow='FIELD NOTES',close=true){return `${close?'<button class="dialog-close" data-close aria-label="关闭窗口">×</button>':''}<div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}`;}
function reportTable(){
  const roster=displayedReport.units.filter(u=>u.side===reportSide).sort((a,b)=>b[reportMetric]-a[reportMetric]),max=Math.max(1,...roster.map(u=>u[reportMetric]));
  return roster.map(u=>`<div class="report-row ${u.side?'enemy':''}">${art(u.type)}<span>${E.TYPES[u.type].name}<small class="gold"> ${'★'.repeat(u.star)}</small>${displayedReport.telemetryVersion===1?`<small class="report-survival">${u.deathAt===null?'存活至结束':u.deathAt.toFixed(1)+'s 阵亡'} · 施法 ${u.casts}</small>`:''}</span><div class="bar"><i style="width:${u[reportMetric]/max*100}%"></i></div><span class="value">${u[reportMetric]}</span></div>`).join('');
}
function reportSummary(){
  const r=displayedReport,info=E.reportInsights(r,reportSide);if(!info)return '<p class="report-note">这份旧战报没有记录阵亡时间与承伤类型；新战斗会显示详细分析。</p>';
  const enemies=r.units.filter(u=>u.side!==reportSide),remaining=enemies.filter(u=>u.alive).length;
  return `<div class="report-facts"><div><small>首位阵亡</small><strong>${info.first?info.first.deathAt.toFixed(1)+'s':'无人阵亡'}</strong><span>${info.first?E.TYPES[info.first.type].name:'全员存活至结束'}</span></div><div><small>守卫平均存活</small><strong>${info.guardTime===null?'未上阵':info.guardTime.toFixed(1)+'s'}</strong><span>存活者按本场时长统计</span></div><div><small>${reportSide?'我方':'敌方'}剩余</small><strong>${remaining} / ${enemies.length}</strong><span>${info.received?`本侧承伤：物理 ${Math.round((info.received-info.magic-info.trueDamage)/info.received*100)}% · 魔法 ${Math.round(info.magic/info.received*100)}% · 真实 ${Math.round(info.trueDamage/info.received*100)}%`:'本侧未损失生命'}</span></div></div>${!reportSide&&info.advice.length?`<details class="report-advice" ${!r.won?'open':''}><summary>下一场可以怎样调整 · ${info.advice.length} 条</summary><div>${info.advice.map(a=>`<article><strong>${a.title}</strong><p>${a.evidence}</p><small>${a.action}</small></article>`).join('')}</div></details>`:''}`;
}
function showReport(report,required=false){
  displayedReport=report;reportMetric='damage';reportSide=0;const detail=report.detail;
  const label=state.life<=0?'查看远征记录 →':report.won&&['elite','boss'].includes(report.kind)&&state.stage!==26?'领取稀有馈赠 →':state.stage===26&&report.won?'完成远征 →':'回到路线地图 →';
  showDialog(required?'result':'report',`<div class="report-scroll">${heading(report.won?(report.casualties?'胜利，也有它的代价。':'稳稳拿下这一战。'):'重整队伍，记住这一战。',`${report.name} · ${report.time.toFixed(1)} 秒${report.draw?' · 战斗超时':''}`,'BATTLE REPORT / '+(report.won?'VICTORY':'DEFEAT'),!required)}<div class="result-heading"><div class="result-emblem">${report.won?'❧':'☾'}</div><div class="result-metric">+${report.income} ◈<small>远征生命 ${report.loss?'−'+report.loss:'未损失'} · 阵亡 ${report.casualties} 名</small></div></div><div class="income-breakdown">${report.won?`<span>基础 <b>+${detail.base}</b></span><span>利息 <b>+${detail.interest}</b></span><span>连胜 <b>+${detail.streak}</b></span><span>节点 <b>+${detail.path}</b></span><span>遗物 <b>+${detail.relic}</b></span>`:`<span>${report.kind==='boss'?'首领战败，远征结束。':report.lifeAfter===0?'远征生命耗尽，本次旅途结束。':`撤退补给 +${report.income} 金币；下一场 2 次免费刷新，当前节点不重试。`}</span>`}</div>${report.loot?`<p class="report-note">✦ 意外收获：${lootDescription(report.loot).name}，已放入行囊。</p>`:report.kind==='battle'&&report.won?'<p class="report-note">本次没有额外掉落。普通战斗胜利有 22% 概率发现装备。</p>':''}<div id="report-summary">${reportSummary()}</div><div class="report-tabs"><button class="active" data-metric="damage">伤害</button><button data-metric="healed">治疗</button><button data-metric="blocked">护盾</button>${report.telemetryVersion===1?'<button data-metric="taken" title="实际生命损失，不含护盾吸收">承伤</button>':''}${report.mechanicsVersion===1?'<button data-metric="procCount" title="装备与遗物触发次数，包括护盾转法力、暴击治疗等">触发</button>':''}<button id="report-side" style="margin-left:auto">我方 ⇄</button></div><div id="report-table">${reportTable()}</div><p class="report-note">所有伙伴战后恢复；星级、装备与阵型保留。远征生命不会自动恢复。</p></div><div class="modal-actions report-actions">${required?`<button class="primary" id="continue-result">${label}</button>`:'<button class="primary" data-close>回到旅途</button>'}</div>`);
}
function showRewards(){
  showDialog('reward',`${heading('冒险者应得的珍藏','这是精英或首领的馈赠。选择一件遗物；有代价的力量也可以放弃。','A RARE DISCOVERY',false)}<div class="choices">${state.rewards.map(key=>{const [kind,id]=key.split(':'),d=lootDescription(key);return `<button class="choice" data-reward="${key}"><span class="choice-tag">${kind==='item'?'伙伴装备':id==='bloodpact'?'力量与代价':'全队遗物'}</span><span class="choice-icon">${d.icon}</span><strong>${d.name}</strong><small>${d.desc}</small></button>`;}).join('')}</div><div class="modal-actions"><button class="quiet" id="skip-reward">不取遗物，继续旅途</button></div><p class="tiny" style="margin-top:14px">永久遗物最多叠加两层，持续到本次远征结束。</p>`);
}
function recordEnd(){
  if(state.recorded)return;const record=E.runRecord(state);if(!record)return;
  if(!records.runs.some(r=>r.id===record.id)){records.best=Math.max(records.best,state.completed.length);if(record.won)records.wins++;records.runs.unshift(record);records.runs=records.runs.slice(0,30);}
  try{localStorage.setItem(RECORDS,JSON.stringify(records));state.recorded=true;save();}catch{notify('记录暂未写入浏览器，请保留此页并稍后重试。',true);}
}
function showRecords(){
  const medals=Object.entries(E.CHALLENGES).filter(([id])=>id!=='none').map(([id,c])=>`<span class="challenge-medal ${records.runs.some(r=>r.won&&r.challenge===id)?'earned':''}">${records.runs.some(r=>r.won&&r.challenge===id)?'✦':'◇'} ${c.name}</span>`).join('');
  showDialog('records',`${heading('森林记得，走过的每一条路','本浏览器最近 30 次完成的远征；历史累计凯旋保留。','EXPEDITION JOURNAL')}<div class="record-overview"><b>凯旋 ${records.wins} 次</b><span>最远 ${records.best} / 27 站</span></div><div class="challenge-medals">${medals}</div><p class="tiny muted">勋章按保留记录展示。旧版本只有累计次数，没有可还原的阵容。</p><div class="record-list">${records.runs.map((r,i)=>`<details class="run-record"><summary><b>${r.won?'✦ 凯旋':'☽ 远征结束'}</b><span>${E.DIFFICULTIES[r.difficulty].name} · ${E.CHALLENGES[r.challenge].name}</span><small>${r.completed}/27 站 · ${new Date(r.endedAt).toLocaleDateString('zh-CN')}</small></summary><p class="tiny">${E.ORIGINS[r.origin].name} · 种子 ${r.seed} · 剩余生命 ${r.life} · 收入 ${r.totalGold} 金币</p><div class="record-roster">${r.roster.map(u=>`<div>${art(u.type)}<b>${E.TYPES[u.type].name}</b><small>${'★'.repeat(u.star)} · 第 ${Math.floor(u.pos/6)-2} 排 ${u.pos%6+1} 列</small><small>${u.item?E.ITEMS[u.item].name:'无装备'}</small></div>`).join('')}</div><p class="tiny">遗物：${r.relics.map(id=>E.RELICS[id].name).join('、')||'无'}</p><div class="record-route">${r.route.map((h,i)=>`<span title="第 ${i+1} 站 · ${E.NODES[h.kind].name}${h.won===null?'':h.won?' · 胜利':' · 战败'}" class="${h.won===false?'route-loss':''}">${E.NODES[h.kind].icon}${h.won===false?'×':''}</span>`).join('')}</div><button class="secondary" data-record-replay="${i}">用相同配置再出发 →</button></details>`).join('')||'<div class="empty-record">旅途尚未落笔。完成一轮远征后，阵容、路线与收获会留在这里。</div>'}</div><div class="modal-actions"><button class="primary" data-close>回到旅途</button></div>`);
}
function showEnd(){
  recordEnd();const won=state.phase==='won';showDialog('end',`<div class="final-hero"><span>${won?'❖':'☽'}</span></div>${heading(won?'古树苏醒，森林记得你。':'长夜之后，仍有新的黎明。',won?'你与伙伴穿过三章、二十七站旅途，守住了最后的黎明。':'这次旅途暂时结束。带上经验，下一次走得更远。',won?'EXPEDITION COMPLETE':'UNTIL THE NEXT DAWN',false)}<div class="end-score"><div><small>完成节点</small><strong>${state.completed.length} / 27</strong></div><div><small>剩余生命</small><strong>${state.life}</strong></div><div><small>收集遗物</small><strong>${state.relics.length}</strong></div><div><small>总获金币</small><strong>${state.totalGold}</strong></div></div><div class="end-roster">${E.deployed(state).map(u=>`<div>${art(u.type)}<small>${'★'.repeat(u.star)}</small></div>`).join('')}</div><p class="tiny center">${E.DIFFICULTIES[state.difficulty].name}难度 · ${E.ORIGINS[state.origin].name} · 累计凯旋 ${records.wins} 次</p><div class="modal-actions"><button class="quiet" data-close>回望棋盘</button><button class="secondary" id="open-records">远征记录</button><button class="primary" id="new-from-end">开启新的远征 →</button></div>`);
}
function showPhase(){if(state.phase==='result')showReport(state.report,true);else if(state.phase==='reward')showRewards();else if(['won','lost'].includes(state.phase))showEnd();}
function showNewRun(config=null){
  newOrigin=config?.origin||state.origin;newDifficulty=config?.difficulty||state.difficulty;newChallenge=config?.challenge||state.challenge||'none';
  showDialog('new',`${heading('每一段传奇，都有新的起点。','选择同行的伙伴与旅途难度。','A NEW EXPEDITION')}<div class="choices origin-choices">${Object.entries(E.ORIGINS).map(([id,o])=>`<button class="choice ${id===newOrigin?'selected':''}" data-origin="${id}"><div class="origin-art">${o.types.map(art).join('')}</div><strong>${o.icon} ${o.name}</strong><small>${o.desc}<br>初始金币 ${o.gold} · 橡木圆盾 ×1</small></button>`).join('')}</div><div class="difficulty-options">${Object.entries(E.DIFFICULTIES).map(([id,d])=>`<button class="difficulty-option ${id===newDifficulty?'selected':''}" data-difficulty="${id}"><strong>${d.name}</strong><small>${d.desc}</small></button>`).join('')}</div><label class="challenge-field" for="run-challenge">特殊挑战<select id="run-challenge">${Object.entries(E.CHALLENGES).map(([id,c])=>`<option value="${id}" ${id===newChallenge?'selected':''}>${c.name}</option>`).join('')}</select><small id="challenge-description">${E.CHALLENGES[newChallenge].desc}</small></label><div class="seed-field"><label for="run-seed">地图种子 <small>留空随机生成</small></label><div><input id="run-seed" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="1 — 4294967295" aria-describedby="seed-help" value="${config?.seed??''}"><button class="secondary" id="current-seed">沿用当前种子</button></div><p id="seed-help">相同种子、开局与难度可复现起点；不同招募、路线与布阵会改变后续结果。</p></div><p class="new-run-note">${config?'配置已填入，当前远征还未改变。':''}${config?.rules&&config.rules!==E.RULESET?'该记录来自旧规则版本，重玩会按当前规则生成。':''}确认出发后才替换当前进度，累计凯旋记录会保留。</p><div class="modal-actions"><button class="quiet" data-close>继续当前旅途</button><button class="primary" id="confirm-new">准备好，出发 →</button></div>`);
}
function newGame(){
  const parsed=E.parseSeed($('run-seed').value);if(parsed.error){notify(parsed.error,true);$('run-seed').focus();return;}
  stopClock();state=E.newRun({...(parsed.seed!==null?{seed:parsed.seed}:{}),origin:newOrigin,difficulty:newDifficulty,challenge:newChallenge});selected=null;inspected=null;mapSelected=null;paused=false;logs=[];lastSaveTick=0;activeTab='scout';$('modal').close();dialogKind=null;$('effects').innerHTML='';$('floaters').innerHTML='';save();render();audio.play('start');notify('新的远征开始，森林在等你。');
}
function showShare(){
  const url=location.origin+location.pathname+'?'+E.runQuery(state);
  showDialog('share',`${heading('把这条路，交给下一位旅人','分享种子、开局与难度，让朋友从同一个起点出发。','SAME SEED, YOUR OWN JOURNEY')}<div class="share-config"><strong>种子 ${state.seed}</strong><span>${E.ORIGINS[state.origin].name} · ${E.DIFFICULTIES[state.difficulty].name} · ${E.CHALLENGES[state.challenge||'none'].name}</span></div><label class="share-label" for="share-url">远征链接</label><input class="share-url" id="share-url" readonly value="${escapeHTML(url)}"><p class="report-note">链接只包含开局配置，不包含你的存档。对方确认出发后才替换已有远征。${state.ruleset===E.RULESET?'相同规则版本内，相同选择可以复现同一旅途。':'当前是旧版远征；重玩会按新版规则生成，敌群与事件可能不同。'}</p><div class="modal-actions"><button class="secondary" id="replay-current">重玩这一种子</button><button class="primary" id="copy-share">复制链接</button></div>`);
}
async function copyShare(){
  try{await navigator.clipboard.writeText($('share-url').value);notify('远征链接已复制。');}
  catch{$('share-url').focus();$('share-url').select();notify('链接已选中，可手动复制。');}
}
function openSharedRun(){
  const config=E.parseRunLink(location.search);if(!config)return;
  if(config.error)notify(config.error,true);else showNewRun(config);
  const url=new URL(location.href);for(const key of ['seed','origin','difficulty','challenge','rules'])url.searchParams.delete(key);history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function showSettings(){showDialog('settings',`${heading('让旅途，合你的心意。','','SOUND & COMFORT')}<label class="settings-row"><span>音效<small>招募、攻击、技能与胜利提示</small></span><input id="pref-enabled" type="checkbox" ${prefs.enabled?'checked':''}></label><label class="settings-row"><span>林间轻音乐<small>原创合成旋律 · 默认为关闭</small></span><input id="pref-music" type="checkbox" ${prefs.music?'checked':''}></label><label class="settings-row"><span>音量 <b id="volume-value">${Math.round(prefs.volume*100)}%</b><small>音效与音乐的总音量</small></span><input id="pref-volume" type="range" min="0" max="100" value="${Math.round(prefs.volume*100)}" aria-label="总音量"></label><label class="settings-row"><span>减少动态效果<small>关闭飘字、光效与移动动画</small></span><input id="pref-reduced" type="checkbox" ${prefs.reduced?'checked':''}></label><div class="modal-actions"><button class="secondary" id="preview-sound">♫ 试听音效</button><button class="primary" data-close>回到旅途</button></div><p class="tiny" style="margin-top:14px">切换到其他页面时，战斗和声音会自动暂停。</p>`);}
function showGuide(){showDialog('guide',`${heading('给初次远征的你','布阵没有倒计时，慢慢想，选出自己的答案。','THE TRAVELER’S FIELD GUIDE')}<div class="guide-grid"><div class="guide-step"><h3>01 · 组建队伍</h3><p>酒馆招募到备战席，点击伙伴再点我方下方三排上阵，也可拖动。点击其他场上伙伴可交换。整队会自动挑选并排好伙伴。</p></div><div class="guide-step"><h3>02 · 升星与羁绊</h3><p>3 个同种、同星伙伴自动合成，最高 3 星。22 位伙伴、5 个阵营与5类职业。阵营 2 / 3 种触发，职业 2 种触发；每个阵营至少4位可选。溪羽琴师兼属林地 / 潮汐，星火斥候兼属星辉 / 余烬，可连接不同阵容。同一种棋子重复上阵不重复计算羁绊。不同阵营与职业可以同时生效。</p></div><div class="guide-step"><h3>03 · 经济取舍</h3><p>每场战斗 1 次免费刷新，战败后下场 2 次；事件与营地不重置。酒馆成长位优先补齐已有一星对子。胜利按结算前金币每 10 枚给 1 利息，最多 2；三连胜起额外 1 金币。商人出售装备和遗物，预留金币才有选择。</p></div><div class="guide-step"><h3>04 · 观察敌人</h3><p>守卫嘲讽并抵挡伤害，刺客先潜伏 1.5 秒再切入后排，落地后有 1 秒不可选中的影幕保护（仍受范围伤害），法师擅长范围伤害。棋子的站位影响承伤、寻路与技能覆盖。战力是参考，阵型和克制仍然重要。</p></div><div class="guide-step"><h3>05 · 技能与装备</h3><p>法力达到 100 自动施法。物理伤害受护甲减免；魔法仅计 45% 护甲；真实伤害无视护甲。装备每人一件，可免费卸下与交换，出售或合成不丢装备。</p></div><div class="guide-step"><h3>06 · 走自己的路</h3><p>三章共 27 个节点，从相连的地图节点选择路线。普通战斗给金币，22% 掉装备；精英与章节首领胜利选择遗物。营地可恢复 26 远征生命或精制装备。伙伴战后恢复，但胜利阵亡每人损失 2 远征生命，最多 8；普通战败扣更多生命后继续前进，首领战败远征结束。</p></div></div><p class="tiny">空格：开始 / 暂停 · R：刷新酒馆 · M：音效 · Esc：取消选中或关闭普通窗口。存档仅保存在当前浏览器，战斗中退出也可继续。</p><div class="modal-actions"><button class="secondary" id="all-codex">伙伴图鉴</button><button class="secondary" id="guide-builds">构筑手记</button><button class="primary" data-close>心中有数，出发 →</button></div>`);}
function showCodex(type=null,enemies=false){
  const full=!type&&!enemies;const types=type?[type]:enemies?[...new Set(E.enemyRoster(state).map(u=>u.type))]:Object.keys(E.TYPES).filter(t=>E.TYPES[t].cost&&(codexFaction==='all'||E.hasFaction(t,codexFaction))&&(codexRole==='all'||E.TYPES[t].role===codexRole));
  showDialog('codex',`${heading(enemies?'前方的对手':'森林伙伴图鉴','了解技能，再选择适合你的伙伴。','COMPANIONS & ABILITIES')}${full?`<div class="codex-filters"><label>阵营<select id="codex-faction"><option value="all">所有阵营</option>${Object.entries(E.FACTIONS).map(([id,f])=>`<option value="${id}" ${codexFaction===id?'selected':''}>${f.name}</option>`).join('')}</select></label><label>职业<select id="codex-role"><option value="all">所有职业</option>${Object.entries(E.ROLES).map(([id,r])=>`<option value="${id}" ${codexRole===id?'selected':''}>${r}</option>`).join('')}</select></label><small>显示 ${types.length} / 22 位</small></div><p class="tiny muted">阵营加成与职业羁绊可以交叉搭配；双阵营伙伴会同时计入两边。每个角色仍只有一个主动技能。</p>`:''}<div class="codex-grid" ${types.length===1?'style="grid-template-columns:1fr"':''}>${types.map(id=>{const d=E.TYPES[id];return `<article class="codex-card">${art(id)}<h3>${d.name}</h3><small>${factionName(id)} · ${E.ROLES[d.role]} · ${d.cost?'◈ '+d.cost:'首领'}</small><p>♥ ${d.hp} · ⚔ ${d.atk} · 护甲 ${d.armor}<br>攻击间隔 ${d.interval}s · 射程 ${d.range}</p><small>✧ ${d.skill}</small><p>${d.desc}</p></article>`;}).join('')||'<p class="tiny">这个组合目前没有伙伴。换一个阵营或职业试试。</p>'}</div><div class="modal-actions"><button class="primary" data-close>回到旅途</button></div>`);
}
function showTrait(id){
  const f=E.FACTIONS[id],r=E.ROLE_TRAITS[id],roster=E.deployed(state),types=Object.keys(E.TYPES).filter(t=>E.TYPES[t].cost>0&&(f?E.hasFaction(t,id):E.TYPES[t].role===id));
  showDialog('trait',`${heading((f?.icon||r.icon)+' '+(f?.name||r.name),'只计算上阵的不同种类伙伴；重复棋子不会重复增加羁绊层数。','SYNERGY NOTES')}<div class="skill-box">${f?f.desc.map((d,i)=>`<p><b>${i+2} 种伙伴：</b>${d}</p>`).join(''):`<p>${r.desc}</p>`}</div><div class="codex-grid">${types.map(t=>`<article class="codex-card">${art(t)}<h3>${E.TYPES[t].name}</h3><small>${factionName(t)} · ${E.ROLES[E.TYPES[t].role]}</small><small>${roster.some(u=>u.type===t)?'✓ 已上阵':'尚未上阵'}</small><button class="quiet" data-codex="${t}">查看技能 ↗</button></article>`).join('')}</div><div class="modal-actions"><button class="primary" data-close>继续布阵</button></div>`);
}
function equipmentDelta(u,item){
  const roster=u.pos===null?[...E.deployed(state),u]:E.deployed(state),before=E.stats(u,roster,state.relics),after=E.stats({...u,item},roster,state.relics);
  const fields=[['maxHp','生命',0],['atk','攻击',0],['armor','护甲',1],['interval','攻击间隔',2],['power','技能强度','%'],['mana','初始法力',0],['healing','治疗效果','%'],['leech','吸血','%'],['moveInterval','移动间隔',2],['crit','暴击率','%'],['critPower','暴击倍率','%'],['castMana','施法回蓝',1],['emergencyShield','木心护盾','%']];
  return fields.filter(([key])=>Math.abs(before[key]-after[key])>.0001).map(([key,name,precision])=>{const fmt=v=>precision==='%'?Math.round(v*100)+'%':Number(v.toFixed(precision))+(key.endsWith('nterval')?'s':'');const improved=key.endsWith('nterval')?after[key]<before[key]:after[key]>before[key];return `<span class="${improved?'gain':'loss'}">${name} ${fmt(before[key])} → ${fmt(after[key])}</span>`;}).join('')||'<span>当前属性不变</span>';
}
function showEquipment(){
  const u=state.units.find(u=>u.id===inspected);if(!u||!E.canManage(state))return;selected=u.id;
  showDialog('equipment',`${heading('为'+E.TYPES[u.type].name+'准备行装','按当前羁绊与遗物比较更换前后属性。每人一件，原装备返回行囊。','EQUIPMENT')}<div class="current-equipment"><strong>当前 · ${u.item?E.ITEMS[u.item].name:'未装备'}</strong><p>${u.item?E.ITEMS[u.item].desc:'下方显示更换后的属性，点击即可穿戴。'}</p></div><div class="choices equipment-choices">${state.bag.map((id,i)=>`<button class="choice" data-equip="${i}"><span class="choice-icon">${E.ITEMS[id].icon}</span><strong>${E.ITEMS[id].name}</strong><small>${E.ITEMS[id].desc}</small><div class="equipment-deltas">${equipmentDelta(u,id)}</div></button>`).join('')}</div>${!state.bag.length?'<p class="report-note">行囊暂时没有备用装备。普通战斗偶尔掉落装备，商人与事件也能获得装备。</p>':''}<div class="modal-actions">${u.item?'<button class="secondary" id="unequip">卸下当前装备</button>':''}<button class="primary" data-close>继续布阵</button></div>`);
}
function showBuilds(){
  const builds=E.buildAdvice(state);
  showDialog('builds',`${heading('把行囊，变成一种打法','按当前上阵伙伴与穿戴装备判断搭配条件。满足条件后，仍需在战斗中触发。','BUILD YOUR JOURNEY')}<div class="build-grid">${builds.map(b=>`<article class="build-card ${b.active?'active':''}"><span class="choice-tag">${b.active?'搭配条件齐备':b.owned?'已持有核心遗物':'可探索方向'}</span><h3>${E.RELICS[b.relic].icon} ${b.name}</h3><p>${b.desc}</p><ul><li class="${b.owned?'ready':''}">${b.owned?'✓':'○'} ${E.RELICS[b.relic].name}</li><li class="${b.ready?'ready':''}">${b.ready?'✓':'○'} ${b.source}</li></ul><small>${E.RELICS[b.relic].desc}。${b.tip}</small></article>`).join('')}</div><details class="gear-catalog"><summary>装备一览 · 每人一件，可在营地精制</summary><div class="build-grid">${E.BASIC_ITEMS.map(id=>`<article class="build-card"><h3>${E.ITEMS[id].icon} ${E.ITEMS[id].name}</h3><p>${E.ITEMS[id].desc}</p></article>`).join('')}</div></details><div class="modal-actions"><button class="primary" data-close>继续搭配</button></div>`);
}
function showRelic(id){const r=E.RELICS[id];showDialog('relic',`${heading(r.icon+' '+r.name,r.desc,'RELIC OF THE JOURNEY')}<p class="report-note">当前持有 ${E.count(state.relics,id)} 层 · 整队生效，持续本次远征。</p><div class="modal-actions"><button class="primary" data-close>收好行囊</button></div>`);}
function syncPreferences(){audio.configure(prefs);document.body.classList.toggle('reduce-motion',prefs.reduced);syncVisuals();savePrefs();renderControls();}
// One delegated click handler keeps generated controls keyboard- and pointer-accessible.
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  audio.unlock();const d=button.dataset;
  if(button.hasAttribute('data-close')){closeDialog();return;}
  if(d.buy!==undefined){action(E.buy(state,Number(d.buy)),'buy');return;}
  if(d.cell!==undefined){moveTo(Number(d.cell));return;}
  if(d.actor){selectActor(d.actor);return;}
  if(d.bench!==undefined){if(d.bench)selectActor(d.bench);else moveTo(null);return;}
  if(d.equip!==undefined){const id=selected||(activeTab==='unit'?inspected:null);if(!id||!state.units.some(u=>u.id===id)){notify('先在棋盘或备战席选择一位伙伴，再点击装备。');return;}if(action(E.equip(state,id,Number(d.equip)),'equip','装备已穿戴，原装备会回到行囊。')){selected=id;inspected=id;if(dialogKind==='equipment'){$('modal').close();dialogKind=null;}render();setTab('unit');}return;}
  if(d.rangeMode){rangeMode=d.rangeMode;renderInspector();renderSelection();return;}
  if(d.tab){setTab(d.tab);audio.play('click');return;}
  if(d.inspect){selected=null;inspected=d.inspect;setTab('unit');updateActors();renderSelection();return;}
  if(d.codex){showCodex(d.codex);return;}
  if(d.trait){showTrait(d.trait);return;}
  if(d.relic){showRelic(d.relic);return;}
  if(d.reward){if(action(E.takeReward(state,d.reward),'reward')){$('modal').close();dialogKind=null;mapSelected=null;render();showPhase();}return;}
  if(d.mapNode){mapSelected=d.mapNode;if(dialogKind==='map')showMap(mapAct);else{renderScouting();renderTravel();renderControls();}audio.play('click');return;}
  if(d.mapAct!==undefined){showMap(Number(d.mapAct));return;}
  if(d.camp){action(E.camp(state,d.camp),'reward');return;}
  if(d.forge){if(action(E.camp(state,'forge',d.forge),'equip')){$('modal').close();dialogKind=null;}return;}
  if(d.merchant!==undefined){action(E.merchantBuy(state,d.merchant),'buy','商品已收入行囊。');return;}
  if(d.eventChoice){action(E.takeEvent(state,d.eventChoice),'reward');return;}
  if(d.treasure){action(E.treasure(state,d.treasure),'reward');return;}
  if(d.recordReplay!==undefined){const r=records.runs[Number(d.recordReplay)];if(r)showNewRun(r);return;}
  if(d.origin){newOrigin=d.origin;document.querySelectorAll('[data-origin]').forEach(b=>b.classList.toggle('selected',b.dataset.origin===newOrigin));audio.play('click');return;}
  if(d.difficulty){newDifficulty=d.difficulty;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===newDifficulty));audio.play('click');return;}
  if(d.metric){reportMetric=d.metric;document.querySelectorAll('[data-metric]').forEach(b=>b.classList.toggle('active',b.dataset.metric===reportMetric));$('report-table').innerHTML=reportTable();return;}
  switch(button.id){
    case 'status-toggle':document.querySelector('.expedition').classList.toggle('status-open');renderStatus();break;
    case 'fight':primaryAction();break;
    case 'open-map':case 'open-map-large':showMap();break;
    case 'confirm-map-node':enterSelectedNode();break;
    case 'camp-forge':showForge();break;
    case 'skip-reward':if(action(E.skipReward(state),'move')){$('modal').close();dialogKind=null;mapSelected=null;render();showPhase();}break;
    case 'pause':togglePause();break;
    case 'speed':prefs.speed=(prefs.speed||1)%3+1;audio.play('click');renderControls();startClock();break;
    case 'auto':action(E.autoDeploy(state),'move','已按前排承伤、后排输出安排队伍。');break;
    case 'refresh':action(E.refresh(state),'click');break;
    case 'lock':if(E.canManage(state)){state.locked=!state.locked;action({},'click',state.locked?'下场战斗将保留这批酒馆伙伴。':'已解除酒馆锁定。');}break;
    case 'expand':action(E.expand(state),'buy','人口已扩充，可以再上阵一位伙伴。');break;
    case 'restart':case 'new-from-end':showNewRun();break;
    case 'current-seed':$('run-seed').value=state.seed;break;
    case 'share-run':showShare();break;
    case 'copy-share':copyShare();break;
    case 'replay-current':showNewRun(E.runConfig(state));break;
    case 'confirm-new':newGame();break;
    case 'open-records':showRecords();break;
    case 'help':showGuide();break;
    case 'all-codex':codexFaction='all';codexRole='all';showCodex();break;
    case 'build-guide':case 'guide-builds':showBuilds();break;
    case 'inspect-enemy':showCodex(null,true);break;
    case 'settings':showSettings();break;
    case 'sound':prefs.enabled=!prefs.enabled;syncPreferences();if(prefs.enabled)audio.play('click');notify(prefs.enabled?'音效已开启':'音效已关闭');break;
    case 'preview-sound':if(prefs.enabled)audio.play('victory');else notify('先开启音效，再试听。');break;
    case 'dismiss-tip':prefs.tip=false;savePrefs();$('onboarding').hidden=true;break;
    case 'clear-selection':selected=null;inspected=null;render();break;
    case 'manage-equipment':showEquipment();break;
    case 'unequip':if(action(E.equip(state,inspected,-1),'equip')){$('modal').close();dialogKind=null;}break;
    case 'bench-unit':action(E.move(state,inspected,null),'move');break;
    case 'sell-unit':{const u=state.units.find(u=>u.id===inspected);if(!u)break;if(action(E.sell(state,u.id),'buy',`${E.TYPES[u.type].name} 已离队，装备返回行囊。`)){inspected=null;renderInspector();}break;}
    case 'continue-result':if(action(E.continueResult(state),null)){$('modal').close();dialogKind=null;mapSelected=null;render();showPhase();}break;
    case 'last-report':if(state.report)showReport(state.report);break;
    case 'report-side':reportSide=1-reportSide;text('report-side',reportSide?'敌方 ⇄':'我方 ⇄');$('report-table').innerHTML=reportTable();$('report-summary').innerHTML=reportSummary();break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='codex-faction'){codexFaction=el.value;showCodex();$('codex-faction').focus({preventScroll:true});}
  if(el.id==='codex-role'){codexRole=el.value;showCodex();$('codex-role').focus({preventScroll:true});}
  if(el.id==='run-challenge'&&Object.hasOwn(E.CHALLENGES,el.value)){newChallenge=el.value;text('challenge-description',E.CHALLENGES[newChallenge].desc);}
  if(el.id==='pref-volume'){prefs.volume=Number(el.value)/100;text('volume-value',el.value+'%');syncPreferences();}
  if(el.id==='pref-enabled'){prefs.enabled=el.checked;syncPreferences();if(prefs.enabled)audio.unlock().then(()=>audio.play('click'));}
  if(el.id==='pref-music'){prefs.music=el.checked;syncPreferences();audio.unlock();}
  if(el.id==='pref-reduced'){prefs.reduced=el.checked;syncPreferences();}
});
document.addEventListener('dragstart',event=>{
  const el=event.target.closest('[data-actor],[data-bench]');if(!el||!E.canManage(state))return;const id=el.dataset.actor||el.dataset.bench;if(!state.units.some(u=>u.id===id)){event.preventDefault();return;}selected=id;inspected=id;event.dataTransfer.setData('text/plain',id);event.dataTransfer.effectAllowed='move';renderSelection();
});
document.addEventListener('dragover',event=>{const el=event.target.closest('[data-cell],[data-actor],#bench');if(el&&E.canManage(state)){event.preventDefault();event.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',event=>{
  const el=event.target.closest('[data-cell],[data-actor],#bench');if(!el||!E.canManage(state))return;event.preventDefault();const id=event.dataTransfer.getData('text/plain');if(!state.units.some(u=>u.id===id))return;selected=id;
  if(el.id==='bench')moveTo(null);else if(el.dataset.cell!==undefined)moveTo(Number(el.dataset.cell));else {const u=state.units.find(u=>u.id===el.dataset.actor);if(u)moveTo(u.pos);else notify('只能布置在我方阵地。',true);}
});
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.key==='Escape'&&!$('modal').open){selected=null;inspected=null;render();return;}
  if($('modal').open)return;
  if(event.code==='Space'&&event.target.tagName!=='BUTTON'){event.preventDefault();audio.unlock();if(state.phase==='battle')togglePause();else primaryAction();}
  if(event.key.toLowerCase()==='r'&&E.canManage(state)){event.preventDefault();audio.unlock();action(E.refresh(state),'click');}
  if(event.key.toLowerCase()==='m'){prefs.enabled=!prefs.enabled;audio.unlock();syncPreferences();}
});
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.phase==='battle'){paused=true;stopClock();syncVisuals();save();renderControls();}audio.setActive(false);}else audio.setActive(true);});
window.addEventListener('pagehide',()=>{save();audio.stopMusic();});
load();addLog(state.phase==='battle'?'战斗已恢复，点击 ▶ 继续。':`第 ${E.currentNode(state).act+1} 章 · ${E.currentNode(state).name}。`);render();showPhase();openSharedRun();
