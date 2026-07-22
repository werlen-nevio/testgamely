import type { Item } from "./Item"
import { applyPoison } from "../entities/Enemy"

// ─── ITEM REGISTRY ───
// Pure data, kept apart from the engine. 25 items; nine of them modify shots
// (tagged "shot"). Because every hook runs for every held item, any mix stacks
// on its own — no combo is coded by hand.

const SPREAD_ANGLE = 0.28

export const ITEMS: Item[] = [
  // ── stat items ──
  {
    id: "rusted-fang",
    name: "Rostiger Fang",
    description: "+2 Schaden.",
    tag: "damage",
    color: "#d1603a",
    glyph: "F",
    modifyStats: (stats) => {
      stats.damage += 2
    },
  },
  {
    id: "twitch-trigger",
    name: "Zuckabzug",
    description: "Deutlich höhere Feuerrate.",
    tag: "tears",
    color: "#4fb0c9",
    glyph: "T",
    modifyStats: (stats) => {
      stats.fireRate += 1.6
    },
  },
  {
    id: "long-lens",
    name: "Fernglas",
    description: "+Reichweite und Schussgeschwindigkeit.",
    tag: "utility",
    color: "#6fa1c9",
    glyph: "L",
    modifyStats: (stats) => {
      stats.range += 160
      stats.shotSpeed += 70
    },
  },
  {
    id: "quick-boots",
    name: "Flinke Stiefel",
    description: "+Bewegungstempo.",
    tag: "utility",
    color: "#63c98a",
    glyph: "B",
    modifyStats: (stats) => {
      stats.moveSpeed += 45
    },
  },
  {
    id: "black-clover",
    name: "Schwarzes Kleeblatt",
    description: "+Glück.",
    tag: "utility",
    color: "#4a8f5a",
    glyph: "C",
    modifyStats: (stats) => {
      stats.luck += 3
    },
  },
  {
    id: "heavy-slug",
    name: "Schweres Geschoss",
    description: "+3.5 Schaden, aber langsamere Feuerrate.",
    tag: "damage",
    color: "#b8503a",
    glyph: "S",
    modifyStats: (stats) => {
      stats.damage += 3.5
      stats.fireRate = Math.max(1, stats.fireRate - 0.6)
    },
  },
  {
    id: "iron-rind",
    name: "Eiserne Rinde",
    description: "+1 maximales Herz, voll geheilt.",
    tag: "defense",
    color: "#c98a4a",
    glyph: "R",
    modifyStats: (stats) => {
      stats.maxHearts += 1
    },
    onPickup: ({ run }) => {
      run.heal(1)
    },
  },
  {
    id: "sacrificial-edge",
    name: "Opferklinge",
    description: "+5 Schaden, aber -1 maximales Herz.",
    tag: "damage",
    color: "#a8324a",
    glyph: "X",
    modifyStats: (stats) => {
      stats.damage += 5
      stats.maxHearts = Math.max(1, stats.maxHearts - 1)
    },
  },
  {
    id: "momentum-core",
    name: "Schwungkern",
    description: "+Tempo und +Schussgeschwindigkeit.",
    tag: "utility",
    color: "#5ac9c0",
    glyph: "M",
    modifyStats: (stats) => {
      stats.moveSpeed += 28
      stats.shotSpeed += 60
    },
  },
  {
    id: "twin-fangs",
    name: "Zwillingsfänge",
    description: "+1.5 Schaden und +0.8 Feuerrate.",
    tag: "damage",
    color: "#d17a4a",
    glyph: "W",
    modifyStats: (stats) => {
      stats.damage += 1.5
      stats.fireRate += 0.8
    },
  },

  // ── shot modifiers (9) ──
  {
    id: "ghost-round",
    name: "Geisterschuss",
    description: "Schüsse durchbohren alle Gegner.",
    tag: "shot",
    color: "#c9c2e8",
    glyph: "P",
    onShoot: ({ projectile }) => {
      projectile.flags.piercing = true
      projectile.pierceRemaining = 99
    },
  },
  {
    id: "lodestone-heart",
    name: "Magnetherz",
    description: "Schüsse suchen sich Gegner.",
    tag: "shot",
    color: "#8a7ad6",
    glyph: "H",
    onShoot: ({ projectile }) => {
      projectile.flags.homing = true
    },
  },
  {
    id: "split-tongue",
    name: "Spaltzunge",
    description: "Feuert zwei zusätzliche Schüsse im Fächer.",
    tag: "shot",
    color: "#d7a54a",
    glyph: "Y",
    onShoot: ({ run, projectile }) => {
      const { velocityX, velocityY } = projectile.transform
      for (const angle of [-SPREAD_ANGLE, SPREAD_ANGLE]) {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        run.spawnShot({
          faction: "player",
          x: projectile.transform.x,
          y: projectile.transform.y,
          velocityX: velocityX * cos - velocityY * sin,
          velocityY: velocityX * sin + velocityY * cos,
          radius: projectile.radius,
          damage: projectile.damage,
          lifeTicks: projectile.lifeTicks,
        })
      }
    },
  },
  {
    id: "rubber-round",
    name: "Gummigeschoss",
    description: "Schüsse prallen von Wänden ab.",
    tag: "shot",
    color: "#5ac97a",
    glyph: "O",
    onShoot: ({ projectile }) => {
      projectile.flags.bouncing = true
      projectile.bounceRemaining = 3
    },
  },
  {
    id: "powder-tip",
    name: "Pulverspitze",
    description: "Schüsse explodieren beim Aufprall.",
    tag: "shot",
    color: "#e08a3a",
    glyph: "E",
    onShoot: ({ projectile }) => {
      projectile.flags.explosive = true
    },
  },
  {
    id: "venom-sac",
    name: "Giftbeutel",
    description: "Schüsse vergiften Gegner.",
    tag: "shot",
    color: "#7ac94a",
    glyph: "V",
    onShoot: ({ projectile }) => {
      projectile.flags.poison = true
    },
  },
  {
    id: "swollen-eye",
    name: "Geschwollenes Auge",
    description: "Grössere, härtere Schüsse.",
    tag: "shot",
    color: "#c95a8a",
    glyph: "G",
    onShoot: ({ projectile }) => {
      projectile.radius *= 1.7
      projectile.damage *= 1.2
    },
  },
  {
    id: "mirror-twin",
    name: "Spiegelzwilling",
    description: "Feuert einen parallelen zweiten Schuss.",
    tag: "shot",
    color: "#9ac9d6",
    glyph: "II",
    onShoot: ({ run, projectile }) => {
      const perpX = -projectile.transform.velocityY
      const perpY = projectile.transform.velocityX
      const length = Math.hypot(perpX, perpY) || 1
      const offset = 14
      run.spawnShot({
        faction: "player",
        x: projectile.transform.x + (perpX / length) * offset,
        y: projectile.transform.y + (perpY / length) * offset,
        velocityX: projectile.transform.velocityX,
        velocityY: projectile.transform.velocityY,
        radius: projectile.radius,
        damage: projectile.damage,
        lifeTicks: projectile.lifeTicks,
      })
    },
  },
  {
    id: "rearguard",
    name: "Rückendeckung",
    description: "Feuert zusätzlich nach hinten.",
    tag: "shot",
    color: "#c9b04a",
    glyph: "R",
    onShoot: ({ run, projectile }) => {
      run.spawnShot({
        faction: "player",
        x: projectile.transform.x,
        y: projectile.transform.y,
        velocityX: -projectile.transform.velocityX,
        velocityY: -projectile.transform.velocityY,
        radius: projectile.radius,
        damage: projectile.damage,
        lifeTicks: projectile.lifeTicks,
      })
    },
  },

  // ── triggered effects (onHit / onKill / onRoomClear / onDamageTaken) ──
  {
    id: "ember-brand",
    name: "Glutmal",
    description: "Treffer entzünden Gift bei Gegnern.",
    tag: "shot",
    color: "#d15a3a",
    glyph: "K",
    onHit: ({ enemy }) => {
      applyPoison(enemy, 70)
    },
  },
  {
    id: "leech-charm",
    name: "Egel-Amulett",
    description: "Kills heilen manchmal.",
    tag: "defense",
    color: "#b83a5a",
    glyph: "D",
    onKill: ({ run, player }) => {
      if (Math.random() < 0.12) run.heal(1)
      void player
    },
  },
  {
    id: "coin-vein",
    name: "Münzader",
    description: "Kills lassen manchmal Münzen fallen.",
    tag: "utility",
    color: "#d6b23a",
    glyph: "$",
    onKill: ({ run, x, y }) => {
      if (Math.random() < 0.2) run.spawnPickupDrop(x, y)
    },
  },
  {
    id: "tribute-bowl",
    name: "Opferschale",
    description: "Geräumte Räume bringen Münzen.",
    tag: "utility",
    color: "#c9a24a",
    glyph: "U",
    onRoomClear: ({ run }) => {
      run.addCoins(2)
    },
  },
  {
    id: "thorn-mantle",
    name: "Dornenmantel",
    description: "Schaden zu nehmen verletzt alle Gegner.",
    tag: "defense",
    color: "#8a9a3a",
    glyph: "Z",
    onDamageTaken: ({ run }) => {
      run.damageAllEnemies(4)
      run.shake(8)
    },
  },
  {
    id: "bulwark-heart",
    name: "Bollwerkherz",
    description: "+2 maximale Herzen, voll geheilt, etwas langsamer.",
    tag: "defense",
    color: "#b87a3a",
    glyph: "A",
    modifyStats: (stats) => {
      stats.maxHearts += 2
      stats.moveSpeed = Math.max(120, stats.moveSpeed - 18)
    },
    onPickup: ({ run }) => {
      run.heal(2)
    },
  },
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export const itemById = (id: string): Item | undefined => ITEM_BY_ID.get(id)

// Draws a random item id, avoiding anything the player already holds when
// possible so pedestals and shop stock feel fresh.
export const randomItemId = (excludeIds: readonly string[] = []): string => {
  const available = ITEMS.filter((item) => !excludeIds.includes(item.id))
  const pool = available.length > 0 ? available : ITEMS
  return pool[Math.floor(Math.random() * pool.length)].id
}
