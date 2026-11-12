'use strict';
/* Heliotown – Grunddaten, Konstanten und Hilfsfunktionen */
window.SC = window.SC || {};
(function (SC) {
  SC.VERSION = 1;

  // Gelände
  SC.TER = { GRASS: 0, WATER: 1, TREES: 2 };
  // Feldarten
  SC.KIND = { EMPTY: 0, ROAD: 1, WIRE: 2, ROADWIRE: 3, ZONE: 4, BUILDING: 5, RUBBLE: 6 };

  SC.ZONE_COLORS = ['', '#3fbf5a', '#3a8ef0', '#f2b21b'];
  // Einwohner (Wohnen) bzw. Arbeitsplätze (Gewerbe/Industrie) je Ausbaustufe 0..3
  SC.CAPACITY = [null, [0, 12, 40, 110], [0, 8, 25, 70], [0, 12, 35, 80]];

  SC.COST = { road: 10, bridge: 60, wire: 5, wireWater: 25, zone: 10, trees: 3, rubble: 5, bulldoze: 5, demolish: 40 };

  // Sichtbare Texte (Namen, Beschreibungen, Monate …) stehen in i18n.js
  Object.defineProperty(SC, 'MONTHS', { get: () => SC.t('months') });
  Object.defineProperty(SC, 'ZONE_NAMES', { get: () => ['', SC.t('zone.1'), SC.t('zone.2'), SC.t('zone.3')] });

  // Gebäudetypen (Index = ID)
  SC.BTYPES = [null,
    { key: 'coal', size: 3, cost: 3000, upkeep: 30, power: 900, pollution: 255, icon: '🏭', group: 'energy' },
    { key: 'solar', size: 3, cost: 6500, upkeep: 40, power: 600, icon: '☀️', group: 'energy' },
    { key: 'wind', size: 1, cost: 450, upkeep: 4, power: 50, icon: '🌬️', group: 'energy' },
    { key: 'police', size: 2, cost: 700, upkeep: 25, radius: 14, icon: '🚓', group: 'services' },
    { key: 'fire', size: 2, cost: 700, upkeep: 25, radius: 14, icon: '🚒', group: 'services' },
    { key: 'school', size: 2, cost: 900, upkeep: 30, radius: 16, icon: '🏫', group: 'services' },
    { key: 'hospital', size: 2, cost: 1200, upkeep: 40, radius: 18, icon: '🏥', group: 'services' },
    { key: 'park', size: 1, cost: 60, upkeep: 1, radius: 5, icon: '🌳', group: 'leisure' },
    { key: 'stadium', size: 3, cost: 9000, upkeep: 90, radius: 30, minPop: 3000, icon: '🏟️', group: 'leisure' }
  ];
  SC.BKEY = {};
  SC.BTYPES.forEach((b, i) => {
    if (!b) return;
    b.id = i; SC.BKEY[b.key] = b;
    Object.defineProperty(b, 'name', { get: () => SC.t('b.' + b.key) });
    Object.defineProperty(b, 'desc', { get: () => SC.t('b.' + b.key + '.desc') });
  });

  // Werkzeuge
  SC.TOOLS = [
    { id: 'query', icon: '🔍', key: 'q', group: 'tools' },
    { id: 'bulldoze', icon: '🚜', key: 'b', group: 'tools', drag: 'rect', cost: SC.COST.bulldoze },
    { id: 'road', icon: '🛣️', key: 'r', group: 'infra', drag: 'line', cost: SC.COST.road },
    { id: 'wire', icon: '⚡', key: 'l', group: 'infra', drag: 'line', cost: SC.COST.wire },
    { id: 'zoneR', icon: '🏠', key: 'w', group: 'zones', drag: 'rect', zone: 1, cost: SC.COST.zone },
    { id: 'zoneC', icon: '🏬', key: 'g', group: 'zones', drag: 'rect', zone: 2, cost: SC.COST.zone },
    { id: 'zoneI', icon: '⚙️', key: 'i', group: 'zones', drag: 'rect', zone: 3, cost: SC.COST.zone }
  ];
  SC.BTYPES.forEach(b => {
    if (!b) return;
    SC.TOOLS.push({ id: 'b_' + b.key, icon: b.icon, group: b.group, building: b.id,
      drag: b.size === 1 ? 'rect' : null, cost: b.cost });
  });
  SC.TOOL = {};
  SC.TOOLS.forEach(tool => {
    SC.TOOL[tool.id] = tool;
    const base = tool.building ? 'b.' + SC.BTYPES[tool.building].key : 'tool.' + tool.id;
    Object.defineProperty(tool, 'name', { get: () => SC.t(base) });
    Object.defineProperty(tool, 'desc', { get: () => SC.t(base + '.desc') });
    Object.defineProperty(tool, 'groupName', { get: () => SC.t('grp.' + tool.group) });
  });

  // Einwohnerschwellen der Stadtgrößen; Namen in i18n.js ('class', 'classA')
  SC.CITY_CLASSES = [0, 500, 2000, 10000, 40000, 100000];
  SC.cityClassIndex = function (pop) {
    let idx = 0;
    SC.CITY_CLASSES.forEach((p, i) => { if (pop >= p) idx = i; });
    return idx;
  };
  SC.cityClass = pop => SC.t('class')[SC.cityClassIndex(pop)];

  // Millisekunden je Spieltag pro Geschwindigkeitsstufe
  SC.SPEEDS = [0, 200, 70, 18];

  // ---------- Hilfsfunktionen ----------
  SC.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  SC.hash = function (i) {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  SC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SC.fmtNum = n => Math.round(n).toLocaleString(SC.locale());
  SC.fmtMoney = (n, decimals) => {
    const v = Math.abs(decimals ? n : Math.round(n)).toLocaleString(SC.locale(), { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
    return (n < 0 ? '−' : '') + (SC.lang === 'de' ? v + ' €' : '€' + v);
  };
  SC.dateStr = s => SC.MONTHS[s.month] + ' ' + s.year;
  SC.msgText = e => (e.k ? SC.t(e.k, e.p || undefined) : e.msg);
  SC.msgDate = e => (e.k ? SC.MONTHS[e.m] + ' ' + e.y : e.d);
  SC.esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Einfacher Nachrichtenkanal
  SC.listeners = {};
  SC.on = (ev, fn) => { (SC.listeners[ev] = SC.listeners[ev] || []).push(fn); };
  SC.emit = (ev, data) => { (SC.listeners[ev] || []).forEach(fn => fn(data)); };
  // Meldungen werden als Schlüssel + Parameter gespeichert, damit sie die Sprache wechseln können.
  // Ältere Spielstände enthalten fertigen Text (msg) und ein Datum als Text (d).
  SC.notify = function (s, key, params, type) {
    const entry = { k: key, p: params || null, m: s.month, y: s.year, type: type || 'info' };
    s.log.push(entry);
    if (s.log.length > 60) s.log.shift();
    SC.emit('notify', entry);
  };
})(window.SC);
