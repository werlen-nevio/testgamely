# ART DIRECTION — Hollowdeep

> Dies ist die **einzige Quelle** für alle visuellen Entscheidungen. Kein
> Farbwert, keine Formsprache, kein Timing-Wert taucht irgendwo im Code auf, der
> nicht hier definiert ist. Braucht ein Sonderfall eine Ausnahme, wird sie
> **hier** dokumentiert — nicht in den Code geschmuggelt.

---

## 1. Konzept & Setting

**Thema: „Der ertrunkene Tempel" — ein Abstieg in eine lichtlose Tiefsee-Ruine.**

Vor Ewigkeiten sank ein Tempel in einen Meeresgraben. Kein Sonnenlicht dringt
hierher; das Einzige, was leuchtet, ist **Biolumineszenz** — die Kreaturen, die
den Tempel bewohnt haben, und der Spieler selbst, ein winziger warmer Lichtträger
(eine Art Laternen-Taucher / Funke), der in die Dunkelheit hinabsteigt.

Stimmung: **kalt, still, ehrfürchtig, bedrohlich-schön.** Nicht eklig, nicht
fleischig, nicht Keller. Wo Isaac warm-braun, grungy und body-horror ist, ist
Hollowdeep **kalt, blau-schwarz und leuchtend** — dieselbe Genre-Sprache
(Twin-Stick-Roguelike), aber eine eigene Welt.

Abgrenzung zum Vorbild (bewusst gegenteilig):
- Palette: kaltes Abgrund-Blau/Teal + Biolumineszenz statt Braun-Grau-Fleisch.
- Setting: geflutete Tempeltiefe statt Keller/Körper.
- Gegner-Fantasie: Tiefseewesen & erwachte Tempelwächter statt Monster-Föten.
- Grundton: erhaben-melancholisch statt grotesk.

**Floor-Fantasie** (jede Ebene ist eine tiefere Schicht der Ruine):
1. *Geflutetes Hauptschiff* — teal-dominant, noch „hell".
2. *Korallengebein* — violett durchsetzt, verwachsener.
3. *Abgrund-Gewölbe* — tiefstes Blau, fast schwarz, am bedrohlichsten.
4. + tiefer: zyklisch abgedunkelt.

---

## 2. Palette (feste, benannte Tokens)

Verbindlich. Jede Farbe im Spiel ist eines dieser Tokens **oder** eine per
`shade(token, amount)` definierte Ab-/Aufhellung eines Tokens (siehe §9). Freie
Farbwerte sind verboten.

### Welt & Hintergrund
| Token | Hex | Verwendung |
| --- | --- | --- |
| `--ink` | `#03070d` | Tiefste Schatten, Outlines, Vignette-Kern |
| `--bg-abyss` | `#050c16` | Void hinter allem, Letterbox |
| `--bg-deep` | `#0a1826` | Boden-Basis der Räume |
| `--bg-stone` | `#0f2233` | Wände / gebaute Struktur / Hindernisse |
| `--bg-mist` | `#173a52` | Ambientes Lichtfeld, Bodenglanz, Nebel |

### Spieler (die einzige **warme** Farbe der Welt → nie verwechselbar)
| Token | Hex | Verwendung |
| --- | --- | --- |
| `--player-core` | `#ffe7ad` | Heller warmer Kern (das hellste Objekt im Bild) |
| `--player-glow` | `#ff9d3c` | Bernstein-Halo, Spieler-Licht, Laufstaub-Wärme |

### Biolumineszenz (kühler Neutral-/Freundlich-/Interaktiv-Akzent)
| Token | Hex | Verwendung |
| --- | --- | --- |
| `--bio` | `#3fe0d0` | Spieler-Schüsse, Pickups, offene Türen, freundlicher Glow |
| `--bio-deep` | `#157f79` | Kanten/Schatten von Bio-Elementen |

### Gefahr (RESERVIERTE Signalfarbe — **nur** Gefahr)
| Token | Hex | Verwendung |
| --- | --- | --- |
| `--danger` | `#ff2f6a` | Gegner-Schüsse, Fallen, Angriffs-Telegraphs |
| `--danger-glow` | `#ff86ac` | Halo/Trail von Gefahr |

> **Eiserne Regel:** `--danger`/`--danger-glow` berührt **nichts** Freundliches.
> Kein Pickup, kein Spieler-Element, keine Tür benutzt diesen Farbton. Sieht der
> Spieler Rosa-Rot, heisst das *immer* „das tut weh".

### Feedback (nahezu monochrom, Utility)
| Token | Hex | Verwendung |
| --- | --- | --- |
| `--flash` | `#ffffff` | Treffer-Blitz auf Gegnern |
| `--hurt` | `#ff1f3a` | Vollbild-Puls, wenn der Spieler getroffen wird |

### Kreaturen-Palette (kalte Farbtöne — Gegnerkörper nie warm, nie `--danger`)
| Token | Hex | Gegner | Charakter |
| --- | --- | --- | --- |
| `--hunter` | `#6f63ff` | Verfolger | Indigo, stur, unaufhaltsam |
| `--leaper` | `#34d98c` | Hüpfer | Jade, federnd, lebendig |
| `--caster` | `#46b6ff` | Schütze | Himmelblau, hält Distanz |
| `--shard` | `#9fe8ff` | Springer | Blasses Eis, **kristalliner Konstrukt-Wächter** |
| `--brood` | `#c05ad6` | Splitter | Orchidee, teilt sich |
| `--boss-body` | `#5a2fa0` | Boss (Phase 1) | Königliches Violett, massiv |
| `--boss-hot` | `#ff3fa0` | Boss (Phase 2) | Farbverschiebung Richtung Gefahr → sichtbare Eskalation |

Chromatische Kernpalette ≈ 11 Töne (ohne `--ink`/`--flash`). Kreaturentöne sind
eine harmonisierte kühle Erweiterung derselben Familie. Kanten/Glows werden
ausschliesslich per `shade()` erzeugt.

---

## 3. Formsprache

**Leitsatz: „Lebendiges ist rund und leuchtet. Gebautes ist kantig und dunkel."**

- **Lebendiges** (Spieler, Kreaturen, Projektile, Pickups): weiche, runde,
  organische Silhouetten mit **hellem Glühkern + dunklerer Aussenhaut**. Alles
  Lebendige trägt sein eigenes Licht.
- **Gebautes** (Wände, Hindernisse, Tempelstruktur): kantig, dunkel, matt, ohne
  Eigenlicht — es *verschluckt* Licht, statt es abzugeben. Verwitterter Stein
  mit eingeritzten, schwach glimmenden Bio-Linien.

Dieser Zwei-Register-Kontrast (leuchtend-organisch vs. dunkel-geometrisch) ist
selbst ein Lesbarkeits-Werkzeug: Bedrohung und Beute leuchten, Deckung und
Wände nicht.

**Dokumentierte Ausnahme:** Der *Springer* (Gegnertyp 4) ist ein kristalliner
Tempel-Wächter, kein Weichtier — er ist **geometrisch** (facettierter Kristall)
statt rund. Das ist Absicht: seine Geometrie erzählt sofort „bewegt sich starr,
schnellt in geraden Linien". Er glüht dennoch (lebendig-gebaut-Hybrid).

---

## 4. Lesbarkeits-Hierarchie

Priorität von „muss immer sofort erkennbar" nach unten:

1. **Spieler** — hellste, klarste Silhouette; einziger **warmer** (bernsteinfarbener)
   Ton im ganzen Bild; kräftigster Eigen-Glow. Nie mit irgendetwas verwechselbar.
2. **Gefahr** — jede Gegner-Projektil/Falle in `--danger` (Rosa-Rot). Reservierte
   Signalfarbe, sonst nirgends. Hoher Kontrast gegen den blauen Hintergrund.
3. **Beute/Interaktiv** — Pickups, offene Türen, Podeste in `--bio` (Teal): kühl,
   hell, „einladend", aber klar von Gefahr (Rosa) und Spieler (Bernstein) getrennt.
4. **Gegnerkörper** — kalte Farben, mittlere Helligkeit, **nie so hell wie der
   Spieler**, nie im Danger-Farbton. Nur ihre *Schüsse* sind rosa.
5. **Welt/Struktur** — dunkel, entsättigt, tritt zurück.

Drei disjunkte Farbfamilien tragen die Kern-Lesbarkeit:
**Warm = Ich · Rosa-Rot = Tod · Teal = Nutzen.**

---

## 5. Element-Guidelines

Alle weiter mit Canvas-Shapes (keine Sprite-Sheets), aber mit Glow, Schichtung
und Detail — jedes Element eine eigene Silhouette.

**Spieler** — runder Kern (`--player-core`) mit weichem Bernstein-Halo
(`--player-glow`), gerichteter „Laternen"-Lichtkegel als Richtungsanzeige,
leise Idle-Animation (Atmen/Wippen ~0.8 Hz), kurzer Trail bei Tempo.

**Gegner** — Silhouette trägt die Typ-Erkennung, Farbe die Familie:
- *Verfolger* (`--hunter`): kompakte runde Masse, ein starrendes Auge, „drückt" nach vorn.
- *Hüpfer* (`--leaper`): tropfenförmig, staucht (rest) / streckt (leap) — der Squash/Stretch ist der Tell.
- *Schütze* (`--caster`): schlanker Körper mit vorgelagertem Fokus-Ring, der sich **vor dem Schuss zusammenzieht** (Tell).
- *Springer* (`--shard`): facettierter Kristall, rotiert leicht; kurzes Aufblitzen vor Richtungswechsel.
- *Splitter* (`--brood`): runde Masse mit sichtbarer Teilungsnaht, pulsiert.

**Boss** — deutlich grösser (Radius ~2× Standardgegner), eigener starker Glow,
Gefahr-Telegraphs in `--danger`. **Phase 2** ist am Erscheinungsbild ablesbar:
Körperfarbe verschiebt `--boss-body` → `--boss-hot`, zusätzliche Ringe/Dornen,
schnelleres Pulsieren. Kein Text nötig, um die Eskalation zu verstehen.

**Projektile** — klar getrennt:
- Spieler: **runder** Bio-Kern (`--bio`) mit hellem Zentrum + Teal-Trail.
- Gegner: **rautenförmiger/spitzer** Gefahr-Kern (`--danger`) mit Rosa-Trail.
Form **und** Farbe unterscheiden sie — auch farbenblind lesbar.

**Pickups** — auf einen Blick lesbar, schweben + pulsieren sanft (Sinus), leichter
Bio-Glow-Ring, damit sie „einladen". Herz/Münze/Bombe/Schlüssel je eigene klare Form.

**Räume** — Tiefe statt flach: Boden mit sanftem radialem Bodenglanz (`--bg-mist`),
dunklere Ränder, Wände als erhabene Stein-Bänder (`--bg-stone`) mit `--ink`-Fugen
und schwachen Bio-Ritzlinien. Hindernisse als kantige Steinblöcke mit Top-Kante
(Pseudo-Höhe). Jede Ebene tönt dieselbe Palette (siehe §1).

**Türen** — Zustand ohne Text erkennbar:
- *offen*: leuchtender `--bio`-Torbogen, dunkle Öffnung dahinter.
- *verschlossen (Kampf)*: massiver `--bg-stone`-Riegel mit `--ink`-Fugen, kein Glow.
- *Boss*: Torbogen in `--danger` mit Dornen-Silhouette.
- *Shop*: Torbogen in `--player-glow` (warm → „hier gibt's was").

---

## 6. Game-Feel-Tokens

Das Herz dieser Etappe. Alle Werte zentral, referenziert statt hartkodiert.

**Trauma (ein zentraler Wert 0..1, quadratisch auf Shake gemappt):**
- Abklingen: `trauma -= 1.6 * dt` pro Frame (auf 0 geklemmt).
- Shake: `offset = maxShake * trauma²`, `maxShake = 15px`, plus winziger Rotations-Kick `maxAngle = 0.03 rad`.
- Auslöser (addiert, geklemmt auf 1):
  - Schuss abgefeuert: `+0.05`
  - Gegner vom Spieler getroffen: `+0.12`
  - Gegner stirbt: `+0.18`
  - Spieler getroffen: `+0.40`
  - Explosion: `+0.55`
  - Boss-Phasenwechsel: `+0.5`
  - Boss-Tod: `+1.0`

**Hit-Stop (Frames Update-Freeze, Rendering läuft weiter):**
- Normaler Kill: `2`
- Starker/Explosions-Kill: `4`
- Spieler getroffen: `3`
- Boss-Phasenwechsel: `6`
- Boss-Tod: `8`

**Hit-Flash:** getroffener Gegner blitzt `--flash` für `4` Frames, Rückstoss
`6px` entlang der Schussrichtung.

**Spieler-Treffer-Feedback:** `--hurt`-Vollbild-Puls (Alpha 0→0.5→0 über `24`
Frames), Zeitlupe (Zeitfaktor `0.35` für `10` Frames), deutliches Blinken (i-Frames).

**Raum-Clear:** Kamera-Zoom-Puls (Scale `1 → 1.035 → 1` über `20` Frames),
Türen öffnen mit `--bio`-Aufblitz, Trauma `+0.15`, kurzer Ton.

**Partikel (Object-Pool, keine Allokation im Hot Path):**
- Mündungsblitz beim Schuss (2–3, `--player-glow`/`--bio`).
- Einschlag-Funken (`--bio` bzw. Gegnerfarbe).
- Todes-Explosion (Gegnerfarbe, kräftig).
- Laufstaub (`--bg-mist`, gedämpft, bei Tempo).
- Explosion (`--player-glow` Kern + `--danger` Ränder).

**Trails:** Projektile immer (kurz), Spieler ab Schwellen-Tempo. Umgesetzt über
gepoolte Rest-Positionen mit Fade — keine Allokation.

**Kamera:** weiches Nachziehen (`lerp 0.1`) zu einem kleinen Offset in Spieler-
Richtung (max `12px`, geklemmt), plus Look-Ahead in Schussrichtung (`~10px`).
Kein starres Zentrieren. Backdrop wird über den View hinaus gezeichnet, damit
der Offset nie Void freilegt.

**Übergänge:** Raumwechsel = weicher Fade/Wisch (bestehend, verfeinert),
Floor-Wechsel = längerer Fade durch `--ink` mit kurzer Ebenen-Einblendung.

---

## 7. Canvas-Politur (oberste Schichten)

- **Glow/Bloom:** heller Akzente via `shadowBlur` bzw. additivem Zweit-Layer.
  **Sparsam, nur auf Akzenten** (Spieler, Bio, Danger, Boss). Struktur/Wände nie.
- **Licht:** additiver Radial-Gradient um Spieler und Projektile; Raumränder
  abgedunkelt (Vignette-Verbund). Der Spieler ist wörtlich die Lichtquelle im Raum.
- **Vignette:** radialer `--ink`-Verlauf als oberste-2. Schicht.
- **Grain:** sehr feines, gedämpftes Rauschen als oberste Schicht (subtil, animiert).
- **Font:** siehe §8, kein Browser-Default.

---

## 8. Font

Bewusst gewählt, lokal gebündelt (Build-Asset via `@fontsource`, **keine**
Laufzeit-Netzabhängigkeit):

- **Titel / Überschriften:** eine inschriftliche, klassische Serifen-Antiqua
  (Kandidat: *Cinzel*) — evoziert Tempel-Gravuren, passt zur ertrunkenen Ruine.
- **HUD / Zahlen / UI:** eine klare geometrische Mono (Kandidat: *Space Mono*
  oder *JetBrains Mono*) — technisch-lesbar, ruhig, gut für Zähler.

Fallback-Stack ohne Netz: `"Cinzel", Georgia, serif` bzw. `"Space Mono",
ui-monospace, Menlo, monospace`.

**Fixiert:** Titel = **Cinzel** (500/700), HUD/Zahlen = **Space Mono** (400/700),
lokal gebündelt über `@fontsource` (Build-Asset, keine Laufzeit-Netzabhängigkeit).
Definiert in `src/ui/fonts.ts` als `FONT_TITLE` / `FONT_UI`.

---

## 9. Regeln & Mechanik

- `shade(token, amount)`: einzige erlaubte Farb-Ableitung. `amount < 0` dunkelt
  ab (Kanten/Schatten), `amount > 0` hellt auf (Highlights/Glow). Keine anderen
  freien Farbwerte.
- Tokens leben zentral in `src/theme.ts` (Single Source im Code, gespiegelt aus
  diesem Dokument). Ändert sich hier ein Wert, ändert er sich dort — und nur dort.
- **Mechanik bleibt unangetastet.** Diese Etappe ändert ausschliesslich
  Aussehen und Game-Feel, keine Spielregeln, keine Balance-Zahlen.
- Jede spätere Ausnahme von diesen Regeln wird **in diesem Dokument** vermerkt,
  nicht im Code versteckt.

### Änderungsprotokoll
- *v1 (Entwurf):* Erste Fassung, Thema „Ertrunkener Tempel", zur Abnahme.
- *v1 (umgesetzt):* Tokens zentral in `src/theme.ts` (mit `shade`/`mix`/`rgba`),
  Game-Feel-Tokens in `src/feel.ts`, alle Hardcode-Farben ersetzt, alle Elemente
  neu gezeichnet, Canvas-Politur (Glow, Vignette, Grain, Spieler-Licht, Kamera,
  Übergänge) und Fonts umgesetzt. Ausnahme dokumentiert: Springer geometrisch.
  Einzige nicht per Token gehaltene Farben: `src/style.css` (spiegelt `--bg-abyss`
  mit Kommentar, da CSS ausserhalb des TS-Token-Moduls liegt).
