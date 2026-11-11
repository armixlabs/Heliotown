'use strict';
/* Heliotown – Darstellung auf dem Canvas (Draufsicht mit Schrägprojektion) */
(function (SC) {
  const K = SC.KIND, T = SC.TER;
  const R = SC.Render = {};
  let canvas, ctx, dpr = 1;
  const view = R.view = { x: 0, y: 0, ts: 24 };
  R.MIN_TS = 6; R.MAX_TS = 72;

  const GRASS = ['#77b049', '#72ab45', '#7cb54e', '#74ad47'];
  const TREE_COLORS = ['#2f7a35', '#3a8a3c', '#2a6d31', '#45963f'];
  const WATER = '#3b8bd4', WATER_HI = '#62a8e6', WATER_DEEP = '#337dc2';
  const ASPHALT = '#53575c';
  const R_ROOFS = ['#c0563f', '#9c5a3c', '#a83f3f', '#6b6f7a', '#b8733a', '#7a4f8a'];
  const R_WALLS = ['#efe1c6', '#e7d3b0', '#dcd6cc', '#f3ead9', '#e9cfc0'];
  const C_TOPS = ['#cfd8e2', '#d9d3c7', '#c6d0cf'];
  const C_FRONTS = ['#5e86b4', '#4f9aa8', '#7a7fb8', '#3f6f9e'];
  const I_TOPS = ['#b4ad9f', '#a9a9a2', '#bfae8f'];
  const I_FRONTS = ['#867f72', '#7b7d80', '#8f7d5c'];
  const CAR_COLORS = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2c3e50', '#e67e22', '#9b59b6'];

  R.init = function (c) {
    canvas = c;
    ctx = c.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    dpr = window.devicePixelRatio || 1;
    R.cw = canvas.clientWidth; R.ch = canvas.clientHeight;
    canvas.width = Math.round(R.cw * dpr); canvas.height = Math.round(R.ch * dpr);
  };
  R.centerOn = function (tx, ty) {
    view.x = tx * view.ts - R.cw / 2;
    view.y = ty * view.ts - R.ch / 2;
  };
  R.screenToTile = function (sx, sy) {
    return { x: Math.floor((sx + view.x) / view.ts), y: Math.floor((sy + view.y) / view.ts) };
  };
  R.zoomAt = function (sx, sy, f) {
    const wx = (sx + view.x) / view.ts, wy = (sy + view.y) / view.ts;
    view.ts = SC.clamp(view.ts * f, R.MIN_TS, R.MAX_TS);
    view.x = wx * view.ts - sx; view.y = wy * view.ts - sy;
  };
  R.clampView = function (s) {
    const ts = view.ts, m = 120;
    view.x = SC.clamp(view.x, -R.cw + m, s.W * ts - m);
    view.y = SC.clamp(view.y, -R.ch + m, s.H * ts - m);
  };

  // ---------- Grundformen ----------
  function box(x, y, w, d, h, top, front, shadow) {
    if (shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + w, y + d * 0.25, Math.min(h * 0.45, w * 0.6), d * 0.75);
    }
    ctx.fillStyle = front; ctx.fillRect(x, y + d - h, w, h);
    ctx.fillStyle = top; ctx.fillRect(x, y - h, w, d);
  }
  function windows(x, y, w, h, u, color, lit) {
    if (u < 1.1) return;
    const ww = Math.max(1, u * 1.1), wh = Math.max(1, u * 1.3), gx = u * 2.4, gy = u * 3;
    for (let yy = y + u; yy + wh < y + h - u * 0.5; yy += gy)
      for (let xx = x + u * 0.9; xx + ww < x + w - u * 0.3; xx += gx) {
        ctx.fillStyle = (lit && SC.hash((xx * 7 + yy * 13) | 0) > 0.7) ? '#ffe89a' : color;
        ctx.fillRect(xx, yy, ww, wh);
      }
  }
  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function smoke(x, y, u, t, seed, big) {
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.00045 + seed * 0.013 + k / 3) % 1);
      const r = u * (big ? 1.6 : 1) * (0.8 + ph * 2.2);
      ctx.fillStyle = 'rgba(120,120,120,' + (0.5 * (1 - ph)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x + ph * u * 5, y - ph * u * (big ? 18 : 11), r, 0, Math.PI * 2); ctx.fill();
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
  function label(text, x, y, size, color) {
    ctx.fillStyle = color; ctx.font = 'bold ' + Math.round(size) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // ---------- Boden ----------
  function roadAt(s, x, y) {
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) return false;
    return SC.isRoad(s.kind[y * s.W + x]);
  }
  function drawRoad(s, x, y, px, py, ts, detail) {
    const n = roadAt(s, x, y - 1), so = roadAt(s, x, y + 1), e = roadAt(s, x + 1, y), w = roadAt(s, x - 1, y);
    const bridge = s.terrain[y * s.W + x] === T.WATER;
    const rw = ts * 0.64, m = (ts - rw) / 2;
    if (bridge) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px + m + ts * 0.08, py + m + ts * 0.08, rw, rw);
    }
    ctx.fillStyle = bridge ? '#8b8178' : ASPHALT;
    ctx.fillRect(px + m, py + m, rw, rw);
    if (n) ctx.fillRect(px + m, py, rw, m + 0.5);
    if (so) ctx.fillRect(px + m, py + m + rw - 0.5, rw, m + 0.5);
    if (w) ctx.fillRect(px, py + m, m + 0.5, rw);
    if (e) ctx.fillRect(px + m + rw - 0.5, py + m, m + 0.5, rw);
    if (bridge && detail) {
      ctx.fillStyle = '#d7d2c8';
      if (n || so || !(e || w)) { ctx.fillRect(px + m - 1, py, 1.5, ts); ctx.fillRect(px + m + rw - 0.5, py, 1.5, ts); }
      if (e || w) { ctx.fillRect(px, py + m - 1, ts, 1.5); ctx.fillRect(px, py + m + rw - 0.5, ts, 1.5); }
    }
    if (detail && ts >= 16) {
      ctx.fillStyle = '#f0d36b';
      const lw = Math.max(1, ts / 28);
      if ((n || so) && !(e || w)) {
        ctx.fillRect(px + ts / 2 - lw / 2, py + ts * 0.08, lw, ts * 0.3);
        ctx.fillRect(px + ts / 2 - lw / 2, py + ts * 0.58, lw, ts * 0.3);
      } else if ((e || w) && !(n || so)) {
        ctx.fillRect(px + ts * 0.08, py + ts / 2 - lw / 2, ts * 0.3, lw);
        ctx.fillRect(px + ts * 0.58, py + ts / 2 - lw / 2, ts * 0.3, lw);
      }
    }
  }

  function drawGround(s, i, x, y, px, py, pw, ph, ts, t, detail) {
    const ter = s.terrain[i], k = s.kind[i];
    if (ter === T.WATER) {
      ctx.fillStyle = (SC.hash(i) > 0.5) ? WATER : WATER_DEEP;
      ctx.fillRect(px, py, pw, ph);
      if (detail) {
        const ph2 = Math.sin(t * 0.0015 + x * 0.9 + y * 0.6);
        if (ph2 > 0.55) { ctx.fillStyle = WATER_HI; ctx.fillRect(px + ts * 0.2, py + ts * (0.35 + 0.1 * ph2), ts * 0.45, Math.max(1, ts * 0.06)); }
      }
    } else {
      ctx.fillStyle = GRASS[(SC.hash(i) * 4) | 0];
      ctx.fillRect(px, py, pw, ph);
    }
    switch (k) {
      case K.ROAD: case K.ROADWIRE:
        drawRoad(s, x, y, px, py, ts, detail);
        break;
      case K.ZONE: {
        const z = s.zone[i], l = s.lvl[i];
        if (l === 0) {
          ctx.fillStyle = SC.ZONE_COLORS[z] + '44';
          ctx.fillRect(px, py, pw, ph);
          if (ts >= 8) {
            ctx.strokeStyle = SC.ZONE_COLORS[z] + 'cc';
            ctx.lineWidth = Math.max(1, ts / 22);
            const m = ts * 0.12;
            ctx.strokeRect(px + m, py + m, ts - 2 * m, ts - 2 * m);
          }
        } else {
          ctx.fillStyle = z === 1 ? (GRASS[(SC.hash(i) * 4) | 0]) : z === 2 ? '#a9aeb3' : '#9c968a';
          ctx.fillRect(px, py, pw, ph);
          ctx.fillStyle = SC.ZONE_COLORS[z] + '30';
          ctx.fillRect(px, py, pw, ph);
        }
        break;
      }
      case K.BUILDING: {
        const bt = SC.BTYPES[s.lvl[i]];
        if (bt && bt.key !== 'park' && bt.key !== 'solar' && bt.key !== 'wind') {
          ctx.fillStyle = bt.key === 'coal' ? '#8d8a82' : '#b9b8b0';
          ctx.fillRect(px, py, pw, ph);
        } else if (bt && bt.key === 'park') {
          ctx.fillStyle = '#86c45a'; ctx.fillRect(px, py, pw, ph);
        }
        break;
      }
      case K.RUBBLE:
        ctx.fillStyle = '#8a7660'; ctx.fillRect(px, py, pw, ph);
        if (detail) {
          ctx.fillStyle = '#6a5a4a';
          for (let k2 = 0; k2 < 5; k2++) ctx.fillRect(px + SC.hash(i * 5 + k2) * ts * 0.8, py + SC.hash(i * 9 + k2) * ts * 0.8, ts * 0.15, ts * 0.12);
        }
        break;
    }
  }

  // ---------- Objekte ----------
  function drawTrees(i, px, py, ts, detail) {
    if (!detail) {
      ctx.fillStyle = TREE_COLORS[0];
      ctx.fillRect(px + ts * 0.15, py + ts * 0.15, ts * 0.7, ts * 0.7);
      return;
    }
    const n = 2 + ((SC.hash(i) * 3) | 0);
    for (let k = 0; k < n; k++) {
      const hx = SC.hash(i * 7 + k), hy = SC.hash(i * 13 + k * 3);
      const tx = px + ts * (0.2 + 0.6 * hx), ty = py + ts * (0.3 + 0.55 * ((hy + k / n) % 1));
      const r = ts * (0.17 + 0.1 * SC.hash(i * 3 + k));
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(tx + r * 0.4, ty + r * 0.5, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b3e24'; ctx.fillRect(tx - r * 0.12, ty - r * 0.3, r * 0.24, r * 0.6);
      circle(tx, ty - r * 0.6, r, TREE_COLORS[(k + ((SC.hash(i) * 4) | 0)) % 4]);
      circle(tx - r * 0.3, ty - r * 0.9, r * 0.35, 'rgba(255,255,255,0.12)');
    }
  }

  function conductorAt(s, x, y) {
    if (x < 0 || y < 0 || x >= s.W || y >= s.H) return false;
    return SC.isConductor(s.kind[y * s.W + x]);
  }
  function drawWire(s, x, y, px, py, ts) {
    const cx = px + ts / 2, top = py + ts * 0.2;
    ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, ts / 26);
    ctx.beginPath();
    let any = false;
    if (conductorAt(s, x + 1, y)) { ctx.moveTo(cx, top); ctx.lineTo(px + ts, top); any = true; }
    if (conductorAt(s, x - 1, y)) { ctx.moveTo(cx, top); ctx.lineTo(px, top); any = true; }
    if (conductorAt(s, x, y - 1)) { ctx.moveTo(cx, top); ctx.lineTo(cx, py - ts * 0.3); any = true; }
    if (conductorAt(s, x, y + 1)) { ctx.moveTo(cx, top); ctx.lineTo(cx, py + ts * 0.7); any = true; }
    if (any) ctx.stroke();
    ctx.fillStyle = '#6d4c2f';
    ctx.fillRect(cx - ts * 0.05, top, ts * 0.1, ts * 0.45);
    ctx.fillRect(cx - ts * 0.18, top - ts * 0.02, ts * 0.36, Math.max(1, ts * 0.06));
  }

  function drawZoneBuilding(s, i, px, py, ts, t, detail) {
    const z = s.zone[i], l = s.lvl[i], v = s.vari[i];
    const u = ts / 16;
    if (!detail) {
      const h = [0, 2, 5, 10][l] * u;
      const col = z === 1 ? R_ROOFS[v % R_ROOFS.length] : z === 2 ? C_FRONTS[v % 4] : I_FRONTS[v % 3];
      ctx.fillStyle = col; ctx.fillRect(px + 2 * u, py + 2 * u - h * 0.4, 12 * u, 12 * u);
      return;
    }
    if (z === 1) {
      const roof = R_ROOFS[v % R_ROOFS.length], wall = R_WALLS[(v >> 3) % R_WALLS.length];
      if (l === 1) {
        house(px + 1.5 * u, py + 2.5 * u, 6 * u, 5 * u, 3 * u, roof, wall);
        house(px + 8.5 * u, py + 8.5 * u, 6 * u, 5 * u, 3 * u, R_ROOFS[(v + 2) % R_ROOFS.length], wall);
        if (v & 1) circle(px + 12 * u, py + 4 * u, 2 * u, TREE_COLORS[1]);
        else circle(px + 4 * u, py + 12 * u, 2 * u, TREE_COLORS[2]);
      } else if (l === 2) {
        box(px + 2 * u, py + 3 * u, 12 * u, 10 * u, 7 * u, roof, wall);
        windows(px + 2 * u, py + 13 * u - 7 * u, 12 * u, 7 * u, u, '#5d7894', false);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px + 2 * u, py - 4 * u + 5 * u, 12 * u, u * 0.8);
      } else {
        box(px + 3 * u, py + 3 * u, 10 * u, 10 * u, 20 * u, '#8c8f99', wall);
        windows(px + 3 * u, py + 13 * u - 20 * u, 10 * u, 20 * u, u, '#5d7894', true);
        ctx.fillStyle = roof; ctx.fillRect(px + 5 * u, py - 15 * u, 6 * u, 4 * u);
      }
    } else if (z === 2) {
      const top = C_TOPS[v % 3], front = C_FRONTS[(v >> 2) % 4];
      if (l === 1) {
        box(px + 2 * u, py + 4 * u, 12 * u, 9 * u, 4 * u, top, '#e6dfd2');
        ctx.fillStyle = front; ctx.fillRect(px + 3 * u, py + 10 * u, 10 * u, 2.2 * u);
        const aw = ['#e74c3c', '#27ae60', '#2980b9', '#f39c12'][v % 4];
        for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : aw; ctx.fillRect(px + 2 * u + k * 2 * u, py + 8.6 * u, 2 * u, 1.4 * u); }
      } else if (l === 2) {
        box(px + 2 * u, py + 2 * u, 12 * u, 12 * u, 11 * u, top, front);
        windows(px + 2 * u, py + 14 * u - 11 * u, 12 * u, 11 * u, u, '#c9e4ff', false);
      } else {
        box(px + 3 * u, py + 3 * u, 10 * u, 10 * u, 30 * u, top, front);
        windows(px + 3 * u, py + 13 * u - 30 * u, 10 * u, 30 * u, u, '#cfe8ff', true);
        ctx.fillStyle = '#ddd'; ctx.fillRect(px + 7.6 * u, py - 33 * u, 0.8 * u, 6 * u);
        if ((t / 600 | 0) % 2) circle(px + 8 * u, py - 33 * u, 0.7 * u, '#ff3b30');
      }
    } else {
      const top = I_TOPS[v % 3], front = I_FRONTS[v % 3];
      const powered = s.powered[i];
      if (l === 1) {
        box(px + 2 * u, py + 4 * u, 12 * u, 9 * u, 4 * u, top, front);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let k = 0; k < 4; k++) ctx.fillRect(px + 2 * u + k * 3 * u, py, 1.2 * u, 9 * u);
      } else if (l === 2) {
        box(px + 1 * u, py + 4 * u, 10 * u, 10 * u, 6 * u, top, front);
        box(px + 12 * u, py + 5 * u, 2.4 * u, 2.4 * u, 13 * u, '#5a5a5a', '#9a4a3a');
        if (powered) smoke(px + 13.2 * u, py - 9 * u, u, t, v, false);
      } else {
        box(px + 1 * u, py + 3 * u, 14 * u, 11 * u, 8 * u, top, front);
        ctx.fillStyle = '#c9c1aa'; ctx.fillRect(px + 2 * u, py - 4 * u, 4 * u, 9 * u);
        box(px + 9 * u, py + 2 * u, 2.4 * u, 2.4 * u, 17 * u, '#555', '#a04535');
        box(px + 12.5 * u, py + 2 * u, 2.4 * u, 2.4 * u, 14 * u, '#555', '#a04535');
        if (powered) { smoke(px + 10.2 * u, py - 15 * u, u, t, v, true); smoke(px + 13.7 * u, py - 12 * u, u, t, v + 50, false); }
      }
    }
  }
  function house(x, y, w, d, h, roof, wall) {
    box(x, y, w, d, h, roof, wall);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y - h + d / 2, w, d / 2);
    ctx.fillStyle = '#6b4b32'; ctx.fillRect(x + w * 0.42, y + d - h * 0.7, w * 0.16, h * 0.7);
  }

  function drawService(s, b, px, py, ts, t, detail) {
    const bt = SC.BTYPES[b.t], S = bt.size * ts, u = ts / 16, o = b.y * s.W + b.x, v = s.vari[o];
    switch (bt.key) {
      case 'coal': {
        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath(); ctx.ellipse(px + S * 0.25, py + S * 0.82, S * 0.18, S * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        box(px + S * 0.05, py + S * 0.3, S * 0.58, S * 0.4, S * 0.22, '#a4a39c', '#74726b');
        windows(px + S * 0.05, py + S * 0.7 - S * 0.22, S * 0.58, S * 0.22, u * 1.2, '#4a4a48', false);
        for (let k = 0; k < 2; k++) {
          const cx = px + S * (0.7 + k * 0.15), cy = py + S * 0.25;
          box(cx, cy, S * 0.1, S * 0.1, S * 0.62, '#cfcfc8', '#b03a2e');
          ctx.fillStyle = '#eee'; ctx.fillRect(cx, cy + S * 0.1 - S * 0.62 + S * 0.12, S * 0.1, S * 0.06);
          if (detail) smoke(cx + S * 0.05, cy - S * 0.55, u * 2, t, v + k * 40, true);
        }
        break;
      }
      case 'solar': {
        const rows = 6, cols = 3, pw = S / cols, ph = S / rows;
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const x = px + c * pw + pw * 0.08, y = py + r * ph + ph * 0.15;
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + u, y + u, pw * 0.84, ph * 0.7);
            ctx.fillStyle = '#1e3a6e'; ctx.fillRect(x, y, pw * 0.84, ph * 0.7);
            if (detail) {
              ctx.fillStyle = '#4f7cc4';
              for (let q = 1; q < 4; q++) ctx.fillRect(x + pw * 0.84 * q / 4, y, Math.max(0.6, u * 0.3), ph * 0.7);
              ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, pw * 0.84, ph * 0.18);
            }
          }
        break;
      }
      case 'wind': {
        const cx = px + ts / 2, base = py + ts * 0.85, top = py - ts * 0.6;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(cx, base - u, ts * 0.5, u * 1.5);
        ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = Math.max(1.5, u * 1.4);
        ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, top); ctx.stroke();
        const ang = t * 0.004 + v;
        ctx.lineWidth = Math.max(1, u * 1.1);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = ang + k * Math.PI * 2 / 3;
          ctx.moveTo(cx, top); ctx.lineTo(cx + Math.cos(a) * ts * 0.55, top + Math.sin(a) * ts * 0.55);
        }
        ctx.stroke();
        circle(cx, top, u * 1.3, '#ddd');
        break;
      }
      case 'police': case 'fire': case 'school': case 'hospital': {
        const cfg = {
          police: ['#3a64b8', '#e8e8ef', 'P', '#fff'],
          fire: ['#c0392b', '#ece4d8', 'F', '#fff'],
          school: ['#d98c3a', '#f3e3c3', 'S', '#fff'],
          hospital: ['#f4f4f4', '#d8dde3', '+', '#e02424']
        }[bt.key];
        const h = bt.key === 'hospital' ? S * 0.35 : S * 0.2;
        const x = px + S * 0.08, y = py + S * 0.22, w = S * 0.84, d = S * 0.62;
        box(x, y, w, d, h, cfg[0], cfg[1]);
        windows(x, y + d - h, w, h, u, '#6d88a6', false);
        if (bt.key === 'fire') {
          ctx.fillStyle = '#8e1f16';
          for (let k = 0; k < 3; k++) ctx.fillRect(x + w * (0.1 + k * 0.3), y + d - h * 0.7, w * 0.22, h * 0.7);
        }
        if (bt.key === 'school') {
          ctx.fillStyle = '#ddd'; ctx.fillRect(px + S * 0.86, py - S * 0.05, Math.max(1, u * 0.6), S * 0.3);
          ctx.fillStyle = '#2e86de'; ctx.fillRect(px + S * 0.86, py - S * 0.05, S * 0.09, S * 0.06);
        }
        const cx = x + w / 2, cy = y - h + d / 2;
        if (bt.key === 'hospital') {
          ctx.fillStyle = cfg[3];
          ctx.fillRect(cx - S * 0.05, cy - S * 0.16, S * 0.1, S * 0.32);
          ctx.fillRect(cx - S * 0.16, cy - S * 0.05, S * 0.32, S * 0.1);
        } else {
          circle(cx, cy, S * 0.16, 'rgba(0,0,0,0.25)');
          label(cfg[2], cx, cy + 1, S * 0.24, cfg[3]);
        }
        break;
      }
      case 'park': {
        const cx = px + ts / 2, cy = py + ts / 2;
        ctx.fillStyle = '#d8c79a';
        ctx.fillRect(px, cy - ts * 0.06, ts, ts * 0.12);
        ctx.fillRect(cx - ts * 0.06, py, ts * 0.12, ts);
        if (v & 1) {
          ctx.fillStyle = '#4aa3df';
          ctx.beginPath(); ctx.ellipse(cx, cy, ts * 0.2, ts * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        } else circle(cx, cy, ts * 0.12, '#e8b3c8');
        if (detail) {
          circle(px + ts * 0.22, py + ts * 0.2, ts * 0.15, TREE_COLORS[1]);
          circle(px + ts * 0.78, py + ts * 0.75, ts * 0.15, TREE_COLORS[3]);
          circle(px + ts * 0.8, py + ts * 0.18, ts * 0.12, TREE_COLORS[0]);
        }
        break;
      }
      case 'stadium': {
        const cx = px + S / 2, cy = py + S / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(cx + S * 0.05, cy + S * 0.06, S * 0.46, S * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8f99a3';
        ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.04, S * 0.46, S * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b6bec7';
        ctx.beginPath(); ctx.ellipse(cx, cy - S * 0.02, S * 0.46, S * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c94f4f';
        ctx.beginPath(); ctx.ellipse(cx, cy - S * 0.02, S * 0.38, S * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(cx - S * 0.26, cy - S * 0.2, S * 0.52, S * 0.36);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, u * 0.5);
        ctx.strokeRect(cx - S * 0.24, cy - S * 0.18, S * 0.48, S * 0.32);
        ctx.beginPath(); ctx.moveTo(cx, cy - S * 0.18); ctx.lineTo(cx, cy + S * 0.14); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy - S * 0.02, S * 0.06, 0, Math.PI * 2); ctx.stroke();
        break;
      }
    }
  }

  function drawFire(i, px, py, ts, t) {
    const f = (t * 0.01 + i) % (Math.PI * 2);
    ctx.fillStyle = 'rgba(40,30,30,0.35)';
    circle(px + ts * 0.5, py - ts * 0.3, ts * 0.35, 'rgba(60,50,50,0.35)');
    circle(px + ts * 0.5, py + ts * 0.5, ts * (0.38 + 0.05 * Math.sin(f)), '#e74c3c');
    circle(px + ts * 0.45, py + ts * 0.45, ts * (0.26 + 0.05 * Math.cos(f * 1.3)), '#f39c12');
    circle(px + ts * 0.55, py + ts * 0.5, ts * (0.14 + 0.04 * Math.sin(f * 2)), '#ffe066');
  }

  function drawCars(s, i, x, y, px, py, ts, t) {
    const tr = s.traffic[i];
    if (tr < 15) return;
    const count = tr > 110 ? 3 : tr > 50 ? 2 : 1;
    const vert = (roadAt(s, x, y - 1) || roadAt(s, x, y + 1)) && !(roadAt(s, x - 1, y) || roadAt(s, x + 1, y));
    const horiz = (roadAt(s, x - 1, y) || roadAt(s, x + 1, y)) && !(roadAt(s, x, y - 1) || roadAt(s, x, y + 1));
    if (!vert && !horiz) return;
    const cl = ts * 0.22, cw = ts * 0.13;
    for (let c = 0; c < count; c++) {
      const sp = 0.0003 * (1 + SC.hash(i * 3 + c));
      let ph = (t * sp + SC.hash(i * 11 + c)) % 1;
      const lane = c % 2;
      if (lane) ph = 1 - ph;
      ctx.fillStyle = CAR_COLORS[(SC.hash(i * 17 + c) * CAR_COLORS.length) | 0];
      if (vert) ctx.fillRect(px + ts / 2 + (lane ? -ts * 0.2 : ts * 0.07), py + ph * ts - cl / 2, cw, cl);
      else ctx.fillRect(px + ph * ts - cl / 2, py + ts / 2 + (lane ? ts * 0.07 : -ts * 0.2), cl, cw);
    }
  }

  // ---------- Overlays ----------
  function heat(v, a) {
    v = SC.clamp(v, 0, 1);
    const r = v < 0.5 ? Math.round(510 * v) : 255, g = v < 0.5 ? 220 : Math.round(220 - (v - 0.5) * 440);
    return 'rgba(' + r + ',' + g + ',40,' + a + ')';
  }
  function overlayColor(s, mode, i) {
    const k = s.kind[i];
    switch (mode) {
      case 'power':
        if (k !== K.EMPTY && k !== K.RUBBLE)
          return s.powered[i] ? 'rgba(60,230,100,0.5)' : 'rgba(240,40,40,0.55)';
        return null;
      case 'pollution': return s.pollution[i] > 4 ? heat(s.pollution[i] / 200, 0.55) : null;
      case 'crime': return s.crime[i] > 2 ? heat(s.crime[i] / 70, 0.55) : null;
      case 'landValue': {
        if (s.terrain[i] === T.WATER) return null;
        const v = s.landValue[i] / 100;
        return 'rgba(' + Math.round(220 - v * 200) + ',' + Math.round(80 + v * 150) + ',' + Math.round(200 - v * 120) + ',0.55)';
      }
      case 'traffic': return SC.isRoad(k) ? heat(s.traffic[i] / 160, 0.75) : null;
      case 'police': case 'fire': case 'school': case 'hospital': {
        const v = s.cov[mode][i];
        return v > 0 ? 'rgba(40,140,255,' + (0.15 + v * 0.5).toFixed(2) + ')' : null;
      }
      case 'roads':
        if (k !== K.ZONE) return null;
        return s.roadDist[i] <= 3 ? 'rgba(60,230,100,0.45)' : 'rgba(240,40,40,0.55)';
    }
    return null;
  }

  // ---------- Hauptzeichnung ----------
  R.draw = function (s, t, ui) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1d2a1a';
    ctx.fillRect(0, 0, R.cw, R.ch);
    const ts = view.ts, W = s.W, H = s.H;
    const x0 = Math.max(0, Math.floor(view.x / ts)), x1 = Math.min(W - 1, Math.floor((view.x + R.cw) / ts));
    const y0 = Math.max(0, Math.floor(view.y / ts)), y1 = Math.min(H - 1, Math.floor((view.y + R.ch) / ts));
    const yb = Math.min(H - 1, y1 + 3);
    const detail = ts >= 11;
    const blink = ((t / 450) | 0) % 2 === 0;

    // Pass 1: Boden
    for (let y = y0; y <= y1; y++) {
      const py = Math.floor(y * ts - view.y), ph = Math.floor((y + 1) * ts - view.y) - py;
      for (let x = x0; x <= x1; x++) {
        const px = Math.floor(x * ts - view.x), pw = Math.floor((x + 1) * ts - view.x) - px;
        drawGround(s, y * W + x, x, y, px, py, pw, ph, ts, t, detail);
      }
    }

    // Gebäude nach unterster Zeile einsortieren
    const rows = new Map();
    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t];
      if (b.x + bt.size - 1 < x0 || b.x > x1 || b.y > yb || b.y + bt.size - 1 < y0) continue;
      const by = b.y + bt.size - 1;
      if (!rows.has(by)) rows.set(by, []);
      rows.get(by).push(b);
    }

    // Pass 2: Objekte (zeilenweise für korrekte Überdeckung)
    for (let y = y0; y <= yb; y++) {
      const py = y * ts - view.y;
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, k = s.kind[i], px = x * ts - view.x;
        if (k === K.EMPTY && s.terrain[i] === T.TREES) drawTrees(i, px, py, ts, detail);
        else if (k === K.ZONE && s.lvl[i] > 0) drawZoneBuilding(s, i, px, py, ts, t, detail);
        else if ((k === K.WIRE || k === K.ROADWIRE) && ts >= 7) drawWire(s, x, y, px, py, ts);
        else if (SC.isRoad(k) && ts >= 14) drawCars(s, i, x, y, px, py, ts, t);
      }
      const list = rows.get(y);
      if (list) for (const b of list) {
        const bt = SC.BTYPES[b.t];
        drawService(s, b, b.x * ts - view.x, b.y * ts - view.y, ts, t, detail);
        if (bt.key !== 'park' && !bt.power) {
          const o = b.y * W + b.x;
          if (!s.powered[o] && blink) bolt(b.x * ts - view.x + bt.size * ts / 2, b.y * ts - view.y - ts * 0.1, Math.max(10, ts * 0.6));
        }
      }
      // Feuer & Strom-Warnsymbole
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (s.fire[i]) drawFire(i, x * ts - view.x, py, ts, t);
        else if (blink && s.kind[i] === K.ZONE && !s.powered[i] && ts >= 10 && (s.lvl[i] > 0 || (x + y) % 3 === 0))
          bolt(x * ts - view.x + ts / 2, py + ts / 2 - (s.lvl[i] > 0 ? ts * 0.4 : 0), Math.max(7, ts * 0.45));
      }
    }

    // Overlay
    if (ui.overlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, R.cw, R.ch);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const c = overlayColor(s, ui.overlay, y * W + x);
          if (c) { ctx.fillStyle = c; ctx.fillRect(x * ts - view.x, y * ts - view.y, ts + 0.5, ts + 0.5); }
        }
    }

    // Vorschau
    const pv = ui.preview;
    if (pv) {
      if (pv.radius) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.arc(pv.cx * ts - view.x, pv.cy * ts - view.y, pv.radius * ts, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const p of pv.tiles) {
        const sz = (pv.size || 1) * ts;
        ctx.fillStyle = p.c < 0 ? 'rgba(255,40,40,0.4)' : p.c === 0 && !pv.size ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)';
        ctx.fillRect(p.x * ts - view.x, p.y * ts - view.y, sz, sz);
        ctx.strokeStyle = p.c < 0 ? '#ff4d4d' : '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x * ts - view.x + 0.5, p.y * ts - view.y + 0.5, sz - 1, sz - 1);
      }
    }
    if (ui.hover && !pv) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(ui.hover.x * ts - view.x + 0.5, ui.hover.y * ts - view.y + 0.5, ts - 1, ts - 1);
    }
  };

  // ---------- Minikarte ----------
  let mmCanvas = null, mmImg = null;
  R.drawMinimap = function (s, target, overlay, noViewport) {
    if (!mmCanvas || mmCanvas.width !== s.W || mmCanvas.height !== s.H) {
      mmCanvas = document.createElement('canvas');
      mmCanvas.width = s.W; mmCanvas.height = s.H;
      mmImg = mmCanvas.getContext('2d').createImageData(s.W, s.H);
    }
    const d = mmImg.data;
    for (let i = 0; i < s.N; i++) {
      let r, g, b;
      const k = s.kind[i], ter = s.terrain[i];
      if (k === K.ROAD || k === K.ROADWIRE) { r = 70; g = 70; b = 75; }
      else if (k === K.WIRE) { r = 150; g = 120; b = 70; }
      else if (k === K.ZONE) {
        const l = s.lvl[i], z = s.zone[i];
        const base = z === 1 ? [63, 191, 90] : z === 2 ? [58, 142, 240] : [242, 178, 27];
        const f = l === 0 ? 0.55 : 0.75 + l * 0.08;
        r = base[0] * f; g = base[1] * f; b = base[2] * f;
      }
      else if (k === K.BUILDING) { r = 225; g = 225; b = 215; }
      else if (k === K.RUBBLE) { r = 138; g = 118; b = 96; }
      else if (ter === T.WATER) { r = 59; g = 139; b = 212; }
      else if (ter === T.TREES) { r = 40; g = 110; b = 45; }
      else { r = 118; g = 175; b = 73; }
      if (s.fire[i]) { r = 255; g = 80; b = 20; }
      if (overlay) {
        const c = overlayColor(s, overlay, i);
        if (c) {
          const m = c.match(/[\d.]+/g);
          const a = +m[3];
          r = r * (1 - a) + m[0] * a; g = g * (1 - a) + m[1] * a; b = b * (1 - a) + m[2] * a;
        } else { r *= 0.6; g *= 0.6; b *= 0.6; }
      }
      const p = i * 4;
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
    mmCanvas.getContext('2d').putImageData(mmImg, 0, 0);
    const tc = target.getContext('2d');
    const tw = target.width, th = target.height;
    tc.imageSmoothingEnabled = false;
    tc.fillStyle = '#111'; tc.fillRect(0, 0, tw, th);
    tc.drawImage(mmCanvas, 0, 0, tw, th);
    if (!Array.isArray(noViewport)) return; // Ecken des sichtbaren Bereichs in Kartenkoordinaten
    const sx = tw / s.W, sy = th / s.H;
    tc.strokeStyle = '#fff'; tc.lineWidth = 1.5;
    tc.beginPath();
    noViewport.forEach((p, k) => (k ? tc.lineTo(p[0] * sx, p[1] * sy) : tc.moveTo(p[0] * sx, p[1] * sy)));
    tc.closePath(); tc.stroke();
  };

  // Gemeinsame Schnittstelle mit der 3D-Ansicht
  R.DEFAULT_TS = 24;
  R.is3D = false;
  R.setState = function () {};
  R.rotate = function () {};
  R.screenToMapF = function (s, sx, sy) { return [(sx + view.x) / view.ts, (sy + view.y) / view.ts]; };
  R.getCenter = function () { return R.screenToMapF(null, R.cw / 2, R.ch / 2); };
  R.viewportCorners = function (s) {
    return [[0, 0], [R.cw, 0], [R.cw, R.ch], [0, R.ch]].map(p => R.screenToMapF(s, p[0], p[1]));
  };
})(window.SC);
