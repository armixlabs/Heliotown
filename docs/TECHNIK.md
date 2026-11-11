# SunCity – Technische Dokumentation

Dieses Dokument beschreibt den Aufbau des Codes für alle, die SunCity weiterentwickeln wollen. Für Spielanleitung und Bedienung siehe [README](../README.md).

## Grundprinzipien

- **Keine Abhängigkeiten, kein Build.** Reines JavaScript, HTML und CSS.
- **Läuft von `file://`.** Deshalb klassische `<script>`-Tags statt ES-Module (Browser blockieren Module bei `file://`) und kein `fetch` lokaler Dateien.
- **Ein globaler Namensraum `SC`.** Jede Datei ist eine selbstausführende Funktion, die ihre Teile an `window.SC` hängt. Die Ladereihenfolge in `index.html` ist wichtig: `data.js` → `state.js` → `sim.js` → `render.js` → `render3d.js` → `ui.js`.
- **Alles prozedural gezeichnet.** Gebäude, Bäume, Autos und Rauch entstehen zur Laufzeit auf einem `<canvas>`.

## Module

| Datei | Inhalt |
|---|---|
| `data.js` | Konstanten (`SC.TER`, `SC.KIND`, `SC.COST`, `SC.CAPACITY`), Gebäudetypen `SC.BTYPES`, Werkzeuge `SC.TOOLS`, Zufallsgenerator, Formatierung, Ereignisbus (`SC.on`, `SC.emit`, `SC.notify`) |
| `state.js` | Spielstand anlegen (`SC.createState`, `SC.newGame`), Kartengenerator, Bauaktionen (`SC.Act`), Serialisierung, `localStorage`-Verwaltung (`SC.Storage`) |
| `sim.js` | Simulation (`SC.Sim`): Stromnetz, Straßenanbindung, Umweltkarten, Statistik, Nachfrage, Zonenwachstum, Brände, Haushalt, Berater |
| `render.js` | 2D-Draufsicht (`SC.Render`) und Minikarte |
| `render3d.js` | Isometrische 3D-Ansicht (`SC.RenderIso`) |
| `ui.js` | Spielschleife, Maus/Touch/Tastatur, Werkzeugleiste, Menüs, Dialoge (`SC.Game`) |

## Datenmodell

Die Karte ist ein Raster aus `W × H` Feldern. Jede Eigenschaft liegt in einem eigenen typisierten Array der Länge `N = W·H`; der Index eines Feldes ist `i = y·W + x`.

**Gespeicherte Karten** (Teil des Spielstands):

| Array | Typ | Bedeutung |
|---|---|---|
| `terrain` | `Uint8` | 0 Wiese, 1 Wasser, 2 Wald |
| `kind` | `Uint8` | 0 leer, 1 Straße, 2 Leitung, 3 Straße mit Leitung, 4 Zone, 5 Gebäude, 6 Trümmer |
| `zone` | `Uint8` | 1 Wohnen, 2 Gewerbe, 3 Industrie (bei `kind = 4`) |
| `lvl` | `Uint8` | Ausbaustufe 0–3 bei Zonen; **Gebäudetyp-ID** bei `kind = 5` |
| `vari` | `Uint8` | Zufallswert für optische Varianten |
| `fire` | `Uint8` | 0 = kein Brand, sonst Brenndauer in Tagen |

Dazu kommt die Liste `buildings` mit Einträgen `{ t, x, y }` (Typ-ID und linke obere Ecke) für mehrfeldrige Gebäude wie Kraftwerke.

**Abgeleitete Karten** (werden nach dem Laden neu berechnet, `SC.allocDerived`): `origin` (Ursprungsfeld eines Gebäudes), `powered`, `roadDist`, `pollution`, `crime`, `landValue`, `traffic` sowie die Versorgungsabdeckung `cov.police | fire | school | hospital | park | leisure` (je 0–1).

## Simulation

**Zeit.** Ein Takt (`Sim.tick`) ist ein Spieltag; 30 Tage ergeben einen Monat. Die Geschwindigkeitsstufen entsprechen 200, 70 und 18 ms pro Tag (`SC.SPEEDS`).

**Pro Tag** wird ein Dreißigstel aller Felder auf Wachstum geprüft. Damit das nicht zeilenweise sichtbar ist, läuft der Durchlauf mit einer Primzahl-Schrittweite (7919) über die Karte. Außerdem werden Brände fortgeschrieben, Statistik und Nachfrage neu gezählt.

**Pro Monat** (`Sim.monthly`) werden alle Karten neu berechnet, der Haushalt verbucht, eventuell ein Brand ausgelöst, Verlauf, Meilensteine und Berater-Hinweise aktualisiert.

**Stromnetz.** Breitensuche von jedem Kraftwerk über leitende Felder (Straßen, Leitungen, Zonen, Gebäude – nicht über leere Felder oder Trümmer). Jedes Zonenfeld und jedes Dienstgebäudefeld verbraucht eine Einheit. Die Kapazität des Netzes wird in Suchreihenfolge verteilt, also zuerst an Felder nahe dem Kraftwerk.

**Straßenanbindung.** Breitensuche mit 8 Nachbarn von allen Straßenfeldern aus. Zonen brauchen eine Straße in höchstens 3 Feldern Abstand.

**Umweltkarten.** Quellwerte werden mit mehreren Durchläufen eines 3×3-Box-Filters verteilt:

- *Verschmutzung:* Industrie (50 je Stufe), Gewerbe (6 je Stufe), Kohlekraftwerk, Verkehr; Wald und Parks senken sie.
- *Kriminalität:* Bebauungsdichte, niedriger Bodenwert; Polizeiabdeckung senkt sie stark.
- *Bodenwert:* Nähe zu Wasser und Wald, Parks, Stadion, Schulen, Krankenhäuser, Polizei; Verschmutzung und Kriminalität senken ihn.

**Nachfrage** (Werte −1 bis +1). Mit Einwohnern `P`, Gewerbe-Jobs `C`, Industrie-Jobs `I`, `J = C + I` und Erwerbsbevölkerung `0,55·P`:

```
Wohnen     = (J − 0,55·P + 100) / max(100, 0,275·P + 0,2·J)
Industrie  = (0,30·P − I + 40)  / max(60, 0,15·P)
Gewerbe    = (0,22·P + 0,1·I − C + 20) / max(40, 0,1·P)
```

Von allen drei Werten wird `(Steuersatz − 7) · 0,07` abgezogen; ein Stadion erhöht Gewerbe und Wohnen leicht.

**Wachstum einer Zone** (`evalZone`). Ohne Straße oder Strom schrumpft sie. Sonst ergibt sich eine Bewertung aus Nachfrage, Bodenwert, Verschmutzung, Kriminalität und (bei Wohnen) Schulen und Krankenhäusern. Ist sie positiv, steigt die Ausbaustufe mit einer Wahrscheinlichkeit; stark negativ sinkt sie. Die höchste Stufe hängt von der Einwohnerzahl ab (unter 250 → Stufe 1, unter 2.000 → Stufe 2, sonst 3) und bei Wohnen und Gewerbe zusätzlich vom Bodenwert.

Einwohner bzw. Arbeitsplätze je Stufe (`SC.CAPACITY`):

| Zone | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|
| Wohnen (Einwohner) | 12 | 40 | 110 |
| Gewerbe (Jobs) | 8 | 25 | 70 |
| Industrie (Jobs) | 12 | 35 | 80 |

**Brände.** Monatlich kann ein bebautes Zonenfeld Feuer fangen (seltener mit Feuerwehrabdeckung, häufiger bei Industrie). Feuer breitet sich mit 6 % pro Tag auf brennbare Nachbarn aus, wird bei Feuerwehrabdeckung nach einigen Tagen gelöscht und brennt sonst nach 22 Tagen nieder. Kraftwerke und Feuerwachen brennen nicht. In den Einstellungen abschaltbar.

**Haushalt** (pro Monat):

```
Einnahmen = Steuersatz · (Einwohner + 1,2 · Arbeitsplätze) · 0,018
Ausgaben  = Unterhalt aller Gebäude + 0,08 je Straße + 0,6 je Brücke + 0,03 je Leitung
```

## Darstellung

Beide Renderer haben dieselbe Schnittstelle, die `ui.js` über die Variable `R` nutzt: `init`, `draw`, `screenToTile`, `screenToMapF`, `centerOn`, `getCenter`, `zoomAt`, `clampView`, `viewportCorners`, `setState`, `rotate`, `view { x, y, ts }`.

**2D-Draufsicht** (`render.js`). Erst der Boden, dann Objekte zeilenweise von oben nach unten, damit höhere Gebäude korrekt verdeckt werden. Gebäude erhalten durch eine versetzte Dachfläche und eine Frontwand einen leichten Tiefeneindruck.

**3D-Ansicht** (`render3d.js`). Isometrische Projektion im Verhältnis 2:1:

```
Bildschirm-x = (wx − wy) · ts − view.x
Bildschirm-y = (wx + wy) · ts/2 − wz · 1,15·ts − view.y
```

`wx, wy` sind gedrehte Kartenkoordinaten, `wz` die Höhe in Feldbreiten. Die Drehung (`rot` 0–3) wird über `rotF`/`unrotF` auf Karten- und Weltkoordinaten abgebildet, für Richtungen über `rotDelta`. Gezeichnet wird in drei Durchgängen: Boden (ohne Reihenfolge), optional Overlay, dann Objekte diagonal von hinten nach vorn (aufsteigende Summe `rx + ry`). Mehrfeldrige Gebäude werden auf ihrem vordersten Feld gezeichnet. Bei sehr hohen Nachbargebäuden kann es dadurch an den Kanten selten zu kleinen Überdeckungsfehlern kommen.

Grundformen sind Quader (`box`) mit Dach, linker und rechter Wand in drei Helligkeiten, Satteldachhäuser (`gableHouse`), Pyramidendächer und Fensterreihen. Unterhalb bestimmter Zoomstufen werden Details (Fenster, Autos, Rauch) weggelassen.

**Minikarte.** Ein Pixel pro Feld, per `ImageData` erzeugt und skaliert gezeichnet; der sichtbare Bereich wird als Vieleck eingezeichnet, damit er auch in der gedrehten 3D-Ansicht stimmt.

## Speicherformat

`SC.serialize` erzeugt ein JSON-Objekt:

```json
{
  "app": "SunCity",
  "v": 1,
  "name": "Sonnenberg", "W": 96, "H": 96, "seed": 657589908,
  "money": 20000, "tax": 7, "day": 1, "month": 0, "year": 2025,
  "buildings": [{ "t": 1, "x": 40, "y": 30 }],
  "history": [], "log": [], "flags": {}, "advisor": {},
  "maps": { "terrain": "<Base64>", "kind": "...", "zone": "...", "lvl": "...", "vari": "...", "fire": "..." }
}
```

Jede Karte in `maps` ist **lauflängenkodiert** (Paare aus Anzahl 1–255 und Wert) und dann **Base64**-kodiert. Eine mittlere Stadt braucht so rund 15–20 KB.

**Speicherorte im `localStorage`** (Präfix `suncity.v1.`):

| Schlüssel | Inhalt |
|---|---|
| `suncity.v1.index` | Liste der Spielstände (Name, Stadt, Einwohner, Datum, Größe) |
| `suncity.v1.slot.<id>` | Spielstand als JSON; `auto` ist der Autosave |
| `suncity.v1.pref.view` / `pref.rot` | gewählte Ansicht und Drehung |

Exportierte Dateien (`*.suncity.json`) enthalten genau dasselbe JSON. Beim Laden prüft `SC.deserialize` das Feld `app` und lehnt Spielstände einer neueren Version (`v`) ab.

## Erweitern

**Neues Gebäude:** Eintrag in `SC.BTYPES` (`data.js`) mit `key`, `name`, `size`, `cost`, `upkeep` und je nach Art `power`, `pollution`, `radius` oder `minPop`. Werkzeug und Kosten entstehen automatisch. Dann in `render.js` (`drawService`) und `render3d.js` (`drawService`) einen `case` für die Darstellung ergänzen. Eine Versorgungswirkung über `radius` landet in `s.cov[key]`. Für eine neue Wirkung `SC.allocDerived` und `Sim.computeMaps` erweitern.

**Neue Kennzahl oder Ansicht:** Karte in `Sim.computeMaps` berechnen, in `overlayColor` beider Renderer einfärben und in `OVERLAYS`/`LEGENDS` (`ui.js`) eintragen.

**Spielstand-Format ändern:** `SC.VERSION` erhöhen und in `SC.deserialize` ältere Versionen umwandeln, damit vorhandene Spielstände ladbar bleiben.

## Testen

Es gibt keine automatisierten Tests. Die Simulation lässt sich ohne Browser in Node.js prüfen, indem man `data.js`, `state.js` und `sim.js` in einem `vm`-Kontext mit einem `window`-Objekt und einem `localStorage`-Ersatz lädt, eine Stadt über `SC.Act.apply` baut und `SC.Sim.tick` in einer Schleife aufruft.

Für Tests im Browser genügt ein beliebiger lokaler Webserver im Projektordner, zum Beispiel `python3 -m http.server`.
