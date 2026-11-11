'use strict';
/* SunCity – Grunddaten, Konstanten und Hilfsfunktionen */
window.SC = window.SC || {};
(function (SC) {
  SC.VERSION = 1;

  // Gelände
  SC.TER = { GRASS: 0, WATER: 1, TREES: 2 };
  // Feldarten
  SC.KIND = { EMPTY: 0, ROAD: 1, WIRE: 2, ROADWIRE: 3, ZONE: 4, BUILDING: 5, RUBBLE: 6 };

  SC.ZONE_NAMES = ['', 'Wohngebiet', 'Gewerbegebiet', 'Industriegebiet'];
  SC.ZONE_COLORS = ['', '#3fbf5a', '#3a8ef0', '#f2b21b'];
  // Einwohner (Wohnen) bzw. Arbeitsplätze (Gewerbe/Industrie) je Ausbaustufe 0..3
  SC.CAPACITY = [null, [0, 12, 40, 110], [0, 8, 25, 70], [0, 12, 35, 80]];

  SC.COST = { road: 10, bridge: 60, wire: 5, wireWater: 25, zone: 10, trees: 3, rubble: 5, bulldoze: 5, demolish: 40 };

  SC.MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  // Gebäudetypen (Index = ID)
  SC.BTYPES = [null,
    { key: 'coal', name: 'Kohlekraftwerk', size: 3, cost: 3000, upkeep: 30, power: 900, pollution: 255, icon: '🏭', group: 'Energie',
      desc: 'Günstiger Strom für 900 Felder – verschmutzt aber stark die Luft.' },
    { key: 'solar', name: 'Solarpark', size: 3, cost: 6500, upkeep: 40, power: 600, icon: '☀️', group: 'Energie',
      desc: 'Sauberer Sonnenstrom für 600 Felder – das Herz von SunCity.' },
    { key: 'wind', name: 'Windrad', size: 1, cost: 450, upkeep: 4, power: 50, icon: '🌬️', group: 'Energie',
      desc: 'Kleines, sauberes Windrad für 50 Felder.' },
    { key: 'police', name: 'Polizeiwache', size: 2, cost: 700, upkeep: 25, radius: 14, icon: '🚓', group: 'Dienste',
      desc: 'Senkt die Kriminalität im Umkreis.' },
    { key: 'fire', name: 'Feuerwache', size: 2, cost: 700, upkeep: 25, radius: 14, icon: '🚒', group: 'Dienste',
      desc: 'Löscht Brände im Umkreis schnell.' },
    { key: 'school', name: 'Schule', size: 2, cost: 900, upkeep: 30, radius: 16, icon: '🏫', group: 'Dienste',
      desc: 'Bildung macht Wohngebiete attraktiver.' },
    { key: 'hospital', name: 'Krankenhaus', size: 2, cost: 1200, upkeep: 40, radius: 18, icon: '🏥', group: 'Dienste',
      desc: 'Gesundheitsversorgung steigert die Lebensqualität.' },
    { key: 'park', name: 'Park', size: 1, cost: 60, upkeep: 1, radius: 5, icon: '🌳', group: 'Freizeit',
      desc: 'Erhöht den Bodenwert und senkt die Verschmutzung.' },
    { key: 'stadium', name: 'Stadion', size: 3, cost: 9000, upkeep: 90, radius: 30, minPop: 3000, icon: '🏟️', group: 'Freizeit',
      desc: 'Großer Bodenwert-Bonus und mehr Gewerbe. Ab 3.000 Einwohnern.' }
  ];
  SC.BKEY = {};
  SC.BTYPES.forEach((b, i) => { if (b) { b.id = i; SC.BKEY[b.key] = b; } });

  // Werkzeuge
  SC.TOOLS = [
    { id: 'query', name: 'Info', icon: '🔍', key: 'q', group: 'Werkzeuge',
      desc: 'Feld anklicken zeigt Details. Ziehen verschiebt die Karte.' },
    { id: 'bulldoze', name: 'Abreißen', icon: '🚜', key: 'b', group: 'Werkzeuge', drag: 'rect', cost: SC.COST.bulldoze,
      desc: 'Entfernt Gebäude, Straßen, Leitungen, Zonen und Bäume.' },
    { id: 'road', name: 'Straße', icon: '🛣️', key: 'r', group: 'Infrastruktur', drag: 'line', cost: SC.COST.road,
      desc: 'Erschließt Zonen (max. 3 Felder Abstand) und leitet Strom. Über Wasser entstehen Brücken.' },
    { id: 'wire', name: 'Stromleitung', icon: '⚡', key: 'l', group: 'Infrastruktur', drag: 'line', cost: SC.COST.wire,
      desc: 'Überbrückt freies Gelände oder Wasser zwischen Kraftwerk und Stadt. Straßen, Zonen und Gebäude leiten Strom selbst weiter.' },
    { id: 'zoneR', name: 'Wohnzone', icon: '🏠', key: 'w', group: 'Zonen', drag: 'rect', zone: 1, cost: SC.COST.zone,
      desc: 'Hier ziehen Einwohner hin. Braucht Strom und Straße.' },
    { id: 'zoneC', name: 'Gewerbezone', icon: '🏬', key: 'g', group: 'Zonen', drag: 'rect', zone: 2, cost: SC.COST.zone,
      desc: 'Läden und Büros schaffen Arbeitsplätze.' },
    { id: 'zoneI', name: 'Industriezone', icon: '⚙️', key: 'i', group: 'Zonen', drag: 'rect', zone: 3, cost: SC.COST.zone,
      desc: 'Fabriken bieten viele Jobs, verschmutzen aber die Umgebung.' }
  ];
  SC.BTYPES.forEach(b => {
    if (!b) return;
    SC.TOOLS.push({ id: 'b_' + b.key, name: b.name, icon: b.icon, group: b.group, building: b.id,
      drag: b.size === 1 ? 'rect' : null, cost: b.cost, desc: b.desc });
  });
  SC.TOOL = {};
  SC.TOOLS.forEach(t => { SC.TOOL[t.id] = t; });

  SC.CITY_CLASSES = [[0, 'Siedlung'], [500, 'Dorf'], [2000, 'Kleinstadt'], [10000, 'Stadt'], [40000, 'Großstadt'], [100000, 'Metropole']];
  SC.cityClass = function (pop) {
    let name = SC.CITY_CLASSES[0][1];
    for (const [p, n] of SC.CITY_CLASSES) if (pop >= p) name = n;
    return name;
  };

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
  SC.fmtNum = n => Math.round(n).toLocaleString('de-DE');
  SC.fmtMoney = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('de-DE') + ' €';
  SC.dateStr = s => SC.MONTHS[s.month] + ' ' + s.year;
  SC.esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Einfacher Nachrichtenkanal
  SC.listeners = {};
  SC.on = (ev, fn) => { (SC.listeners[ev] = SC.listeners[ev] || []).push(fn); };
  SC.emit = (ev, data) => { (SC.listeners[ev] || []).forEach(fn => fn(data)); };
  SC.notify = function (s, msg, type) {
    const entry = { d: SC.dateStr(s), msg, type: type || 'info' };
    s.log.push(entry);
    if (s.log.length > 60) s.log.shift();
    SC.emit('notify', entry);
  };
})(window.SC);
