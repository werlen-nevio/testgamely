import type { Item, ItemPool, Rarity } from "./Item"
import { applyPoison } from "../entities/Enemy"

// ─── ITEM REGISTRY ───
// Pure data, sorted by role (see DESIGN_ITEMS.md). Everything runs through the
// hook chain — new items are new effect objects, never engine special cases.
// Each carries a rarity and the room pools it can appear in.

const SPREAD_ANGLE = 0.28

export const ITEMS: Item[] = [
  // ══ Charakter-Stats ══
  { id: "rusted-fang", name: "Rostiger Fang", description: "+2 Schaden.", tag: "damage", rarity: "common", pools: ["treasure", "shop"], glyph: "F", modifyStats: (s) => { s.damage += 2 } },
  { id: "twitch-trigger", name: "Zuckabzug", description: "Deutlich höhere Feuerrate.", tag: "tears", rarity: "common", pools: ["treasure", "shop"], glyph: "T", modifyStats: (s) => { s.fireRate += 1.6 } },
  { id: "long-lens", name: "Fernglas", description: "+Reichweite & Schusstempo.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "L", modifyStats: (s) => { s.range += 160; s.shotSpeed += 70 } },
  { id: "quick-boots", name: "Flinke Stiefel", description: "+Bewegungstempo.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "B", modifyStats: (s) => { s.moveSpeed += 45 } },
  { id: "black-clover", name: "Schwarzes Kleeblatt", description: "+Glück.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "C", modifyStats: (s) => { s.luck += 3 } },
  { id: "twin-fangs", name: "Zwillingsfänge", description: "+1.5 Schaden & +0.8 Feuerrate.", tag: "damage", rarity: "common", pools: ["treasure", "shop"], glyph: "W", modifyStats: (s) => { s.damage += 1.5; s.fireRate += 0.8 } },
  { id: "iron-rind", name: "Eiserne Rinde", description: "+1 Max-Herz, voll geheilt.", tag: "defense", rarity: "common", pools: ["treasure", "shop"], glyph: "R", modifyStats: (s) => { s.maxHearts += 1 }, onPickup: ({ run }) => run.heal(1) },
  { id: "momentum-core", name: "Schwungkern", description: "+Tempo & +Schusstempo.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "M", modifyStats: (s) => { s.moveSpeed += 28; s.shotSpeed += 60 } },
  // trade-offs
  { id: "heavy-slug", name: "Schweres Geschoss", description: "+3.5 Schaden, langsamere Feuerrate.", tag: "damage", rarity: "common", pools: ["treasure", "shop"], glyph: "S", modifyStats: (s) => { s.damage += 3.5; s.fireRate = Math.max(1, s.fireRate - 0.6) } },
  { id: "sacrificial-edge", name: "Opferklinge", description: "+5 Schaden, −1 Max-Herz.", tag: "damage", rarity: "rare", pools: ["treasure", "shop"], glyph: "X", modifyStats: (s) => { s.damage += 5; s.maxHearts = Math.max(1, s.maxHearts - 1) } },
  { id: "bulwark-heart", name: "Bollwerkherz", description: "+2 Max-Herzen, voll geheilt, etwas langsamer.", tag: "defense", rarity: "rare", pools: ["treasure", "shop"], glyph: "A", modifyStats: (s) => { s.maxHearts += 2; s.moveSpeed = Math.max(120, s.moveSpeed - 18) }, onPickup: ({ run }) => run.heal(2) },
  { id: "featherscale", name: "Federschuppe", description: "+viel Tempo, −1 Max-Herz.", tag: "utility", rarity: "rare", pools: ["treasure", "shop"], glyph: "N", modifyStats: (s) => { s.moveSpeed += 70; s.maxHearts = Math.max(1, s.maxHearts - 1) } },
  { id: "glass-lantern", name: "Glaslaterne", description: "Rasende Feuerrate, winziger Schaden pro Schuss.", tag: "tears", rarity: "rare", pools: ["treasure", "shop"], glyph: "J", modifyStats: (s) => { s.fireRate += 4; s.shotSpeed += 80; s.damage = Math.max(1, s.damage * 0.4) } },
  { id: "anchor-stone", name: "Ankerstein", description: "+Schaden & Reichweite, viel langsamer.", tag: "damage", rarity: "rare", pools: ["treasure"], glyph: "Q", modifyStats: (s) => { s.damage += 4; s.range += 150; s.moveSpeed = Math.max(90, s.moveSpeed - 90) } },
  { id: "wax-heart", name: "Wachsherz", description: "+2 Max-Herzen, −1 Schaden.", tag: "defense", rarity: "common", pools: ["treasure", "shop"], glyph: "H", modifyStats: (s) => { s.maxHearts += 2; s.damage = Math.max(1, s.damage - 1) }, onPickup: ({ run }) => run.heal(2) },
  { id: "ash-lung", name: "Aschenlunge", description: "Feuerrate hoch, Reichweite kurz.", tag: "tears", rarity: "rare", pools: ["treasure", "shop"], glyph: "U", modifyStats: (s) => { s.fireRate += 2.5; s.range = Math.max(150, s.range - 160) } },
  { id: "deep-pressure", name: "Tiefendruck", description: "Massiver Schaden, aber sehr langsame Schüsse.", tag: "damage", rarity: "legendary", pools: ["treasure", "boss"], glyph: "D", modifyStats: (s) => { s.damage += 6; s.shotSpeed = Math.max(140, s.shotSpeed - 130) } },

  // ══ Schuss-Modifier (Flags) ══
  { id: "ghost-round", name: "Geisterschuss", description: "Schüsse durchbohren alle Gegner.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "P", onShoot: ({ projectile }) => { projectile.flags.piercing = true; projectile.pierceRemaining = 99 } },
  { id: "lodestone-heart", name: "Magnetherz", description: "Schüsse suchen sich Gegner.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "H", onShoot: ({ projectile }) => { projectile.flags.homing = true } },
  { id: "split-tongue", name: "Spaltzunge", description: "Zwei zusätzliche Schüsse im Fächer.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "Y", onShoot: ({ run, projectile }) => { const { velocityX, velocityY } = projectile.transform; for (const a of [-SPREAD_ANGLE, SPREAD_ANGLE]) { const c = Math.cos(a); const sn = Math.sin(a); run.spawnShot({ faction: "player", x: projectile.transform.x, y: projectile.transform.y, velocityX: velocityX * c - velocityY * sn, velocityY: velocityX * sn + velocityY * c, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } } },
  { id: "rubber-round", name: "Gummigeschoss", description: "Schüsse prallen von Wänden ab.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "O", onShoot: ({ projectile }) => { projectile.flags.bouncing = true; projectile.bounceRemaining = 3 } },
  { id: "powder-tip", name: "Pulverspitze", description: "Schüsse explodieren beim Aufprall.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "E", onShoot: ({ projectile }) => { projectile.flags.explosive = true } },
  { id: "venom-sac", name: "Giftbeutel", description: "Schüsse vergiften Gegner.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "V", onShoot: ({ projectile }) => { projectile.flags.poison = true } },
  { id: "swollen-eye", name: "Geschwollenes Auge", description: "Grössere, härtere Schüsse.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "G", onShoot: ({ projectile }) => { projectile.radius *= 1.7; projectile.damage *= 1.2 } },
  { id: "mirror-twin", name: "Spiegelzwilling", description: "Ein paralleler zweiter Schuss.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "II", onShoot: ({ run, projectile }) => { const px = -projectile.transform.velocityY; const py = projectile.transform.velocityX; const len = Math.hypot(px, py) || 1; run.spawnShot({ faction: "player", x: projectile.transform.x + (px / len) * 14, y: projectile.transform.y + (py / len) * 14, velocityX: projectile.transform.velocityX, velocityY: projectile.transform.velocityY, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } },
  { id: "rearguard", name: "Rückendeckung", description: "Feuert zusätzlich nach hinten.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "R", onShoot: ({ run, projectile }) => { run.spawnShot({ faction: "player", x: projectile.transform.x, y: projectile.transform.y, velocityX: -projectile.transform.velocityX, velocityY: -projectile.transform.velocityY, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } },
  { id: "chain-spark", name: "Kettenfunke", description: "Treffer springen auf nahe Gegner über.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "K", onShoot: ({ projectile }) => { projectile.flags.chain = true; projectile.chainRemaining = 2 } },
  { id: "boomerang-fin", name: "Bumerangflosse", description: "Schüsse kehren zurück (treffen 2×).", tag: "shot", rarity: "rare", pools: ["treasure"], glyph: "Z", onShoot: ({ projectile }) => { projectile.flags.boomerang = true; projectile.flags.piercing = true; projectile.pierceRemaining = 99 } },
  { id: "spore-burst", name: "Sporenbruch", description: "Tötende Schüsse zerplatzen in Splitter.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "*", onShoot: ({ projectile }) => { projectile.flags.fork = true } },
  { id: "scatter-maw", name: "Schrotmaul", description: "Schrotladung, kurze Reichweite.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "5", onShoot: ({ run, projectile }) => { projectile.lifeTicks = Math.round(projectile.lifeTicks * 0.45); const { velocityX, velocityY } = projectile.transform; for (const a of [-0.3, -0.15, 0.15, 0.3]) { const c = Math.cos(a); const sn = Math.sin(a); run.spawnShot({ faction: "player", x: projectile.transform.x, y: projectile.transform.y, velocityX: velocityX * c - velocityY * sn, velocityY: velocityX * sn + velocityY * c, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } } },
  { id: "frost-bead", name: "Frostperle", description: "Treffer verlangsamen Gegner.", tag: "shot", rarity: "rare", pools: ["treasure", "shop"], glyph: "*", onShoot: ({ projectile }) => { projectile.flags.chill = true } },
  { id: "waver-shot", name: "Irrschuss", description: "Schüsse schlängeln seitwärts.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "~", onShoot: ({ projectile }) => { projectile.flags.wave = true } },
  { id: "forked-tooth", name: "Gabelzahn", description: "Schuss gabelt in zwei.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "Y", onShoot: ({ run, projectile }) => { const { velocityX, velocityY } = projectile.transform; for (const a of [-0.12, 0.12]) { const c = Math.cos(a); const sn = Math.sin(a); run.spawnShot({ faction: "player", x: projectile.transform.x, y: projectile.transform.y, velocityX: velocityX * c - velocityY * sn, velocityY: velocityX * sn + velocityY * c, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } } },
  { id: "heavy-moon", name: "Schwermond", description: "Riesige langsame Schüsse, durchschlagend.", tag: "shot", rarity: "rare", pools: ["treasure"], glyph: "O", onShoot: ({ projectile }) => { projectile.radius *= 1.9; projectile.damage *= 1.4; projectile.flags.piercing = true; projectile.pierceRemaining = 99; projectile.transform.velocityX *= 0.6; projectile.transform.velocityY *= 0.6 } },

  // ══ Getriggerte Effekte ══
  { id: "ember-brand", name: "Glutmal", description: "Treffer entzünden Gift.", tag: "shot", rarity: "common", pools: ["treasure", "shop"], glyph: "K", onHit: ({ enemy }) => applyPoison(enemy, 70) },
  { id: "leech-charm", name: "Egel-Amulett", description: "Kills heilen manchmal.", tag: "defense", rarity: "rare", pools: ["treasure", "boss"], glyph: "D", onKill: ({ run }) => { if (Math.random() < 0.12) run.heal(1) } },
  { id: "coin-vein", name: "Münzader", description: "Kills lassen manchmal Münzen fallen.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "$", onKill: ({ run, x, y }) => { if (Math.random() < 0.2) run.spawnPickupDrop(x, y) } },
  { id: "tribute-bowl", name: "Opferschale", description: "Geräumte Räume bringen Münzen.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "U", onRoomClear: ({ run }) => run.addCoins(2) },
  { id: "flood-call", name: "Flutruf", description: "Raum-Clear: Münzen, manchmal Heilung.", tag: "utility", rarity: "common", pools: ["treasure", "shop"], glyph: "u", onRoomClear: ({ run }) => { run.addCoins(1); if (Math.random() < 0.2) run.heal(1) } },
  { id: "tide-blessing", name: "Tidensegen", description: "Jeder geräumte Raum gibt einen Schild.", tag: "defense", rarity: "rare", pools: ["treasure", "boss"], glyph: "O", onRoomClear: ({ run }) => run.grantShield() },
  { id: "thorn-mantle", name: "Dornenmantel", description: "Schaden zu nehmen verletzt alle Gegner.", tag: "defense", rarity: "rare", pools: ["treasure", "boss"], glyph: "Z", onDamageTaken: ({ run }) => { run.damageAllEnemies(4); run.shake(0.3) } },
  { id: "static-veil", name: "Statik-Schleier", description: "Treffer stösst nahe Gegner weg.", tag: "defense", rarity: "rare", pools: ["treasure", "shop"], glyph: "S", onDamageTaken: ({ run }) => { run.pullEnemies(-320); run.shake(0.25) } },

  // ══ Aktive Items (Leertaste) ══
  { id: "undertow", name: "Sog", description: "AKTIV: zieht Gegner zusammen.", tag: "active", rarity: "rare", pools: ["treasure", "shop"], glyph: "@", active: { chargeRooms: 2 }, onActivate: ({ run }) => { run.pullEnemies(520); run.damageAllEnemies(3); run.shake(0.3) } },
  { id: "lumen-flare", name: "Lumenfackel", description: "AKTIV: radiale Nova, löscht Kugeln.", tag: "active", rarity: "rare", pools: ["treasure", "boss"], glyph: "*", active: { chargeRooms: 2 }, onActivate: ({ run }) => run.nova(14) },
  { id: "slip-current", name: "Gleitströmung", description: "AKTIV: Blink in Blickrichtung.", tag: "active", rarity: "rare", pools: ["treasure", "shop"], glyph: ">", active: { chargeSeconds: 5 }, onActivate: ({ run }) => run.blink(150) },
  { id: "deep-ward", name: "Tiefenschild", description: "AKTIV: Schild gegen den nächsten Treffer.", tag: "active", rarity: "rare", pools: ["treasure", "shop"], glyph: "O", active: { chargeRooms: 3 }, onActivate: ({ run }) => run.grantShield() },
  { id: "vital-bloom", name: "Lebensblüte", description: "AKTIV: heilt 1 Herz.", tag: "active", rarity: "common", pools: ["treasure", "shop"], glyph: "+", active: { chargeRooms: 3 }, onActivate: ({ run }) => run.heal(1) },
  { id: "chrono-silt", name: "Zeitschlick", description: "AKTIV: verlangsamt alles kurz.", tag: "active", rarity: "legendary", pools: ["treasure", "boss"], glyph: "T", active: { chargeRooms: 3 }, onActivate: ({ run }) => run.slowTime(180) },

  // ══ Build-Definer (legendär) ══
  { id: "drowned-star", name: "Der ertrunkene Stern", description: "Ein riesiger, langsamer, brutaler Durchschuss statt vieler Schüsse.", tag: "damage", rarity: "legendary", pools: ["treasure", "boss"], glyph: "*", modifyStats: (s) => { s.fireRate = Math.max(0.7, s.fireRate * 0.35); s.damage *= 3.4; s.shotSpeed = Math.max(150, s.shotSpeed * 0.6) }, onShoot: ({ projectile }) => { projectile.radius *= 2.3; projectile.flags.piercing = true; projectile.pierceRemaining = 99 } },
  { id: "hollow-chorus", name: "Hohler Chor", description: "Schüsse lösen manchmal eine Echo-Salve aus.", tag: "shot", rarity: "legendary", pools: ["treasure", "boss"], glyph: "C", onShoot: ({ run, projectile }) => { if (Math.random() < 0.34) run.spawnShot({ faction: "player", x: projectile.transform.x, y: projectile.transform.y, velocityX: projectile.transform.velocityX, velocityY: projectile.transform.velocityY, radius: projectile.radius, damage: projectile.damage, lifeTicks: projectile.lifeTicks }) } },
  { id: "abyssal-pact", name: "Abgrund-Pakt", description: "Max-Herz → 1, dafür brutaler Schaden & Feuerrate + Schild pro Raum.", tag: "damage", rarity: "legendary", pools: ["treasure", "boss"], glyph: "X", modifyStats: (s) => { s.maxHearts = 1; s.damage += 6; s.fireRate += 2 }, onRoomClear: ({ run }) => run.grantShield() },
  { id: "prism-core", name: "Prismenkern", description: "Schüsse gabeln UND vergiften — jeder Build wird Fläche.", tag: "shot", rarity: "legendary", pools: ["treasure", "boss"], glyph: "P", onShoot: ({ projectile }) => { projectile.flags.fork = true; projectile.flags.poison = true } },
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export const itemById = (id: string): Item | undefined => ITEM_BY_ID.get(id)

const rarityWeight = (rarity: Rarity, luck: number): number => {
  if (rarity === "common") return 3
  if (rarity === "rare") return 1.1
  return 0.35 + luck * 0.02
}

// Draws a weighted-random item id from a room pool, skipping held items and
// favouring commons; luck nudges legendaries up.
export const randomItemId = (pool: ItemPool, excludeIds: readonly string[] = [], luck = 0): string => {
  const candidates = ITEMS.filter((item) => item.pools.includes(pool) && !excludeIds.includes(item.id))
  const list = candidates.length > 0 ? candidates : ITEMS.filter((item) => item.pools.includes(pool))
  const total = list.reduce((sum, item) => sum + rarityWeight(item.rarity, luck), 0)
  let roll = Math.random() * total
  for (const item of list) {
    roll -= rarityWeight(item.rarity, luck)
    if (roll <= 0) return item.id
  }
  return list[list.length - 1].id
}
