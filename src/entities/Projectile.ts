import type { Renderer } from "../core/Renderer"
import { lerp } from "../core/math"
import { ROOM_LEFT, ROOM_TOP, ROOM_RIGHT, ROOM_BOTTOM } from "../constants"
import { createTransform, rememberPreviousPosition, type Transform } from "./components"

// ─── PROJECTILE ───
// Every projectile carries a set of behaviour flags. The base weapon sets none;
// items flip them on in the onShoot hook, which is how synergies emerge without
// special-casing. Projectiles live in a fixed pool — no allocation while firing.

export type Faction = "player" | "enemy"

export interface ProjectileFlags {
  homing: boolean
  piercing: boolean
  explosive: boolean
  bouncing: boolean
  poison: boolean
}

export interface Projectile {
  active: boolean
  faction: Faction
  transform: Transform
  radius: number
  damage: number
  lifeTicks: number
  flags: ProjectileFlags
  // Remaining pass-throughs / wall reflections; seeded from the flags on spawn.
  pierceRemaining: number
  bounceRemaining: number
  // Marks enemies already hit so a piercing shot never double-hits one enemy.
  hitEpoch: number
}

export interface ProjectileSpawn {
  faction: Faction
  x: number
  y: number
  velocityX: number
  velocityY: number
  radius: number
  damage: number
  lifeTicks: number
}

const resetFlags = (flags: ProjectileFlags): void => {
  flags.homing = false
  flags.piercing = false
  flags.explosive = false
  flags.bouncing = false
  flags.poison = false
}

// Copies one projectile's shot modifiers onto another. Used so extra shots
// spawned mid-onShoot (spread, etc.) end up with the same final flags as the
// primary, regardless of the order items ran in.
export const copyShotModifiers = (source: Projectile, target: Projectile): void => {
  target.flags.homing = source.flags.homing
  target.flags.piercing = source.flags.piercing
  target.flags.explosive = source.flags.explosive
  target.flags.bouncing = source.flags.bouncing
  target.flags.poison = source.flags.poison
  target.pierceRemaining = source.pierceRemaining
  target.bounceRemaining = source.bounceRemaining
}

const createInactiveProjectile = (): Projectile => ({
  active: false,
  faction: "player",
  transform: createTransform(0, 0),
  radius: 6,
  damage: 0,
  lifeTicks: 0,
  flags: { homing: false, piercing: false, explosive: false, bouncing: false, poison: false },
  pierceRemaining: 0,
  bounceRemaining: 0,
  hitEpoch: 0,
})

const PLAYER_CORE_COLOR = "#ffe6a3"
const PLAYER_EDGE_COLOR = "#e79a3c"
const ENEMY_CORE_COLOR = "#c9d4ff"
const ENEMY_EDGE_COLOR = "#6f7ad6"

export class ProjectilePool {
  readonly items: Projectile[]
  private epoch = 0

  constructor(capacity: number) {
    this.items = Array.from({ length: capacity }, createInactiveProjectile)
  }

  // Returns the newly spawned projectile so callers (and item hooks) can tweak
  // its flags, or null if the pool is momentarily exhausted.
  spawn(spawn: ProjectileSpawn): Projectile | null {
    const projectile = this.items.find((candidate) => !candidate.active)
    if (!projectile) return null

    projectile.active = true
    projectile.faction = spawn.faction
    projectile.transform.x = spawn.x
    projectile.transform.y = spawn.y
    projectile.transform.previousX = spawn.x
    projectile.transform.previousY = spawn.y
    projectile.transform.velocityX = spawn.velocityX
    projectile.transform.velocityY = spawn.velocityY
    projectile.radius = spawn.radius
    projectile.damage = spawn.damage
    projectile.lifeTicks = spawn.lifeTicks
    resetFlags(projectile.flags)
    projectile.pierceRemaining = 0
    projectile.bounceRemaining = 0
    projectile.hitEpoch = this.epoch
    return projectile
  }

  // Hands out a fresh epoch id used to tag hits for one shot's lifetime, so a
  // piercing projectile can remember which enemies it already struck.
  nextEpoch(): number {
    this.epoch += 1
    return this.epoch
  }

  deactivateAll(): void {
    for (const projectile of this.items) projectile.active = false
  }

  update(deltaSeconds: number): void {
    for (const projectile of this.items) {
      if (!projectile.active) continue
      const { transform } = projectile
      rememberPreviousPosition(transform)

      transform.x += transform.velocityX * deltaSeconds
      transform.y += transform.velocityY * deltaSeconds

      projectile.lifeTicks -= 1
      if (projectile.lifeTicks <= 0) {
        projectile.active = false
        continue
      }

      this.resolveWalls(projectile)
    }
  }

  private resolveWalls(projectile: Projectile): void {
    const { transform, radius } = projectile
    const left = ROOM_LEFT + radius
    const right = ROOM_RIGHT - radius
    const top = ROOM_TOP + radius
    const bottom = ROOM_BOTTOM - radius

    const hitHorizontal = transform.x < left || transform.x > right
    const hitVertical = transform.y < top || transform.y > bottom
    if (!hitHorizontal && !hitVertical) return

    // Bouncing shots reflect off walls a limited number of times.
    if (projectile.flags.bouncing && projectile.bounceRemaining > 0) {
      if (hitHorizontal) {
        transform.velocityX = -transform.velocityX
        transform.x = transform.x < left ? left : right
      }
      if (hitVertical) {
        transform.velocityY = -transform.velocityY
        transform.y = transform.y < top ? top : bottom
      }
      projectile.bounceRemaining -= 1
      return
    }

    projectile.active = false
  }

  render(renderer: Renderer, interpolation: number): void {
    for (const projectile of this.items) {
      if (!projectile.active) continue
      const { transform, radius } = projectile
      const x = lerp(transform.previousX, transform.x, interpolation)
      const y = lerp(transform.previousY, transform.y, interpolation)
      const isPlayer = projectile.faction === "player"
      renderer.fillCircle(x, y, radius + 1, isPlayer ? PLAYER_EDGE_COLOR : ENEMY_EDGE_COLOR)
      renderer.fillCircle(x, y, radius - 1, isPlayer ? PLAYER_CORE_COLOR : ENEMY_CORE_COLOR)
    }
  }
}
