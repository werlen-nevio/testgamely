import type { Renderer } from "../core/Renderer"
import type { Input } from "../core/Input"
import { approach, clamp, lerp } from "../core/math"
import { COLOR, shade, rgba } from "../theme"
import {
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_RIGHT,
  ROOM_BOTTOM,
} from "../constants"
import {
  createTransform,
  rememberPreviousPosition,
  type Body,
  type Transform,
} from "./components"
import type { Item } from "../items/Item"

// ─── PLAYER STATS ───
// The stats object is intentionally standalone: items mutate it, the HUD reads
// it, and combat derives from it. Keeping it separate from the transform means
// stat recalculation never disturbs physics.

export interface PlayerStats {
  damage: number
  fireRate: number // shots per second
  shotSpeed: number // projectile speed, px/s
  range: number // projectile travel distance, px
  moveSpeed: number // maximum movement speed, px/s
  luck: number
  maxHearts: number
  hearts: number
}

export interface Player {
  transform: Transform
  body: Body
  // `baseStats` are the untouched starting values; `stats` is what gameplay
  // reads, recomputed from base by running every item's modifyStats hook. The
  // split means picking up (or losing) an item never accumulates rounding drift.
  baseStats: PlayerStats
  stats: PlayerStats
  items: Item[]
  // Unit vector describing where the player last aimed or moved — used for the
  // facing indicator now, and shot direction fallback later.
  facingX: number
  facingY: number
  invulnerableTicks: number
  // Ticks until the weapon may fire again; derived from the fireRate stat.
  shootCooldownTicks: number
  // Free-running clock for idle breathing / glow pulse.
  animTicks: number
}

// ─── MOVEMENT FEEL ───
// Velocity chases the desired velocity a fixed fraction each tick. A higher
// response while a direction is held makes starts feel crisp; a gentler
// response while idle gives a short, readable glide instead of an abrupt stop.
const ACCELERATION_RESPONSE = 0.24
const STOP_RESPONSE = 0.16

const createBaseStats = (): PlayerStats => ({
  damage: 3.5,
  fireRate: 2.5,
  shotSpeed: 340,
  range: 430,
  moveSpeed: 205,
  luck: 0,
  maxHearts: 3,
  hearts: 3,
})

export const createPlayer = (x: number, y: number): Player => {
  const baseStats = createBaseStats()
  return {
    transform: createTransform(x, y),
    body: { radius: 15 },
    baseStats,
    stats: { ...baseStats },
    items: [],
    facingX: 0,
    facingY: 1,
    invulnerableTicks: 0,
    shootCooldownTicks: 0,
    animTicks: 0,
  }
}

// Rebuilds derived stats from the base values plus every item's modifyStats
// hook. Current hearts carry over (clamped to the possibly-changed maximum);
// everything else is recomputed from scratch so item order never matters.
export const recomputePlayerStats = (player: Player): void => {
  const derived: PlayerStats = { ...player.baseStats }
  for (const item of player.items) item.modifyStats?.(derived)
  derived.hearts = Math.max(0, Math.min(player.stats.hearts, derived.maxHearts))
  player.stats = derived
}

// ─── INVULNERABILITY ───
export const PLAYER_INVULNERABLE_TICKS = 60 // ~1 second of i-frames after a hit

// Applies damage unless the player is already flashing. Returns true if this
// hit brought the player to zero hearts.
export const damagePlayer = (player: Player, amount: number): boolean => {
  if (player.invulnerableTicks > 0) return false
  player.stats.hearts -= amount
  player.invulnerableTicks = PLAYER_INVULNERABLE_TICKS
  return player.stats.hearts <= 0
}

export const updatePlayer = (
  player: Player,
  input: Input,
  deltaSeconds: number,
  speedScale = 1,
): void => {
  const { transform, body, stats } = player
  rememberPreviousPosition(transform)

  // ─── MOVE ───
  const move = input.moveVector()
  const isMoving = move.x !== 0 || move.y !== 0
  const response = isMoving ? ACCELERATION_RESPONSE : STOP_RESPONSE
  const maxSpeed = stats.moveSpeed * speedScale
  transform.velocityX = approach(transform.velocityX, move.x * maxSpeed, response)
  transform.velocityY = approach(transform.velocityY, move.y * maxSpeed, response)

  transform.x += transform.velocityX * deltaSeconds
  transform.y += transform.velocityY * deltaSeconds

  // Keep the whole body inside the walls.
  transform.x = clamp(transform.x, ROOM_LEFT + body.radius, ROOM_RIGHT - body.radius)
  transform.y = clamp(transform.y, ROOM_TOP + body.radius, ROOM_BOTTOM - body.radius)

  // ─── FACING ───
  const aim = input.aimVector()
  if (aim.x !== 0 || aim.y !== 0) {
    player.facingX = aim.x
    player.facingY = aim.y
  } else if (isMoving) {
    player.facingX = move.x
    player.facingY = move.y
  }

  // ─── TIMERS ───
  player.animTicks += 1
  if (player.invulnerableTicks > 0) player.invulnerableTicks -= 1
  if (player.shootCooldownTicks > 0) player.shootCooldownTicks -= 1
}

// The player is a lantern-bearer: the single warm, brightest silhouette, its
// own light source. A soft breathing pulse, a directional lantern cone, and a
// warm bloom set it apart from everything cold in the world.
export const renderPlayer = (
  renderer: Renderer,
  player: Player,
  interpolation: number,
): void => {
  const { transform, body } = player

  // Blink on and off while invulnerable so the hit is legible.
  const blinkHidden = player.invulnerableTicks > 0 && player.invulnerableTicks % 8 < 4
  if (blinkHidden) return

  const x = lerp(transform.previousX, transform.x, interpolation)
  const y = lerp(transform.previousY, transform.y, interpolation)
  const context = renderer.context

  const breathe = Math.sin(player.animTicks * 0.09)
  const radius = body.radius + breathe * 0.8
  const facingX = player.facingX
  const facingY = player.facingY

  // Lantern cone — a soft warm wedge pointing where the player aims.
  const facingAngle = Math.atan2(facingY, facingX)
  renderer.additive(() => {
    const gradient = context.createRadialGradient(x, y, radius, x, y, 92)
    gradient.addColorStop(0, rgba(COLOR.playerGlow, 0.32))
    gradient.addColorStop(1, rgba(COLOR.playerGlow, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.moveTo(x, y)
    context.arc(x, y, 92, facingAngle - 0.5, facingAngle + 0.5)
    context.closePath()
    context.fill()
  })

  // Warm bloom + core.
  renderer.additive(() => renderer.glowCircle(x, y, radius + 3, COLOR.playerGlow, 18 + breathe * 4))
  renderer.fillCircle(x, y, radius, COLOR.playerCore)
  renderer.strokeCircle(x, y, radius, shade(COLOR.playerGlow, -0.35), 2)

  // Inner eye toward the aim — a tiny warm-dark pupil for a clear front.
  const nubDistance = radius - 5
  renderer.fillCircle(x + facingX * nubDistance, y + facingY * nubDistance, 4, shade(COLOR.playerGlow, -0.2))
}
