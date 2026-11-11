'use strict';
/* SunCity – Simulation: Strom, Wachstum, Umwelt, Haushalt, Ereignisse */
(function (SC) {
  const K = SC.KIND, T = SC.TER;
  const Sim = SC.Sim = {};
  const STRIDE = 7919; // Primzahl -> Felder in "zufälliger" Reihenfolge prüfen

  Sim.recomputeAll = function (s) {
    Sim.computePower(s);
    Sim.computeMaps(s);
    Sim.countStats(s);
    Sim.computeDemand(s);
    s.changed = false;
  };

  // Nach Bauaktionen: schnelle Aktualisierung
  Sim.afterEdit = function (s) {
    Sim.computePower(s);
    Sim.computeRoadDist(s);
    Sim.countStats(s);
    s.changed = false;
  };

  // ---------- Strom ----------
  Sim.computePower = function (s) {
    const { W, H, N, kind } = s;
    const pw = s.powered;
    pw.fill(0);
    const visited = new Uint8Array(N);
    const queue = new Int32Array(N);
    const byOrigin = new Map();
    for (const b of s.buildings) byOrigin.set(b.y * W + b.x, b);
    let totalCap = 0, totalUsed = 0, consumers = 0, head = 0, tail = 0;

    for (let i = 0; i < N; i++) {
      const k = kind[i];
      if (k === K.ZONE) consumers++;
      else if (k === K.BUILDING) {
        const bt = SC.BTYPES[s.lvl[i]];
        if (bt && !bt.power && bt.key !== 'park') consumers++;
      }
    }

    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t];
      if (!bt.power) continue;
      const o = b.y * W + b.x;
      if (visited[o]) continue;
      head = 0; tail = 0;
      queue[tail++] = o; visited[o] = 1;
      let cap = 0;
      const plants = new Set();
      while (head < tail) {
        const i = queue[head++];
        if (kind[i] === K.BUILDING) {
          const oo = s.origin[i];
          if (!plants.has(oo)) {
            plants.add(oo);
            const bb = byOrigin.get(oo);
            if (bb && SC.BTYPES[bb.t].power) cap += SC.BTYPES[bb.t].power;
          }
        }
        const x = i % W, y = (i / W) | 0;
        if (x > 0) visit(i - 1);
        if (x < W - 1) visit(i + 1);
        if (y > 0) visit(i - W);
        if (y < H - 1) visit(i + W);
      }
      // Verteilung in BFS-Reihenfolge (nahe Felder zuerst)
      let used = 0;
      for (let q = 0; q < tail; q++) {
        const i = queue[q], k = kind[i];
        if (k !== K.ZONE && k !== K.BUILDING) { pw[i] = 1; continue; }
        if (k === K.BUILDING) {
          const bt2 = SC.BTYPES[s.lvl[i]];
          if (bt2 && (bt2.power || bt2.key === 'park')) { pw[i] = 1; continue; }
        }
        if (used < cap) { pw[i] = 1; used++; }
      }
      totalCap += cap; totalUsed += used;
    }
    s.power = { capacity: totalCap, used: totalUsed, demand: consumers };

    function visit(j) {
      if (!visited[j] && SC.isConductor(kind[j])) { visited[j] = 1; queue[tail++] = j; }
    }
  };

  // ---------- Straßenanbindung (Chebyshev-Abstand bis 4) ----------
  Sim.computeRoadDist = function (s) {
    const { W, H, N, kind } = s;
    const d = s.roadDist;
    d.fill(255);
    const q = new Int32Array(N);
    let head = 0, tail = 0;
    for (let i = 0; i < N; i++) if (SC.isRoad(kind[i])) { d[i] = 0; q[tail++] = i; }
    while (head < tail) {
      const i = q[head++], nd = d[i] + 1;
      if (nd > 4) continue;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (d[j] > nd) { d[j] = nd; q[tail++] = j; }
        }
    }
  };

  function blur(src, W, H, passes) {
    let a = src, b = new Float32Array(a.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) {
        const r = y * W;
        for (let x = 0; x < W; x++) {
          const l = x > 0 ? a[r + x - 1] : a[r + x], rr = x < W - 1 ? a[r + x + 1] : a[r + x];
          b[r + x] = (l + a[r + x] + rr) / 3;
        }
      }
      for (let y = 0; y < H; y++) {
        const r = y * W, up = y > 0 ? r - W : r, dn = y < H - 1 ? r + W : r;
        for (let x = 0; x < W; x++) a[r + x] = (b[up + x] + b[r + x] + b[dn + x]) / 3;
      }
    }
    return a;
  }

  // ---------- Umwelt- und Versorgungskarten ----------
  Sim.computeMaps = function (s) {
    const { W, H, N, kind, zone, lvl, terrain } = s;
    Sim.computeRoadDist(s);

    // Verkehr
    const dens = new Float32Array(N);
    for (let i = 0; i < N; i++) if (kind[i] === K.ZONE) dens[i] = lvl[i] * (zone[i] === 2 ? 1.4 : zone[i] === 3 ? 1.1 : 1);
    blur(dens, W, H, 2);
    for (let i = 0; i < N; i++) s.traffic[i] = SC.isRoad(kind[i]) ? Math.min(255, dens[i] * 70) : 0;

    // Versorgung (Abdeckung)
    for (const key in s.cov) s.cov[key].fill(0);
    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t];
      if (!bt.radius) continue;
      const m = bt.key === 'stadium' ? s.cov.leisure : s.cov[bt.key];
      const cx = b.x + bt.size / 2 - 0.5, cy = b.y + bt.size / 2 - 0.5, r = bt.radius;
      const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(H - 1, Math.ceil(cy + r));
      const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(W - 1, Math.ceil(cx + r));
      for (let y = ya; y <= yb; y++)
        for (let x = xa; x <= xb; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r) continue;
          const v = bt.key === 'park' ? 1 - d / r : 1 - 0.7 * d / r;
          const i = y * W + x;
          if (v > m[i]) m[i] = v;
        }
    }

    // Verschmutzung
    const pol = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const k = kind[i];
      if (k === K.ZONE) { if (zone[i] === 3) pol[i] = lvl[i] * 50; else if (zone[i] === 2) pol[i] = lvl[i] * 6; }
      else if (k === K.BUILDING) {
        const bt = SC.BTYPES[lvl[i]];
        if (bt && bt.pollution) pol[i] = bt.pollution * 1.5;
        if (bt && bt.key === 'park') pol[i] = -40;
      }
      else if (SC.isRoad(k)) pol[i] = s.traffic[i] * 0.45;
      else if (terrain[i] === T.TREES) pol[i] = -12;
    }
    blur(pol, W, H, 3);
    for (let i = 0; i < N; i++) s.pollution[i] = SC.clamp(pol[i] * 1.4, 0, 255);

    // Natur (Wasser/Wald in der Nähe)
    const nat = new Float32Array(N);
    for (let i = 0; i < N; i++) nat[i] = terrain[i] === T.WATER ? 1 : (terrain[i] === T.TREES && kind[i] === K.EMPTY) ? 0.5 : 0;
    blur(nat, W, H, 3);

    // Kriminalität
    const cs = new Float32Array(N);
    for (let i = 0; i < N; i++) if (kind[i] === K.ZONE) cs[i] = lvl[i] * (zone[i] === 1 ? 9 : zone[i] === 2 ? 13 : 7);
    blur(cs, W, H, 2);
    for (let i = 0; i < N; i++) {
      let c = cs[i] * 2.2 + (40 - s.landValue[i]) * 0.25 - s.cov.police[i] * 85;
      if (kind[i] !== K.ZONE && cs[i] < 0.5) c = Math.min(c, 0);
      s.crime[i] = SC.clamp(c, 0, 100);
    }

    // Bodenwert
    for (let i = 0; i < N; i++) {
      const cv = s.cov;
      const lv = 22 + Math.min(1, nat[i] * 1.6) * 40 + cv.park[i] * 28 + cv.leisure[i] * 14 + cv.school[i] * 10 +
        cv.hospital[i] * 7 + cv.police[i] * 4 - s.pollution[i] / 255 * 60 - s.crime[i] * 0.2;
      s.landValue[i] = SC.clamp(lv, 0, 100);
    }
  };

  // ---------- Statistik & Nachfrage ----------
  Sim.countStats = function (s) {
    const { N, kind, zone, lvl } = s;
    let pop = 0, jobsC = 0, jobsI = 0, roads = 0, bridges = 0, wires = 0;
    const zones = [0, 0, 0, 0], free = [0, 0, 0, 0];
    let unpowered = 0, noRoad = 0, resPol = 0, crimeSum = 0;
    for (let i = 0; i < N; i++) {
      const k = kind[i];
      if (k === K.ZONE) {
        const z = zone[i], l = lvl[i], cap = SC.CAPACITY[z][l];
        zones[z]++;
        if (l === 0) free[z]++;
        if (z === 1) { pop += cap; resPol += s.pollution[i] * l; } else if (z === 2) jobsC += cap; else jobsI += cap;
        if (!s.powered[i]) unpowered++;
        if (s.roadDist[i] > 3) noRoad++;
        crimeSum += s.crime[i] * l;
      } else if (k === K.ROAD || k === K.ROADWIRE) {
        if (s.terrain[i] === T.WATER) bridges++; else roads++;
        if (k === K.ROADWIRE) wires++;
      } else if (k === K.WIRE) wires++;
    }
    const st = s.stats;
    st.pop = pop; st.jobsC = jobsC; st.jobsI = jobsI; st.jobs = jobsC + jobsI;
    st.roads = roads; st.bridges = bridges; st.wires = wires;
    st.zones = zones; st.free = free; st.unpowered = unpowered; st.noRoad = noRoad;
    st.avgPol = pop > 0 ? resPol / Math.max(1, pop / 20) : 0;
    st.avgCrime = (pop + jobsC + jobsI) > 0 ? crimeSum / Math.max(1, (pop + jobsC + jobsI) / 20) : 0;
  };

  Sim.computeDemand = function (s) {
    const st = s.stats, P = st.pop, C = st.jobsC, I = st.jobsI, J = C + I;
    const workforce = P * 0.55;
    let r = (J - workforce + 100) / Math.max(100, workforce * 0.5 + J * 0.2);
    let i = (P * 0.3 - I + 40) / Math.max(60, P * 0.15);
    let c = (P * 0.22 + I * 0.1 - C + 20) / Math.max(40, P * 0.1);
    const taxEff = (s.tax - 7) * 0.07;
    r -= taxEff; i -= taxEff; c -= taxEff;
    if (s.buildings.some(b => SC.BTYPES[b.t].key === 'stadium')) { c += 0.15; r += 0.05; }
    s.demand = { r: SC.clamp(r, -1, 1), c: SC.clamp(c, -1, 1), i: SC.clamp(i, -1, 1) };
  };

  Sim.maxLevel = function (s) {
    const p = s.stats.pop;
    return p < 250 ? 1 : p < 2000 ? 2 : 3;
  };

  // ---------- Wachstum einer Zone ----------
  function evalZone(s, i, maxL) {
    if (s.fire[i]) return;
    const z = s.zone[i];
    let l = s.lvl[i];
    const powered = s.powered[i] === 1;
    if (s.roadDist[i] > 3) {
      if (l > 0 && Math.random() < 0.35) s.lvl[i] = l - 1;
      return;
    }
    const d = z === 1 ? s.demand.r : z === 2 ? s.demand.c : s.demand.i;
    const lv = s.landValue[i] / 100, pol = s.pollution[i] / 255, cr = s.crime[i] / 100;
    let score = d * 1.2;
    if (z === 1) score += (lv - 0.25) * 0.9 - pol * 1.3 - cr * 0.6 + s.cov.school[i] * 0.15 + s.cov.hospital[i] * 0.12;
    else if (z === 2) score += (lv - 0.28) * 0.7 - cr * 0.5 - pol * 0.3 + (s.roadDist[i] <= 1 ? 0.06 : 0);
    else score += 0.08 - cr * 0.3;
    if (!powered) score = l === 0 ? -1 : -0.7;

    let cap = maxL;
    if (z !== 3 && lv < 0.42) cap = Math.min(cap, 2);
    if (z !== 3 && lv < 0.2) cap = Math.min(cap, 1);

    if (powered && score > 0.05 && l < cap) {
      if (Math.random() < 0.2 + score * 0.45) { s.lvl[i] = l + 1; s.vari[i] = (Math.random() * 256) | 0; }
    } else if (l > cap && Math.random() < 0.15) {
      s.lvl[i] = l - 1;
    } else if (score < -0.25 && l > 0) {
      if (Math.random() < Math.min(0.4, -score * 0.3)) s.lvl[i] = l - 1;
    }
  }

  // ---------- Feuer ----------
  function flammable(s, i) {
    const k = s.kind[i];
    return (k === K.ZONE && s.lvl[i] > 0) || (k === K.BUILDING && SC.BTYPES[s.lvl[i]].key !== 'fire' && !SC.BTYPES[s.lvl[i]].power) ||
      (k === K.EMPTY && s.terrain[i] === T.TREES);
  }
  Sim.ignite = function (s, i) {
    if (s.fire[i] || !flammable(s, i)) return false;
    s.fire[i] = 1;
    s.burning.push(i);
    return true;
  };
  function burnDown(s, i) {
    const k = s.kind[i];
    s.fire[i] = 0;
    if (k === K.ZONE) s.lvl[i] = 0;
    else if (k === K.BUILDING) { SC.Act.removeBuilding(s, i, K.RUBBLE); }
    else if (k === K.EMPTY) s.terrain[i] = T.GRASS;
  }
  Sim.updateFires = function (s) {
    if (!s.burning.length) return;
    const next = [];
    const W = s.W, H = s.H;
    for (const i of s.burning) {
      if (!s.fire[i]) continue;
      if (s.fire[i] < 250) s.fire[i]++;
      const cov = s.cov.fire[i];
      if (cov > 0.2 && s.fire[i] > 3 + (1 - cov) * 14) {
        s.fire[i] = 0;
        if (s.kind[i] === K.ZONE && s.lvl[i] > 0) s.lvl[i]--;
        continue;
      }
      if (Math.random() < 0.06) {
        const x = i % W, y = (i / W) | 0, dir = (Math.random() * 4) | 0;
        const nx = x + [1, -1, 0, 0][dir], ny = y + [0, 0, 1, -1][dir];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) {
          const j = ny * W + nx;
          if (!s.fire[j] && flammable(s, j)) { s.fire[j] = 1; next.push(j); }
        }
      }
      if (s.fire[i] > 22) { burnDown(s, i); s.changed = true; continue; }
      next.push(i);
    }
    s.burning = next;
    if (!next.length) SC.emit('firesOut');
  };

  // ---------- Haushalt ----------
  Sim.estimateBudget = function (s) {
    const st = s.stats;
    const income = Math.round(s.tax * (st.pop + 1.2 * st.jobs) * 0.018);
    let services = 0, power = 0;
    for (const b of s.buildings) {
      const bt = SC.BTYPES[b.t];
      if (bt.power) power += bt.upkeep; else services += bt.upkeep;
    }
    const roads = Math.round((st.roads || 0) * 0.08 + (st.bridges || 0) * 0.6 + (st.wires || 0) * 0.03);
    const expenses = services + power + roads;
    return { income, services, power, roads, expenses, net: income - expenses };
  };

  // ---------- Takt ----------
  Sim.tick = function (s) {
    if (s.changed) Sim.afterEdit(s);
    const maxL = Sim.maxLevel(s);
    const chunk = Math.ceil(s.N / 30);
    for (let n = 0; n < chunk; n++) {
      const i = (s.scanPos * STRIDE) % s.N;
      s.scanPos = (s.scanPos + 1) % s.N;
      if (s.kind[i] === K.ZONE) evalZone(s, i, maxL);
    }
    Sim.updateFires(s);
    if (s.changed) Sim.afterEdit(s);
    s.day++;
    if (s.day > 30) { s.day = 1; Sim.monthly(s); }
    Sim.countStats(s);
    Sim.computeDemand(s);
  };

  Sim.monthly = function (s) {
    Sim.computePower(s);
    Sim.computeMaps(s);
    Sim.countStats(s);
    Sim.computeDemand(s);
    const prevPop = s.history.length ? s.history[s.history.length - 1].pop : 0;

    // Haushalt
    const b = Sim.estimateBudget(s);
    s.money += b.net;
    s.budget = b;

    // Brände entstehen
    if (s.disasters && s.stats.pop > 150) {
      for (let tries = 0; tries < 25; tries++) {
        const i = (Math.random() * s.N) | 0;
        if (s.kind[i] !== K.ZONE || s.lvl[i] === 0) continue;
        const chance = 0.12 * (1 - s.cov.fire[i]) * (s.zone[i] === 3 ? 1.8 : 1);
        if (Math.random() < chance && Sim.ignite(s, i)) {
          SC.notify(s, 'Feuer ausgebrochen bei (' + (i % s.W) + ', ' + ((i / s.W) | 0) + ')!', 'bad');
          SC.emit('fire', i);
        }
        break;
      }
    }

    // Verlauf
    s.history.push({ y: s.year, m: s.month, pop: s.stats.pop, money: Math.round(s.money), jobs: s.stats.jobs, net: b.net });
    if (s.history.length > 600) s.history.shift();

    milestones(s, prevPop);
    advisor(s);

    s.month++;
    if (s.month > 11) {
      s.month = 0; s.year++;
      SC.emit('newYear', s);
    }
    SC.emit('month', s);
  };

  function milestones(s, prevPop) {
    const pop = s.stats.pop;
    for (const [p, n] of SC.CITY_CLASSES) {
      if (p > 0 && pop >= p && !s.flags['class_' + p]) {
        s.flags['class_' + p] = true;
        SC.notify(s, s.name + ' ist jetzt ' + (n === 'Dorf' ? 'ein ' : 'eine ') + n + '! (' + SC.fmtNum(p) + ' Einwohner)', 'good');
        SC.emit('milestone', n);
      }
    }
    for (const bt of SC.BTYPES) {
      if (bt && bt.minPop && pop >= bt.minPop && !s.flags['unlock_' + bt.key]) {
        s.flags['unlock_' + bt.key] = true;
        SC.notify(s, 'Neu freigeschaltet: ' + bt.name + '!', 'good');
        SC.emit('unlock', bt);
      }
    }
  }

  function advise(s, key, months, msg, type) {
    const now = s.year * 12 + s.month;
    if (s.advisor[key] != null && now - s.advisor[key] < months) return;
    s.advisor[key] = now;
    SC.notify(s, msg, type || 'warn');
  }

  function advisor(s) {
    const st = s.stats, totalZones = st.zones[1] + st.zones[2] + st.zones[3];
    const hasType = key => s.buildings.some(b => SC.BTYPES[b.t].key === key);
    if (s.money < 0) advise(s, 'money', 3, 'Die Stadtkasse ist leer! Erhöhe die Steuern oder senke die Ausgaben.', 'bad');
    if (totalZones > 0 && s.power.capacity === 0) advise(s, 'nopower', 4, 'Deine Zonen haben keinen Strom. Baue ein Kraftwerk und verbinde es per Stromleitung.');
    else if (s.power.demand > s.power.capacity) advise(s, 'powerlow', 4, 'Stromknappheit! Der Bedarf übersteigt die Kraftwerksleistung.', 'bad');
    else if (st.unpowered > 0) advise(s, 'powerconn', 6, 'Einige Zonen sind nicht ans Stromnetz angeschlossen.');
    if (st.noRoad > 4) advise(s, 'road', 6, 'Manche Zonen sind zu weit von einer Straße entfernt (max. 3 Felder).');
    if (s.demand.r > 0.5 && st.free[1] < 4 && totalZones > 0) advise(s, 'needR', 6, 'Die Menschen wollen nach ' + s.name + ' ziehen – weise mehr Wohnzonen aus!', 'info');
    if (s.demand.c > 0.5 && st.free[2] < 3 && st.pop > 50) advise(s, 'needC', 6, 'Händler suchen Platz – weise mehr Gewerbezonen aus!', 'info');
    if (s.demand.i > 0.5 && st.free[3] < 3 && st.pop > 50) advise(s, 'needI', 6, 'Die Industrie möchte expandieren – weise mehr Industriezonen aus!', 'info');
    if (st.pop > 600 && st.avgCrime > 25) advise(s, 'crime', 8, 'Die Kriminalität steigt. Baue Polizeiwachen in dicht besiedelten Gebieten.');
    if (st.pop > 600 && st.avgPol > 60) advise(s, 'pollution', 8, 'Bürger klagen über Luftverschmutzung. Trenne Wohnen und Industrie, baue Parks oder setze auf Solarstrom.');
    if (st.pop > 1200 && !hasType('fire')) advise(s, 'fire', 10, 'Ohne Feuerwehr können sich Brände ungehindert ausbreiten.');
    if (st.pop > 2500 && !hasType('school')) advise(s, 'school', 12, 'Familien wünschen sich Schulen.', 'info');
    if (st.pop > 4000 && !hasType('hospital')) advise(s, 'hospital', 12, 'Die Bevölkerung braucht ein Krankenhaus.', 'info');
  }
})(window.SC);
