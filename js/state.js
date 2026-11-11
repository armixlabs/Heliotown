'use strict';
/* Heliotown – Spielstand, Kartengenerierung, Bauaktionen, Speichern/Laden */
(function (SC) {
  const K = SC.KIND, T = SC.TER;

  // ---------- Spielstand ----------
  SC.createState = function (opts) {
    const W = opts.W, H = opts.H, N = W * H;
    const s = {
      v: SC.VERSION, name: opts.name || 'Heliotown', W, H, N, seed: (opts.seed >>> 0),
      money: opts.money != null ? opts.money : 20000, tax: 7, day: 1, month: 0, year: 2025,
      disasters: opts.disasters !== false, autosave: true,
      terrain: new Uint8Array(N), kind: new Uint8Array(N), zone: new Uint8Array(N),
      lvl: new Uint8Array(N), vari: new Uint8Array(N), fire: new Uint8Array(N),
      buildings: [], history: [], log: [], flags: {}, advisor: {},
      budget: { income: 0, expenses: 0, roads: 0, services: 0, power: 0, net: 0 },
      demand: { r: 0.7, c: 0.5, i: 0.6 },
      stats: { pop: 0, jobsC: 0, jobsI: 0 },
      scanPos: 0
    };
    SC.allocDerived(s);
    return s;
  };

  // Abgeleitete (nicht gespeicherte) Karten anlegen
  SC.allocDerived = function (s) {
    const N = s.N = s.W * s.H;
    s.origin = new Int32Array(N).fill(-1);
    s.powered = new Uint8Array(N);
    s.roadDist = new Uint8Array(N).fill(255);
    s.pollution = new Uint8Array(N);
    s.crime = new Uint8Array(N);
    s.landValue = new Uint8Array(N).fill(30);
    s.traffic = new Uint8Array(N);
    s.cov = {
      police: new Float32Array(N), fire: new Float32Array(N), school: new Float32Array(N),
      hospital: new Float32Array(N), park: new Float32Array(N), leisure: new Float32Array(N)
    };
    s.power = { capacity: 0, used: 0, demand: 0 };
    s.burning = [];
    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t], o = b.y * s.W + b.x;
      for (let dy = 0; dy < bt.size; dy++)
        for (let dx = 0; dx < bt.size; dx++) s.origin[(b.y + dy) * s.W + b.x + dx] = o;
    }
    for (let i = 0; i < N; i++) if (s.fire[i]) s.burning.push(i);
    s.changed = true;
  };

  SC.buildingAt = function (s, i) {
    const o = s.origin[i];
    if (o < 0) return null;
    const x = o % s.W, y = (o / s.W) | 0;
    return s.buildings.find(b => b.x === x && b.y === y) || null;
  };

  // ---------- Kartengenerierung ----------
  function makeNoise(rand, W, H, cell) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const g = new Float32Array(gw * gh);
    for (let k = 0; k < g.length; k++) g[k] = rand();
    return function (x, y) {
      const gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy);
      let fx = gx - ix, fy = gy - iy;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  SC.generateTerrain = function (s, opts) {
    opts = opts || {};
    const rand = SC.mulberry32(s.seed || 1);
    const W = s.W, H = s.H;
    const n1 = makeNoise(rand, W, H, 26), n2 = makeNoise(rand, W, H, 11), n3 = makeNoise(rand, W, H, 4);
    const f1 = makeNoise(rand, W, H, 13), f2 = makeNoise(rand, W, H, 5);
    const waterLevel = opts.water != null ? opts.water : 0.37;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let h = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
        const cx = (x - W / 2) / (W / 2), cy = (y - H / 2) / (H / 2);
        h += 0.09 * (1 - Math.min(1, Math.sqrt(cx * cx + cy * cy)));
        if (h < waterLevel) s.terrain[i] = T.WATER;
        else {
          const f = f1(x, y) * 0.7 + f2(x, y) * 0.3;
          if ((f > 0.58 && rand() < 0.9) || rand() < 0.015) s.terrain[i] = T.TREES;
          else s.terrain[i] = T.GRASS;
        }
      }
    }
    // Fluss
    if (opts.river !== false && rand() < 0.8) {
      const vertical = rand() < 0.5;
      let x = vertical ? W * (0.2 + rand() * 0.6) : 0;
      let y = vertical ? 0 : H * (0.2 + rand() * 0.6);
      let ang = vertical ? Math.PI / 2 : 0;
      const base = ang;
      const width = 1 + (rand() < 0.5 ? 1 : 0);
      for (let step = 0; step < W * 3; step++) {
        for (let dy = -width; dy <= width; dy++)
          for (let dx = -width; dx <= width; dx++) {
            if (dx * dx + dy * dy > width * width + 1) continue;
            const xx = Math.round(x) + dx, yy = Math.round(y) + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H) s.terrain[yy * W + xx] = T.WATER;
          }
        ang += (rand() - 0.5) * 0.35;
        ang = base + SC.clamp(ang - base, -0.9, 0.9);
        x += Math.cos(ang); y += Math.sin(ang);
        if (x < -2 || y < -2 || x > W + 2 || y > H + 2) break;
      }
    }
  };

  SC.newGame = function (opts) {
    const s = SC.createState({ W: opts.size, H: opts.size, name: opts.name, seed: opts.seed, money: opts.money, disasters: opts.disasters });
    SC.generateTerrain(s, { water: opts.water });
    SC.notify(s, 'Willkommen in ' + s.name + '! Baue ein Kraftwerk, Straßen und Zonen.', 'good');
    return s;
  };

  // ---------- Bauaktionen ----------
  const isRoad = k => k === K.ROAD || k === K.ROADWIRE;
  SC.isRoad = isRoad;
  SC.isConductor = k => k !== K.EMPTY && k !== K.RUBBLE; // Straßen, Leitungen, Zonen und Gebäude leiten Strom

  const Act = SC.Act = {};

  function treeCost(s, i) { return s.terrain[i] === T.TREES ? SC.COST.trees : 0; }

  // Liefert Kosten (>=0), -1 = nicht möglich, -2 = gesperrt
  Act.check = function (s, tool, x, y) {
    if (tool.building) return Act.checkBuilding(s, SC.BTYPES[tool.building], x, y);
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) return -1;
    const i = y * s.W + x, k = s.kind[i], ter = s.terrain[i];
    const rub = k === K.RUBBLE ? SC.COST.rubble : 0;
    switch (tool.id) {
      case 'road':
        if (isRoad(k)) return 0;
        if (k === K.EMPTY || k === K.RUBBLE || k === K.WIRE || (k === K.ZONE && s.lvl[i] === 0)) {
          if (ter === T.WATER) return SC.COST.bridge;
          return SC.COST.road + treeCost(s, i) + rub;
        }
        return -1;
      case 'wire':
        if (k !== K.EMPTY && k !== K.RUBBLE) return 0;
        if (k === K.EMPTY || k === K.RUBBLE) return ter === T.WATER ? SC.COST.wireWater : SC.COST.wire + treeCost(s, i) + rub;
        return -1;
      case 'zoneR': case 'zoneC': case 'zoneI':
        if (ter === T.WATER) return -1;
        if (k === K.ZONE) return s.zone[i] === tool.zone ? 0 : (s.lvl[i] === 0 ? SC.COST.zone : -1);
        if (k === K.EMPTY || k === K.RUBBLE) return SC.COST.zone + treeCost(s, i) + rub;
        return -1;
      case 'bulldoze':
        if (s.fire[i]) return SC.COST.bulldoze;
        if (k === K.EMPTY) return ter === T.TREES ? SC.COST.trees : 0;
        if (k === K.ZONE) return s.lvl[i] > 0 ? SC.COST.bulldoze * s.lvl[i] : 1;
        if (k === K.BUILDING) return SC.COST.demolish;
        return SC.COST.bulldoze;
    }
    return -1;
  };

  Act.checkBuilding = function (s, bt, x, y) {
    if (bt.minPop && s.stats.pop < bt.minPop && !s.flags['unlock_' + bt.key]) return -2;
    let cost = bt.cost;
    for (let dy = 0; dy < bt.size; dy++)
      for (let dx = 0; dx < bt.size; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= s.W || yy >= s.H) return -1;
        const i = yy * s.W + xx, k = s.kind[i];
        if (s.terrain[i] === T.WATER || s.fire[i]) return -1;
        if (k === K.EMPTY) cost += treeCost(s, i);
        else if (k === K.RUBBLE) cost += SC.COST.rubble;
        else if (k === K.ZONE && s.lvl[i] === 0) cost += 0;
        else return -1;
      }
    return cost;
  };

  // Führt Aktion aus. Rückgabe: Kosten, -1 ungültig, -2 gesperrt, -3 kein Geld
  Act.apply = function (s, tool, x, y) {
    const c = Act.check(s, tool, x, y);
    if (c < 0) return c;
    if (c > 0 && c > s.money) return -3;
    if (tool.building) { Act.placeBuilding(s, SC.BTYPES[tool.building], x, y); s.money -= c; s.changed = true; return c; }
    const i = y * s.W + x, k = s.kind[i];
    switch (tool.id) {
      case 'road':
        if (c === 0) return 0;
        if (k === K.WIRE) s.kind[i] = K.ROADWIRE;
        else { s.kind[i] = K.ROAD; s.zone[i] = 0; s.lvl[i] = 0; }
        if (s.terrain[i] === T.TREES) s.terrain[i] = T.GRASS;
        break;
      case 'wire':
        if (c === 0) return 0;
        s.kind[i] = K.WIRE;
        if (s.terrain[i] === T.TREES) s.terrain[i] = T.GRASS;
        break;
      case 'zoneR': case 'zoneC': case 'zoneI':
        if (c === 0) return 0;
        s.kind[i] = K.ZONE; s.zone[i] = tool.zone; s.lvl[i] = 0;
        s.vari[i] = (Math.random() * 256) | 0;
        if (s.terrain[i] === T.TREES) s.terrain[i] = T.GRASS;
        break;
      case 'bulldoze':
        if (c === 0) return 0;
        Act.bulldoze(s, i);
        break;
    }
    s.money -= c;
    s.changed = true;
    return c;
  };

  Act.bulldoze = function (s, i) {
    const k = s.kind[i];
    s.fire[i] = 0;
    if (k === K.BUILDING) Act.removeBuilding(s, i, K.EMPTY);
    else if (k === K.ZONE) { if (s.lvl[i] > 0) s.lvl[i] = 0; else { s.kind[i] = K.EMPTY; s.zone[i] = 0; } }
    else if (k !== K.EMPTY) { s.kind[i] = K.EMPTY; s.zone[i] = 0; s.lvl[i] = 0; }
    else if (s.terrain[i] === T.TREES) s.terrain[i] = T.GRASS;
    s.changed = true;
  };

  Act.placeBuilding = function (s, bt, x, y) {
    const o = y * s.W + x;
    for (let dy = 0; dy < bt.size; dy++)
      for (let dx = 0; dx < bt.size; dx++) {
        const i = (y + dy) * s.W + x + dx;
        s.kind[i] = K.BUILDING; s.zone[i] = 0; s.lvl[i] = bt.id; s.origin[i] = o;
        s.terrain[i] = T.GRASS; s.vari[i] = (Math.random() * 256) | 0;
      }
    s.buildings.push({ t: bt.id, x, y });
    s.changed = true;
  };

  Act.removeBuilding = function (s, i, newKind) {
    const b = SC.buildingAt(s, i);
    if (!b) return;
    const bt = SC.BTYPES[b.t];
    for (let dy = 0; dy < bt.size; dy++)
      for (let dx = 0; dx < bt.size; dx++) {
        const j = (b.y + dy) * s.W + b.x + dx;
        s.kind[j] = newKind; s.lvl[j] = 0; s.origin[j] = -1; s.fire[j] = 0;
      }
    s.buildings.splice(s.buildings.indexOf(b), 1);
    s.changed = true;
  };

  // Vorschaukosten für eine Liste von Feldern (Gebäude beim Abriss nur einmal zählen)
  Act.preview = function (s, tool, tiles) {
    let total = 0;
    const seen = new Set();
    const out = tiles.map(([x, y]) => {
      let c = Act.check(s, tool, x, y);
      if (tool.id === 'bulldoze' && c > 0) {
        const o = s.origin[y * s.W + x];
        if (o >= 0) { if (seen.has(o)) c = 0; else seen.add(o); }
      }
      if (c > 0) total += c;
      return { x, y, c };
    });
    return { tiles: out, total };
  };

  // ---------- Serialisierung ----------
  function rleEncode(u8) {
    const out = [];
    let i = 0;
    const n = u8.length;
    while (i < n) {
      const v = u8[i];
      let r = 1;
      while (i + r < n && u8[i + r] === v && r < 255) r++;
      out.push(r, v);
      i += r;
    }
    return Uint8Array.from(out);
  }
  function rleDecode(u8, n) {
    const out = new Uint8Array(n);
    let p = 0;
    for (let i = 0; i + 1 < u8.length && p < n; i += 2) {
      out.fill(u8[i + 1], p, Math.min(n, p + u8[i]));
      p += u8[i];
    }
    return out;
  }
  function toB64(u8) {
    let str = '';
    for (let i = 0; i < u8.length; i += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(str);
  }
  function fromB64(b64) {
    const str = atob(b64);
    const u8 = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) u8[i] = str.charCodeAt(i);
    return u8;
  }

  const MAPS = ['terrain', 'kind', 'zone', 'lvl', 'vari', 'fire'];
  const FIELDS = ['v', 'name', 'W', 'H', 'seed', 'money', 'tax', 'day', 'month', 'year', 'disasters', 'autosave',
    'buildings', 'history', 'log', 'flags', 'advisor', 'budget', 'demand', 'scanPos'];

  SC.serialize = function (s) {
    const o = { app: 'Heliotown' };
    for (const f of FIELDS) o[f] = s[f];
    o.maps = {};
    for (const m of MAPS) o.maps[m] = toB64(rleEncode(s[m]));
    return o;
  };

  SC.deserialize = function (o) {
    // 'SunCity' = früherer Name des Spiels; solche Spielstände bleiben ladbar
    if (!o || (o.app !== 'Heliotown' && o.app !== 'SunCity') || !o.maps || !o.W || !o.H) throw new Error('Keine gültige Heliotown-Spielstanddatei.');
    if (o.v > SC.VERSION) throw new Error('Der Spielstand stammt aus einer neueren Heliotown-Version.');
    const s = SC.createState({ W: o.W, H: o.H, name: o.name, seed: o.seed, money: o.money });
    for (const f of FIELDS) if (o[f] !== undefined) s[f] = o[f];
    s.v = SC.VERSION;
    for (const m of MAPS) s[m] = rleDecode(fromB64(o.maps[m]), s.N);
    s.buildings = (s.buildings || []).filter(b => SC.BTYPES[b.t]);
    SC.allocDerived(s);
    return s;
  };

  // ---------- Lokaler Speicher (localStorage) ----------
  const PREFIX = 'heliotown.v1.';
  const LEGACY_PREFIX = 'suncity.v1.'; // früherer Name des Spiels

  // Einmalige Übernahme von Spielständen und Einstellungen aus der Zeit als „SunCity“
  function migrateLegacy() {
    try {
      if (localStorage.getItem(PREFIX + 'index') || !localStorage.getItem(LEGACY_PREFIX + 'index')) return;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LEGACY_PREFIX) && k !== LEGACY_PREFIX + 'test') keys.push(k);
      }
      for (const k of keys) localStorage.setItem(PREFIX + k.slice(LEGACY_PREFIX.length), localStorage.getItem(k));
      // Alte Einträge erst entfernen, wenn alles kopiert ist
      for (const k of keys) localStorage.removeItem(k);
    } catch (e) { /* Speicher voll oder gesperrt: alte Daten bleiben unangetastet */ }
  }
  migrateLegacy();
  const Store = SC.Storage = {
    available() {
      try { localStorage.setItem(PREFIX + 'test', '1'); localStorage.removeItem(PREFIX + 'test'); return true; }
      catch (e) { return false; }
    },
    list() {
      try { return JSON.parse(localStorage.getItem(PREFIX + 'index') || '[]'); } catch (e) { return []; }
    },
    writeIndex(list) { localStorage.setItem(PREFIX + 'index', JSON.stringify(list)); },
    save(id, s, label) {
      const data = JSON.stringify(SC.serialize(s));
      localStorage.setItem(PREFIX + 'slot.' + id, data);
      const list = Store.list().filter(e => e.id !== id);
      list.push({ id, label: label || s.name, city: s.name, pop: s.stats.pop, money: s.money,
        date: SC.dateStr(s), savedAt: Date.now(), size: s.W + '×' + s.H, bytes: data.length });
      list.sort((a, b) => b.savedAt - a.savedAt);
      Store.writeIndex(list);
    },
    load(id) {
      const raw = localStorage.getItem(PREFIX + 'slot.' + id);
      if (!raw) throw new Error('Spielstand nicht gefunden.');
      return SC.deserialize(JSON.parse(raw));
    },
    raw(id) { return localStorage.getItem(PREFIX + 'slot.' + id); },
    remove(id) {
      localStorage.removeItem(PREFIX + 'slot.' + id);
      Store.writeIndex(Store.list().filter(e => e.id !== id));
    },
    getPref(key, def) {
      try { const v = localStorage.getItem(PREFIX + 'pref.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    setPref(key, val) { try { localStorage.setItem(PREFIX + 'pref.' + key, JSON.stringify(val)); } catch (e) { /* ignorieren */ } }
  };
})(window.SC);
