# Hollowdeep

Ein browserbasiertes Twin-Stick-Roguelike im Geist von *The Binding of Isaac* —
eigene Welt, eigene (Platzhalter-)Assets. TypeScript + Vite, Rendering über
Canvas 2D, keine Runtime-Dependencies ausser Vite.

## Starten

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # Typecheck + Produktions-Build nach dist/
```

## Steuerung

| Taste | Aktion |
| --- | --- |
| `WASD` | Bewegen |
| Pfeiltasten | Schiessen |
| `E` | Bombe legen |
| `Esc` / `P` | Pause (Stat-Übersicht) |
| `Leertaste` / `Enter` | Run starten / Menü |

Gamepad wird unterstützt: linker Stick bewegt, rechter Stick zielt.

## Core Loop

Menü → Raum betreten → Gegner töten → Türen öffnen sich → nächster Raum →
Boss → Falltür → nächstes Stockwerk. Tod = zurück ins Hauptmenü, alles weg.

## Architektur

```
src/
  main.ts            Bootstrap, Game-Loop-Verdrahtung
  Game.ts            Szenen (Titel / Playing / GameOver, Pause)
  Run.ts             Ein Durchlauf: Räume, Kampf, Item-Hooks, Übergänge
  constants.ts       Raum-/View-Masse, Fixed-Timestep
  core/              Loop, Input, Renderer, SpatialGrid, collision, math
  entities/          Player, Enemy, Boss, Projectile, Obstacle, Pickup, Particle
  world/             Floor-Generator, Room-Rendering, directions, Templates (JSON)
  items/             Item-Registry + Effekt-Hooks (Item.ts)
  ui/                HUD, Minimap, PauseMenu
```

### Prinzipien

- **Fixed Timestep, 60 Hz, mit Accumulator**; Rendering entkoppelt und zwischen
  Ticks interpoliert (`core/Loop`).
- **Composition statt Vererbung**: jede Entity ist ein Objekt aus Komponenten
  (`transform`, `body`, `stats`, …), Verhalten per Dispatch.
- **Items sind Daten mit Hooks** (`onPickup`, `onShoot`, `onHit`, `onKill`,
  `onRoomClear`, `onDamageTaken`, `modifyStats`). Jeder Hook läuft für jedes
  aktive Item — Synergien entstehen automatisch. Projektile tragen Flags
  (`homing`, `piercing`, `explosive`, `bouncing`, `poison`), Items setzen sie.
  Neue Items in `items/registry.ts` anhängen — sonst nichts anfassen.
- **Kein DOM pro Entity**, Object-Pools für Projektile und Partikel, Spatial Grid
  für Broad-Phase-Kollision.

### Nachliefern

- **Items**: Eintrag in `src/items/registry.ts` ergänzen.
- **Raum-Layouts**: Template in `src/world/roomTemplates.json` ergänzen.
- **Sprites**: Platzhalter sind farbige Kreise/Rechtecke mit klarer Silhouette;
  Rendering pro Entity ist gekapselt (`renderPlayer`, `renderEnemy`, …), also
  lassen sich `ctx.drawImage`-Aufrufe leicht einsetzen.
