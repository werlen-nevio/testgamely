import type { Item } from "./Item"

// ─── ITEM REGISTRY ───
// Pure data, kept apart from the engine so new items are a copy-paste away.
// Stage 4 ships five: two pure stat items and three shot-modifiers, chosen so
// their synergy is immediately felt (spread × piercing × homing all combine
// with no combo-specific code).

const SPREAD_ANGLE = 0.28 // radians between the centre shot and each wing

export const ITEMS: Item[] = [
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
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export const itemById = (id: string): Item | undefined => ITEM_BY_ID.get(id)

// Draws a random item id, avoiding anything the player already holds when
// possible so pedestals feel fresh.
export const randomItemId = (excludeIds: readonly string[] = []): string => {
  const available = ITEMS.filter((item) => !excludeIds.includes(item.id))
  const pool = available.length > 0 ? available : ITEMS
  return pool[Math.floor(Math.random() * pool.length)].id
}
