'use strict';
/* SunCity – Isometrische 3D-Ansicht (drehbar in 90°-Schritten) */
(function (SC) {
  const K = SC.KIND, T = SC.TER;
  const R = SC.RenderIso = {};
  let canvas, ctx, dpr = 1, skyGrad = null;
  const view = R.view = { x: 0, y: 0, ts: 32 }; // ts = halbe Kachelbreite in Pixeln
  R.rot = 0;
  R.MIN_TS = 4; R.MAX_TS = 80; R.DEFAULT_TS = 30;
  R.is3D = true;

  let TW2 = 32, TH2 = 16, ZS = 36, S = null;

  R.init = function (c) {
    canvas = c;
    ctx = c.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    dpr = window.devicePixelRatio || 1;
    R.cw = canvas.clientWidth; R.ch = canvas.clientHeight;
    skyGrad = null;
  };
  function setScale() { TW2 = view.ts; TH2 = view.ts / 2; ZS = view.ts * 1.15; }

  // ---------- Drehung ----------
  function dims(s) { return R.rot % 2 ? [s.H, s.W] : [s.W, s.H]; }
  function rotF(s, fx, fy) {
    switch (R.rot) {
      case 0: return [fx, fy];
      case 1: return [s.H - fy, fx];
      case 2: return [s.W - fx, s.H - fy];
      default: return [fy, s.W - fx];
    }
  }
  function unrotF(s, rx, ry) {
    switch (R.rot) {
      case 0: return [rx, ry];
      case 1: return [ry, s.H - rx];
      case 2: return [s.W - rx, s.H - ry];
      default: return [s.W - ry, rx];
    }
  }
  function rotDelta(dx, dy) {
    switch (R.rot) {
      case 0: return [dx, dy];
      case 1: return [-dy, dx];
      case 2: return [-dx, -dy];
      default: return [dy, -dx];
    }
  }
  // Kartenrechteck -> gedrehtes Weltrechteck [rx, ry, w, d]
  function mapRect(s, x, y, w, h) {
    const a = rotF(s, x, y), b = rotF(s, x + w, y + h);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])];
  }

  // ---------- Projektion ----------
  const PX = (wx, wy) => (wx - wy) * TW2 - view.x;
  const PY = (wx, wy, wz) => (wx + wy) * TH2 - wz * ZS - view.y;

  R.screenToMapF = function (s, sx, sy) {
    setScale();
    const a = (sx + view.x) / TW2, b = (sy + view.y) / TH2;
    return unrotF(s, (a + b) / 2, (b - a) / 2);
  };
  R.screenToTile = function (sx, sy) {
    const m = R.screenToMapF(S, sx, sy);
    return { x: Math.floor(m[0]), y: Math.floor(m[1]) };
  };
  R.centerOn = function (mx, my) {
    if (!S) return;
    setScale();
    const [wx, wy] = rotF(S, mx, my);
    view.x = (wx - wy) * TW2 - R.cw / 2;
    view.y = (wx + wy) * TH2 - R.ch / 2;
  };
  R.getCenter = function () { return S ? R.screenToMapF(S, R.cw / 2, R.ch / 2) : [0, 0]; };
  R.zoomAt = function (sx, sy, f) {
    if (!S) return;
    const m = R.screenToMapF(S, sx, sy);
    view.ts = SC.clamp(view.ts * f, R.MIN_TS, R.MAX_TS);
    setScale();
    const [wx, wy] = rotF(S, m[0], m[1]);
    view.x = (wx - wy) * TW2 - sx;
    view.y = (wx + wy) * TH2 - sy;
  };
  R.clampView = function (s) {
    S = s;
    const c = R.screenToMapF(s, R.cw / 2, R.ch / 2);
    const cx = SC.clamp(c[0], 0, s.W), cy = SC.clamp(c[1], 0, s.H);
    if (cx !== c[0] || cy !== c[1]) R.centerOn(cx, cy);
  };
  R.setState = function (s) { S = s; };
  R.rotate = function (dir) {
    if (!S) return;
    const c = R.getCenter();
    R.rot = (R.rot + dir + 4) % 4;
    R.centerOn(c[0], c[1]);
  };
  R.viewportCorners = function (s) {
    return [[0, 0], [R.cw, 0], [R.cw, R.ch], [0, R.ch]].map(p => R.screenToMapF(s, p[0], p[1]));
  };

  // ---------- Farben ----------
  const shadeCache = new Map();
  function shade(hex, f) {
    const key = hex + f;
    let c = shadeCache.get(key);
    if (c) return c;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    c = 'rgb(' + r + ',' + g + ',' + b + ')';
    shadeCache.set(key, c);
    return c;
  }
  const GRASS = ['#7bb84e', '#76b349', '#80bd53', '#79b54b'];
  const TREE = ['#2f7d38', '#3b8e3f', '#2b7033', '#469a43'];
  const R_ROOFS = ['#b9533c', '#94563a', '#a63d3d', '#646a78', '#b06d36', '#7a4f8a'];
  const R_WALLS = ['#efe2c8', '#e6d2ae', '#dcd6cc', '#f4ebdb', '#e8cfc0'];
  const GLASS = ['#5d8fc4', '#4aa0b0', '#7d86c4', '#3f74aa', '#8fb4d6'];
  const C_WALL = ['#d7dde4', '#e2dccf', '#cdd8d6'];
  const I_WALL = ['#a8a196', '#9c9fa3', '#b3a080'];
  const CARS = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2c3e50', '#e67e22', '#9b59b6'];

  // ---------- Grundformen ----------
  function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(PX(ax, ay), PY(ax, ay, az));
    ctx.lineTo(PX(bx, by), PY(bx, by, bz));
    ctx.lineTo(PX(cx, cy), PY(cx, cy, cz));
    ctx.lineTo(PX(dx, dy), PY(dx, dy, dz));
    ctx.closePath();
    ctx.fill();
  }
  function flat(wx, wy, w, d, z, color) { quad(wx, wy, z, wx + w, wy, z, wx + w, wy + d, z, wx, wy + d, z, color); }
  function shadow(wx, wy, w, d, h) {
    const l = Math.min(h * 0.55, 1.2);
    ctx.globalAlpha *= 0.22;
    quad(wx + w * 0.3, wy, 0.01, wx + w + l, wy - l * 0.3, 0.01, wx + w + l, wy + d - l * 0.3, 0.01, wx + w * 0.3, wy + d, 0.01, '#000');
    ctx.globalAlpha /= 0.22;
  }
  // Quader mit Dach (oben) sowie linker (+y) und rechter (+x) Seitenwand
  function box(wx, wy, w, d, z0, h, top, wall, noShadow) {
    const z1 = z0 + h;
    if (!noShadow && z0 === 0) shadow(wx, wy, w, d, h);
    quad(wx + w, wy, z0, wx + w, wy + d, z0, wx + w, wy + d, z1, wx + w, wy, z1, shade(wall, 0.72));
    quad(wx, wy + d, z0, wx + w, wy + d, z0, wx + w, wy + d, z1, wx, wy + d, z1, shade(wall, 0.92));
    quad(wx, wy, z1, wx + w, wy, z1, wx + w, wy + d, z1, wx, wy + d, z1, shade(top, 1.05));
  }
  // Fensterreihen auf den beiden sichtbaren Wänden
  function windows(wx, wy, w, d, z0, h, color, floorH, lit, seed) {
    if (TW2 < 12) return;
    const rows = Math.max(1, Math.floor(h / floorH));
    const colsL = Math.max(1, Math.round(w * 4)), colsR = Math.max(1, Math.round(d * 4));
    const fh = h / rows;
    for (let r = 0; r < rows; r++) {
      const za = z0 + fh * r + fh * 0.3, zb = z0 + fh * r + fh * 0.72;
      for (let c = 0; c < colsL; c++) {
        const u0 = wx + w * (c + 0.22) / colsL, u1 = wx + w * (c + 0.78) / colsL;
        const col = lit && SC.hash(seed + r * 31 + c) > 0.82 ? '#ffe9a0' : shade(color, 0.95);
        quad(u0, wy + d, za, u1, wy + d, za, u1, wy + d, zb, u0, wy + d, zb, col);
      }
      for (let c = 0; c < colsR; c++) {
        const v0 = wy + d * (c + 0.22) / colsR, v1 = wy + d * (c + 0.78) / colsR;
        const col = lit && SC.hash(seed + r * 17 + c + 99) > 0.82 ? '#f5dc8a' : shade(color, 0.7);
        quad(wx + w, v0, za, wx + w, v1, za, wx + w, v1, zb, wx + w, v0, zb, col);
      }
    }
  }
  function gableHouse(wx, wy, w, d, h, rh, roof, wall) {
    shadow(wx, wy, w, d, h + rh);
    const z1 = h, zr = h + rh, my = wy + d / 2;
    quad(wx + w, wy, 0, wx + w, wy + d, 0, wx + w, wy + d, z1, wx + w, wy, z1, shade(wall, 0.72));
    // Giebeldreieck rechts
    ctx.fillStyle = shade(wall, 0.72);
    ctx.beginPath();
    ctx.moveTo(PX(wx + w, wy), PY(wx + w, wy, z1));
    ctx.lineTo(PX(wx + w, wy + d), PY(wx + w, wy + d, z1));
    ctx.lineTo(PX(wx + w, my), PY(wx + w, my, zr));
    ctx.closePath(); ctx.fill();
    quad(wx, wy + d, 0, wx + w, wy + d, 0, wx + w, wy + d, z1, wx, wy + d, z1, shade(wall, 0.92));
    quad(wx, wy, z1, wx + w, wy, z1, wx + w, my, zr, wx, my, zr, shade(roof, 1.1));
    quad(wx, wy + d, z1, wx + w, wy + d, z1, wx + w, my, zr, wx, my, zr, shade(roof, 0.85));
    if (TW2 >= 14) {
      const dw = w * 0.18;
      quad(wx + w * 0.41, wy + d, 0, wx + w * 0.41 + dw, wy + d, 0, wx + w * 0.41 + dw, wy + d, h * 0.65, wx + w * 0.41, wy + d, h * 0.65, '#6b4b32');
    }
  }
  function pyramid(wx, wy, w, d, z, h, color) {
    const ax = wx + w / 2, ay = wy + d / 2, az = z + h;
    ctx.fillStyle = shade(color, 0.95);
    tri(wx, wy + d, z, wx + w, wy + d, z, ax, ay, az);
    ctx.fillStyle = shade(color, 0.7);
    tri(wx + w, wy, z, wx + w, wy + d, z, ax, ay, az);
  }
  function tri(ax, ay, az, bx, by, bz, cx, cy, cz) {
    ctx.beginPath();
    ctx.moveTo(PX(ax, ay), PY(ax, ay, az)); ctx.lineTo(PX(bx, by), PY(bx, by, bz)); ctx.lineTo(PX(cx, cy), PY(cx, cy, cz));
    ctx.closePath(); ctx.fill();
  }
  function circleAt(wx, wy, wz, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(PX(wx, wy), PY(wx, wy, wz), r, 0, Math.PI * 2); ctx.fill();
  }
  function smoke(wx, wy, wz, t, seed, big) {
    if (TW2 < 10) return;
    const x = PX(wx, wy), y = PY(wx, wy, wz), u = TW2 / 16;
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.00035 + seed * 0.013 + k / 4) % 1;
      const r = u * (big ? 2.2 : 1.4) * (0.6 + ph * 2.4);
      ctx.fillStyle = 'rgba(215,215,215,' + (0.55 * (1 - ph)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x + ph * u * 10, y - ph * u * (big ? 28 : 18), r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function bolt(cx, cy, sz) {
    ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + sz * 0.15, cy - sz * 0.6); ctx.lineTo(cx - sz * 0.35, cy + sz * 0.1);
    ctx.lineTo(cx - sz * 0.02, cy + sz * 0.1); ctx.lineTo(cx - sz * 0.15, cy + sz * 0.6);
    ctx.lineTo(cx + sz * 0.35, cy - sz * 0.1); ctx.lineTo(cx + sz * 0.02, cy - sz * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ---------- Boden ----------
  function roadAt(s, x, y) { return x >= 0 && y >= 0 && x < s.W && y < s.H && SC.isRoad(s.kind[y * s.W + x]); }
  function condAt(s, x, y) { return x >= 0 && y >= 0 && x < s.W && y < s.H && SC.isConductor(s.kind[y * s.W + x]); }
  // Seiten in gedrehten lokalen Koordinaten: 0:-x 1:+x 2:-y 3:+y
  function sideOf(dx, dy) { const [a, b] = rotDelta(dx, dy); return a < 0 ? 0 : a > 0 ? 1 : b < 0 ? 2 : 3; }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function drawRoad(s, x, y, rx, ry, t) {
    const water = s.terrain[y * s.W + x] === T.WATER;
    const conn = [false, false, false, false];
    for (const [dx, dy] of DIRS) if (roadAt(s, x + dx, y + dy)) conn[sideOf(dx, dy)] = true;
    const z = water ? 0.18 : 0.005;
    if (water) {
      box(rx + 0.4, ry + 0.4, 0.2, 0.2, -0.2, 0.38, '#8a8a85', '#8a8a85', true);
    }
    flat(rx, ry, 1, 1, z, water ? '#8d847a' : '#5a5e63');
    if (TW2 < 7) return;
    // Bordsteine an offenen Seiten
    const e = 0.07, cc = water ? '#d8d2c8' : '#b9bcbf';
    if (!conn[0]) flat(rx, ry, e, 1, z + 0.002, cc);
    if (!conn[1]) flat(rx + 1 - e, ry, e, 1, z + 0.002, cc);
    if (!conn[2]) flat(rx, ry, 1, e, z + 0.002, cc);
    if (!conn[3]) flat(rx, ry + 1 - e, 1, e, z + 0.002, cc);
    if (water && TW2 >= 10) {
      const rh = 0.1;
      if (!conn[1]) quad(rx + 1, ry, z, rx + 1, ry + 1, z, rx + 1, ry + 1, z + rh, rx + 1, ry, z + rh, '#c9c3b8');
      if (!conn[3]) quad(rx, ry + 1, z, rx + 1, ry + 1, z, rx + 1, ry + 1, z + rh, rx, ry + 1, z + rh, '#ddd7cc');
    }
    // Mittellinie
    if (TW2 >= 12) {
      const lw = 0.035;
      if ((conn[0] || conn[1]) && !(conn[2] || conn[3])) {
        flat(rx + 0.08, ry + 0.5 - lw / 2, 0.3, lw, z + 0.003, '#f2d46b');
        flat(rx + 0.62, ry + 0.5 - lw / 2, 0.3, lw, z + 0.003, '#f2d46b');
      } else if ((conn[2] || conn[3]) && !(conn[0] || conn[1])) {
        flat(rx + 0.5 - lw / 2, ry + 0.08, lw, 0.3, z + 0.003, '#f2d46b');
        flat(rx + 0.5 - lw / 2, ry + 0.62, lw, 0.3, z + 0.003, '#f2d46b');
      } else {
        // Kreuzung: Zebrastreifen-Andeutung
        ctx.globalAlpha *= 0.6;
        flat(rx + 0.3, ry + 0.3, 0.4, 0.4, z + 0.003, '#6a6e73');
        ctx.globalAlpha /= 0.6;
      }
    }
  }

  function drawGround(s, i, x, y, rx, ry, t) {
    const ter = s.terrain[i], k = s.kind[i];
    if (ter === T.WATER) {
      flat(rx, ry, 1, 1, 0, SC.hash(i) > 0.5 ? '#3b8ad2' : '#3683cb');
      if (TW2 >= 9) {
        const ph = Math.sin(t * 0.0013 + x * 0.9 + y * 0.7);
        if (ph > 0.5) flat(rx + 0.25, ry + 0.35 + ph * 0.1, 0.45, 0.06, 0.002, '#68ade8');
      }
    } else {
      let col = GRASS[(SC.hash(i) * 4) | 0];
      if (k === K.ZONE && s.lvl[i] > 0 && s.zone[i] !== 1) col = s.zone[i] === 2 ? '#b4b8bc' : '#a59f92';
      else if (k === K.BUILDING) {
        const bt = SC.BTYPES[s.lvl[i]];
        col = bt && (bt.key === 'park' || bt.key === 'solar' || bt.key === 'wind') ? '#86c45a' : bt && bt.key === 'coal' ? '#8f8c84' : '#bdbcb4';
      } else if (k === K.RUBBLE) col = '#8a7660';
      flat(rx, ry, 1, 1, 0, col);
    }
    if (SC.isRoad(k)) drawRoad(s, x, y, rx, ry, t);
    else if (k === K.ZONE) {
      const z = s.zone[i];
      if (s.lvl[i] === 0) {
        ctx.globalAlpha *= 0.3;
        flat(rx, ry, 1, 1, 0.001, SC.ZONE_COLORS[z]);
        ctx.globalAlpha /= 0.3;
        if (TW2 >= 8) {
          const m = 0.12, b = 0.05;
          const c = SC.ZONE_COLORS[z];
          flat(rx + m, ry + m, 1 - 2 * m, b, 0.002, c); flat(rx + m, ry + 1 - m - b, 1 - 2 * m, b, 0.002, c);
          flat(rx + m, ry + m, b, 1 - 2 * m, 0.002, c); flat(rx + 1 - m - b, ry + m, b, 1 - 2 * m, 0.002, c);
        }
      }
    } else if (k === K.RUBBLE && TW2 >= 10) {
      for (let q = 0; q < 4; q++) box(rx + 0.15 + SC.hash(i * 5 + q) * 0.6, ry + 0.15 + SC.hash(i * 7 + q) * 0.6, 0.12, 0.1, 0, 0.06, '#7a7066', '#6b6157', true);
    }
  }

  // ---------- Objekte ----------
  function drawTrees(i, rx, ry) {
    if (TW2 < 6) { flat(rx + 0.1, ry + 0.1, 0.8, 0.8, 0.01, TREE[0]); return; }
    const n = 2 + ((SC.hash(i) * 3) | 0);
    const pts = [];
    for (let k = 0; k < n; k++) pts.push([0.18 + 0.64 * SC.hash(i * 7 + k), 0.18 + 0.64 * ((SC.hash(i * 13 + k * 3) + k / n) % 1), k]);
    pts.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [u, v, k] of pts) {
      const wx = rx + u, wy = ry + v, r = TW2 * (0.2 + 0.1 * SC.hash(i * 3 + k)), h = 0.28 + 0.2 * SC.hash(i * 11 + k);
      ctx.globalAlpha *= 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(PX(wx + 0.12, wy), PY(wx + 0.12, wy, 0), r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.2;
      ctx.strokeStyle = '#5b3e24'; ctx.lineWidth = Math.max(1, TW2 / 18);
      ctx.beginPath(); ctx.moveTo(PX(wx, wy), PY(wx, wy, 0)); ctx.lineTo(PX(wx, wy), PY(wx, wy, h)); ctx.stroke();
      const col = TREE[(k + ((SC.hash(i) * 4) | 0)) % 4];
      const cx = PX(wx, wy), cy = PY(wx, wy, h);
      ctx.fillStyle = shade(col, 0.8); ctx.beginPath(); ctx.arc(cx + r * 0.15, cy + r * 0.1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx - r * 0.1, cy - r * 0.15, r * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWire(s, x, y, rx, ry) {
    const H = 0.75, cx = rx + 0.5, cy = ry + 0.5;
    ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = Math.max(1, TW2 / 14);
    ctx.beginPath(); ctx.moveTo(PX(cx, cy), PY(cx, cy, 0)); ctx.lineTo(PX(cx, cy), PY(cx, cy, H)); ctx.stroke();
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(0.7, TW2 / 30);
    ctx.beginPath();
    for (const [dx, dy] of DIRS) {
      if (!condAt(s, x + dx, y + dy)) continue;
      const [a, b] = rotDelta(dx, dy);
      ctx.moveTo(PX(cx, cy), PY(cx, cy, H));
      ctx.lineTo(PX(cx + a * 0.5, cy + b * 0.5), PY(cx + a * 0.5, cy + b * 0.5, H - 0.05));
    }
    ctx.stroke();
    flat(cx - 0.18, cy - 0.03, 0.36, 0.06, H, '#5a3d24');
  }

  const ZH = [0, 0.4, 0.8, 2.2];
  function drawZone(s, i, rx, ry, t) {
    const z = s.zone[i], l = s.lvl[i], v = s.vari[i];
    if (TW2 < 6) { box(rx + 0.15, ry + 0.15, 0.7, 0.7, 0, ZH[l] * 0.6, SC.ZONE_COLORS[z], SC.ZONE_COLORS[z], true); return; }
    if (z === 1) {
      const roof = R_ROOFS[v % R_ROOFS.length], wall = R_WALLS[(v >> 3) % R_WALLS.length];
      if (l === 1) {
        if (v & 2) circleAt(rx + 0.78, ry + 0.22, 0.3, TW2 * 0.2, TREE[1]);
        gableHouse(rx + 0.08, ry + 0.1, 0.42, 0.36, 0.22, 0.16, roof, wall);
        gableHouse(rx + 0.5, ry + 0.52, 0.4, 0.38, 0.22, 0.15, R_ROOFS[(v + 2) % R_ROOFS.length], wall);
        if (!(v & 2)) circleAt(rx + 0.25, ry + 0.78, 0.25, TW2 * 0.18, TREE[2]);
      } else if (l === 2) {
        const h = 0.55 + (v % 3) * 0.1;
        box(rx + 0.12, ry + 0.14, 0.76, 0.72, 0, h, '#8f949c', wall);
        windows(rx + 0.12, ry + 0.14, 0.76, 0.72, 0, h, '#5d7894', 0.18, false, i);
        if (v & 1) flat(rx + 0.3, ry + 0.3, 0.2, 0.2, h + 0.002, roof);
      } else {
        const h = 1.6 + (v % 4) * 0.25;
        box(rx + 0.18, ry + 0.18, 0.64, 0.64, 0, h, '#7f848e', wall);
        windows(rx + 0.18, ry + 0.18, 0.64, 0.64, 0, h, '#5d7894', 0.16, true, i);
        box(rx + 0.32, ry + 0.32, 0.3, 0.3, h, 0.12, roof, roof, true);
      }
    } else if (z === 2) {
      const glass = GLASS[v % GLASS.length], wall = C_WALL[v % 3];
      if (l === 1) {
        box(rx + 0.1, ry + 0.15, 0.8, 0.72, 0, 0.3, '#c9ced4', wall);
        const aw = ['#e74c3c', '#27ae60', '#2980b9', '#f39c12'][v % 4];
        quad(rx + 0.1, ry + 0.87, 0.2, rx + 0.9, ry + 0.87, 0.2, rx + 0.9, ry + 0.97, 0.16, rx + 0.1, ry + 0.97, 0.16, aw);
        if (TW2 >= 12) quad(rx + 0.15, ry + 0.871, 0.03, rx + 0.85, ry + 0.871, 0.03, rx + 0.85, ry + 0.871, 0.15, rx + 0.15, ry + 0.871, 0.15, shade(glass, 1.1));
      } else if (l === 2) {
        const h = 0.85 + (v % 3) * 0.15;
        box(rx + 0.1, ry + 0.1, 0.8, 0.8, 0, h, '#c3cbd3', glass);
        windows(rx + 0.1, ry + 0.1, 0.8, 0.8, 0, h, '#d6ecff', 0.17, false, i);
      } else {
        const h = 2.4 + (v % 5) * 0.35;
        box(rx + 0.08, ry + 0.08, 0.84, 0.84, 0, 0.3, '#cfd6dc', wall);
        box(rx + 0.2, ry + 0.2, 0.6, 0.6, 0.3, h, '#dce4ec', glass);
        windows(rx + 0.2, ry + 0.2, 0.6, 0.6, 0.3, h, '#cfe8ff', 0.15, true, i);
        if (v % 3 === 0) pyramid(rx + 0.2, ry + 0.2, 0.6, 0.6, 0.3 + h, 0.5, '#d9dee6');
        else {
          box(rx + 0.3, ry + 0.3, 0.4, 0.4, 0.3 + h, 0.15, '#bfc7cf', '#9aa4ae', true);
          if (((t / 600) | 0) % 2) circleAt(rx + 0.5, ry + 0.5, 0.3 + h + 0.45, Math.max(1.5, TW2 / 18), '#ff3b30');
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(PX(rx + 0.5, ry + 0.5), PY(rx + 0.5, ry + 0.5, 0.45 + h)); ctx.lineTo(PX(rx + 0.5, ry + 0.5), PY(rx + 0.5, ry + 0.5, 0.75 + h)); ctx.stroke();
        }
      }
    } else {
      const wall = I_WALL[v % 3], powered = s.powered[i];
      if (l === 1) {
        box(rx + 0.1, ry + 0.15, 0.8, 0.7, 0, 0.28, '#9d978b', wall);
        if (TW2 >= 10) for (let q = 0; q < 4; q++) flat(rx + 0.12 + q * 0.2, ry + 0.17, 0.07, 0.66, 0.282, '#7d776c');
      } else if (l === 2) {
        box(rx + 0.08, ry + 0.2, 0.62, 0.68, 0, 0.42, '#99938a', wall);
        box(rx + 0.77, ry + 0.27, 0.1, 0.1, 0, 0.8, '#555', '#a04535');
        if (powered) smoke(rx + 0.82, ry + 0.32, 0.8, t, v, false);
      } else {
        box(rx + 0.05, ry + 0.3, 0.9, 0.62, 0, 0.5, '#938d84', wall);
        // Silo
        box(rx + 0.08, ry + 0.06, 0.22, 0.22, 0, 0.8, '#d0c8b2', '#c9c1aa');
        box(rx + 0.56, ry + 0.08, 0.11, 0.11, 0, 1.15, '#555', '#a04535');
        box(rx + 0.79, ry + 0.08, 0.11, 0.11, 0, 0.95, '#555', '#a04535');
        if (powered) { smoke(rx + 0.615, ry + 0.135, 1.15, t, v, true); smoke(rx + 0.845, ry + 0.135, 0.95, t, v + 40, false); }
      }
    }
  }

  function drawService(s, b, rx, ry, t) {
    const bt = SC.BTYPES[b.t], Sz = bt.size, v = s.vari[b.y * s.W + b.x];
    switch (bt.key) {
      case 'coal': {
        ctx.fillStyle = '#26262a';
        ctx.beginPath(); ctx.ellipse(PX(rx + 0.7, ry + 2.3), PY(rx + 0.7, ry + 2.3, 0.05), TW2 * 0.7, TH2 * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        box(rx + 0.2, ry + 0.3, 1.7, 1.4, 0, 0.75, '#9a9992', '#8c8a83');
        windows(rx + 0.2, ry + 0.3, 1.7, 1.4, 0, 0.75, '#3f4246', 0.35, false, b.x);
        box(rx + 2.05, ry + 0.25, 0.3, 0.3, 0, 2.6, '#cfcfc8', '#c0392b');
        box(rx + 2.05, ry + 1.15, 0.3, 0.3, 0, 2.3, '#cfcfc8', '#c0392b');
        if (TW2 >= 8) {
          box(rx + 2.05, ry + 0.25, 0.3, 0.3, 1.9, 0.25, '#eee', '#eeeeee', true);
          box(rx + 2.05, ry + 1.15, 0.3, 0.3, 1.6, 0.25, '#eee', '#eeeeee', true);
        }
        smoke(rx + 2.2, ry + 0.4, 2.6, t, v, true);
        smoke(rx + 2.2, ry + 1.3, 2.3, t, v + 33, true);
        break;
      }
      case 'solar': {
        for (let r = 0; r < 6; r++) {
          const y0 = ry + 0.12 + r * 0.47;
          for (let c = 0; c < 3; c++) {
            const x0 = rx + 0.08 + c * 0.97;
            quad(x0, y0, 0.06, x0 + 0.86, y0, 0.06, x0 + 0.86, y0 + 0.32, 0.2, x0, y0 + 0.32, 0.2, '#1e3a6e');
            if (TW2 >= 10) {
              for (let q = 1; q < 4; q++) {
                const xx = x0 + 0.86 * q / 4;
                quad(xx, y0, 0.061, xx + 0.012, y0, 0.061, xx + 0.012, y0 + 0.32, 0.201, xx, y0 + 0.32, 0.201, '#5d88cf');
              }
              quad(x0, y0 + 0.24, 0.17, x0 + 0.86, y0 + 0.24, 0.17, x0 + 0.86, y0 + 0.32, 0.2, x0, y0 + 0.32, 0.2, '#8fb3ea');
            }
          }
        }
        box(rx + 2.55, ry + 2.55, 0.35, 0.35, 0, 0.3, '#ddd', '#cfd2d6');
        break;
      }
      case 'wind': {
        const cx = rx + 0.5, cy = ry + 0.5, H = 2.4;
        ctx.globalAlpha *= 0.2; flat(cx, cy - 0.05, 0.9, 0.1, 0.01, '#000'); ctx.globalAlpha /= 0.2;
        ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = Math.max(1.5, TW2 / 9);
        ctx.beginPath(); ctx.moveTo(PX(cx, cy), PY(cx, cy, 0)); ctx.lineTo(PX(cx, cy), PY(cx, cy, H)); ctx.stroke();
        const hx = PX(cx, cy), hy = PY(cx, cy, H), len = ZS * 0.85, ang = t * 0.003 + v;
        ctx.lineWidth = Math.max(1, TW2 / 12); ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = ang + k * Math.PI * 2 / 3;
          ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * len * 0.75, hy + Math.sin(a) * len);
        }
        ctx.stroke();
        circleAt(cx, cy, H, Math.max(1.5, TW2 / 10), '#ddd');
        break;
      }
      case 'police': case 'fire': case 'school': case 'hospital': {
        const cfg = {
          police: ['#3a64b8', '#e8e8ef', 'P', 0.45],
          fire: ['#b8352a', '#ece4d8', 'F', 0.45],
          school: ['#c97a35', '#f0dfbd', 'S', 0.5],
          hospital: ['#f2f2f2', '#dfe4ea', '+', 1.0]
        }[bt.key];
        const h = cfg[3];
        box(rx + 0.15, ry + 0.2, 1.7, 1.55, 0, h, cfg[0], cfg[1]);
        windows(rx + 0.15, ry + 0.2, 1.7, 1.55, 0, h, '#6d88a6', 0.22, false, b.x * 7);
        if (bt.key === 'fire' && TW2 >= 8)
          for (let q = 0; q < 3; q++) quad(rx + 0.25 + q * 0.55, ry + 1.751, 0, rx + 0.65 + q * 0.55, ry + 1.751, 0, rx + 0.65 + q * 0.55, ry + 1.751, 0.32, rx + 0.25 + q * 0.55, ry + 1.751, 0.32, '#8e1f16');
        if (bt.key === 'school') {
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(PX(rx + 1.95, ry + 1.9), PY(rx + 1.95, ry + 1.9, 0)); ctx.lineTo(PX(rx + 1.95, ry + 1.9), PY(rx + 1.95, ry + 1.9, 1.1)); ctx.stroke();
          ctx.fillStyle = '#2e86de'; ctx.fillRect(PX(rx + 1.95, ry + 1.9), PY(rx + 1.95, ry + 1.9, 1.1), TW2 * 0.35, TW2 * 0.2);
        }
        const cx = rx + 1, cy = ry + 0.975;
        if (bt.key === 'hospital') {
          flat(cx - 0.12, cy - 0.45, 0.24, 0.9, h + 0.003, '#e02424');
          flat(cx - 0.45, cy - 0.12, 0.9, 0.24, h + 0.003, '#e02424');
        } else if (TW2 >= 7) {
          ctx.globalAlpha *= 0.3; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(PX(cx, cy), PY(cx, cy, h), TW2 * 0.45, TH2 * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha /= 0.3;
          ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(TW2 * 0.5) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(cfg[2], PX(cx, cy), PY(cx, cy, h) + 1);
        }
        break;
      }
      case 'park': {
        flat(rx, ry + 0.45, 1, 0.1, 0.004, '#d8c79a');
        flat(rx + 0.45, ry, 0.1, 1, 0.004, '#d8c79a');
        if (v & 1) {
          ctx.fillStyle = '#4aa3df';
          ctx.beginPath(); ctx.ellipse(PX(rx + 0.5, ry + 0.5), PY(rx + 0.5, ry + 0.5, 0.005), TW2 * 0.32, TH2 * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        } else circleAt(rx + 0.5, ry + 0.5, 0.05, TW2 * 0.12, '#e8b3c8');
        circleAt(rx + 0.2, ry + 0.2, 0.3, TW2 * 0.17, TREE[1]);
        circleAt(rx + 0.8, ry + 0.2, 0.3, TW2 * 0.14, TREE[3]);
        circleAt(rx + 0.2, ry + 0.8, 0.3, TW2 * 0.14, TREE[0]);
        circleAt(rx + 0.8, ry + 0.8, 0.3, TW2 * 0.17, TREE[2]);
        break;
      }
      case 'stadium': {
        const cx = rx + 1.5, cy = ry + 1.5, N = 36, ro = 1.4, ri = 1.0, H = 0.55;
        const ring = (r, z) => { const p = []; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, z]); } return p; };
        const pathOf = (pts, color) => {
          ctx.fillStyle = color; ctx.beginPath();
          pts.forEach((p, k) => (k ? ctx.lineTo(PX(p[0], p[1]), PY(p[0], p[1], p[2])) : ctx.moveTo(PX(p[0], p[1]), PY(p[0], p[1], p[2]))));
          ctx.closePath(); ctx.fill();
        };
        shadow(rx + 0.2, ry + 0.3, 2.6, 2.4, H);
        // Außenwand (vordere Hälfte)
        const wall = [];
        for (let k = 0; k <= N / 2; k++) { const a = -Math.PI / 4 + k / N * Math.PI * 2; wall.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro * 0.85, H]); }
        for (let k = N / 2; k >= 0; k--) { const a = -Math.PI / 4 + k / N * Math.PI * 2; wall.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro * 0.85, 0]); }
        pathOf(wall, '#8d96a0');
        pathOf(ring(ro, H), '#c2c9d1');
        pathOf(ring(ri + 0.08, H * 0.7), '#c9504f');
        pathOf(ring(ri, 0.08), '#4caf50');
        if (TW2 >= 8) {
          flat(cx - 0.6, cy - 0.38, 1.2, 0.76, 0.085, '#5cbf60');
          flat(cx - 0.01, cy - 0.38, 0.02, 0.76, 0.09, '#fff');
        }
        break;
      }
    }
  }

  function drawCars(s, i, x, y, t) {
    const tr = s.traffic[i];
    if (tr < 15 || TW2 < 12) return;
    const ns = roadAt(s, x, y - 1) || roadAt(s, x, y + 1), ew = roadAt(s, x - 1, y) || roadAt(s, x + 1, y);
    if (ns === ew) return;
    const count = tr > 110 ? 3 : tr > 50 ? 2 : 1;
    for (let c = 0; c < count; c++) {
      let ph = (t * 0.00025 * (1 + SC.hash(i * 3 + c)) + SC.hash(i * 11 + c)) % 1;
      const lane = c % 2;
      if (lane) ph = 1 - ph;
      const off = lane ? 0.3 : 0.7;
      const mx = ew ? x + ph : x + off, my = ew ? y + off : y + ph;
      const [wx, wy] = rotF(s, mx, my);
      const col = CARS[(SC.hash(i * 17 + c) * CARS.length) | 0];
      const [a] = rotDelta(ew ? 1 : 0, ew ? 0 : 1);
      const lx = a !== 0 ? 0.22 : 0.12, ly = a !== 0 ? 0.12 : 0.22;
      box(wx - lx / 2, wy - ly / 2, lx, ly, 0.01, 0.08, col, col, true);
    }
  }

  function drawFire(i, rx, ry, t) {
    const f = (t * 0.01 + i) % (Math.PI * 2);
    const x = PX(rx + 0.5, ry + 0.5), y = PY(rx + 0.5, ry + 0.5, 0.25);
    ctx.fillStyle = 'rgba(50,40,40,0.4)'; ctx.beginPath(); ctx.arc(x + TW2 * 0.2, y - ZS * 0.9, TW2 * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x, y, TW2 * (0.55 + 0.08 * Math.sin(f)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(x - TW2 * 0.05, y - TH2 * 0.3, TW2 * (0.38 + 0.06 * Math.cos(f * 1.3)), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x + TW2 * 0.05, y - TH2 * 0.5, TW2 * (0.2 + 0.05 * Math.sin(f * 2)), 0, Math.PI * 2); ctx.fill();
  }

  // ---------- Overlays (aus der 2D-Ansicht übernommen) ----------
  function heat(v, a) {
    v = SC.clamp(v, 0, 1);
    const r = v < 0.5 ? Math.round(510 * v) : 255, g = v < 0.5 ? 220 : Math.round(220 - (v - 0.5) * 440);
    return 'rgba(' + r + ',' + g + ',40,' + a + ')';
  }
  function overlayColor(s, mode, i) {
    const k = s.kind[i];
    switch (mode) {
      case 'power': return (k !== K.EMPTY && k !== K.RUBBLE) ? (s.powered[i] ? 'rgba(60,230,100,0.6)' : 'rgba(240,40,40,0.65)') : null;
      case 'pollution': return s.pollution[i] > 4 ? heat(s.pollution[i] / 200, 0.6) : null;
      case 'crime': return s.crime[i] > 2 ? heat(s.crime[i] / 70, 0.6) : null;
      case 'landValue': {
        if (s.terrain[i] === T.WATER) return null;
        const v = s.landValue[i] / 100;
        return 'rgba(' + Math.round(220 - v * 200) + ',' + Math.round(80 + v * 150) + ',' + Math.round(200 - v * 120) + ',0.6)';
      }
      case 'traffic': return SC.isRoad(k) ? heat(s.traffic[i] / 160, 0.8) : null;
      case 'police': case 'fire': case 'school': case 'hospital': {
        const v = s.cov[mode][i];
        return v > 0 ? 'rgba(40,140,255,' + (0.15 + v * 0.55).toFixed(2) + ')' : null;
      }
      case 'roads': return k === K.ZONE ? (s.roadDist[i] <= 3 ? 'rgba(60,230,100,0.55)' : 'rgba(240,40,40,0.65)') : null;
    }
    return null;
  }

  // ---------- Hauptzeichnung ----------
  R.draw = function (s, t, ui) {
    S = s;
    setScale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!skyGrad) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, R.ch);
      skyGrad.addColorStop(0, '#5d9bd6'); skyGrad.addColorStop(0.55, '#a9cdea'); skyGrad.addColorStop(1, '#f2d7b0');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, R.cw, R.ch);
    ctx.globalAlpha = 1;

    const [RW, RH] = dims(s);
    // Sichtbarer Bereich in gedrehten Kachelkoordinaten
    const maxH = 4.2 * ZS;
    const cs = [[0, -TH2], [R.cw, -TH2], [0, R.ch + maxH], [R.cw, R.ch + maxH]].map(([sx, sy]) => {
      const a = (sx + view.x) / TW2, b = (sy + view.y) / TH2;
      return [(a + b) / 2, (b - a) / 2];
    });
    const rx0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0]))) - 1), rx1 = Math.min(RW - 1, Math.ceil(Math.max(...cs.map(c => c[0]))));
    const ry0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1]))) - 1), ry1 = Math.min(RH - 1, Math.ceil(Math.max(...cs.map(c => c[1]))));
    const visible = (rx, ry, extraBottom) => {
      const x = (rx - ry) * TW2 - view.x, y = (rx + ry) * TH2 - view.y;
      return x > -TW2 * 2 && x < R.cw + TW2 * 2 && y > -TH2 * 3 && y < R.ch + TH2 + extraBottom;
    };

    // Erdkante am vorderen Kartenrand
    quad(RW, 0, 0, RW, RH, 0, RW, RH, -0.9, RW, 0, -0.9, '#6b4f36');
    quad(0, RH, 0, RW, RH, 0, RW, RH, -0.9, 0, RH, -0.9, '#8a6847');

    // Pass 1: Boden
    for (let ry = ry0; ry <= ry1; ry++)
      for (let rx = rx0; rx <= rx1; rx++) {
        if (!visible(rx, ry, 0)) continue;
        const [mx, my] = unrotF(s, rx + 0.5, ry + 0.5);
        const x = Math.floor(mx), y = Math.floor(my);
        drawGround(s, y * s.W + x, x, y, rx, ry, t);
      }

    // Overlay
    if (ui.overlay) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, R.cw, R.ch);
      for (let ry = ry0; ry <= ry1; ry++)
        for (let rx = rx0; rx <= rx1; rx++) {
          if (!visible(rx, ry, 0)) continue;
          const [mx, my] = unrotF(s, rx + 0.5, ry + 0.5);
          const c = overlayColor(s, ui.overlay, Math.floor(my) * s.W + Math.floor(mx));
          if (c) flat(rx, ry, 1, 1, 0.01, c);
        }
    }

    // Gebäudeliste: vordere Ecke -> Gebäude
    const front = new Map();
    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t];
      const [bx, by, bw, bd] = mapRect(s, b.x, b.y, bt.size, bt.size);
      front.set((by + bd - 1) * RW + (bx + bw - 1), { b, rx: bx, ry: by });
    }

    // Pass 2: Objekte diagonal von hinten nach vorn
    const objAlpha = ui.overlay ? 0.35 : 1;
    const blink = ((t / 450) | 0) % 2 === 0;
    for (let d = rx0 + ry0; d <= rx1 + ry1; d++) {
      const ra = Math.max(rx0, d - ry1), rb = Math.min(rx1, d - ry0);
      for (let rx = ra; rx <= rb; rx++) {
        const ry = d - rx;
        if (!visible(rx, ry, maxH)) continue;
        const [mx, my] = unrotF(s, rx + 0.5, ry + 0.5);
        const x = Math.floor(mx), y = Math.floor(my), i = y * s.W + x, k = s.kind[i];
        ctx.globalAlpha = objAlpha;
        if (k === K.EMPTY && s.terrain[i] === T.TREES) drawTrees(i, rx, ry);
        else if (k === K.ZONE && s.lvl[i] > 0) drawZone(s, i, rx, ry, t);
        else if (k === K.WIRE && TW2 >= 5) drawWire(s, x, y, rx, ry);
        else if (SC.isRoad(k)) {
          drawCars(s, i, x, y, t);
          if (k === K.ROADWIRE && TW2 >= 5) drawWire(s, x, y, rx, ry);
        } else if (k === K.BUILDING) {
          const f = front.get(ry * RW + rx);
          if (f) {
            drawService(s, f.b, f.rx, f.ry, t);
            const bt = SC.BTYPES[f.b.t];
            if (bt.key !== 'park' && !bt.power && !s.powered[i] && blink) {
              const sz = SC.BTYPES[f.b.t].size;
              bolt(PX(f.rx + sz / 2, f.ry + sz / 2), PY(f.rx + sz / 2, f.ry + sz / 2, 1.5), Math.max(10, TW2 * 0.7));
            }
          }
        }
        ctx.globalAlpha = 1;
        if (s.fire[i]) drawFire(i, rx, ry, t);
        else if (blink && k === K.ZONE && !s.powered[i] && TW2 >= 8 && (s.lvl[i] > 0 || (x + y) % 3 === 0))
          bolt(PX(rx + 0.5, ry + 0.5), PY(rx + 0.5, ry + 0.5, ZH[s.lvl[i]] + 0.35), Math.max(7, TW2 * 0.5));
      }
    }
    ctx.globalAlpha = 1;

    // Vorschau
    const pv = ui.preview;
    const outline = (x, y, sz, fill, stroke) => {
      const [wx, wy, w, d] = mapRect(s, x, y, sz, sz);
      flat(wx, wy, w, d, 0.02, fill);
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PX(wx, wy), PY(wx, wy, 0.02)); ctx.lineTo(PX(wx + w, wy), PY(wx + w, wy, 0.02));
      ctx.lineTo(PX(wx + w, wy + d), PY(wx + w, wy + d, 0.02)); ctx.lineTo(PX(wx, wy + d), PY(wx, wy + d, 0.02));
      ctx.closePath(); ctx.stroke();
    };
    if (pv) {
      if (pv.radius) {
        const [wx, wy] = rotF(s, pv.cx, pv.cy);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(PX(wx, wy), PY(wx, wy, 0), pv.radius * TW2 * Math.SQRT2, pv.radius * TH2 * Math.SQRT2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const p of pv.tiles) {
        const bad = p.c < 0;
        outline(p.x, p.y, pv.size || 1, bad ? 'rgba(255,40,40,0.4)' : (p.c === 0 && !pv.size ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)'), bad ? '#ff4d4d' : '#ffffff');
      }
    }
    if (ui.hover && !pv) outline(ui.hover.x, ui.hover.y, 1, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.9)');
  };
})(window.SC);
