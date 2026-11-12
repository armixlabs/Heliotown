'use strict';
/* Heliotown – Benutzeroberfläche, Eingabe, Dialoge, Spielschleife */
(function (SC) {
  let R = SC.Render;
  const Sim = SC.Sim, Act = SC.Act, K = SC.KIND, T = SC.TER;
  const $ = id => document.getElementById(id);
  const esc = SC.esc;
  const t = (key, params) => SC.t(key, params);

  const G = SC.Game = {
    s: null, tool: SC.TOOL.query, speed: 1, overlay: null, hover: null, preview: null,
    drag: null, pan: null, dialogOpen: false, infoTile: null, mouse: { x: 0, y: 0 }, screen: null
  };

  const OVERLAYS = [
    [null, '🗺️', 'ov.none'], ['power', '⚡', 'ov.power'], ['roads', '🛣️', 'ov.roads'], ['pollution', '🏭', 'ov.pollution'],
    ['crime', '🚨', 'ov.crime'], ['landValue', '💎', 'ov.landValue'], ['traffic', '🚗', 'ov.traffic'], ['police', '🚓', 'ov.police'],
    ['fire', '🚒', 'ov.fire'], ['school', '🏫', 'ov.school'], ['hospital', '🏥', 'ov.hospital']
  ];
  const GRAD_HEAT = '<div class="grad" style="background:linear-gradient(90deg,#28dc28,#ffdc28,#ff2828)"></div>';
  function legend(key) {
    const green = '<span style="color:#3ce664">■</span> ', red = ' &nbsp; <span style="color:#f02828">■</span> ';
    switch (key) {
      case 'power': return green + t('lg.powered') + red + t('lg.unpowered');
      case 'roads': return green + t('lg.connected') + red + t('lg.noRoad');
      case 'pollution': case 'crime': return t('lg.low') + ' ' + GRAD_HEAT + ' ' + t('lg.high');
      case 'traffic': return t('lg.light') + ' ' + GRAD_HEAT + ' ' + t('lg.jam');
      case 'landValue': return t('lg.low') + ' <div class="grad" style="background:linear-gradient(90deg,#dc50c8,#78a0a0,#14e650)"></div> ' + t('lg.high');
      case 'police': case 'fire': case 'school': case 'hospital': return t('lg.' + key);
    }
    return '';
  }

  // ======================= Initialisierung =======================
  G.init = function () {
    SC.setLang(SC.Storage.getPref('lang', null) || SC.detectLang());
    SC.Render.init($('view'));
    SC.RenderIso.init($('view'));
    R = SC.Storage.getPref('view', '3d') === '2d' ? SC.Render : SC.RenderIso;
    SC.RenderIso.rot = SC.Storage.getPref('rot', 0) | 0;
    applyStaticTexts();
    buildToolbar();
    buildOverlays();
    bindTopbar();
    bindCanvas();
    bindKeys();
    $('minimap').addEventListener('pointerdown', minimapJump);
    $('minimap').addEventListener('pointermove', e => { if (e.buttons & 1) minimapJump(e); });
    SC.on('notify', onNotify);
    SC.on('newYear', () => autosave(true));
    SC.on('milestone', idx => toast(t('toast.milestone', { cls: '@class.' + idx }), 'good', 5000));
    window.addEventListener('beforeunload', () => autosave(true));
    setInterval(() => autosave(true), 120000);
    $('fileInput').addEventListener('change', onImportFile);
    if (!SC.Storage.available()) setTimeout(() => toast(t('toast.noStorage'), 'warn', 8000), 500);
    showMainMenu();
    requestAnimationFrame(frame);
  };

  // ======================= Sprache =======================
  function applyStaticTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  }
  G.setLanguage = function (lang) {
    if (lang === SC.lang) return;
    SC.setLang(lang);
    SC.Storage.setPref('lang', SC.lang);
    applyStaticTexts();
    buildToolbar();
    buildOverlays();
    updateViewButtons();
    if (G.s) {
      updateTopbar();
      const lastMsg = G.s.log[G.s.log.length - 1];
      if (lastMsg) setTicker(lastMsg);
      if (G.infoTile) renderInfo();
    }
    updatePreview();
  };
  function langPicker(id) {
    return '<div class="langPick" id="' + id + '">' + SC.LANG_LIST.map(l =>
      '<button class="btn small' + (l === SC.lang ? ' primary' : '') + '" data-lang="' + l + '">' + esc(SC.LANGS[l]['lang.name']) + '</button>').join('') + '</div>';
  }
  function bindLangPicker(id, after) {
    $(id).querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { G.setLanguage(b.dataset.lang); after(); }));
  }

  // ======================= Spielschleife =======================
  let last = 0, acc = 0, uiTimer = 0, mmTimer = 0;
  function frame(time) {
    requestAnimationFrame(frame);
    const dt = Math.min(250, last ? time - last : 16);
    last = time;
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
    R.draw(s, time, G);
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
    $('btnView').innerHTML = R.is3D ? '🗺️ <span class="t">' + esc(t('view.2d')) + '</span>' : '🧊 <span class="t">' + esc(t('view.3d')) + '</span>';
    $('btnView').title = R.is3D ? t('view.to2d') : t('view.to3d');
    $('btnRotL').classList.toggle('hidden', !R.is3D);
    $('btnRotR').classList.toggle('hidden', !R.is3D);
  }

  // ======================= Werkzeuge =======================
  function buildToolbar() {
    const tb = $('toolbar');
    tb.innerHTML = '';
    let group = null;
    for (const tool of SC.TOOLS) {
      if (tool.group !== group) {
        group = tool.group;
        const h = document.createElement('div');
        h.className = 'tgroup'; h.textContent = tool.groupName;
        tb.appendChild(h);
      }
      const b = document.createElement('button');
      b.className = 'tool'; b.dataset.tool = tool.id;
      b.innerHTML = '<span class="ico">' + tool.icon + '</span><span class="lbl">' + esc(tool.name) + '</span>' +
        '<span class="cost">' + (tool.cost ? SC.fmtMoney(tool.cost) : '&nbsp;') + '</span>';
      b.title = tool.name + (tool.key ? ' [' + tool.key.toUpperCase() + ']' : '') + '\n' + (tool.desc || '');
      b.addEventListener('click', () => G.setTool(tool.id));
      b.classList.toggle('on', G.tool && G.tool.id === tool.id);
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
    box.innerHTML = '';
    for (const [key, icon, label] of OVERLAYS) {
      const b = document.createElement('button');
      const name = icon + ' ' + t(label);
      b.dataset.ov = key || '';
      b.textContent = name; b.title = name;
      b.addEventListener('click', () => G.setOverlay(key === G.overlay ? null : key));
      box.appendChild(b);
    }
    G.setOverlay(G.overlay);
  }
  G.setOverlay = function (key) {
    G.overlay = key;
    document.querySelectorAll('#overlays button').forEach(b => b.classList.toggle('on', (b.dataset.ov || null) === key));
    $('legend').innerHTML = key ? legend(key) : '';
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
      b.querySelector('.cost').textContent = locked ? t('tool.lockedShort', { n: bt.minPop }) : SC.fmtMoney(bt.cost);
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
      invalid = pv.tiles.every(p => p.c < 0);
      const d = G.drag;
      const dims = tool.drag === 'rect' ? (Math.abs(d.ex - d.sx) + 1) + '×' + (Math.abs(d.ey - d.sy) + 1) : t('pv.tiles', { n: pv.tiles.length });
      text = tool.name + ' · ' + dims + ' · ' + SC.fmtMoney(total);
    } else if (tool.building) {
      const bt = SC.BTYPES[tool.building];
      const o = buildingOrigin(G.hover, bt);
      const c = Act.check(s, tool, o.x, o.y);
      G.preview = { tiles: [{ x: o.x, y: o.y, c }], size: bt.size, radius: bt.radius, cx: o.x + bt.size / 2, cy: o.y + bt.size / 2 };
      total = c; invalid = c < 0;
      text = bt.name + ' · ' + (c === -2 ? t('pv.lockedFrom', { n: bt.minPop }) : c < 0 ? t('pv.notHere') : SC.fmtMoney(c));
    } else {
      const c = Act.check(s, tool, G.hover.x, G.hover.y);
      G.preview = { tiles: [{ x: G.hover.x, y: G.hover.y, c }] };
      total = c; invalid = c < 0;
      text = tool.name + ' · ' + (c < 0 ? t('pv.notHere') : SC.fmtMoney(c));
    }
    if (total > s.money) { invalid = true; text += ' · ' + t('pv.tooExpensive'); }
    tip.textContent = text;
    tip.classList.toggle('bad', invalid);
    tip.classList.remove('hidden');
    tip.style.left = (G.mouse.x + 16) + 'px';
    tip.style.top = (G.mouse.y + 18) + 'px';
  }

  function applyDrag() {
    const s = G.s, tool = G.tool;
    let spent = 0, noMoney = false, locked = false;
    for (const [x, y] of dragTiles()) {
      const r = Act.apply(s, tool, x, y);
      if (r > 0) spent += r;
      else if (r === -3) noMoney = true;
      else if (r === -2) locked = true;
    }
    finishAction(spent, noMoney, locked, false);
  }
  function placeBuilding(tile) {
    const s = G.s, bt = SC.BTYPES[G.tool.building];
    const o = buildingOrigin(tile, bt);
    const r = Act.apply(s, G.tool, o.x, o.y);
    if (r === -1) toast(t('toast.noSpace', { b: bt.name }), 'warn');
    finishAction(r > 0 ? r : 0, r === -3, r === -2, r > 0 ? bt : null);
  }
  function finishAction(spent, noMoney, locked, bt) {
    const s = G.s;
    if (spent > 0) floatText('−' + SC.fmtMoney(spent), true);
    if (noMoney) toast(t('toast.noMoney'), 'bad');
    if (locked) toast(t('toast.locked'), 'warn');
    if (bt && bt.power && !s.flags.firstPlant) {
      s.flags.firstPlant = true;
      toast(t('toast.firstPlant'), 'info', 7000);
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
      const tool = SC.TOOLS.find(tl => tl.key === k);
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
    const s = G.s, tile = G.infoTile, i = tile.y * s.W + tile.x, k = s.kind[i], ter = s.terrain[i];
    let title = '', html = '';
    const yes = '✅ ', no = '❌ ';
    const env = () =>
      row(t('i.landValue'), s.landValue[i] + meter(s.landValue[i] / 100, '#3fbf5a')) +
      row(t('i.pollution'), Math.round(s.pollution[i] / 2.55) + '%' + meter(s.pollution[i] / 255, '#ff7043')) +
      row(t('i.crime'), s.crime[i] + '%' + meter(s.crime[i] / 100, '#e53935')) +
      row(t('i.policeCov'), Math.round(s.cov.police[i] * 100) + '%' + meter(s.cov.police[i], '#3a8ef0')) +
      row(t('i.fireCov'), Math.round(s.cov.fire[i] * 100) + '%' + meter(s.cov.fire[i], '#3a8ef0'));
    if (k === K.ZONE) {
      const z = s.zone[i], l = s.lvl[i];
      title = SC.ZONE_NAMES[z] + ' – ' + t('lvl.' + z)[l];
      html += row(z === 1 ? t('i.residents') : t('i.jobs'), SC.fmtNum(SC.CAPACITY[z][l]));
      html += row(t('i.level'), l + ' / 3');
      html += row(t('i.power'), s.powered[i] ? yes + t('i.powered') : no + t('i.noPower'));
      html += row(t('i.roadAccess'), s.roadDist[i] <= 3 ? yes + t('i.yes') : no + t('i.noRoad'));
      html += env();
      if (z === 1) html += row(t('i.school'), Math.round(s.cov.school[i] * 100) + '%') + row(t('i.hospital'), Math.round(s.cov.hospital[i] * 100) + '%');
    } else if (k === K.BUILDING) {
      const b = SC.buildingAt(s, i), bt = SC.BTYPES[b.t];
      title = bt.icon + ' ' + esc(bt.name);
      html += row(t('i.upkeep'), t('i.perMonth', { v: SC.fmtMoney(bt.upkeep) }));
      if (bt.power) {
        html += row(t('i.output'), t('i.tiles', { n: bt.power }));
        html += row(t('i.grid'), SC.fmtNum(s.power.used) + ' / ' + SC.fmtNum(s.power.capacity));
        if (bt.pollution) html += row(t('i.env'), t('i.heavyPol'));
      } else if (bt.key !== 'park') {
        html += row(t('i.power'), s.powered[i] ? yes + t('i.powered') : no + t('i.noPower'));
      }
      if (bt.radius) html += row(t('i.range'), t('i.tiles', { n: bt.radius }));
      html += '<div class="note" style="margin-top:6px">' + esc(bt.desc) + '</div>';
    } else if (SC.isRoad(k)) {
      title = ter === T.WATER ? t('i.bridge') : t('i.road');
      if (k === K.ROADWIRE) title += t('i.withWire');
      html += row(t('i.traffic'), Math.round(s.traffic[i] / 2.55) + '%' + meter(s.traffic[i] / 160, '#ffb703'));
      html += row(t('i.upkeep'), t('i.perMonth', { v: SC.fmtMoney(ter === T.WATER ? 0.6 : 0.08, 2) }));
    } else if (k === K.WIRE) {
      title = t('i.wire');
      html += row(t('i.power'), s.powered[i] ? yes + t('i.live') : no + t('i.notConnected'));
    } else if (k === K.RUBBLE) {
      title = t('i.rubble');
      html += '<div class="note">' + t('i.rubbleHint') + '</div>';
    } else {
      title = ter === T.WATER ? t('i.water') : ter === T.TREES ? t('i.forest') : t('i.meadow');
      if (ter !== T.WATER) html += env();
    }
    if (s.fire[i]) html = '<div class="row" style="color:#ff8b84"><span>' + t('i.burning') + '</span><span></span></div>' + html;
    html += row(t('i.position'), tile.x + ', ' + tile.y);
    const p = $('infoPanel');
    p.innerHTML = '<button class="close" title="' + esc(t('btn.close')) + '">✕</button><h3>' + title + '</h3>' + html;
    p.querySelector('.close').addEventListener('click', closeInfo);
    p.classList.remove('hidden');
  }

  // ======================= Meldungen =======================
  function onNotify(entry) {
    setTicker(entry);
    if (entry.type === 'bad' || entry.type === 'good') toast(SC.msgText(entry), entry.type);
  }
  function setTicker(entry) {
    const tk = $('ticker');
    tk.className = entry.type || '';
    tk.innerHTML = '<span class="d">' + esc(SC.msgDate(entry)) + '</span>' + esc(SC.msgText(entry));
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

  // ======================= Dialoge =======================
  function openDialog(title, body, opts) {
    opts = opts || {};
    if (opts.menu && !G.s) opts.noClose = true;
    const d = $('dialog');
    d.innerHTML = (title ? '<div class="dhead"><h2>' + title + '</h2>' + (opts.noClose ? '' : '<button class="x" title="' + esc(t('btn.close')) + '">✕</button>') + '</div>' : '') +
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
      '<p class="tag">' + t('app.tagline') + '</p>';
    if (G.s) html += '<button class="btn primary mbtn" data-a="resume">▶ ' + t('menu.resume') + '</button>';
    else if (auto) html += '<button class="btn primary mbtn" data-a="continue">▶ ' + t('menu.continue') + '<span class="cont">' +
      esc(auto.city) + ' · ' + esc(auto.date) + ' · ' + t('menu.residents', { n: auto.pop }) + '</span></button>';
    html += '<button class="btn mbtn' + (!G.s && !auto ? ' primary' : '') + '" data-a="new">🏗️ ' + t('menu.new') + '</button>' +
      '<button class="btn mbtn" data-a="load">📂 ' + t('menu.load') + '</button>' +
      '<button class="btn mbtn" data-a="import">📥 ' + t('menu.import') + '</button>' +
      (G.s ? '<button class="btn mbtn" data-a="settings">⚙️ ' + t('menu.settings') + '</button>' : '') +
      '<button class="btn mbtn" data-a="help">❓ ' + t('menu.help') + '</button>' +
      '<div class="langRow"><span class="note">🌐 ' + t('menu.language') + '</span>' + langPicker('menuLang') + '</div>' +
      '<p class="note" style="margin-top:14px">' + t('menu.offline') + '</p></div>';
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
    bindLangPicker('menuLang', showMainMenu);
  }

  // ---------- Neues Spiel ----------
  function showNewGame() {
    const names = t('ng.names');
    const seed = (Math.random() * 1e9) | 0;
    const money = n => SC.fmtMoney(n);
    const html =
      '<div class="newgame"><div class="form">' +
      '<label>' + t('ng.name') + '</label><input type="text" id="ngName" maxlength="40" value="' + esc(names[(Math.random() * names.length) | 0]) + '">' +
      '<label>' + t('ng.size') + '</label><select id="ngSize"><option value="64">' + t('ng.small') + ' (64×64)</option><option value="96" selected>' + t('ng.medium') + ' (96×96)</option><option value="128">' + t('ng.large') + ' (128×128)</option></select>' +
      '<label>' + t('ng.water') + '</label><select id="ngWater"><option value="0.3">' + t('ng.little') + '</option><option value="0.37" selected>' + t('ng.normal') + '</option><option value="0.44">' + t('ng.much') + '</option></select>' +
      '<label>' + t('ng.diff') + '</label><select id="ngDiff"><option value="50000">' + t('ng.easy') + ' (' + money(50000) + ')</option><option value="20000" selected>' + t('ng.normal') + ' (' + money(20000) + ')</option><option value="10000">' + t('ng.hard') + ' (' + money(10000) + ')</option></select>' +
      '<label>' + t('ng.disasters') + '</label><label><input type="checkbox" id="ngDis" checked> ' + t('ng.fires') + '</label>' +
      '<label>' + t('ng.seed') + '</label><div style="display:flex;gap:6px"><input type="number" id="ngSeed" value="' + seed + '"><button class="btn small" id="ngRnd" title="' + esc(t('ng.newMap')) + '">🎲</button></div>' +
      '</div><div><canvas class="preview" id="ngPrev" width="160" height="160"></canvas><div class="note" style="text-align:center;margin-top:4px">' + t('ng.preview') + '</div></div></div>' +
      '<div class="actions"><button class="btn" id="ngBack">' + t('btn.back') + '</button><button class="btn primary" id="ngGo">' + t('ng.go') + '</button></div>';
    const d = openDialog('🏗️ ' + t('ng.title'), html, { menu: true });
    const opts = () => ({
      name: $('ngName').value.trim() || t('app.defaultCity'), size: +$('ngSize').value, water: +$('ngWater').value,
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
      if (G.s && !confirm(t('ng.confirm'))) return;
      if (G.s) autosave(true);
      G.startGame(SC.newGame(opts()));
      toast(t('ng.tip'), 'info', 7000);
    });
    d.querySelector('#ngName').focus();
  }

  // ---------- Speichern / Laden ----------
  function quickSave() {
    if (!G.s) return;
    try { SC.Storage.save('auto', G.s, 'auto'); toast(t('toast.quickSaved'), 'good', 2000); }
    catch (e) { toast(t('toast.saveFail', { e: e.message }), 'bad'); }
  }
  function autosave(silent) {
    if (!G.s || !G.s.autosave) return;
    try {
      SC.Storage.save('auto', G.s, 'auto');
      if (!silent) toast(t('toast.autosaved'), 'info', 1800);
    } catch (e) { if (!silent) toast(t('toast.autosaveFail'), 'bad'); }
  }
  function loadSlot(id) {
    try {
      const s = SC.Storage.load(id);
      G.startGame(s);
      toast(t('toast.loaded', { name: s.name }), 'good', 2500);
    } catch (e) { toast(t('toast.loadFail', { e: e.message }), 'bad', 6000); }
  }
  const safeName = str => str.replace(/[^\wäöüÄÖÜß-]+/g, '_') || 'Heliotown';
  function fileName(s) {
    return safeName(s.name) + '_' + (s.year * 100 + s.month + 1) + '.heliotown.json';
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
        if (G.s && !confirm(t('confirm.import', { name: s.name }))) return;
        if (G.s) autosave(true);
        G.startGame(s);
        toast(t('toast.imported', { name: s.name }), 'good', 5000);
      } catch (err) { toast(t('toast.importFail', { e: err.message }), 'bad', 6000); }
    };
    rd.readAsText(f);
  }

  function showSaveLoad(mode) {
    const list = SC.Storage.list();
    let used = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('heliotown.')) used += (localStorage.getItem(k) || '').length; } } catch (e) { /* */ }
    const label = e => (e.id === 'auto' ? t('sl.autoLabel') : e.label);
    let html = '';
    if (G.s) html += '<div class="saveRow"><input type="text" id="slName" maxlength="40" value="' + esc(G.s.name) + ' – ' + esc(SC.dateStr(G.s)) + '">' +
      '<button class="btn primary" id="slSave">💾 ' + t('sl.save') + '</button></div>';
    html += '<div class="slots">';
    if (!list.length) html += '<p class="note">' + t('sl.none') + '</p>';
    for (const e of list) {
      const when = new Date(e.savedAt).toLocaleString(SC.locale(), { dateStyle: 'short', timeStyle: 'short' });
      html += '<div class="slot"><div class="meta"><b>' + (e.id === 'auto' ? '🔄 ' : '') + esc(label(e)) + '</b><small>' +
        esc(e.city) + ' · ' + esc(e.date) + ' · ' + SC.fmtNum(e.pop) + ' ' + t('sl.res') + ' · ' + SC.fmtMoney(e.money) + ' · ' + esc(e.size) + ' · ' + t('sl.savedAt', { t: when }) + '</small></div>' +
        '<button class="btn small primary" data-load="' + esc(e.id) + '">' + t('sl.load') + '</button>' +
        '<button class="btn small" data-exp="' + esc(e.id) + '" title="' + esc(t('sl.export')) + '">⬇</button>' +
        '<button class="btn small danger" data-del="' + esc(e.id) + '" title="' + esc(t('sl.delete')) + '">🗑</button></div>';
    }
    html += '</div><div class="actions" style="justify-content:space-between">' +
      '<span class="note">' + t('sl.used', { n: Math.round(used / 1024) }) + '</span><span style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" id="slImport">📥 ' + t('sl.importFile') + '</button>' +
      (G.s ? '<button class="btn" id="slExport">⬇ ' + t('sl.exportCurrent') + '</button>' : '') +
      (!G.s ? '<button class="btn" id="slBack">' + t('btn.back') + '</button>' : '') + '</span></div>' +
      '<p class="note">' + t('sl.note') + '</p>';
    const d = openDialog(mode === 'save' ? '💾 ' + t('sl.titleSave') : '📂 ' + t('sl.titleLoad'), html, { menu: !G.s });
    if (G.s) {
      $('slSave').addEventListener('click', () => {
        const name = $('slName').value.trim() || G.s.name;
        const ex = list.find(e => e.label === name && e.id !== 'auto');
        if (ex && !confirm(t('confirm.overwrite', { name }))) return;
        try {
          SC.Storage.save(ex ? ex.id : 'save_' + Date.now(), G.s, name);
          toast(t('toast.savedAs', { name }), 'good', 2500);
          showSaveLoad(mode);
        } catch (e) { toast(t('toast.saveFull'), 'bad', 6000); }
      });
      $('slExport').addEventListener('click', () => download(fileName(G.s), JSON.stringify(SC.serialize(G.s))));
    }
    if ($('slBack')) $('slBack').addEventListener('click', showMainMenu);
    $('slImport').addEventListener('click', () => $('fileInput').click());
    d.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
      if (G.s && !confirm(t('confirm.load'))) return;
      if (G.s && b.dataset.load !== 'auto') autosave(true);
      loadSlot(b.dataset.load);
    }));
    d.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => {
      const raw = SC.Storage.raw(b.dataset.exp);
      const e = list.find(x => x.id === b.dataset.exp);
      if (raw) download(safeName(e.city || '') + '_' + safeName(e.date || '') + '.heliotown.json', raw);
    }));
    d.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const e = list.find(x => x.id === b.dataset.del);
      if (!confirm(t('confirm.delete', { name: label(e) }))) return;
      SC.Storage.remove(b.dataset.del);
      showSaveLoad(mode);
    }));
  }

  // ---------- Haushalt ----------
  function showBudget() {
    const s = G.s;
    const html = '<div class="form" style="grid-template-columns:140px 1fr 50px">' +
      '<label>' + t('bd.tax') + '</label><input type="range" id="bTax" min="0" max="20" step="1" value="' + s.tax + '"><b id="bTaxV">' + s.tax + '%</b></div>' +
      '<p class="note" id="bTaxHint"></p><table class="tbl" id="bTable"></table>' +
      '<p class="note">' + t('bd.note') + '</p>' +
      '<div class="actions"><button class="btn primary" id="bOk">' + t('btn.ok') + '</button></div>';
    openDialog('💰 ' + t('bd.title'), html);
    const render = () => {
      Sim.computeDemand(s);
      const b = Sim.estimateBudget(s);
      $('bTaxV').textContent = s.tax + '%';
      $('bTaxHint').textContent = t(s.tax <= 4 ? 'bd.hint1' : s.tax <= 8 ? 'bd.hint2' : s.tax <= 12 ? 'bd.hint3' : 'bd.hint4');
      const r = (n, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + n + '</td><td class="num ' + (v < 0 ? 'negc' : v > 0 ? 'pos' : '') + '">' + SC.fmtMoney(v) + '</td></tr>';
      $('bTable').innerHTML =
        '<tr><td colspan="2" class="note">' + t('bd.forecastMonth') + '</td></tr>' +
        r('🏛️ ' + t('bd.taxIncome'), b.income) + r('🛣️ ' + t('bd.roads'), -b.roads) + r('⚡ ' + t('bd.plants'), -b.power) +
        r('🏥 ' + t('bd.services'), -b.services) + r(t('bd.net'), b.net, 'sum') + r(t('bd.year'), b.net * 12) +
        '<tr><td>' + t('bd.last') + '</td><td class="num ' + (s.budget.net < 0 ? 'negc' : 'pos') + '">' + SC.fmtMoney(s.budget.net || 0) + '</td></tr>' +
        '<tr class="sum"><td>💶 ' + t('bd.cash') + '</td><td class="num">' + SC.fmtMoney(s.money) + '</td></tr>';
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
      row(t('st.pop'), SC.fmtNum(st.pop)) + row(t('st.size'), SC.cityClass(st.pop)) +
      row(t('st.jobsC'), SC.fmtNum(st.jobsC)) + row(t('st.jobsI'), SC.fmtNum(st.jobsI)) +
      row(t('st.zR'), SC.fmtNum(st.zones[1])) + row(t('st.zC'), SC.fmtNum(st.zones[2])) +
      row(t('st.zI'), SC.fmtNum(st.zones[3])) + row(t('st.roads'), SC.fmtNum(st.roads + st.bridges)) +
      row(t('st.power'), SC.fmtNum(s.power.demand) + ' / ' + SC.fmtNum(s.power.capacity)) + row(t('st.unpowered'), SC.fmtNum(st.unpowered)) +
      row(t('st.pf'), count('police') + ' / ' + count('fire')) + row(t('st.sh'), count('school') + ' / ' + count('hospital')) +
      '</div><div class="sidehead">' + t('st.chPop') + '</div><canvas class="chart" id="chPop"></canvas>' +
      '<div class="sidehead">' + t('st.chMoney') + '</div><canvas class="chart" id="chMoney"></canvas>' +
      '<div class="sidehead">' + t('st.news') + '</div><div class="log">' +
      s.log.slice().reverse().map(e => '<div class="' + e.type + '"><span class="note">' + esc(SC.msgDate(e)) + '</span> ' + esc(SC.msgText(e)) + '</div>').join('') + '</div>';
    openDialog('📈 ' + t('st.title') + ' – ' + esc(s.name), html, { width: '680px' });
    chart($('chPop'), s.history.map(h => h.pop), '#3fbf5a', v => SC.fmtNum(v));
    chart($('chMoney'), s.history.map(h => h.money), '#ffb703', v => SC.fmtMoney(v));
  }
  function chart(cv, data, color, fmt) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.font = '11px system-ui, sans-serif'; c.fillStyle = '#9aa7b8';
    if (data.length < 2) { c.fillText(t('ch.few'), 12, h / 2); return; }
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
    c.fillText(t('ch.last', { n: pts.length }), L, h - 4);
  }

  // ---------- Einstellungen ----------
  function showSettings() {
    const s = G.s;
    const html = '<div class="form">' +
      '<label>' + t('se.city') + '</label><input type="text" id="seName" maxlength="40" value="' + esc(s.name) + '">' +
      '<label>' + t('se.disasters') + '</label><label><input type="checkbox" id="seDis"' + (s.disasters ? ' checked' : '') + '> ' + t('se.fires') + '</label>' +
      '<label>' + t('se.autosave') + '</label><label><input type="checkbox" id="seAuto"' + (s.autosave ? ' checked' : '') + '> ' + t('se.autoDesc') + '</label>' +
      '<label>' + t('se.language') + '</label>' + langPicker('seLang') +
      '</div><div class="actions"><button class="btn" id="seBack">' + t('btn.back') + '</button><button class="btn primary" id="seOk">' + t('se.apply') + '</button></div>';
    openDialog('⚙️ ' + t('se.title'), html, { menu: true });
    bindLangPicker('seLang', showSettings);
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
    const html = '<div class="help">' + t('help.html') + '</div>' +
      '<div class="actions"><button class="btn primary" id="hOk">' + t('help.go') + '</button></div>';
    openDialog('❓ ' + t('help.title'), html, { menu: !G.s });
    $('hOk').addEventListener('click', () => (G.s ? closeDialog() : showMainMenu()));
  }
})(window.SC);
