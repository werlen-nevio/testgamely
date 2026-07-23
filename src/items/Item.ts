import type { Player, PlayerStats } from "../entities/Player"
import type { Projectile, ProjectileSpawn } from "../entities/Projectile"
import type { Enemy } from "../entities/Enemy"
import { COLOR } from "../theme"

// ─── ITEM SYSTEM ───
// An item is data with optional lifecycle hooks — never a special case in the
// engine. Every active item is run, in order, on each hook, so combinations
// stack automatically: a piercing item, a homing item and a spread item held
// together simply all fire their onShoot and the shot ends up piercing, homing
// AND tripled without anyone coding that specific combo.
//
// Projectiles expose a flag set; items flip flags on and the combat code turns
// each flag into behaviour. That is the whole synergy mechanism.

// The slice of the run that hooks are allowed to poke at. Run implements this
// structurally, which keeps items decoupled from the Run class.
export interface RunApi {
  readonly player: Player
  // Spawns an extra projectile belonging to the shot currently being fired, so
  // it inherits the primary shot's final flags.
  spawnShot(spawn: ProjectileSpawn): Projectile | null
  // Spawns a standalone projectile (bursts, enemy-independent effects).
  spawnProjectile(spawn: ProjectileSpawn): Projectile | null
  heal(hearts: number): void
  addCoins(amount: number): void
  nearestEnemyTo(x: number, y: number): Enemy | null
  spawnPickupDrop(x: number, y: number): void
  damageAllEnemies(amount: number): void
  shake(strength: number): void
}

export interface ItemContext {
  run: RunApi
  player: Player
}

export interface ShootContext extends ItemContext {
  // The primary projectile just spawned by the weapon.
  projectile: Projectile
  aimX: number
  aimY: number
}

export interface HitContext extends ItemContext {
  projectile: Projectile
  enemy: Enemy
}

export interface KillContext extends ItemContext {
  enemy: Enemy
  x: number
  y: number
}

export interface DamageContext extends ItemContext {
  amount: number
}

export type ItemTag = "damage" | "tears" | "shot" | "utility" | "defense"

// Item colour is derived from its tag so every icon stays on-palette and the
// hue itself reads as a category (all shot-modifiers share one colour, etc.).
const TAG_COLOR: Record<ItemTag, string> = {
  damage: COLOR.brood,
  tears: COLOR.caster,
  shot: COLOR.bio,
  utility: COLOR.leaper,
  defense: COLOR.hunter,
}

export const itemColor = (item: Item): string => TAG_COLOR[item.tag]

export interface Item {
  id: string
  name: string
  description: string
  tag: ItemTag
  glyph: string // single character shown on the HUD icon
  modifyStats?: (stats: PlayerStats) => void
  onPickup?: (context: ItemContext) => void
  onShoot?: (context: ShootContext) => void
  onHit?: (context: HitContext) => void
  onKill?: (context: KillContext) => void
  onRoomClear?: (context: ItemContext) => void
  onDamageTaken?: (context: DamageContext) => void
}
