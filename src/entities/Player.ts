import type { Renderer } from "../core/Renderer"
import type { Input } from "../core/Input"
import { approach, clamp, lerp } from "../core/math"
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
  stats: PlayerStats
  // Unit vector describing where the player last aimed or moved — used for the
  // facing indicator now, and shot direction fallback later.
  facingX: number
  facingY: number
  invulnerableTicks: number
}

// ─── MOVEMENT FEEL ───
// Velocity chases the desired velocity a fixed fraction each tick. A higher
// response while a direction is held makes starts feel crisp; a gentler
// response while idle gives a short, readable glide instead of an abrupt stop.
const ACCELERATION_RESPONSE = 0.24
const STOP_RESPONSE = 0.16

export const createPlayer = (x: number, y: number): Player => ({
  transform: createTransform(x, y),
  body: { radius: 15 },
  stats: {
    damage: 3.5,
    fireRate: 2.5,
    shotSpeed: 340,
    range: 430,
    moveSpeed: 205,
    luck: 0,
    maxHearts: 3,
    hearts: 3,
  },
  facingX: 0,
  facingY: 1,
  invulnerableTicks: 0,
})

export const updatePlayer = (
  player: Player,
  input: Input,
  deltaSeconds: number,
): void => {
  const { transform, body, stats } = player
  rememberPreviousPosition(transform)

  // ─── MOVE ───
  const move = input.moveVector()
  const isMoving = move.x !== 0 || move.y !== 0
  const response = isMoving ? ACCELERATION_RESPONSE : STOP_RESPONSE
  transform.velocityX = approach(transform.velocityX, move.x * stats.moveSpeed, response)
  transform.velocityY = approach(transform.velocityY, move.y * stats.moveSpeed, response)

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
  if (player.invulnerableTicks > 0) player.invulnerableTicks -= 1
}

const BODY_COLOR = "#e9ddc0"
const OUTLINE_COLOR = "#241d1a"
const EYE_COLOR = "#7a4a2c"

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

  renderer.fillCircle(x, y, body.radius, BODY_COLOR)
  context.lineWidth = 2
  context.strokeStyle = OUTLINE_COLOR
  context.stroke()

  // A small "eye" nub marks facing, giving the blob a clear silhouette.
  const nubDistance = body.radius - 4
  renderer.fillCircle(x + player.facingX * nubDistance, y + player.facingY * nubDistance, 5, EYE_COLOR)
}
