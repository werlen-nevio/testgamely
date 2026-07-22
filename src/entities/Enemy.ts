import type { Renderer } from "../core/Renderer"
import type { Player } from "./Player"
import { approach, clamp, lerp, normalize } from "../core/math"
import { ROOM_LEFT, ROOM_TOP, ROOM_RIGHT, ROOM_BOTTOM } from "../constants"
import {
  createTransform,
  rememberPreviousPosition,
  type Body,
  type Transform,
} from "./components"

// ─── ENEMY ───
// One composition-based enemy object for every type. Behaviour is dispatched by
// `type` in updateEnemy — no subclasses. Stage 2 implements the chaser; the
// remaining types slot into the same switch in a later stage.

export type EnemyType = "chaser" | "hopper" | "shooter" | "bouncer" | "splitter"

export interface Enemy {
  active: boolean
  type: EnemyType
  transform: Transform
  body: Body
  health: number
  maxHealth: number
  contactDamage: number
  hitFlashTicks: number
  // Behaviour scratch, meaning depends on the type (jump timer, shoot cooldown,
  // travel direction). Kept generic so no type needs its own object shape.
  timerTicks: number
  moveDirX: number
  moveDirY: number
}

// ─── FACTORIES ───

export const createChaser = (x: number, y: number): Enemy => ({
  active: true,
  type: "chaser",
  transform: createTransform(x, y),
  body: { radius: 16 },
  health: 6,
  maxHealth: 6,
  contactDamage: 1,
  hitFlashTicks: 0,
  timerTicks: 0,
  moveDirX: 0,
  moveDirY: 0,
})

// Dispatches to the right factory. Until the remaining behaviours land in a
// later stage, every unimplemented type falls back to a chaser so room
// templates can already reference the full roster.
export const createEnemy = (type: EnemyType, x: number, y: number): Enemy => {
  switch (type) {
    case "chaser":
    default:
      return createChaser(x, y)
  }
}

// ─── UPDATE ───

const CHASER_SPEED = 82
const CHASER_TURN_RESPONSE = 0.06

export const updateEnemy = (enemy: Enemy, player: Player, deltaSeconds: number): void => {
  rememberPreviousPosition(enemy.transform)
  if (enemy.hitFlashTicks > 0) enemy.hitFlashTicks -= 1

  switch (enemy.type) {
    case "chaser":
      steerToward(enemy, player, CHASER_SPEED, CHASER_TURN_RESPONSE)
      break
    default:
      break
  }

  const { transform, body } = enemy
  transform.x += transform.velocityX * deltaSeconds
  transform.y += transform.velocityY * deltaSeconds
  transform.x = clamp(transform.x, ROOM_LEFT + body.radius, ROOM_RIGHT - body.radius)
  transform.y = clamp(transform.y, ROOM_TOP + body.radius, ROOM_BOTTOM - body.radius)
}

const steerToward = (
  enemy: Enemy,
  player: Player,
  speed: number,
  response: number,
): void => {
  const direction = normalize(
    player.transform.x - enemy.transform.x,
    player.transform.y - enemy.transform.y,
  )
  enemy.transform.velocityX = approach(enemy.transform.velocityX, direction.x * speed, response)
  enemy.transform.velocityY = approach(enemy.transform.velocityY, direction.y * speed, response)
}

// Applies damage and returns true if this hit was fatal. The caller owns what
// happens next (deactivation, on-kill effects, splitting).
export const damageEnemy = (enemy: Enemy, amount: number): boolean => {
  enemy.health -= amount
  enemy.hitFlashTicks = 5
  return enemy.health <= 0
}

// ─── RENDER ───

const CHASER_COLOR = "#a8322f"
const CHASER_EDGE_COLOR = "#5c1b19"
const EYE_COLOR = "#f4e2c4"
const FLASH_COLOR = "#ffffff"

export const renderEnemy = (renderer: Renderer, enemy: Enemy, interpolation: number): void => {
  const { transform, body } = enemy
  const x = lerp(transform.previousX, transform.x, interpolation)
  const y = lerp(transform.previousY, transform.y, interpolation)
  const context = renderer.context
  const flashing = enemy.hitFlashTicks > 0

  renderer.fillCircle(x, y, body.radius, flashing ? FLASH_COLOR : CHASER_COLOR)
  context.lineWidth = 2
  context.strokeStyle = flashing ? FLASH_COLOR : CHASER_EDGE_COLOR
  context.stroke()

  if (flashing) return

  // Two eyes for a readable, menacing silhouette.
  const eyeOffsetX = body.radius * 0.4
  const eyeOffsetY = body.radius * 0.15
  renderer.fillCircle(x - eyeOffsetX, y - eyeOffsetY, 3, EYE_COLOR)
  renderer.fillCircle(x + eyeOffsetX, y - eyeOffsetY, 3, EYE_COLOR)
}
