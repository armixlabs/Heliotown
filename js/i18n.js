'use strict';
/* Heliotown – Übersetzungen (Deutsch / Englisch)
 *
 * SC.t('schluessel', { name: 'Wert' }) liefert den Text in der aktuellen Sprache.
 * Platzhalter in geschweiften Klammern werden ersetzt. Beginnt ein Parameterwert mit '@',
 * wird er selbst als Schlüssel übersetzt (z. B. { b: '@b.stadium' }).
 * Fehlt ein Text in der aktuellen Sprache, wird Deutsch verwendet, sonst der Schlüssel.
 */
(function (SC) {
  const de = {
    // Allgemein
    'app.tagline': 'Plane, baue und verwalte deine eigene Stadt.',
    'app.defaultCity': 'Heliotown',
    'btn.back': 'Zurück', 'btn.close': 'Schließen', 'btn.ok': 'OK',
    'lang.name': 'Deutsch',

    // Hauptmenü
    'menu.resume': 'Zurück zum Spiel', 'menu.continue': 'Weiterspielen', 'menu.new': 'Neues Spiel',
    'menu.load': 'Spiel laden / speichern', 'menu.import': 'Spielstand-Datei importieren',
    'menu.settings': 'Einstellungen', 'menu.help': 'Anleitung', 'menu.language': 'Sprache',
    'menu.offline': 'Läuft komplett offline. Spielstände werden lokal in diesem Browser gespeichert –<br>zum Umziehen auf einen anderen PC als Datei exportieren.',
    'menu.residents': '{n} Einwohner',

    // Neues Spiel
    'ng.title': 'Neues Spiel', 'ng.name': 'Stadtname', 'ng.size': 'Kartengröße',
    'ng.small': 'Klein', 'ng.medium': 'Mittel', 'ng.large': 'Groß',
    'ng.water': 'Wasser', 'ng.little': 'Wenig', 'ng.normal': 'Normal', 'ng.much': 'Viel',
    'ng.diff': 'Schwierigkeit', 'ng.easy': 'Leicht', 'ng.hard': 'Schwer',
    'ng.disasters': 'Katastrophen', 'ng.fires': 'Brände können ausbrechen',
    'ng.seed': 'Karten-Nr.', 'ng.newMap': 'Neue Karte', 'ng.preview': 'Vorschau', 'ng.go': 'Stadt gründen',
    'ng.confirm': 'Das aktuelle Spiel wird beendet. Nicht gespeicherter Fortschritt geht verloren (außer im Autosave). Fortfahren?',
    'ng.tip': 'Tipp: Baue zuerst ein Kraftwerk, dann Straßen und Zonen. Öffne ❓ für die Anleitung.',
    'ng.names': ['Sonnenstadt', 'Neu-Sonnfeld', 'Lichtenau', 'Sonnenberg', 'Helioshafen', 'Goldtal', 'Sommerau'],

    // Kopfleiste und Seitenleiste
    'tb.menu': 'Hauptmenü', 'tb.date': 'Datum', 'tb.money': 'Kassenstand', 'tb.pop': 'Einwohner',
    'tb.power': 'Strom: verbraucht / Kapazität (Felder)', 'tb.rci': 'Nachfrage: Wohnen / Gewerbe / Industrie',
    'rci.r': 'W', 'rci.c': 'G', 'rci.i': 'I',
    'tb.pause': 'Pause [Leertaste]', 'tb.slow': 'Langsam [1]', 'tb.normal': 'Normal [2]', 'tb.fast': 'Schnell [3]',
    'tb.rotL': 'Ansicht nach links drehen [Z]', 'tb.rotR': 'Ansicht nach rechts drehen [X]',
    'tb.budget': 'Haushalt', 'tb.stats': 'Statistik', 'tb.save': 'Speichern', 'tb.help': 'Hilfe',
    'view.2d': '2D-Ansicht', 'view.3d': '3D-Ansicht',
    'view.to2d': 'Zur Draufsicht wechseln [V]', 'view.to3d': 'Zur 3D-Ansicht wechseln [V]',
    'side.view': 'Ansicht', 'side.minimap': 'Klicken zum Hinspringen', 'ticker.title': 'Klicken für alle Nachrichten',

    // Werkzeuggruppen, Werkzeuge, Gebäude
    'grp.tools': 'Werkzeuge', 'grp.infra': 'Infrastruktur', 'grp.zones': 'Zonen',
    'grp.energy': 'Energie', 'grp.services': 'Dienste', 'grp.leisure': 'Freizeit',
    'tool.query': 'Info', 'tool.query.desc': 'Feld anklicken zeigt Details. Ziehen verschiebt die Karte.',
    'tool.bulldoze': 'Abreißen', 'tool.bulldoze.desc': 'Entfernt Gebäude, Straßen, Leitungen, Zonen und Bäume.',
    'tool.road': 'Straße', 'tool.road.desc': 'Erschließt Zonen (max. 3 Felder Abstand) und leitet Strom. Über Wasser entstehen Brücken.',
    'tool.wire': 'Stromleitung', 'tool.wire.desc': 'Überbrückt freies Gelände oder Wasser zwischen Kraftwerk und Stadt. Straßen, Zonen und Gebäude leiten Strom selbst weiter.',
    'tool.zoneR': 'Wohnzone', 'tool.zoneR.desc': 'Hier ziehen Einwohner hin. Braucht Strom und Straße.',
    'tool.zoneC': 'Gewerbezone', 'tool.zoneC.desc': 'Läden und Büros schaffen Arbeitsplätze.',
    'tool.zoneI': 'Industriezone', 'tool.zoneI.desc': 'Fabriken bieten viele Jobs, verschmutzen aber die Umgebung.',
    'b.coal': 'Kohlekraftwerk', 'b.coal.desc': 'Günstiger Strom für 900 Felder – verschmutzt aber stark die Luft.',
    'b.solar': 'Solarpark', 'b.solar.desc': 'Sauberer Sonnenstrom für 600 Felder – das Herz von Heliotown.',
    'b.wind': 'Windrad', 'b.wind.desc': 'Kleines, sauberes Windrad für 50 Felder.',
    'b.police': 'Polizeiwache', 'b.police.desc': 'Senkt die Kriminalität im Umkreis.',
    'b.fire': 'Feuerwache', 'b.fire.desc': 'Löscht Brände im Umkreis schnell.',
    'b.school': 'Schule', 'b.school.desc': 'Bildung macht Wohngebiete attraktiver.',
    'b.hospital': 'Krankenhaus', 'b.hospital.desc': 'Gesundheitsversorgung steigert die Lebensqualität.',
    'b.park': 'Park', 'b.park.desc': 'Erhöht den Bodenwert und senkt die Verschmutzung.',
    'b.stadium': 'Stadion', 'b.stadium.desc': 'Großer Bodenwert-Bonus und mehr Gewerbe. Ab 3.000 Einwohnern.',

    // Zonen, Monate, Stadtgrößen
    'zone.1': 'Wohngebiet', 'zone.2': 'Gewerbegebiet', 'zone.3': 'Industriegebiet',
    'lvl.1': ['Unbebaut', 'Einfamilienhäuser', 'Mehrfamilienhaus', 'Wohnturm'],
    'lvl.2': ['Unbebaut', 'Laden', 'Bürogebäude', 'Geschäftsturm'],
    'lvl.3': ['Unbebaut', 'Werkstatt', 'Fabrik', 'Industriekomplex'],
    'months': ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    'class': ['Siedlung', 'Dorf', 'Kleinstadt', 'Stadt', 'Großstadt', 'Metropole'],
    'classA': ['eine Siedlung', 'ein Dorf', 'eine Kleinstadt', 'eine Stadt', 'eine Großstadt', 'eine Metropole'],

    // Ansichten (Overlays) und Legenden
    'ov.none': 'Normal', 'ov.power': 'Strom', 'ov.roads': 'Anbindung', 'ov.pollution': 'Verschmutzung',
    'ov.crime': 'Kriminalität', 'ov.landValue': 'Bodenwert', 'ov.traffic': 'Verkehr', 'ov.police': 'Polizei',
    'ov.fire': 'Feuerwehr', 'ov.school': 'Bildung', 'ov.hospital': 'Gesundheit',
    'lg.powered': 'versorgt', 'lg.unpowered': 'ohne Strom', 'lg.connected': 'erschlossen',
    'lg.noRoad': 'keine Straße in 3 Feldern', 'lg.low': 'niedrig', 'lg.high': 'hoch', 'lg.light': 'wenig', 'lg.jam': 'Stau',
    'lg.police': 'Abdeckung durch Polizeiwachen', 'lg.fire': 'Abdeckung durch Feuerwachen',
    'lg.school': 'Einzugsgebiet von Schulen', 'lg.hospital': 'Einzugsgebiet von Krankenhäusern',

    // Bau-Vorschau und Rückmeldungen
    'pv.tiles': '{n} Felder', 'pv.lockedFrom': '🔒 ab {n} Einwohnern', 'pv.notHere': 'hier nicht möglich',
    'pv.tooExpensive': 'zu teuer!', 'tool.lockedShort': '🔒 ab {n} EW',
    'toast.noSpace': 'Hier ist kein Platz für {b}.', 'toast.noMoney': 'Nicht genug Geld in der Stadtkasse!',
    'toast.locked': 'Noch nicht freigeschaltet.',
    'toast.firstPlant': 'Tipp: Verbinde das Kraftwerk mit Straße oder Stromleitung mit deiner Stadt – Straßen und Zonen leiten Strom weiter.',
    'toast.noStorage': 'Lokaler Speicher ist in diesem Browser nicht verfügbar – Spielstände bitte als Datei exportieren.',
    'toast.quickSaved': 'Spiel gespeichert (Autosave).', 'toast.saveFail': 'Speichern fehlgeschlagen: {e}',
    'toast.autosaved': 'Automatisch gespeichert.',
    'toast.autosaveFail': 'Autosave fehlgeschlagen – Speicher voll? Exportiere deine Stadt als Datei.',
    'toast.loaded': '„{name}“ geladen.', 'toast.loadFail': 'Laden fehlgeschlagen: {e}',
    'toast.imported': '„{name}“ importiert. Tipp: Über 💾 kannst du es im Browser speichern.',
    'toast.importFail': 'Import fehlgeschlagen: {e}', 'toast.savedAs': 'Gespeichert: {name}',
    'toast.saveFull': 'Speichern fehlgeschlagen (Speicher voll?). Lösche alte Stände oder exportiere als Datei.',
    'toast.milestone': '🎉 {cls}!',
    'confirm.import': 'Importierten Spielstand „{name}“ laden? Das aktuelle Spiel wird beendet.',
    'confirm.overwrite': 'Spielstand „{name}“ überschreiben?',
    'confirm.load': 'Spielstand laden? Nicht gespeicherter Fortschritt geht verloren.',
    'confirm.delete': 'Spielstand „{name}“ endgültig löschen? Das kann nicht rückgängig gemacht werden.',

    // Info-Panel
    'i.landValue': 'Bodenwert', 'i.pollution': 'Verschmutzung', 'i.crime': 'Kriminalität',
    'i.policeCov': 'Polizeischutz', 'i.fireCov': 'Brandschutz', 'i.residents': 'Einwohner', 'i.jobs': 'Arbeitsplätze',
    'i.level': 'Ausbaustufe', 'i.power': 'Strom', 'i.powered': 'versorgt', 'i.noPower': 'kein Strom',
    'i.roadAccess': 'Straßenanbindung', 'i.yes': 'ja', 'i.noRoad': 'keine Straße in 3 Feldern',
    'i.school': 'Schule', 'i.hospital': 'Krankenhaus', 'i.upkeep': 'Unterhalt', 'i.perMonth': '{v} / Monat',
    'i.output': 'Leistung', 'i.tiles': '{n} Felder', 'i.grid': 'Netz gesamt', 'i.env': 'Umwelt',
    'i.heavyPol': '⚠️ stark verschmutzend', 'i.range': 'Reichweite', 'i.bridge': '🌉 Brücke', 'i.road': '🛣️ Straße',
    'i.withWire': ' mit Stromleitung', 'i.traffic': 'Verkehr', 'i.wire': '⚡ Stromleitung', 'i.live': 'unter Spannung',
    'i.notConnected': 'nicht verbunden', 'i.rubble': '🧱 Trümmer',
    'i.rubbleHint': 'Mit dem Abriss-Werkzeug räumen oder direkt überbauen.',
    'i.water': '🌊 Wasser', 'i.forest': '🌲 Wald', 'i.meadow': '🌱 Wiese', 'i.burning': '🔥 Hier brennt es!',
    'i.position': 'Position',

    // Speichern und Laden
    'sl.titleSave': 'Speichern & Laden', 'sl.titleLoad': 'Spiel laden', 'sl.save': 'Speichern',
    'sl.none': 'Noch keine Spielstände vorhanden.', 'sl.res': 'EW', 'sl.savedAt': 'gespeichert {t}',
    'sl.load': 'Laden', 'sl.export': 'Als Datei exportieren', 'sl.delete': 'Löschen',
    'sl.used': 'Belegt: {n} KB (Browser-Limit ca. 5.000 KB)', 'sl.importFile': 'Datei importieren',
    'sl.exportCurrent': 'Aktuelles Spiel exportieren', 'sl.autoLabel': 'Automatisch gespeichert',
    'sl.note': 'Exportierte Dateien (.heliotown.json) kannst du auf einen anderen PC kopieren und dort importieren.',

    // Haushalt
    'bd.title': 'Haushalt', 'bd.tax': 'Steuersatz',
    'bd.note': 'Einnahmen und Ausgaben werden monatlich verbucht. Steuern über 7 % bremsen das Wachstum, niedrigere fördern es.',
    'bd.hint1': 'Sehr niedrige Steuern – die Stadt wächst schnell, aber die Kasse leidet.',
    'bd.hint2': 'Ausgewogene Steuern.', 'bd.hint3': 'Erhöhte Steuern – das Wachstum verlangsamt sich.',
    'bd.hint4': 'Sehr hohe Steuern – Bürger und Firmen ziehen weg!',
    'bd.forecastMonth': 'Prognose pro Monat', 'bd.taxIncome': 'Steuereinnahmen', 'bd.roads': 'Straßen & Leitungen',
    'bd.plants': 'Kraftwerke', 'bd.services': 'Öffentliche Dienste & Parks', 'bd.net': 'Saldo pro Monat',
    'bd.year': 'Prognose pro Jahr', 'bd.last': 'Letzter Monat', 'bd.cash': 'Kassenstand',

    // Statistik
    'st.title': 'Statistik', 'st.pop': 'Einwohner', 'st.size': 'Stadtgröße', 'st.jobsC': 'Jobs Gewerbe',
    'st.jobsI': 'Jobs Industrie', 'st.zR': 'Wohnzonen', 'st.zC': 'Gewerbezonen', 'st.zI': 'Industriezonen',
    'st.roads': 'Straßen', 'st.power': 'Strom', 'st.unpowered': 'Ohne Strom', 'st.pf': 'Polizei / Feuerwehr',
    'st.sh': 'Schulen / Kliniken', 'st.chPop': 'Einwohner', 'st.chMoney': 'Kassenstand', 'st.news': 'Nachrichten',
    'ch.few': 'Noch zu wenige Daten – lass die Zeit laufen.', 'ch.last': 'letzte {n} Monate',

    // Einstellungen
    'se.title': 'Einstellungen', 'se.city': 'Stadtname', 'se.disasters': 'Katastrophen',
    'se.fires': 'Brände können ausbrechen', 'se.autosave': 'Autosave', 'se.autoDesc': 'jedes Spieljahr und alle 2 Minuten',
    'se.language': 'Sprache', 'se.apply': 'Übernehmen',

    // Meldungen der Simulation
    'msg.welcome': 'Willkommen in {city}! Baue ein Kraftwerk, Straßen und Zonen.',
    'msg.fire': 'Feuer ausgebrochen bei ({x}, {y})!',
    'msg.class': '{city} ist jetzt {clsA}! ({n} Einwohner)',
    'msg.unlock': 'Neu freigeschaltet: {b}!',
    'adv.money': 'Die Stadtkasse ist leer! Erhöhe die Steuern oder senke die Ausgaben.',
    'adv.nopower': 'Deine Zonen haben keinen Strom. Baue ein Kraftwerk und verbinde es per Stromleitung.',
    'adv.powerlow': 'Stromknappheit! Der Bedarf übersteigt die Kraftwerksleistung.',
    'adv.powerconn': 'Einige Zonen sind nicht ans Stromnetz angeschlossen.',
    'adv.road': 'Manche Zonen sind zu weit von einer Straße entfernt (max. 3 Felder).',
    'adv.needR': 'Die Menschen wollen nach {city} ziehen – weise mehr Wohnzonen aus!',
    'adv.needC': 'Händler suchen Platz – weise mehr Gewerbezonen aus!',
    'adv.needI': 'Die Industrie möchte expandieren – weise mehr Industriezonen aus!',
    'adv.crime': 'Die Kriminalität steigt. Baue Polizeiwachen in dicht besiedelten Gebieten.',
    'adv.pollution': 'Bürger klagen über Luftverschmutzung. Trenne Wohnen und Industrie, baue Parks oder setze auf Solarstrom.',
    'adv.fire': 'Ohne Feuerwehr können sich Brände ungehindert ausbreiten.',
    'adv.school': 'Familien wünschen sich Schulen.',
    'adv.hospital': 'Die Bevölkerung braucht ein Krankenhaus.',

    // Fehler
    'err.invalid': 'Keine gültige Heliotown-Spielstanddatei.',
    'err.newer': 'Der Spielstand stammt aus einer neueren Heliotown-Version.',
    'err.notFound': 'Spielstand nicht gefunden.',

    // Anleitung
    'help.title': 'Anleitung', 'help.go': 'Los geht’s!',
    'help.html':
      '<h3>So startest du</h3><ol>' +
      '<li><b>Kraftwerk bauen</b> (Kohle, Solar oder Windrad).</li>' +
      '<li><b>Straßen ziehen</b> – Zonen brauchen eine Straße in höchstens 3 Feldern Abstand.</li>' +
      '<li><b>Zonen ausweisen</b>: Wohnen, Gewerbe und Industrie per Ziehen aufspannen.</li>' +
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
      '<li><kbd>Q</kbd> Info · <kbd>B</kbd> Abriss · <kbd>R</kbd> Straße · <kbd>L</kbd> Leitung · <kbd>W</kbd> Wohnen · <kbd>G</kbd> Gewerbe · <kbd>I</kbd> Industrie · <kbd>Esc</kbd> abbrechen</li>' +
      '<li><kbd>Strg</kbd>+<kbd>S</kbd> Schnellspeichern</li></ul>' +
      '<h3>Spielstände</h3><p>Alles wird lokal im Browser gespeichert (automatisch jedes Spieljahr). ' +
      'Um eine Stadt auf einen anderen PC mitzunehmen, exportiere sie unter 💾 als Datei und importiere sie dort.</p>' +
      '<h3>Sprache</h3><p>Die Sprache stellst du im Hauptmenü (☰) um.</p>',

    'noscript': 'Heliotown benötigt JavaScript.'
  };

  const en = {
    'app.tagline': 'Plan, build and manage your own city.',
    'app.defaultCity': 'Heliotown',
    'btn.back': 'Back', 'btn.close': 'Close', 'btn.ok': 'OK',
    'lang.name': 'English',

    'menu.resume': 'Back to game', 'menu.continue': 'Continue', 'menu.new': 'New game',
    'menu.load': 'Load / save game', 'menu.import': 'Import save file',
    'menu.settings': 'Settings', 'menu.help': 'How to play', 'menu.language': 'Language',
    'menu.offline': 'Runs completely offline. Games are saved locally in this browser –<br>export them as a file to move them to another PC.',
    'menu.residents': '{n} residents',

    'ng.title': 'New game', 'ng.name': 'City name', 'ng.size': 'Map size',
    'ng.small': 'Small', 'ng.medium': 'Medium', 'ng.large': 'Large',
    'ng.water': 'Water', 'ng.little': 'Little', 'ng.normal': 'Normal', 'ng.much': 'Lots',
    'ng.diff': 'Difficulty', 'ng.easy': 'Easy', 'ng.hard': 'Hard',
    'ng.disasters': 'Disasters', 'ng.fires': 'Fires can break out',
    'ng.seed': 'Map no.', 'ng.newMap': 'New map', 'ng.preview': 'Preview', 'ng.go': 'Found city',
    'ng.confirm': 'The current game will end. Unsaved progress will be lost (except for the autosave). Continue?',
    'ng.tip': 'Tip: Build a power plant first, then roads and zones. Open ❓ for instructions.',
    'ng.names': ['Brightwater', 'Sunridge', 'Goldfield', 'Lumen Bay', 'Helios Harbor', 'Summerdale', 'Dawnford'],

    'tb.menu': 'Main menu', 'tb.date': 'Date', 'tb.money': 'Treasury', 'tb.pop': 'Population',
    'tb.power': 'Power: used / capacity (tiles)', 'tb.rci': 'Demand: residential / commercial / industrial',
    'rci.r': 'R', 'rci.c': 'C', 'rci.i': 'I',
    'tb.pause': 'Pause [Space]', 'tb.slow': 'Slow [1]', 'tb.normal': 'Normal [2]', 'tb.fast': 'Fast [3]',
    'tb.rotL': 'Rotate view left [Z]', 'tb.rotR': 'Rotate view right [X]',
    'tb.budget': 'Budget', 'tb.stats': 'Statistics', 'tb.save': 'Save', 'tb.help': 'Help',
    'view.2d': '2D view', 'view.3d': '3D view',
    'view.to2d': 'Switch to top-down view [V]', 'view.to3d': 'Switch to 3D view [V]',
    'side.view': 'View', 'side.minimap': 'Click to jump there', 'ticker.title': 'Click for all messages',

    'grp.tools': 'Tools', 'grp.infra': 'Infrastructure', 'grp.zones': 'Zones',
    'grp.energy': 'Energy', 'grp.services': 'Services', 'grp.leisure': 'Leisure',
    'tool.query': 'Info', 'tool.query.desc': 'Click a tile to see details. Drag to move the map.',
    'tool.bulldoze': 'Bulldoze', 'tool.bulldoze.desc': 'Removes buildings, roads, power lines, zones and trees.',
    'tool.road': 'Road', 'tool.road.desc': 'Connects zones (up to 3 tiles away) and carries power. Bridges are built over water.',
    'tool.wire': 'Power line', 'tool.wire.desc': 'Bridges open land or water between power plant and city. Roads, zones and buildings carry power on their own.',
    'tool.zoneR': 'Residential', 'tool.zoneR.desc': 'People move in here. Needs power and a road.',
    'tool.zoneC': 'Commercial', 'tool.zoneC.desc': 'Shops and offices create jobs.',
    'tool.zoneI': 'Industrial', 'tool.zoneI.desc': 'Factories offer many jobs but pollute their surroundings.',
    'b.coal': 'Coal power plant', 'b.coal.desc': 'Cheap power for 900 tiles – but heavily pollutes the air.',
    'b.solar': 'Solar farm', 'b.solar.desc': 'Clean solar power for 600 tiles – the heart of Heliotown.',
    'b.wind': 'Wind turbine', 'b.wind.desc': 'Small, clean wind turbine for 50 tiles.',
    'b.police': 'Police station', 'b.police.desc': 'Reduces crime in the area.',
    'b.fire': 'Fire station', 'b.fire.desc': 'Puts out fires in the area quickly.',
    'b.school': 'School', 'b.school.desc': 'Education makes residential areas more attractive.',
    'b.hospital': 'Hospital', 'b.hospital.desc': 'Health care improves quality of life.',
    'b.park': 'Park', 'b.park.desc': 'Raises land value and reduces pollution.',
    'b.stadium': 'Stadium', 'b.stadium.desc': 'Large land value bonus and more commerce. From 3,000 residents.',

    'zone.1': 'Residential zone', 'zone.2': 'Commercial zone', 'zone.3': 'Industrial zone',
    'lvl.1': ['Vacant', 'Houses', 'Apartment building', 'Residential tower'],
    'lvl.2': ['Vacant', 'Shop', 'Office building', 'Office tower'],
    'lvl.3': ['Vacant', 'Workshop', 'Factory', 'Industrial complex'],
    'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'class': ['Settlement', 'Village', 'Small town', 'Town', 'City', 'Metropolis'],
    'classA': ['a settlement', 'a village', 'a small town', 'a town', 'a city', 'a metropolis'],

    'ov.none': 'Normal', 'ov.power': 'Power', 'ov.roads': 'Road access', 'ov.pollution': 'Pollution',
    'ov.crime': 'Crime', 'ov.landValue': 'Land value', 'ov.traffic': 'Traffic', 'ov.police': 'Police',
    'ov.fire': 'Fire', 'ov.school': 'Education', 'ov.hospital': 'Health',
    'lg.powered': 'powered', 'lg.unpowered': 'no power', 'lg.connected': 'connected',
    'lg.noRoad': 'no road within 3 tiles', 'lg.low': 'low', 'lg.high': 'high', 'lg.light': 'light', 'lg.jam': 'congested',
    'lg.police': 'Police station coverage', 'lg.fire': 'Fire station coverage',
    'lg.school': 'School catchment area', 'lg.hospital': 'Hospital catchment area',

    'pv.tiles': '{n} tiles', 'pv.lockedFrom': '🔒 from {n} residents', 'pv.notHere': 'not possible here',
    'pv.tooExpensive': 'too expensive!', 'tool.lockedShort': '🔒 from {n} pop.',
    'toast.noSpace': 'No room here for: {b}.', 'toast.noMoney': 'Not enough money in the treasury!',
    'toast.locked': 'Not unlocked yet.',
    'toast.firstPlant': 'Tip: Connect the power plant to your city with a road or power line – roads and zones pass power on.',
    'toast.noStorage': 'Local storage is not available in this browser – please export your games as files.',
    'toast.quickSaved': 'Game saved (autosave).', 'toast.saveFail': 'Saving failed: {e}',
    'toast.autosaved': 'Autosaved.',
    'toast.autosaveFail': 'Autosave failed – storage full? Export your city as a file.',
    'toast.loaded': '"{name}" loaded.', 'toast.loadFail': 'Loading failed: {e}',
    'toast.imported': '"{name}" imported. Tip: Use 💾 to save it in the browser.',
    'toast.importFail': 'Import failed: {e}', 'toast.savedAs': 'Saved: {name}',
    'toast.saveFull': 'Saving failed (storage full?). Delete old saves or export as a file.',
    'toast.milestone': '🎉 {cls}!',
    'confirm.import': 'Load imported save "{name}"? The current game will end.',
    'confirm.overwrite': 'Overwrite save "{name}"?',
    'confirm.load': 'Load this save? Unsaved progress will be lost.',
    'confirm.delete': 'Permanently delete save "{name}"? This cannot be undone.',

    'i.landValue': 'Land value', 'i.pollution': 'Pollution', 'i.crime': 'Crime',
    'i.policeCov': 'Police coverage', 'i.fireCov': 'Fire coverage', 'i.residents': 'Residents', 'i.jobs': 'Jobs',
    'i.level': 'Development level', 'i.power': 'Power', 'i.powered': 'powered', 'i.noPower': 'no power',
    'i.roadAccess': 'Road access', 'i.yes': 'yes', 'i.noRoad': 'no road within 3 tiles',
    'i.school': 'School', 'i.hospital': 'Hospital', 'i.upkeep': 'Upkeep', 'i.perMonth': '{v} / month',
    'i.output': 'Output', 'i.tiles': '{n} tiles', 'i.grid': 'Grid total', 'i.env': 'Environment',
    'i.heavyPol': '⚠️ heavily polluting', 'i.range': 'Range', 'i.bridge': '🌉 Bridge', 'i.road': '🛣️ Road',
    'i.withWire': ' with power line', 'i.traffic': 'Traffic', 'i.wire': '⚡ Power line', 'i.live': 'live',
    'i.notConnected': 'not connected', 'i.rubble': '🧱 Rubble',
    'i.rubbleHint': 'Clear it with the bulldozer or build over it directly.',
    'i.water': '🌊 Water', 'i.forest': '🌲 Forest', 'i.meadow': '🌱 Meadow', 'i.burning': '🔥 Fire here!',
    'i.position': 'Position',

    'sl.titleSave': 'Save & load', 'sl.titleLoad': 'Load game', 'sl.save': 'Save',
    'sl.none': 'No saved games yet.', 'sl.res': 'pop.', 'sl.savedAt': 'saved {t}',
    'sl.load': 'Load', 'sl.export': 'Export as file', 'sl.delete': 'Delete',
    'sl.used': 'Used: {n} KB (browser limit approx. 5,000 KB)', 'sl.importFile': 'Import file',
    'sl.exportCurrent': 'Export current game', 'sl.autoLabel': 'Autosave',
    'sl.note': 'You can copy exported files (.heliotown.json) to another PC and import them there.',

    'bd.title': 'Budget', 'bd.tax': 'Tax rate',
    'bd.note': 'Income and expenses are booked monthly. Taxes above 7% slow growth, lower taxes encourage it.',
    'bd.hint1': 'Very low taxes – the city grows fast, but the treasury suffers.',
    'bd.hint2': 'Balanced taxes.', 'bd.hint3': 'Raised taxes – growth slows down.',
    'bd.hint4': 'Very high taxes – residents and businesses are moving away!',
    'bd.forecastMonth': 'Forecast per month', 'bd.taxIncome': 'Tax income', 'bd.roads': 'Roads & power lines',
    'bd.plants': 'Power plants', 'bd.services': 'Public services & parks', 'bd.net': 'Balance per month',
    'bd.year': 'Forecast per year', 'bd.last': 'Last month', 'bd.cash': 'Treasury',

    'st.title': 'Statistics', 'st.pop': 'Population', 'st.size': 'City size', 'st.jobsC': 'Commercial jobs',
    'st.jobsI': 'Industrial jobs', 'st.zR': 'Residential zones', 'st.zC': 'Commercial zones', 'st.zI': 'Industrial zones',
    'st.roads': 'Roads', 'st.power': 'Power', 'st.unpowered': 'Unpowered', 'st.pf': 'Police / fire',
    'st.sh': 'Schools / hospitals', 'st.chPop': 'Population', 'st.chMoney': 'Treasury', 'st.news': 'News',
    'ch.few': 'Not enough data yet – let time run.', 'ch.last': 'last {n} months',

    'se.title': 'Settings', 'se.city': 'City name', 'se.disasters': 'Disasters',
    'se.fires': 'Fires can break out', 'se.autosave': 'Autosave', 'se.autoDesc': 'every game year and every 2 minutes',
    'se.language': 'Language', 'se.apply': 'Apply',

    'msg.welcome': 'Welcome to {city}! Build a power plant, roads and zones.',
    'msg.fire': 'Fire broke out at ({x}, {y})!',
    'msg.class': '{city} is now {clsA}! ({n} residents)',
    'msg.unlock': 'Newly unlocked: {b}!',
    'adv.money': 'The treasury is empty! Raise taxes or cut spending.',
    'adv.nopower': 'Your zones have no power. Build a power plant and connect it with power lines.',
    'adv.powerlow': 'Power shortage! Demand exceeds power plant capacity.',
    'adv.powerconn': 'Some zones are not connected to the power grid.',
    'adv.road': 'Some zones are too far from a road (max. 3 tiles).',
    'adv.needR': 'People want to move to {city} – zone more residential areas!',
    'adv.needC': 'Merchants are looking for space – zone more commercial areas!',
    'adv.needI': 'Industry wants to expand – zone more industrial areas!',
    'adv.crime': 'Crime is rising. Build police stations in densely populated areas.',
    'adv.pollution': 'Residents complain about air pollution. Separate homes from industry, build parks or switch to solar power.',
    'adv.fire': 'Without a fire department, fires can spread unchecked.',
    'adv.school': 'Families would like schools.',
    'adv.hospital': 'The population needs a hospital.',

    'err.invalid': 'Not a valid Heliotown save file.',
    'err.newer': 'This save comes from a newer version of Heliotown.',
    'err.notFound': 'Save not found.',

    'help.title': 'How to play', 'help.go': 'Let’s go!',
    'help.html':
      '<h3>Getting started</h3><ol>' +
      '<li><b>Build a power plant</b> (coal, solar or wind).</li>' +
      '<li><b>Lay roads</b> – zones need a road within 3 tiles.</li>' +
      '<li><b>Zone land</b>: drag to mark residential, commercial and industrial areas.</li>' +
      '<li><b>Connect power</b> – roads, zones and buildings pass power to neighbouring tiles. Use power lines to bridge open land or water.</li>' +
      '<li>Let time run and keep an eye on the <b>demand bars</b> (R/C/I) at the top.</li></ol>' +
      '<h3>Tips</h3><ul>' +
      '<li>Industry pollutes – keep it away from homes. Parks and forests clean the air.</li>' +
      '<li>High land value (water, parks, schools) lets high-rises grow.</li>' +
      '<li>Police reduce crime, fire stations put out fires quickly.</li>' +
      '<li>Medium buildings appear from 250 residents, large ones from 2,000.</li>' +
      '<li>The views on the right (power, road access, pollution …) reveal problems at a glance.</li></ul>' +
      '<h3>Controls</h3><ul>' +
      '<li><b>Left mouse button</b>: build (drag for roads, power lines, zones, bulldozing)</li>' +
      '<li><b>Drag with right/middle mouse button</b> or drag with the Info tool: move the map</li>' +
      '<li><b>Mouse wheel</b>: zoom · <kbd>+</kbd>/<kbd>−</kbd> zoom · <kbd>Arrow keys</kbd> move</li>' +
      '<li><kbd>Space</kbd> pause · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> game speed</li>' +
      '<li><kbd>V</kbd> 3D/2D view · <kbd>Z</kbd>/<kbd>X</kbd> (or <kbd>,</kbd>/<kbd>.</kbd>) rotate view</li>' +
      '<li><kbd>Q</kbd> Info · <kbd>B</kbd> Bulldoze · <kbd>R</kbd> Road · <kbd>L</kbd> Power line · <kbd>W</kbd> Residential · <kbd>G</kbd> Commercial · <kbd>I</kbd> Industrial · <kbd>Esc</kbd> cancel</li>' +
      '<li><kbd>Ctrl</kbd>+<kbd>S</kbd> quick save</li></ul>' +
      '<h3>Saved games</h3><p>Everything is saved locally in your browser (automatically every game year). ' +
      'To take a city to another PC, export it as a file via 💾 and import it there.</p>' +
      '<h3>Language</h3><p>You can change the language in the main menu (☰).</p>',

    'noscript': 'Heliotown requires JavaScript.'
  };

  SC.LANGS = { de, en };
  SC.LANG_LIST = ['de', 'en'];
  SC.LOCALES = { de: 'de-DE', en: 'en-US' };
  SC.lang = 'de';

  function lookup(d, key) {
    if (key in d) return d[key];
    const m = /^(.+)\.(\d+)$/.exec(key); // 'class.2' = drittes Element der Liste 'class'
    if (m && Array.isArray(d[m[1]])) return d[m[1]][+m[2]];
    return undefined;
  }
  SC.t = function (key, params) {
    let v = lookup(SC.LANGS[SC.lang] || de, key);
    if (v === undefined) v = lookup(de, key);
    if (v === undefined) return key;
    if (typeof v !== 'string' || !params) return v;
    return v.replace(/\{(\w+)\}/g, (m, p) => {
      if (!(p in params)) return m;
      const val = params[p];
      if (typeof val === 'number') return SC.fmtNum(val);
      return typeof val === 'string' && val[0] === '@' ? SC.t(val.slice(1)) : String(val);
    });
  };
  SC.locale = () => SC.LOCALES[SC.lang] || 'de-DE';
  SC.setLang = function (lang) {
    SC.lang = SC.LANGS[lang] ? lang : 'de';
    document.documentElement.lang = SC.lang;
  };
  SC.detectLang = function () {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'de';
    return /^de/i.test(nav) ? 'de' : 'en';
  };
})(window.SC);
