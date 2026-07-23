# DESIGN — Items

> Ziel ~55–60 Items, **gezogen aus bewussten Rollen**, nicht mehr Stat-Sticks.
> Leitfrage für jedes Item: *„Welche interessante Entscheidung erzeugt das?"*
> Ein reines `+1 damage` ohne Nebenwirkung oder Spielweisen-Änderung fliegt raus.
> Alle neu über die **Hook-Kette** (`modifyStats`, `onShoot`, `onHit`, `onKill`,
> `onRoomClear`, `onDamageTaken`, neu `onActivate`) — keine Sonderfälle im Kern.

## Rollen (Kategorien)
1. **Charakter-Stats** — Werte *mit* Nebenwirkung/Gefühl (langsamer aber härter …).
2. **Schuss-Modifier** — setzen Flags aufs Projektil. **≥15**, hier entstehen Synergien.
3. **Getriggerte Effekte** — reagieren auf onKill/onHit/onRoomClear/onDamageTaken.
4. **Aktive Items** — auf Knopfdruck (Leertaste im Run) mit Aufladung.
5. **Build-Definer** — selten, kippen einen Run und bewerten andere Items neu.
6. **Trade-off** — starker Vorteil an echten Nachteil gekoppelt (oft die besten).

## Systeme (neu in dieser Etappe)
- **Seltenheit:** `common` / `rare` / `legendary`. Zieh-Gewicht common 3 · rare 1.1
  · legendary 0.35, skaliert leicht mit `luck`.
- **Pools pro Raumtyp:**
  - `treasure` (Item-Raum) — alle Passiven + Aktive, alle Seltenheiten.
  - `shop` — kaufbar, überwiegend common/rare (keine legendaries).
  - `boss` — Boss-Belohnung nach Sieg; rare/legendary-lastig.
  Jedes Item listet seine erlaubten Pools.
- **Aktiv-Item-System:** ein Slot (`activeItem`). Aufladung in „Ladepunkten":
  Raum-Clear = +1, manche laden zusätzlich über Zeit. Bei voller Ladung feuert
  `onActivate` und setzt zurück. HUD zeigt Icon + Ladebalken. Taste: Leertaste.
- **Projektil-Flags neu:** `chain`, `return`, `chill`, `wave`, `fork` (zusätzlich
  zu homing/pierce/explosive/bounce/poison). Jede Flag → definiertes Kern-Verhalten;
  Items setzen nur die Flag.

---

## Bestand (25, recodiert)
Kurz, mit Rolle/Seltenheit: Rostiger Fang (stat, c), Zuckabzug (stat, c),
Fernglas (stat, c), Flinke Stiefel (stat, c), Schwarzes Kleeblatt (stat, c),
Schweres Geschoss (trade, c), Eiserne Rinde (stat, c), Opferklinge (trade, r),
Schwungkern (stat, c), Zwillingsfänge (stat, c) · Geisterschuss/Pierce (shot, r),
Magnetherz/Homing (shot, r), Spaltzunge/Spread (shot, c), Gummigeschoss/Bounce
(shot, c), Pulverspitze/Explosiv (shot, r), Giftbeutel/Poison (shot, c),
Geschwollenes Auge/Big (shot, c), Spiegelzwilling/Parallel (shot, r),
Rückendeckung/Back (shot, c) · Glutmal/onHit-Gift (trig, c), Egel-Amulett/onKill-
Heal (trig, r), Münzader/onKill-Coin (trig, c), Opferschale/onRoomClear (trig, c),
Dornenmantel/onDamageTaken (trig, r), Bollwerkherz (trade, r).

---

## Neu — Charakter-Stats (Trade-off/Gefühl)
- **Tiefendruck** (legendary, treasure/boss): +stark Schaden, aber Schüsse deutlich
  langsamer. → Nahkampf/Homing-Spielweise. *Syn:* Magnetherz, Geschwollenes Auge.
- **Federschuppe** (rare, treasure/shop): +viel Tempo, −1 Max-Herz. Zerbrechlicher
  Sprinter. *Syn:* Dornenmantel, Ausweich-Aktive.
- **Glaslaterne** (rare, treasure/shop): +hohe Feuerrate & Schusstempo, aber winziger
  Schaden pro Schuss (MG-Gefühl). *Syn:* alle onHit-Effekte (Glutmal, Ketten), Pierce.
- **Ankerstein** (rare, treasure): +Schaden & Reichweite, −Tempo stark (Turm-Spiel).
  *Syn:* Homing, Rückstoss, Frost.
- **Wachsherz** (common, shop/treasure): +1 Max-Herz, aber Heilung halbiert. Ehrliche
  Abwägung Kapazität vs. Nachschub.
- **Aschenlunge** (rare, treasure): Feuerrate stark hoch, Reichweite stark runter
  (Nahkampf-Sprüher). *Syn:* Schrotmaul, Frost, Rückstoss.

## Neu — Schuss-Modifier (Flags)
- **Kettenfunke** `chain` (rare, treasure/shop): Treffer springt auf einen nahen
  Gegner über. *Syn:* Funkenschwarm/Crowd, Glaslaterne.
- **Bumerangflosse** `return` (rare, treasure): Schüsse kehren zurück (treffen 2×).
  *Syn:* Pierce, Positionierung.
- **Sporenbruch** `fork` (rare, treasure): tötet ein Schuss, zerplatzt er in
  Fragmente. *Syn:* Hoher Schaden (Overkill), Crowd.
- **Schrotmaul** `scatter` (common, shop): 4 Schüsse im engen Kegel, kurze
  Reichweite. *Syn:* Rückstoss, Nahkampf-Stats.
- **Frostperle** `chill` (rare, treasure/shop): Treffer verlangsamt Gegner. *Syn:*
  Kiten, Kontrolle gegen Rammhorn/Späher.
- **Irrschuss** `wave` (common, treasure): Schüsse schlängeln (mehr Querabdeckung).
  *Syn:* Crowd, enge Räume.
- **Gabelzahn** `fork2` (common, treasure): Schuss gabelt beim Abschuss in zwei
  leicht divergierende. *Syn:* Spread-Stacking, Pierce.
- **Schwermond** (rare, treasure): Schüsse sehr gross & langsam, hoher Schaden,
  durchschlagend (impliziert Pierce). Trade-off-Shot. *Syn:* Homing.
> Schuss-Modifier gesamt (Bestand 10 + neu 8) = **18** (≥15 erfüllt).

## Neu — Getriggerte Effekte
- **Grabhauch** (common, treasure/shop): onKill — getöteter Gegner hinterlässt eine
  kleine Giftwolke. *Syn:* Crowd, Gift-Build.
- **Jägermal** (rare, treasure): onHit — markierter Gegner nimmt +% Schaden von
  Folgetreffern. *Syn:* Feuerrate, Glaslaterne.
- **Ernteschuld** (rare, treasure/boss): onKill — Stapel; bei N Kills lädt der
  nächste Schuss zu einem Stoss auf. *Syn:* schnelle Kills/Crowd.
- **Makelloses Gelübde** (rare, treasure): onRoomClear — heilt, wenn der Raum ohne
  Schaden geräumt wurde. Belohnt sauberes Spiel. *Syn:* Ausweich-Builds.
- **Statik-Schleier** (rare, treasure): onDamageTaken — kurzer Extra-i-Frame +
  stösst nahe Gegner weg (Panik-Ventil). *Syn:* fragile Stats.
- **Flutruf** (common, shop): onRoomClear — kleine Heilung + Münze.

## Neu — Aktive Items (Slot + Aufladung, Leertaste)
- **Sog** (rare, treasure): zieht alle Gegner zur Mitte + Schaden. Laden: 2 Räume.
  *Syn:* Explosiv/AoE danach.
- **Lumenfackel** (rare, treasure/boss): radiale Nova (Schaden + löscht Gegner-
  Kugeln). Laden: 2 Räume. Panik-Räumung.
- **Gleitströmung** (rare, treasure/shop): kurzer Blink in Blickrichtung mit
  i-Frames. Lädt schnell über Zeit (~5 s). Mobilität/Ausweichen.
- **Tiefenschild** (rare, treasure): temporärer Schild (absorbiert den nächsten
  Treffer). Laden: 3 Räume.
- **Zeitschlick** (legendary, treasure/boss): verlangsamt alle Gegner & Kugeln
  einige Sekunden. Laden: 3 Räume.
- **Lebensblüte** (common, shop/treasure): heilt 1 Herz. Laden: 3 Räume.

## Neu — Build-Definer (legendary, treasure/boss)
- **Der ertrunkene Stern**: verwandelt hohe Feuerrate in *einen* riesigen,
  langsamen, extrem harten Schuss (Feuerrate/Schusszahl stark reduziert). Bewertet
  Homing/Pierce/Bounce völlig neu. *Syn:* Magnetherz, Gummigeschoss.
- **Hohler Chor**: jeder 3. Schuss löst eine komplette Extra-Salve aus (Echo).
  Belohnt Schuss-Modifier-Stacking massiv. *Syn:* alle Flags.
- **Abgrund-Pakt**: Max-Herz → 1, dafür +massiv Schaden & Feuerrate und ein
  Schild-Ladung pro Raum-Clear. Definiert das Glaskanonen-Spiel. *Syn:* Statik-
  Schleier, Ausweich-Aktive.
- **Prismenkern**: verstärkt alle Flag-Effekte (Explosion/Gift/Kette/…) um +50 %.
  Verstärker, der Flag-Items neu bewertet. *Syn:* jedes Schuss-Modifier.

---

## Synergie-Garantie (≥ ⅓ der Items)
Mindestens ein Drittel bildet mit ≥2 anderen eine spürbare Synergie. Kern-Cluster:
- **Crowd/AoE:** Kettenfunke ↔ Funkenschwarm-Gegner ↔ Sporenbruch ↔ Irrschuss ↔ Pulverspitze ↔ Glaslaterne.
- **onHit-Stacking:** Glaslaterne ↔ Glutmal ↔ Jägermal ↔ Kettenfunke ↔ Frostperle.
- **Riesen-Schuss:** Der ertrunkene Stern ↔ Magnetherz ↔ Gummigeschoss ↔ Geschwollenes Auge ↔ Tiefendruck.
- **Glaskanone:** Abgrund-Pakt ↔ Federschuppe ↔ Statik-Schleier ↔ Gleitströmung ↔ Makelloses Gelübde.
- **Flag-Verstärker:** Prismenkern ↔ jedes Flag-Item; Hohler Chor ↔ jedes onShoot-Item.

## Umsetzungs-Änderungen (dokumentiert)
- **Prismenkern:** statt „alle Flag-Effekte +50 %" (im Kern diffus umzusetzen) nun
  „Schüsse gabeln UND vergiften" — klare Flag-Gewährung, macht jeden Build zum
  Flächen-Build, bleibt ein Build-Definer.
- **Bumerangflosse/Schwermond** implizieren Durchschuss (treffen so 2× / lohnen die
  Grösse). **Hohler Chor** = ~⅓-Chance Echo-Schuss (stateless) statt „jeder 3.".
- Endstand **52 Items** (im Zielband 50–60), davon **20 schuss-getaggt** (≥15).

## Regeln (aus Prompt 1 fortgeführt)
- Eigene Namen/Konzepte, nichts aus dem Vorbild.
- Neue Items = neue Effekt-Objekte in `items/registry.ts`, kein Kern-Sonderfall.
- Farben tag-codiert aus den Palette-Tokens (Aktive Items bekommen ein eigenes,
  klar unterscheidbares Tag/Icon).
- Wenn ein Item beim Bauen kaputt/langweilig ist: hier im Sheet ändern und
  begründen — die Docs bleiben die Wahrheit.
