# DESIGN — Bosse

> Sechs Bosse, **kein Boss spielt sich wie ein anderer** — jeder hat ein eigenes
> Kern-Pattern und einen „Aha"-Moment, wenn man es durchschaut. Pro Floor wird
> einer zufällig gezogen, passend zur Floor-Schwierigkeit (Tier). Phase 2 ändert
> das *Verhalten*, nicht nur HP/Tempo. Look gebunden an `ART_DIRECTION.md`.
> Gefahr immer `--danger`; jeder Angriff hat einen sichtbaren Tell.

Kern-Pattern-Übersicht (jeder Slot einmal besetzt):

| Boss | Kern-Pattern | Testet | Tier |
| --- | --- | --- | --- |
| Gezeitenwächter | Nahkampf-Verfolger (Charges) | Positionierung/Kiting | 1 |
| Laternenschwarm | Bullet-Pattern | Ausweichen / Muster lesen | 1 |
| Rammhorn-Fürst | Commit-Dash-Duell + Adds-Lite | Timing / Konter | 2 |
| Brutmutter | Adds-Spawner | Prioritäten / Ressourcen | 2 |
| Versunkenes Idol | Arena-Veränderer | Raumkontrolle | 3 |
| Strömungsschlange | Bewegliches Hindernis | Ausweichen / Space-Denial | 3 |

Tier = frühestes Stockwerk. Floor n zieht aus allen Bossen mit Tier ≤ ceil(n/2),
sodass frühe Floors zahmer starten und sich Runs unterscheiden.

---

## Gezeitenwächter (Tidewarden)
- **Fantasy:** Ein kolossaler Panzerwächter, der dich unerbittlich rammt — das
  Gefühl, vor einer Lawine zu fliehen.
- **Rolle:** Positionierung/Kiting unter Dauerdruck.
- **Arena:** offen; er nutzt die Wände, um dich einzuklemmen.
- **Silhouette:** massiver runder Brocken, Panzer-Violett (`--boss-body`),
  schwerer Glow, zwei glühende Augen; grösster „solider" Körper der Riege.
- **Phase 1:**
  - *Anlauf-Ramme* — **Tell:** richtet sich auf dich aus, Augen flammen auf,
    lehnt sich ~0.6 s zurück. **Ablauf:** Dash in gerader Linie, prallt 1× von der
    Wand ab, dann ~1.2 s Erschöpfung. **Counter:** seitlich ausweichen, im
    Erschöpfungsfenster schiessen.
  - *Grundstampfer* — **Tell:** hebt sich, ein Ring-Umriss (`--danger`) zeichnet
    sich am Boden. **Ablauf:** Stampfen sendet *einen* expandierenden Schockring
    mit einer Lücke nach aussen. **Counter:** durch die Lücke oder rechtzeitig aus
    dem Radius.
- **Phase-2-Trigger (<50 %):** Die Anlauf-Ramme hinterlässt jetzt eine kurz
  glühende Gefahren-Spur auf dem Pfad und prallt **2×** ab — die Arena verengt
  sich mit jedem Angriff, du musst die Spuren mit einplanen.
- **Fehlerkultur:** bestraft Stehen in der Bahn und Ecken; verzeiht saubere
  Seitwärts-Dodges (grosszügiges Erschöpfungsfenster).

## Laternenschwarm (Lantern-Choir)
- **Fantasy:** Ein schwebender Chor aus Laternen-Geistern, der den Raum mit
  Licht-Salven flutet — hypnotisch und tödlich.
- **Rolle:** Reines Ausweichen, Muster lesen.
- **Arena:** schwebt zentral; du kreist aussen.
- **Silhouette:** Kern-Kugel (`--boss-body`) mit umlaufenden kleinen Laternen-
  Punkten, die vor Salven zum Kern ziehen.
- **Phase 1:**
  - *Ringsalve* — **Tell:** Laternen ziehen sich zum Kern zusammen, Aufblitzen.
    **Ablauf:** gleichmässiger Kugelring nach aussen. **Counter:** in die Lücken
    radial hinauslaufen.
  - *Zielfächer* — **Tell:** eine Laterne leuchtet hell und richtet sich auf dich.
    **Ablauf:** 3–5-Fächer auf deine Position. **Counter:** quer dodgen.
  - *Spirale* — **Tell:** Kern beginnt sichtbar zu rotieren (Spin-up). **Ablauf:**
    rotierender Spiralstrom. **Counter:** mit der Drehrichtung mitlaufen.
- **Phase-2-Trigger (<50 %):** Ringsalve wird zum **Doppelring** (zwei versetzte
  Ringe, deren Lücken *wandern*); Spirale dreht in **beide** Richtungen. Das
  Ausweichen ändert sich grundlegend — statische Lücken gibt es nicht mehr.
- **Fehlerkultur:** bestraft Panik/Stehenbleiben; verzeiht ruhiges, stetiges Kreisen.

## Rammhorn-Fürst (Charger-Lord)
- **Fantasy:** Der uralte Leitbulle der Rammhörner — ein Duell aus Anlauf und
  Konter, unterbrochen von rufender Brut.
- **Rolle:** Timing / Konter-Fenster (Read & Punish).
- **Arena:** lange Sichtlinien; er braucht Anlaufstrecke.
- **Silhouette:** schlanker, kantiger Körper mit grossem leuchtenden Horn
  (`--hunter`), tief geduckte Anlauf-Pose.
- **Phase 1:**
  - *Sturmlauf* — **Tell:** gräbt ein, Horn leuchtet auf, dünne `--danger`-Linie
    zeigt die Bahn (~0.7 s). **Ablauf:** ein schneller Dash, überschiesst, steckt
    ~1 s fest (Schwachpunkt). **Counter:** senkrecht ausweichen, dann draufhalten.
  - *Ruf der Brut* — **Tell:** wirft den Kopf hoch, Horn-Doppelblitz. **Ablauf:**
    spawnt 2 `charger`-Adds (kleine Rammhörner). **Counter:** Adds im Anlauf lesen
    oder DPS auf den Fürsten pushen — echte Entscheidung.
- **Phase-2-Trigger (<50 %):** Sturmlauf wird zum **Dreifach-Dash** (drei Dashes
  hintereinander mit kurzer Umlenkung), Steck-Fenster kürzer. Der Konter wird
  präziser — du musst zwischen den Dashes lesen statt nur einmal.
- **Fehlerkultur:** bestraft blindes Draufhalten in der Bahn; verzeiht saubere
  Senkrecht-Dodges + Geduld aufs Fenster.

## Brutmutter (Brood-Mother)
- **Fantasy:** Eine aufgeblähte Laichkreatur, die den Raum mit Brut füllt — die
  eigentliche Gefahr sind ihre Kinder.
- **Rolle:** Prioritäten / Ressourcen (Adds vs. Boss-DPS).
- **Arena:** hält sich oben/hinten, umgibt sich mit Adds.
- **Silhouette:** grosse runde Masse (`--brood`) mit sichtbaren Laichkammern,
  die vor dem Spawn hell pulsieren.
- **Phase 1:**
  - *Laichen* — **Tell:** eine Laichkammer pulsiert auf. **Ablauf:** spawnt 2–3
    `swarm`/`chaser`-Adds. **Counter:** Adds mit AoE räumen *oder* Boss pushen und
    Adds ignorieren — die Kernentscheidung.
  - *Gift-Spucke* — **Tell:** Maul öffnet sich, lädt (`--danger`-Glühen).
    **Ablauf:** eine langsame, grosse Giftkugel auf dich, blockiert Sicht.
    **Counter:** ausweichen, nicht dahinter einklemmen lassen.
- **Phase-2-Trigger (<50 %):** laicht **häufiger** und **erzürnt** bestehende Adds
  (schneller, aggressiver). Add-Management wird zum Kern; reines Boss-Tunneln
  wird bestraft, weil der Raum überläuft.
- **Fehlerkultur:** bestraft Ignorieren der Adds (Einkesselung); verzeiht
  diszipliniertes Aufräumen zwischen den Laich-Wellen.

## Versunkenes Idol (Sunken Idol)
- **Fantasy:** Ein uraltes Götzenbild, das den Tempel flutet — du kämpfst gegen
  den Raum, nicht nur gegen das Idol.
- **Rolle:** Raumkontrolle / Positionierung.
- **Arena:** stationär im Zentrum; „flutet" Streifen/Quadranten mit Gefahr.
- **Silhouette:** **kantiges, gebautes** Idol (Register „Gebautes" wie der
  Kristallwächter), dunkler Stein mit glühenden Bio-Ritzlinien + `--danger`-Augen.
- **Phase 1:**
  - *Flut* — **Tell:** ein Streifen/Quadrant des Bodens färbt sich ~1.2 s
    (`--danger`, gedämpft). **Ablauf:** dieser Bereich wird kurz tödlich (Welle).
    **Counter:** vorausschauend in einen sicheren Bereich stehen.
  - *Peilstrahl* — **Tell:** Auge lädt (heller), dreht sich zu dir. **Ablauf:**
    ein rotierender Strahl (`--danger`) sweept einmal herum. **Counter:** ums Idol
    laufen, dem Strahl davon.
- **Phase-2-Trigger (<50 %):** **zwei** Bereiche fluten gleichzeitig (sichere
  Fläche schrumpft), Peilstrahl wird **Doppelstrahl** (zwei Arme). Der Raum selbst
  wird zum Hauptgegner — Positionierung schlägt Reflexe.
- **Fehlerkultur:** bestraft Verweilen in Warnzonen; verzeiht frühes Umziehen
  (Vorwarnung ist bewusst grosszügig).

## Strömungsschlange (Current-Serpent)
- **Fantasy:** Ein langer Aal aus Strömung und Licht, der den Raum durchzieht —
  sein Körper *ist* die Gefahr.
- **Rolle:** Ausweichen + Space-Denial (der Körper verstellt Bahnen).
- **Arena:** patrouilliert in Bahnen quer durch den Raum.
- **Silhouette:** mehrgliedriger Segment-Körper (`--caster`/`--bio`), leuchtender
  Kopf mit `--danger`-Maul; der einzige lange, nicht-runde Boss.
- **Phase 1:**
  - *Durchzug* — **Tell:** Kopf richtet sich aus, Segmente ziehen sich zusammen
    (Anlauf). **Ablauf:** schwimmt in einer Kurve quer durch den Raum;
    Körperkontakt schadet. **Counter:** Bahn antizipieren, auf die freie Seite.
  - *Biss-Spucke* — **Tell:** Maul leuchtet `--danger` auf. **Ablauf:** 3 gezielte
    Projektile beim Vorbeiziehen. **Counter:** seitlich ausweichen.
- **Phase-2-Trigger (<50 %):** **Umsetzungs-Änderung (dokumentiert):** Eine echte
  Teilung in zwei unabhängige Schlangen bräuchte ein Multi-Boss-System (zwei
  Köpfe/HP-Pools) — ausserhalb des jetzigen Ein-Boss-Objekts. Stattdessen
  **beschleunigt** die Schlange deutlich, **zieht sich enger zusammen** (Körper
  verstellt mehr Bahn) und die Biss-Spucke wird zum **5-Fächer**. Das ändert das
  Ausweichen spürbar; der „Aha" bleibt: Kopf ist die Schwachstelle, Körper nur
  Hindernis. (Eine echte Teilung ist als späteres Feature vermerkt.)
- **Fehlerkultur:** bestraft Sich-Einkesseln-Lassen (in eine Ecke gedrängt);
  verzeiht Positionierung in der Raummitte mit Bahn-Lesen.

---

## Umsetzungs-Notiz
- Gemeinsame Boss-Basis (Transform, HP, Phase, Timer, Health-Bar, Tod → Reward +
  Falltür). Jeder Boss ist ein **eigenes Verhaltensobjekt** über einen `type`-
  Dispatch (Composition, kein Vererbungsbaum), analog zu den Gegnern.
- Angriffe laufen über ein kleines Telegraph→Fire-Schema: jeder Angriff hat eine
  `windup`-Phase (sichtbarer Tell) und eine `fire`-Phase. Kein Schaden ohne
  vorherigen Tell.
- Boss-Tod droppt ein Item aus dem **Boss-Reward-Pool** (siehe DESIGN_ITEMS.md),
  dann öffnet sich die Falltür.
