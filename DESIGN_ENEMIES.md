# DESIGN — Gegner

> Gegner sind ein **Vokabular**: jeder stellt dem Spieler *eine* Frage, die
> noch kein anderer stellt. Der Reiz entsteht aus Kombinationen — ein
> Fernkämpfer + ein Verfolger zwingt zu anderer Bewegung als jeder allein.
> Look & Farbe gebunden an `ART_DIRECTION.md` (kalte Kreaturen, Farbe kodiert
> Familie, Silhouette kodiert Typ, nur ihre Schüsse sind `--danger`).

Format: **Frage** · Rolle · Tell → Verhalten → Counterplay.

---

## Bestehende fünf (Rollen geschärft)

### Tiefenschleicher · `chaser` · `--hunter`
- **Frage:** „Räumst du mich weg, bevor ich dich stelle?"
- Rolle: Grundbedrohung, erzeugt Zeitdruck.
- Tell: dauerhaftes Zudrängen (kein Angriffs-Tell nötig, er *ist* die Drohung).
- Counter: Kiten, priorisieren; stirbt schnell.

### Springmaul · `hopper` · `--leaper`
- **Frage:** „Kannst du meinen Sprung-Rhythmus lesen?"
- Rolle: rhythmische Positionsbedrohung.
- Tell: Stauchen ( Duck) vor dem Sprung, Strecken im Flug.
- Counter: seitlich weg im Duck-Moment; zwischen Sprüngen gefahrlos.

### Späher · `shooter` · `--caster`
- **Frage:** „Kannst du dich bewegen, *während* du zurückschiesst?"
- Rolle: zwingt Bewegung + Zielen gleichzeitig.
- Tell: Fokus-Ring zieht sich vor dem Schuss zusammen.
- Counter: quer zur Schussrichtung; Distanz schliessen entwertet ihn.

### Kristallwächter · `bouncer` · `--shard`
- **Frage:** „Hältst du eine Bahn frei, oder läufst du hinein?"
- Rolle: bewegliche Raum-Gefahr, ignoriert dich.
- Tell: gerade, vorhersehbare Bahn; Aufblitzen beim Abprall.
- Counter: Bahn lesen, nicht kreuzen; berechenbar.

### Laichbrocken · `splitter` · `--brood`
- **Frage:** „Kümmerst du dich zuerst um mich oder um den Rest?"
- Rolle: Mengen-Management, Ziel-Reihenfolge.
- Tell: pulsierende Teilungsnaht.
- Counter: mit AoE/Pierce zusammen töten; einzeln erzeugt er mehr Chaos.

---

## Sechs neue (je eine neue Frage)

### Netzweber · `weaver` · `--brood` (dunkler)
- **Frage:** „Wie viel Raum gibst du auf, um sicher zu bleiben?"
- Rolle: **Raum-Attrition** — verkleinert nutzbaren Boden.
- Tell: driftet langsam und zieht eine leuchtende Schleim-Spur, die kurz als
  Gefahren-Feld (`--danger`, gedämpft) liegen bleibt und dich verlangsamt.
- Verhalten: hält Distanz, webt bevorzugt zwischen dir und offenem Raum.
- Counter: früh töten, bevor das Netz den Raum zuzieht; nie in eine Ecke weben
  lassen. Neu ggü. bouncer: die Gefahr *bleibt liegen*, statt zu wandern.

### Wächteraug · `sentinel` · `--caster` (blass)
- **Frage:** „Triffst du mich von der richtigen Seite?"
- Rolle: **Winkel-Zwang** — Positionierung um eine Deckung herum.
- Tell: ein leuchtender Schild-Bogen auf seiner *Vorderseite* (zeigt zu dir),
  Auge lädt vor dem Schuss hell auf.
- Verhalten: stationär/träge, dreht sich langsam zu dir, feuert seltene schwere
  gezielte Schüsse. Schild blockt Spieler-Schüsse aus dem Frontwinkel komplett.
- Counter: umlaufen und in den *Rücken* schiessen; das langsame Nachdrehen gibt
  ein Fenster. Neu: erstes Ziel, das *Winkel* statt Reaktion verlangt.

### Bannkugel · `warden` · `--bio`
- **Frage:** „Schaltest du zuerst den Beschützer aus?"
- Rolle: **Support / Ziel-Priorität** — macht *andere* gefährlich.
- Tell: sichtbarer Schild-Strahl zu jedem Gegner, den sie gerade schützt; die
  geschützten Gegner tragen eine `--bio`-Blase (klar „unverwundbar").
- Verhalten: schwebt hinten, verleiht nahen Gegnern eine Schild-Blase
  (Unverwundbarkeit), solange die Kugel lebt. Selbst schwach.
- Counter: die Kugel zuerst töten — dann fällt der ganze geschützte Trupp. Neu
  ggü. splitter (Menge): hier geht es um *das eine richtige Ziel*.

### Sturztaucher · `diver` · `--caster` (hell)
- **Frage:** „Bleibst du je stehen?"
- Rolle: **Anti-Camp** — bestraft Stillstand.
- Tell: steigt aus dem Sichtfeld auf, ein wachsender Schatten-/Zielkreis
  (`--danger`-Umriss) markiert ~1s lang deine *aktuelle* Position.
- Verhalten: schlägt nach dem Tell an der markierten Stelle ein (AoE), zieht
  sich zurück, wiederholt. Trifft nur, wo du *warst*.
- Counter: einfach weiterlaufen; der Kreis ist grosszügig, aber Stehenbleiben
  ist tödlich. Neu: die einzige Bedrohung, die *Bewegung erzwingt*.

### Rammhorn · `charger` · `--hunter` (hell)
- **Frage:** „Nutzt du das Konter-Fenster nach dem Dash?"
- Rolle: **Commit & Punish** — Timing eines Gegenschlags.
- Tell: richtet sich aus, gräbt ein (Anlauf-Pose), Hornspitze leuchtet auf
  (~0.7s), eine dünne `--danger`-Linie zeigt die Dash-Bahn.
- Verhalten: dasht einmal schnell in gerader Linie, überschiesst, dann steckt es
  kurz fest (Erschöpfung, doppelter Schaden nimmt es dann).
- Counter: **senkrecht** zur Linie ausweichen, dann im Steck-Fenster draufhalten.
  Neu ggü. chaser (Dauerdruck): dieser *committet und ist danach verwundbar*.

### Funkenschwarm · `swarm` · `--leaper` (klein, viele)
- **Frage:** „Hältst du die Menge auf Abstand, oder lässt du dich einkesseln?"
- Rolle: **Crowd / Flächenwert** — belohnt Pierce/Explosiv/AoE.
- Tell: bewegt sich als sichtbarer Schwarm (Flock), einzeln trivial; das Kollektiv
  umschliesst dich langsam.
- Verhalten: 4–6 winzige Flieger, jeder 1 HP, schwärmen locker auf dich zu.
- Counter: nicht einkesseln lassen (Positionierung), mit einem durchschlagenden
  Schuss mehrere auf einmal räumen. Neu: der erste Gegner, bei dem *ein* Schuss
  *viele* treffen sollte — macht Pierce/Explosiv spürbar wertvoll.

---

## Kombinations-Absichten (warum das Vokabular zusammen funktioniert)

- **Späher + Tiefenschleicher:** du kannst nicht ruhig zielen (Verfolger drückt)
  und nicht ruhig laufen (Späher schiesst) → erzwingt Zirkel-Bewegung.
- **Wächteraug + irgendein Verfolger:** die Deckung, die dich vom Wächteraug
  wegdreht, treibt dich dem Verfolger in die Arme → Winkel vs. Druck.
- **Bannkugel + Rammhorn/Späher:** der geschützte Rammbock ist unantastbar, bis
  du den Support findest → Zielpriorität unter Zeitdruck.
- **Netzweber + Sturztaucher:** das Netz nimmt Boden, der Taucher bestraft das
  Stehenbleiben im Restraum → doppelte Positionierungs-Zange.
- **Funkenschwarm + Springmaul:** der Schwarm kesselt, der Hüpfer nutzt die
  Enge → belohnt, den Schwarm früh mit AoE aufzulösen.
