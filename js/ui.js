'use strict';
/* Heliotown – Benutzeroberfläche, Eingabe, Dialoge, Spielschleife */
(function (SC) {
  let R = SC.Render;
  const Sim = SC.Sim, Act = SC.Act, K = SC.KIND, T = SC.TER;
  const $ = id => document.getElementById(id);
  const esc = SC.esc;

  const G = SC.Game = {
    s: null, tool: SC.TOOL.query, speed: 1, overlay: null, hover: null, preview: null,
    drag: null, pan: null, dialogOpen: false, infoTile: null, mouse: { x: 0, y: 0 }
  };

  const OVERLAYS = [
    [null, '🗺️ Normal'], ['power', '⚡ Strom'], ['roads', '🛣️ Anbindung'], ['pollution', '🏭 Verschmutzung'],
    ['crime', '🚨 Kriminalität'], ['landValue', '💎 Bodenwert'], ['traffic', '🚗 Verkehr'], ['police', '🚓 Polizei'],
    ['fire', '🚒 Feuerwehr'], ['school', '🏫 Bildung'], ['hospital', '🏥 Gesundheit']
  ];
  const LEGENDS = {
    power: '<span style="color:#3ce664">■</span> versorgt &nbsp; <span style="color:#f02828">■</span> ohne Strom',
    roads: '<span style="color:#3ce664">■</span> erschlossen &nbsp; <span style="color:#f02828">■</span> keine Straße in 3 Feldern',
    pollution: 'niedrig <div class="grad" style="background:linear-gradient(90deg,#28dc28,#ffdc28,#ff2828)"></div> hoch',
    crime: 'niedrig <div class="grad" style="background:linear-gradient(90deg,#28dc28,#ffdc28,#ff2828)"></div> hoch',
    traffic: 'wenig <div class="grad" style="background:linear-gradient(90deg,#28dc28,#ffdc28,#ff2828)"></div> Stau',
    landValue: 'niedrig <div class="grad" style="background:linear-gradient(90deg,#dc50c8,#78a0a0,#14e650)"></div> hoch',
    police: 'Abdeckung durch Polizeiwachen', fire: 'Abdeckung durch Feuerwachen',
    school: 'Einzugsgebiet von Schulen', hospital: 'Einzugsgebiet von Krankenhäusern'
  };

  // ======================= Initialisierung =======================
  G.init = function () {
    SC.Render.init($('view'));
    SC.RenderIso.init($('view'));
    R = SC.Storage.getPref('view', '3d') === '2d' ? SC.Render : SC.RenderIso;
    SC.RenderIso.rot = SC.Storage.getPref('rot', 0) | 0;
    buildToolbar();
    buildOverlays();
    bindTopbar();
    bindCanvas();
    bindKeys();
    SC.on('notify', onNotify);
    SC.on('newYear', () => autosave(true));
    SC.on('milestone', n => floatBanner('🎉 ' + n + '!'));
    window.addEventListener('beforeunload', () => autosave(true));
    setInterval(() => autosave(true), 120000);
    $('fileInput').addEventListener('change', onImportFile);
    if (!SC.Storage.available())
      setTimeout(() => toast('Lokaler Speicher ist in diesem Browser nicht verfügbar – Spielstände bitte als Datei exportieren.', 'warn', 8000), 500);
    showMainMenu();
    requestAnimationFrame(frame);
  };

  // ======================= Spielschleife =======================
  let last = 0, acc = 0, uiTimer = 0, mmTimer = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(250, last ? t - last : 16);
    last = t;
    const s = G.s;
    if (!s) return;
    if (G.speed > 0 && !G.dialogOpen) {
      acc += dt;
      const per = SC.SPEEDS[G.speed];
      let n = 0;
      while (acc >= per && n < 12) { Sim.tick(s); acc -= per; n++; }
      if (n >= 12) acc = 0;
      if (n > 0 && G.drag) updatePreview();
    }
    if (s.changed) Sim.afterEdit(s);
    R.clampView(s);
    R.draw(s, t, G);
    uiTimer += dt;
    if (uiTimer > 200) { uiTimer = 0; updateTopbar(); if (G.infoTile) renderInfo(); }
    mmTimer += dt;
    if (mmTimer > 600) { mmTimer = 0; SC.Render.drawMinimap(s, $('minimap'), G.overlay, R.viewportCorners(s)); }
  }

  G.startGame = function (s) {
    G.s = s;
    Sim.recomputeAll(s);
    R.setState(s);
    R.view.ts = R.DEFAULT_TS;
    // Kamera auf bebautes Gebiet oder Kartenmitte
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < s.N; i++) if (s.kind[i] !== K.EMPTY) { sx += i % s.W; sy += (i / s.W) | 0; n++; }
    if (n) R.centerOn(sx / n, sy / n); else R.centerOn(s.W / 2, s.H / 2);
    ['topbar', 'toolbar', 'side', 'ticker'].forEach(id => $(id).classList.remove('hidden'));
    closeDialog();
    G.setTool('query');
    G.setOverlay(null);
    G.setSpeed(1);
    G.infoTile = null; $('infoPanel').classList.add('hidden');
    const lastMsg = s.log[s.log.length - 1];
    if (lastMsg) setTicker(lastMsg); else $('ticker').textContent = '';
    updateTopbar();
    updateViewButtons();
    mmTimer = 1000;
  };

  // ======================= Ansicht 2D / 3D =======================
  G.setViewMode = function (mode) {
    const next = mode === '2d' ? SC.Render : SC.RenderIso;
    if (next === R) return;
    const c = G.s ? R.getCenter() : null;
    const zoomRel = R.view.ts / R.DEFAULT_TS;
    R = next;
    SC.Storage.setPref('view', mode);
    if (G.s) {
      R.setState(G.s);
      R.view.ts = SC.clamp(R.DEFAULT_TS * zoomRel, R.MIN_TS, R.MAX_TS);
      R.centerOn(c[0], c[1]);
    }
    updateViewButtons();
    updatePreview();
    mmTimer = 1000;
  };
  G.rotateView = function (dir) {
    if (!R.is3D) return;
    R.rotate(dir);
    SC.Storage.setPref('rot', R.rot);
    updatePreview();
    mmTimer = 1000;
  };
  function updateViewButtons() {
    $('btnView').innerHTML = R.is3D ? '🗺️ <span class="t">2D-Ansicht</span>' : '🧊 <span class="t">3D-Ansicht</span>';
    $('btnView').title = R.is3D ? 'Zur Draufsicht wechseln [V]' : 'Zur 3D-Ansicht wechseln [V]';
    $('btnRotL').classList.toggle('hidden', !R.is3D);
    $('btnRotR').classList.toggle('hidden', !R.is3D);
  }

  // ======================= Werkzeuge =======================
  function buildToolbar() {
    const tb = $('toolbar');
    let group = null;
    for (const tool of SC.TOOLS) {
      if (tool.group !== group) {
        group = tool.group;
        const h = document.createElement('div');
        h.className = 'tgroup'; h.textContent = group;
        tb.appendChild(h);
      }
      const b = document.createElement('button');
      b.className = 'tool'; b.dataset.tool = tool.id;
      b.innerHTML = '<span class="ico">' + tool.icon + '</span><span class="lbl">' + esc(tool.name) + '</span>' +
        '<span class="cost">' + (tool.cost ? SC.fmtMoney(tool.cost) : '&nbsp;') + '</span>';
      b.title = tool.name + (tool.key ? ' [' + tool.key.toUpperCase() + ']' : '') + '\n' + (tool.desc || '');
      b.addEventListener('click', () => G.setTool(tool.id));
      tb.appendChild(b);
    }
  }
  G.setTool = function (id) {
    G.tool = SC.TOOL[id];
    G.drag = null;
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === id));
    $('view').style.cursor = id === 'query' ? 'grab' : 'crosshair';
    updatePreview();
    $('cursorTip').classList.add('hidden');
  };

  function buildOverlays() {
    const box = $('overlays');
    for (const [key, name] of OVERLAYS) {
      const b = document.createElement('button');
      b.dataset.ov = key || '';
      b.textContent = name; b.title = name;
      b.addEventListener('click', () => G.setOverlay(key === G.overlay ? null : key));
      box.appendChild(b);
    }
    $('minimap').addEventListener('pointerdown', minimapJump);
    $('minimap').addEventListener('pointermove', e => { if (e.buttons & 1) minimapJump(e); });
  }
  G.setOverlay = function (key) {
    G.overlay = key;
    document.querySelectorAll('#overlays button').forEach(b => b.classList.toggle('on', (b.dataset.ov || null) === key));
    $('legend').innerHTML = key ? LEGENDS[key] || '' : '';
    mmTimer = 1000;
  };
  function minimapJump(e) {
    if (!G.s) return;
    const r = e.currentTarget.getBoundingClientRect();
    R.centerOn((e.clientX - r.left) / r.width * G.s.W, (e.clientY - r.top) / r.height * G.s.H);
    mmTimer = 1000;
  }

  // ======================= Kopfleiste =======================
  function bindTopbar() {
    $('btnMenu').addEventListener('click', showMainMenu);
    $('btnBudget').addEventListener('click', showBudget);
    $('btnStats').addEventListener('click', showStats);
    $('btnSave').addEventListener('click', () => showSaveLoad('save'));
    $('btnHelp').addEventListener('click', showHelp);
    $('btnView').addEventListener('click', () => G.setViewMode(R.is3D ? '2d' : '3d'));
    $('btnRotL').addEventListener('click', () => G.rotateView(-1));
    $('btnRotR').addEventListener('click', () => G.rotateView(1));
    $('ticker').addEventListener('click', showStats);
    document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => G.setSpeed(+b.dataset.speed)));
  }
  G.setSpeed = function (n) {
    if (n > 0) G.lastSpeed = n;
    G.speed = n;
    document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === n));
  };

  function updateTopbar() {
    const s = G.s;
    if (!s) return;
    const st = s.stats;
    $('cityName').textContent = s.name;
    $('cityClass').textContent = SC.cityClass(st.pop);
    $('statDate').textContent = '📅 ' + SC.dateStr(s);
    const m = $('statMoney');
    m.textContent = '💶 ' + SC.fmtMoney(s.money);
    m.classList.toggle('neg', s.money < 0);
    $('statPop').textContent = '👥 ' + SC.fmtNum(st.pop);
    const p = $('statPower');
    p.textContent = '⚡ ' + SC.fmtNum(Math.min(s.power.demand, s.power.capacity)) + ' / ' + SC.fmtNum(s.power.capacity);
    p.classList.toggle('warn', s.power.demand > s.power.capacity);
    for (const z of ['r', 'c', 'i']) {
      const v = s.demand[z];
      const el = document.querySelector('#rci .bar[data-z=' + z + '] i');
      const h = Math.abs(v) * 50;
      el.style.height = h + '%';
      el.style.top = v >= 0 ? (50 - h) + '%' : '50%';
      el.style.opacity = v >= 0 ? 1 : 0.5;
    }
    document.querySelectorAll('.tool').forEach(b => {
      const tool = SC.TOOL[b.dataset.tool];
      if (!tool.building) return;
      const bt = SC.BTYPES[tool.building];
      if (!bt.minPop) return;
      const locked = st.pop < bt.minPop && !s.flags['unlock_' + bt.key];
      b.classList.toggle('locked', locked);
      b.querySelector('.cost').textContent = locked ? '🔒 ab ' + SC.fmtNum(bt.minPop) + ' EW' : SC.fmtMoney(bt.cost);
    });
  }

  // ======================= Maus / Touch =======================
  function pos(e) {
    const r = $('view').getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function bindCanvas() {
    const c = $('view');
    const pointers = new Map();
    let pinch = null;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      if (!G.s) return;
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        G.drag = null; G.pan = null; updatePreview();
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        return;
      }
      if (e.button === 1 || e.button === 2) { G.pan = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: true }; c.style.cursor = 'grabbing'; return; }
      if (e.button !== 0) return;
      const tile = R.screenToTile(p.x, p.y);
      const tool = G.tool;
      if (tool.id === 'query') { G.pan = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, query: tile }; return; }
      if (tool.building && !tool.drag) { placeBuilding(tile, p); return; }
      G.drag = { sx: tile.x, sy: tile.y, ex: tile.x, ey: tile.y };
      updatePreview();
    });
    c.addEventListener('pointermove', e => {
      if (!G.s) return;
      const p = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        R.zoomAt(m.x, m.y, d / Math.max(1, pinch.d));
        R.view.x -= m.x - pinch.m.x; R.view.y -= m.y - pinch.m.y;
        pinch = { d, m };
        return;
      }
      G.mouse = { x: e.clientX, y: e.clientY };
      if (G.pan) {
        if (!G.pan.moved && Math.hypot(p.x - G.pan.sx, p.y - G.pan.sy) > 5) { G.pan.moved = true; c.style.cursor = 'grabbing'; }
        if (G.pan.moved) { R.view.x -= p.x - G.pan.x; R.view.y -= p.y - G.pan.y; }
        G.pan.x = p.x; G.pan.y = p.y;
        return;
      }
      const tile = R.screenToTile(p.x, p.y);
      const inside = tile.x >= 0 && tile.y >= 0 && tile.x < G.s.W && tile.y < G.s.H;
      G.hover = inside ? tile : null;
      if (G.drag) { G.drag.ex = SC.clamp(tile.x, 0, G.s.W - 1); G.drag.ey = SC.clamp(tile.y, 0, G.s.H - 1); }
      updatePreview();
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (G.pan) {
        if (!G.pan.moved && G.pan.query) showInfo(G.pan.query);
        G.pan = null;
        c.style.cursor = G.tool.id === 'query' ? 'grab' : 'crosshair';
        return;
      }
      if (G.drag) { applyDrag(); G.drag = null; updatePreview(); }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch = null; G.pan = null; G.drag = null; updatePreview(); });
    c.addEventListener('pointerleave', () => { if (!G.drag) { G.hover = null; updatePreview(); } });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (!G.s) return;
      const p = pos(e);
      R.zoomAt(p.x, p.y, Math.pow(1.0018, -e.deltaY * (e.deltaMode === 1 ? 30 : 1)));
      updatePreview();
    }, { passive: false });
  }

  function lineTiles(sx, sy, ex, ey) {
    const out = [];
    const sxn = Math.sign(ex - sx), syn = Math.sign(ey - sy);
    if (Math.abs(ex - sx) >= Math.abs(ey - sy)) {
      for (let x = sx; ; x += sxn) { out.push([x, sy]); if (x === ex) break; }
      if (syn) for (let y = sy + syn; ; y += syn) { out.push([ex, y]); if (y === ey) break; }
    } else {
      for (let y = sy; ; y += syn) { out.push([sx, y]); if (y === ey) break; }
      if (sxn) for (let x = sx + sxn; ; x += sxn) { out.push([x, ey]); if (x === ex) break; }
    }
    return out;
  }
  function rectTiles(sx, sy, ex, ey) {
    const out = [];
    const xa = Math.min(sx, ex), xb = Math.max(sx, ex), ya = Math.min(sy, ey), yb = Math.max(sy, ey);
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) out.push([x, y]);
    return out;
  }
  function dragTiles() {
    const d = G.drag;
    return G.tool.drag === 'line' ? lineTiles(d.sx, d.sy, d.ex, d.ey) : rectTiles(d.sx, d.sy, d.ex, d.ey);
  }
  function buildingOrigin(tile, bt) {
    const off = Math.floor((bt.size - 1) / 2);
    return { x: tile.x - off, y: tile.y - off };
  }

  function updatePreview() {
    const s = G.s, tool = G.tool, tip = $('cursorTip');
    G.preview = null;
    if (!s || tool.id === 'query' || (!G.hover && !G.drag)) { tip.classList.add('hidden'); return; }
    let total = 0, invalid = false, text = '';
    if (G.drag) {
      const pv = Act.preview(s, tool, dragTiles());
      G.preview = { tiles: pv.tiles };
      total = pv.total;
      invalid = pv.tiles.every(t => t.c < 0);
      const d = G.drag;
      const dims = tool.drag === 'rect' ? (Math.abs(d.ex - d.sx) + 1) + '×' + (Math.abs(d.ey - d.sy) + 1) : pv.tiles.length + ' Felder';
      text = tool.name + ' · ' + dims + ' · ' + SC.fmtMoney(total);
    } else if (tool.building) {
      const bt = SC.BTYPES[tool.building];
      const o = buildingOrigin(G.hover, bt);
      const c = Act.check(s, tool, o.x, o.y);
      G.preview = { tiles: [{ x: o.x, y: o.y, c }], size: bt.size, radius: bt.radius, cx: o.x + bt.size / 2, cy: o.y + bt.size / 2 };
      total = c; invalid = c < 0;
      text = bt.name + ' · ' + (c === -2 ? '🔒 ab ' + SC.fmtNum(bt.minPop) + ' Einwohnern' : c < 0 ? 'hier nicht möglich' : SC.fmtMoney(c));
    } else {
      const c = Act.check(s, tool, G.hover.x, G.hover.y);
      G.preview = { tiles: [{ x: G.hover.x, y: G.hover.y, c }] };
      total = c; invalid = c < 0;
      text = tool.name + ' · ' + (c < 0 ? 'hier nicht möglich' : SC.fmtMoney(c));
    }
    if (total > s.money) { invalid = true; text += ' · zu teuer!'; }
    tip.textContent = text;
    tip.classList.toggle('bad', invalid);
    tip.classList.remove('hidden');
    tip.style.left = (G.mouse.x + 16) + 'px';
    tip.style.top = (G.mouse.y + 18) + 'px';
  }

  function applyDrag() {
    const s = G.s, tool = G.tool;
    let spent = 0, noMoney = false, locked = false, any = false;
    for (const [x, y] of dragTiles()) {
      const r = Act.apply(s, tool, x, y);
      if (r > 0) spent += r;
      if (r >= 0) any = true;
      else if (r === -3) noMoney = true;
      else if (r === -2) locked = true;
    }
    finishAction(spent, noMoney, locked, false);
  }
  function placeBuilding(tile) {
    const s = G.s, bt = SC.BTYPES[G.tool.building];
    const o = buildingOrigin(tile, bt);
    const r = Act.apply(s, G.tool, o.x, o.y);
    if (r === -1) toast('Hier ist kein Platz für ' + bt.name + '.', 'warn');
    finishAction(r > 0 ? r : 0, r === -3, r === -2, r > 0 ? bt : null);
  }
  function finishAction(spent, noMoney, locked, bt) {
    const s = G.s;
    if (spent > 0) floatText('−' + SC.fmtMoney(spent), true);
    if (noMoney) toast('Nicht genug Geld in der Stadtkasse!', 'bad');
    if (locked) toast('Noch nicht freigeschaltet.', 'warn');
    if (bt && bt.power && !s.flags.firstPlant) {
      s.flags.firstPlant = true;
      toast('Tipp: Verbinde das Kraftwerk mit Straße oder Stromleitung mit deiner Stadt – Straßen und Zonen leiten Strom weiter.', 'info', 7000);
    }
    Sim.afterEdit(s);
    updateTopbar();
    updatePreview();
    mmTimer = 1000;
  }

  // ======================= Tastatur =======================
  function bindKeys() {
    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (G.dialogOpen) {
        if (e.key === 'Escape' && G.s) closeDialog();
        return;
      }
      if (!G.s) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); quickSave(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 200 : 60;
      switch (e.key) {
        case 'ArrowLeft': R.view.x -= step; e.preventDefault(); return;
        case 'ArrowRight': R.view.x += step; e.preventDefault(); return;
        case 'ArrowUp': R.view.y -= step; e.preventDefault(); return;
        case 'ArrowDown': R.view.y += step; e.preventDefault(); return;
        case '+': case '=': R.zoomAt(R.cw / 2, R.ch / 2, 1.25); return;
        case '-': case '_': R.zoomAt(R.cw / 2, R.ch / 2, 0.8); return;
        case ' ': e.preventDefault(); G.setSpeed(G.speed ? 0 : (G.lastSpeed || 1)); return;
        case '0': G.setSpeed(0); return;
        case '1': case '2': case '3': G.setSpeed(+e.key); return;
        case 'Escape':
          if (G.drag) { G.drag = null; updatePreview(); }
          else if (G.infoTile) closeInfo();
          else G.setTool('query');
          return;
      }
      if (k === 'v') { G.setViewMode(R.is3D ? '2d' : '3d'); return; }
      if (e.key === ',' || k === 'z') { G.rotateView(-1); return; }
      if (e.key === '.' || k === 'x') { G.rotateView(1); return; }
      if (k === 'p') { G.setSpeed(G.speed ? 0 : (G.lastSpeed || 1)); return; }
      const tool = SC.TOOLS.find(t => t.key === k);
      if (tool) G.setTool(tool.id);
    });
  }

  // ======================= Info-Panel =======================
  function showInfo(tile) {
    const s = G.s;
    if (tile.x < 0 || tile.y < 0 || tile.x >= s.W || tile.y >= s.H) return;
    G.infoTile = tile;
    renderInfo();
  }
  function closeInfo() { G.infoTile = null; $('infoPanel').classList.add('hidden'); }
  function meter(v, color) {
    v = SC.clamp(v, 0, 1);
    return '<span class="meter"><i style="width:' + Math.round(v * 100) + '%;background:' + color + '"></i></span>';
  }
  function row(a, b) { return '<div class="row"><span>' + a + '</span><span>' + b + '</span></div>'; }
  function renderInfo() {
    const s = G.s, t = G.infoTile, i = t.y * s.W + t.x, k = s.kind[i], ter = s.terrain[i];
    let title = '', html = '';
    const yes = '✅', no = '❌';
    const env = () =>
      row('Bodenwert', s.landValue[i] + meter(s.landValue[i] / 100, '#3fbf5a')) +
      row('Verschmutzung', Math.round(s.pollution[i] / 2.55) + '%' + meter(s.pollution[i] / 255, '#ff7043')) +
      row('Kriminalität', s.crime[i] + '%' + meter(s.crime[i] / 100, '#e53935')) +
      row('Polizeischutz', Math.round(s.cov.police[i] * 100) + '%' + meter(s.cov.police[i], '#3a8ef0')) +
      row('Brandschutz', Math.round(s.cov.fire[i] * 100) + '%' + meter(s.cov.fire[i], '#3a8ef0'));
    if (k === K.ZONE) {
      const z = s.zone[i], l = s.lvl[i];
      const names = [['Unbebaut', 'Einfamilienhäuser', 'Mehrfamilienhaus', 'Wohnturm'],
        ['Unbebaut', 'Laden', 'Bürogebäude', 'Geschäftsturm'],
        ['Unbebaut', 'Werkstatt', 'Fabrik', 'Industriekomplex']][z - 1];
      title = SC.ZONE_NAMES[z] + ' – ' + names[l];
      html += row(z === 1 ? 'Einwohner' : 'Arbeitsplätze', SC.fmtNum(SC.CAPACITY[z][l]));
      html += row('Ausbaustufe', l + ' / 3');
      html += row('Strom', s.powered[i] ? yes + ' versorgt' : no + ' kein Strom');
      html += row('Straßenanbindung', s.roadDist[i] <= 3 ? yes + ' ja' : no + ' keine Straße in 3 Feldern');
      html += env();
      if (z === 1) html += row('Schule', Math.round(s.cov.school[i] * 100) + '%') + row('Krankenhaus', Math.round(s.cov.hospital[i] * 100) + '%');
    } else if (k === K.BUILDING) {
      const b = SC.buildingAt(s, i), bt = SC.BTYPES[b.t];
      title = bt.icon + ' ' + bt.name;
      html += row('Unterhalt', SC.fmtMoney(bt.upkeep) + ' / Monat');
      if (bt.power) {
        html += row('Leistung', SC.fmtNum(bt.power) + ' Felder');
        html += row('Netz gesamt', SC.fmtNum(s.power.used) + ' / ' + SC.fmtNum(s.power.capacity));
        if (bt.pollution) html += row('Umwelt', '⚠️ stark verschmutzend');
      } else if (bt.key !== 'park') {
        html += row('Strom', s.powered[i] ? yes + ' versorgt' : no + ' kein Strom');
      }
      if (bt.radius) html += row('Reichweite', bt.radius + ' Felder');
      html += '<div class="note" style="margin-top:6px">' + esc(bt.desc) + '</div>';
    } else if (SC.isRoad(k)) {
      title = ter === T.WATER ? '🌉 Brücke' : '🛣️ Straße';
      if (k === K.ROADWIRE) title += ' mit Stromleitung';
      html += row('Verkehr', Math.round(s.traffic[i] / 2.55) + '%' + meter(s.traffic[i] / 160, '#ffb703'));
      html += row('Unterhalt', ter === T.WATER ? '0,60 € / Monat' : '0,08 € / Monat');
    } else if (k === K.WIRE) {
      title = '⚡ Stromleitung';
      html += row('Strom', s.powered[i] ? yes + ' unter Spannung' : no + ' nicht verbunden');
    } else if (k === K.RUBBLE) {
      title = '🧱 Trümmer';
      html += '<div class="note">Mit dem Abriss-Werkzeug räumen oder direkt überbauen.</div>';
    } else {
      title = ter === T.WATER ? '🌊 Wasser' : ter === T.TREES ? '🌲 Wald' : '🌱 Wiese';
      if (ter !== T.WATER) html += env();
    }
    if (s.fire[i]) html = '<div class="row" style="color:#ff8b84"><span>🔥 Hier brennt es!</span><span></span></div>' + html;
    html += row('Position', t.x + ', ' + t.y);
    const p = $('infoPanel');
    p.innerHTML = '<button class="close" title="Schließen">✕</button><h3>' + title + '</h3>' + html;
    p.querySelector('.close').addEventListener('click', closeInfo);
    p.classList.remove('hidden');
  }

  // ======================= Meldungen =======================
  function onNotify(entry) {
    setTicker(entry);
    if (entry.type === 'bad' || entry.type === 'good') toast(entry.msg, entry.type);
  }
  function setTicker(entry) {
    const tk = $('ticker');
    tk.className = entry.type || '';
    tk.innerHTML = '<span class="d">' + esc(entry.d) + '</span>' + esc(entry.msg);
  }
  function toast(msg, type, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms || 3800);
  }
  G.toast = toast;
  function floatText(text, neg) {
    const el = document.createElement('div');
    el.className = 'floatText' + (neg ? ' neg' : '');
    el.textContent = text;
    el.style.left = (G.mouse.x + 10) + 'px';
    el.style.top = (G.mouse.y - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  function floatBanner(text) { toast(text, 'good', 5000); }

  // ======================= Dialoge =======================
  function openDialog(title, body, opts) {
    opts = opts || {};
    if (opts.menu && !G.s) opts.noClose = true;
    const d = $('dialog');
    d.innerHTML = (title ? '<div class="dhead"><h2>' + title + '</h2>' + (opts.noClose ? '' : '<button class="x" title="Schließen">✕</button>') + '</div>' : '') +
      '<div class="dbody">' + body + '</div>';
    d.style.width = opts.width || '';
    $('modal').classList.remove('hidden');
    $('modal').classList.toggle('menuMode', !!opts.menu);
    G.dialogOpen = true;
    G.drag = null; G.preview = null;
    $('cursorTip').classList.add('hidden');
    const x = d.querySelector('.dhead .x');
    if (x) x.addEventListener('click', closeDialog);
    return d;
  }
  function closeDialog() {
    $('modal').classList.add('hidden');
    $('dialog').innerHTML = '';
    G.dialogOpen = false;
  }
  $('modal') && $('modal').addEventListener('pointerdown', e => {
    if (e.target === $('modal') && G.s && !$('modal').classList.contains('menuMode')) closeDialog();
  });

  // ---------- Hauptmenü ----------
  function showMainMenu() {
    const saves = SC.Storage.list();
    const auto = saves.find(e => e.id === 'auto');
    let html = '<div class="menu"><div class="logo"><span class="s">☀️</span> Heliotown</div>' +
      '<p class="tag">Plane, baue und verwalte deine eigene Stadt.</p>';
    if (G.s) html += '<button class="btn primary mbtn" data-a="resume">▶ Zurück zum Spiel</button>';
    else if (auto) html += '<button class="btn primary mbtn" data-a="continue">▶ Weiterspielen<span class="cont">' +
      esc(auto.city) + ' · ' + esc(auto.date) + ' · ' + SC.fmtNum(auto.pop) + ' Einwohner</span></button>';
    html += '<button class="btn mbtn' + (!G.s && !auto ? ' primary' : '') + '" data-a="new">🏗️ Neues Spiel</button>' +
      '<button class="btn mbtn" data-a="load">📂 Spiel laden / speichern</button>' +
      '<button class="btn mbtn" data-a="import">📥 Spielstand-Datei importieren</button>' +
      (G.s ? '<button class="btn mbtn" data-a="settings">⚙️ Einstellungen</button>' : '') +
      '<button class="btn mbtn" data-a="help">❓ Anleitung</button>' +
      '<p class="note" style="margin-top:18px">Läuft komplett offline. Spielstände werden lokal in diesem Browser gespeichert –<br>' +
      'zum Umziehen auf einen anderen PC als Datei exportieren.</p></div>';
    const d = openDialog('', html, { menu: true, width: '460px' });
    d.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'resume') closeDialog();
      else if (a === 'continue') loadSlot('auto');
      else if (a === 'new') showNewGame();
      else if (a === 'load') showSaveLoad(G.s ? 'save' : 'load');
      else if (a === 'import') $('fileInput').click();
      else if (a === 'settings') showSettings();
      else if (a === 'help') showHelp();
    }));
  }

  // ---------- Neues Spiel ----------
  function showNewGame() {
    const names = ['Sonnenstadt', 'Neu-Sonnfeld', 'Lichtenau', 'Sonnenberg', 'Helioshafen', 'Goldtal', 'Sommerau'];
    const seed = (Math.random() * 1e9) | 0;
    const html =
      '<div class="newgame"><div class="form">' +
      '<label>Stadtname</label><input type="text" id="ngName" maxlength="40" value="' + names[(Math.random() * names.length) | 0] + '">' +
      '<label>Kartengröße</label><select id="ngSize"><option value="64">Klein (64×64)</option><option value="96" selected>Mittel (96×96)</option><option value="128">Groß (128×128)</option></select>' +
      '<label>Wasser</label><select id="ngWater"><option value="0.3">Wenig</option><option value="0.37" selected>Normal</option><option value="0.44">Viel</option></select>' +
      '<label>Schwierigkeit</label><select id="ngDiff"><option value="50000">Leicht (50.000 €)</option><option value="20000" selected>Normal (20.000 €)</option><option value="10000">Schwer (10.000 €)</option></select>' +
      '<label>Katastrophen</label><label><input type="checkbox" id="ngDis" checked> Brände können ausbrechen</label>' +
      '<label>Karten-Nr.</label><div style="display:flex;gap:6px"><input type="number" id="ngSeed" value="' + seed + '"><button class="btn small" id="ngRnd" title="Neue Karte">🎲</button></div>' +
      '</div><div><canvas class="preview" id="ngPrev" width="160" height="160"></canvas><div class="note" style="text-align:center;margin-top:4px">Vorschau</div></div></div>' +
      '<div class="actions"><button class="btn" id="ngBack">Zurück</button><button class="btn primary" id="ngGo">Stadt gründen</button></div>';
    const d = openDialog('🏗️ Neues Spiel', html, { menu: true });
    const opts = () => ({
      name: $('ngName').value.trim() || 'Heliotown', size: +$('ngSize').value, water: +$('ngWater').value,
      money: +$('ngDiff').value, disasters: $('ngDis').checked, seed: (+$('ngSeed').value) >>> 0
    });
    const prev = () => {
      const o = opts();
      const s = SC.createState({ W: o.size, H: o.size, seed: o.seed });
      SC.generateTerrain(s, { water: o.water });
      SC.Render.drawMinimap(s, $('ngPrev'), null, null);
    };
    prev();
    ['ngSize', 'ngWater', 'ngSeed'].forEach(id => $(id).addEventListener('change', prev));
    $('ngRnd').addEventListener('click', () => { $('ngSeed').value = (Math.random() * 1e9) | 0; prev(); });
    $('ngBack').addEventListener('click', showMainMenu);
    $('ngGo').addEventListener('click', () => {
      if (G.s && !confirm('Das aktuelle Spiel wird beendet. Nicht gespeicherter Fortschritt geht verloren (außer im Autosave). Fortfahren?')) return;
      if (G.s) autosave(true);
      G.startGame(SC.newGame(opts()));
      toast('Tipp: Baue zuerst ein Kraftwerk, dann Straßen und Zonen. Öffne ❓ für die Anleitung.', 'info', 7000);
    });
    d.querySelector('#ngName').focus();
  }

  // ---------- Speichern / Laden ----------
  function quickSave() {
    if (!G.s) return;
    try { SC.Storage.save('auto', G.s, 'Automatisch gespeichert'); toast('Spiel gespeichert (Autosave).', 'good', 2000); }
    catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, 'bad'); }
  }
  function autosave(silent) {
    if (!G.s || !G.s.autosave) return;
    try {
      SC.Storage.save('auto', G.s, 'Automatisch gespeichert');
      if (!silent) toast('Automatisch gespeichert.', 'info', 1800);
    } catch (e) { if (!silent) toast('Autosave fehlgeschlagen – Speicher voll? Exportiere deine Stadt als Datei.', 'bad'); }
  }
  function loadSlot(id) {
    try {
      const s = SC.Storage.load(id);
      G.startGame(s);
      toast('„' + s.name + '“ geladen.', 'good', 2500);
    } catch (e) { toast('Laden fehlgeschlagen: ' + e.message, 'bad', 6000); }
  }
  function fileName(s) {
    return (s.name.replace(/[^\wäöüÄÖÜß-]+/g, '_') || 'Heliotown') + '_' + SC.MONTHS[s.month] + s.year + '.heliotown.json';
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function onImportFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const s = SC.deserialize(JSON.parse(rd.result));
        if (G.s && !confirm('Importierten Spielstand „' + s.name + '“ laden? Das aktuelle Spiel wird beendet.')) return;
        if (G.s) autosave(true);
        G.startGame(s);
        toast('„' + s.name + '“ importiert. Tipp: Über 💾 kannst du es im Browser speichern.', 'good', 5000);
      } catch (err) { toast('Import fehlgeschlagen: ' + err.message, 'bad', 6000); }
    };
    rd.readAsText(f);
  }

  function showSaveLoad(mode) {
    const list = SC.Storage.list();
    let used = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('heliotown.')) used += (localStorage.getItem(k) || '').length; } } catch (e) { /* */ }
    let html = '';
    if (G.s) html += '<div class="saveRow"><input type="text" id="slName" maxlength="40" value="' + esc(G.s.name) + ' – ' + esc(SC.dateStr(G.s)) + '">' +
      '<button class="btn primary" id="slSave">💾 Speichern</button></div>';
    html += '<div class="slots">';
    if (!list.length) html += '<p class="note">Noch keine Spielstände vorhanden.</p>';
    for (const e of list) {
      const when = new Date(e.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      html += '<div class="slot"><div class="meta"><b>' + (e.id === 'auto' ? '🔄 ' : '') + esc(e.label) + '</b><small>' +
        esc(e.city) + ' · ' + esc(e.date) + ' · ' + SC.fmtNum(e.pop) + ' EW · ' + SC.fmtMoney(e.money) + ' · ' + esc(e.size) + ' · gespeichert ' + when + '</small></div>' +
        '<button class="btn small primary" data-load="' + esc(e.id) + '">Laden</button>' +
        '<button class="btn small" data-exp="' + esc(e.id) + '" title="Als Datei exportieren">⬇</button>' +
        '<button class="btn small danger" data-del="' + esc(e.id) + '" title="Löschen">🗑</button></div>';
    }
    html += '</div><div class="actions" style="justify-content:space-between">' +
      '<span class="note">Belegt: ' + Math.round(used / 1024) + ' KB (Browser-Limit ca. 5.000 KB)</span><span style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" id="slImport">📥 Datei importieren</button>' +
      (G.s ? '<button class="btn" id="slExport">⬇ Aktuelles Spiel exportieren</button>' : '') +
      (!G.s ? '<button class="btn" id="slBack">Zurück</button>' : '') + '</span></div>' +
      '<p class="note">Exportierte Dateien (.heliotown.json) kannst du auf einen anderen PC kopieren und dort importieren.</p>';
    const d = openDialog(mode === 'save' ? '💾 Speichern & Laden' : '📂 Spiel laden', html, { menu: !G.s });
    if (G.s) {
      $('slSave').addEventListener('click', () => {
        const label = $('slName').value.trim() || G.s.name;
        const ex = list.find(e => e.label === label && e.id !== 'auto');
        if (ex && !confirm('Spielstand „' + label + '“ überschreiben?')) return;
        try {
          SC.Storage.save(ex ? ex.id : 'save_' + Date.now(), G.s, label);
          toast('Gespeichert: ' + label, 'good', 2500);
          showSaveLoad(mode);
        } catch (e) { toast('Speichern fehlgeschlagen (Speicher voll?). Lösche alte Stände oder exportiere als Datei.', 'bad', 6000); }
      });
      $('slExport').addEventListener('click', () => download(fileName(G.s), JSON.stringify(SC.serialize(G.s))));
    }
    if ($('slBack')) $('slBack').addEventListener('click', showMainMenu);
    $('slImport').addEventListener('click', () => $('fileInput').click());
    d.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
      if (G.s && !confirm('Spielstand laden? Nicht gespeicherter Fortschritt geht verloren.')) return;
      if (G.s && b.dataset.load !== 'auto') autosave(true);
      loadSlot(b.dataset.load);
    }));
    d.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => {
      const raw = SC.Storage.raw(b.dataset.exp);
      const e = list.find(x => x.id === b.dataset.exp);
      if (raw) download((e.city || 'Heliotown').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '_' + e.date.replace(' ', '') + '.heliotown.json', raw);
    }));
    d.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const e = list.find(x => x.id === b.dataset.del);
      if (!confirm('Spielstand „' + e.label + '“ endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
      SC.Storage.remove(b.dataset.del);
      showSaveLoad(mode);
    }));
  }

  // ---------- Haushalt ----------
  function showBudget() {
    const s = G.s;
    const html = '<div class="form" style="grid-template-columns:140px 1fr 50px">' +
      '<label>Steuersatz</label><input type="range" id="bTax" min="0" max="20" step="1" value="' + s.tax + '"><b id="bTaxV">' + s.tax + '%</b></div>' +
      '<p class="note" id="bTaxHint"></p><table class="tbl" id="bTable"></table>' +
      '<p class="note">Einnahmen und Ausgaben werden monatlich verbucht. Steuern über 7 % bremsen das Wachstum, niedrigere fördern es.</p>' +
      '<div class="actions"><button class="btn primary" id="bOk">OK</button></div>';
    openDialog('💰 Haushalt', html);
    const render = () => {
      Sim.computeDemand(s);
      const b = Sim.estimateBudget(s);
      $('bTaxV').textContent = s.tax + '%';
      $('bTaxHint').textContent = s.tax <= 4 ? 'Sehr niedrige Steuern – die Stadt wächst schnell, aber die Kasse leidet.' :
        s.tax <= 8 ? 'Ausgewogene Steuern.' : s.tax <= 12 ? 'Erhöhte Steuern – das Wachstum verlangsamt sich.' : 'Sehr hohe Steuern – Bürger und Firmen ziehen weg!';
      const r = (n, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + n + '</td><td class="num ' + (v < 0 ? 'negc' : v > 0 ? 'pos' : '') + '">' + SC.fmtMoney(v) + '</td></tr>';
      $('bTable').innerHTML =
        '<tr><td colspan="2" class="note">Prognose pro Monat</td></tr>' +
        r('🏛️ Steuereinnahmen', b.income) + r('🛣️ Straßen & Leitungen', -b.roads) + r('⚡ Kraftwerke', -b.power) +
        r('🏥 Öffentliche Dienste & Parks', -b.services) + r('Saldo pro Monat', b.net, 'sum') + r('Prognose pro Jahr', b.net * 12) +
        '<tr><td>Letzter Monat</td><td class="num ' + (s.budget.net < 0 ? 'negc' : 'pos') + '">' + SC.fmtMoney(s.budget.net || 0) + '</td></tr>' +
        '<tr class="sum"><td>💶 Kassenstand</td><td class="num">' + SC.fmtMoney(s.money) + '</td></tr>';
    };
    render();
    $('bTax').addEventListener('input', e => { s.tax = +e.target.value; render(); updateTopbar(); });
    $('bOk').addEventListener('click', closeDialog);
  }

  // ---------- Statistik ----------
  function showStats() {
    const s = G.s, st = s.stats;
    const count = key => s.buildings.filter(b => SC.BTYPES[b.t].key === key).length;
    const html = '<div class="statgrid">' +
      row('Einwohner', SC.fmtNum(st.pop)) + row('Stadtgröße', SC.cityClass(st.pop)) +
      row('Jobs Gewerbe', SC.fmtNum(st.jobsC)) + row('Jobs Industrie', SC.fmtNum(st.jobsI)) +
      row('Wohnzonen', SC.fmtNum(st.zones[1])) + row('Gewerbezonen', SC.fmtNum(st.zones[2])) +
      row('Industriezonen', SC.fmtNum(st.zones[3])) + row('Straßen', SC.fmtNum(st.roads + st.bridges)) +
      row('Strom', SC.fmtNum(s.power.demand) + ' / ' + SC.fmtNum(s.power.capacity)) + row('Ohne Strom', SC.fmtNum(st.unpowered)) +
      row('Polizei / Feuerwehr', count('police') + ' / ' + count('fire')) + row('Schulen / Kliniken', count('school') + ' / ' + count('hospital')) +
      '</div><div class="sidehead">Einwohner</div><canvas class="chart" id="chPop"></canvas>' +
      '<div class="sidehead">Kassenstand</div><canvas class="chart" id="chMoney"></canvas>' +
      '<div class="sidehead">Nachrichten</div><div class="log">' +
      s.log.slice().reverse().map(e => '<div class="' + e.type + '"><span class="note">' + esc(e.d) + '</span> ' + esc(e.msg) + '</div>').join('') + '</div>';
    openDialog('📈 Statistik – ' + esc(s.name), html, { width: '680px' });
    chart($('chPop'), s.history.map(h => h.pop), '#3fbf5a', v => SC.fmtNum(v));
    chart($('chMoney'), s.history.map(h => h.money), '#ffb703', v => SC.fmtMoney(v));
  }
  function chart(cv, data, color, fmt) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.font = '11px system-ui, sans-serif'; c.fillStyle = '#9aa7b8';
    if (data.length < 2) { c.fillText('Noch zu wenige Daten – lass die Zeit laufen.', 12, h / 2); return; }
    const pts = data.slice(-240);
    let mn = Math.min(0, ...pts), mx = Math.max(...pts);
    if (mx === mn) mx = mn + 1;
    const L = 70, Rr = 10, Tp = 10, B = 18;
    const X = i => L + (w - L - Rr) * i / (pts.length - 1), Y = v => Tp + (h - Tp - B) * (1 - (v - mn) / (mx - mn));
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    for (let k = 0; k <= 3; k++) {
      const v = mn + (mx - mn) * k / 3, y = Y(v);
      c.beginPath(); c.moveTo(L, y); c.lineTo(w - Rr, y); c.stroke();
      c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(fmt(v), L - 6, y);
    }
    if (mn < 0) { c.strokeStyle = 'rgba(255,90,79,0.5)'; c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(w - Rr, Y(0)); c.stroke(); }
    c.beginPath();
    pts.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
    c.strokeStyle = color; c.lineWidth = 2; c.stroke();
    c.lineTo(X(pts.length - 1), Y(mn)); c.lineTo(X(0), Y(mn)); c.closePath();
    c.fillStyle = color + '22'; c.fill();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = '#9aa7b8';
    c.fillText('letzte ' + pts.length + ' Monate', L, h - 4);
  }

  // ---------- Einstellungen ----------
  function showSettings() {
    const s = G.s;
    const html = '<div class="form">' +
      '<label>Stadtname</label><input type="text" id="seName" maxlength="40" value="' + esc(s.name) + '">' +
      '<label>Katastrophen</label><label><input type="checkbox" id="seDis"' + (s.disasters ? ' checked' : '') + '> Brände können ausbrechen</label>' +
      '<label>Autosave</label><label><input type="checkbox" id="seAuto"' + (s.autosave ? ' checked' : '') + '> jedes Spieljahr und alle 2 Minuten</label>' +
      '</div><div class="actions"><button class="btn" id="seBack">Zurück</button><button class="btn primary" id="seOk">Übernehmen</button></div>';
    openDialog('⚙️ Einstellungen', html, { menu: true });
    $('seBack').addEventListener('click', showMainMenu);
    $('seOk').addEventListener('click', () => {
      s.name = $('seName').value.trim() || s.name;
      s.disasters = $('seDis').checked;
      s.autosave = $('seAuto').checked;
      updateTopbar();
      closeDialog();
    });
  }

  // ---------- Hilfe ----------
  function showHelp() {
    const html = '<div class="help">' +
      '<h3>So startest du</h3><ol>' +
      '<li><b>Kraftwerk bauen</b> (Kohle, Solar oder Windrad).</li>' +
      '<li><b>Straßen ziehen</b> – Zonen brauchen eine Straße in höchstens 3 Feldern Abstand.</li>' +
      '<li><b>Zonen ausweisen</b>: Wohnen (W), Gewerbe (G) und Industrie (I) per Ziehen aufspannen.</li>' +
      '<li><b>Strom verlegen</b> – Straßen, Zonen und Gebäude leiten Strom an Nachbarfelder weiter. Lücken über freies Gelände oder Wasser überbrückst du mit Stromleitungen.</li>' +
      '<li>Zeit laufen lassen und die <b>Nachfrage-Balken</b> (W/G/I) oben im Blick behalten.</li></ol>' +
      '<h3>Tipps</h3><ul>' +
      '<li>Industrie verschmutzt – halte Abstand zu Wohngebieten. Parks und Wald verbessern die Luft.</li>' +
      '<li>Hoher Bodenwert (Wasser, Parks, Schulen) lässt Hochhäuser entstehen.</li>' +
      '<li>Polizei senkt Kriminalität, Feuerwehr löscht Brände schnell.</li>' +
      '<li>Ab 250 Einwohnern entstehen mittlere, ab 2.000 große Gebäude.</li>' +
      '<li>Die Ansichten rechts (Strom, Anbindung, Verschmutzung …) zeigen Probleme sofort.</li></ul>' +
      '<h3>Steuerung</h3><ul>' +
      '<li><b>Linke Maustaste</b>: bauen (ziehen für Straßen, Leitungen, Zonen, Abriss)</li>' +
      '<li><b>Rechte/mittlere Maustaste ziehen</b> oder Info-Werkzeug ziehen: Karte verschieben</li>' +
      '<li><b>Mausrad</b>: zoomen · <kbd>+</kbd>/<kbd>−</kbd> zoomen · <kbd>Pfeiltasten</kbd> verschieben</li>' +
      '<li><kbd>Leertaste</kbd> Pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> Geschwindigkeit</li>' +
      '<li><kbd>V</kbd> 3D-/2D-Ansicht · <kbd>Z</kbd>/<kbd>X</kbd> (oder <kbd>,</kbd>/<kbd>.</kbd>) Ansicht drehen</li>' +
      '<li><kbd>Q</kbd> Info · <kbd>B</kbd> Abriss · <kbd>R</kbd> Straße · <kbd>L</kbd> Leitung · <kbd>W</kbd> <kbd>G</kbd> <kbd>I</kbd> Zonen · <kbd>Esc</kbd> abbrechen</li>' +
      '<li><kbd>Strg</kbd>+<kbd>S</kbd> Schnellspeichern</li></ul>' +
      '<h3>Spielstände</h3><p>Alles wird lokal im Browser gespeichert (automatisch jedes Spieljahr). ' +
      'Um eine Stadt auf einen anderen PC mitzunehmen, exportiere sie unter 💾 als Datei und importiere sie dort.</p></div>' +
      '<div class="actions"><button class="btn primary" id="hOk">Los geht’s!</button></div>';
    openDialog('❓ Anleitung', html, { menu: !G.s });
    $('hOk').addEventListener('click', () => (G.s ? closeDialog() : showMainMenu()));
  }
})(window.SC);
