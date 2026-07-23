import type { Renderer } from "../core/Renderer"
import type { Player } from "./Player"
import { approach, clamp, lerp, normalize } from "../core/math"
import { COLOR, shade, rgba } from "../theme"
import { ROOM_LEFT, ROOM_TOP, ROOM_RIGHT, ROOM_BOTTOM } from "../constants"
import {
  createTransform,
  rememberPreviousPosition,
  type Body,
  type Transform,
} from "./components"
import type { Obstacle } from "./Obstacle"

// ─── ENEMY ───
// One composition-based object for every type; behaviour is dispatched by
// `type` in updateEnemy — no subclasses. Enemies that need to shoot or read the
// room reach the world through an EnemyContext rather than importing Run.

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
  // Behaviour scratch: meaning depends on the type.
  timerTicks: number
  mode: number // hopper: 0 rest / 1 leap
  moveDirX: number
  moveDirY: number
  generation: number // splitter: 0 big, 1 medium, 2 small (no more splitting)
  poisonTicks: number // remaining poison duration
  poisonTimer: number // ticks until the next poison tick of damage
}

export interface EnemyContext {
  obstacles: readonly Obstacle[]
  spawnEnemyProjectile: (
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    damage: number,
  ) => void
}

// ─── FACTORIES ───

const baseEnemy = (type: EnemyType, x: number, y: number, radius: number, health: number): Enemy => ({
  active: true,
  type,
  transform: createTransform(x, y),
  body: { radius },
  health,
  maxHealth: health,
  contactDamage: 1,
  hitFlashTicks: 0,
  timerTicks: 0,
  mode: 0,
  moveDirX: 0,
  moveDirY: 0,
  generation: 0,
  poisonTicks: 0,
  poisonTimer: 0,
})

const POISON_INTERVAL = 14
const POISON_DAMAGE = 1

// Refreshes an enemy's poison duration (used by poison shots / on-hit items).
export const applyPoison = (enemy: Enemy, ticks: number): void => {
  enemy.poisonTicks = Math.max(enemy.poisonTicks, ticks)
}

// Advances poison one tick. Returns true (and flashes) when a tick of poison
// damage lands, so the caller can apply it and check for death.
export const tickPoison = (enemy: Enemy): boolean => {
  if (enemy.poisonTicks <= 0) return false
  enemy.poisonTicks -= 1
  enemy.poisonTimer -= 1
  if (enemy.poisonTimer > 0) return false
  enemy.poisonTimer = POISON_INTERVAL
  enemy.health -= POISON_DAMAGE
  enemy.hitFlashTicks = Math.max(enemy.hitFlashTicks, 3)
  return enemy.health <= 0
}

export const createChaser = (x: number, y: number): Enemy => baseEnemy("chaser", x, y, 16, 6)

export const createHopper = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("hopper", x, y, 15, 7)
  enemy.timerTicks = 20 + Math.floor(Math.random() * 30) // desync the first leap
  return enemy
}

export const createShooter = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("shooter", x, y, 15, 5)
  enemy.timerTicks = 40 + Math.floor(Math.random() * 40)
  return enemy
}

export const createBouncer = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("bouncer", x, y, 14, 8)
  const cardinals = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  const [dirX, dirY] = cardinals[Math.floor(Math.random() * cardinals.length)]
  enemy.moveDirX = dirX
  enemy.moveDirY = dirY
  enemy.transform.velocityX = dirX * BOUNCER_SPEED
  enemy.transform.velocityY = dirY * BOUNCER_SPEED
  return enemy
}

const SPLITTER_SIZES = [19, 14, 10]
const SPLITTER_HEALTH = [9, 5, 2]

export const createSplitter = (x: number, y: number, generation = 0): Enemy => {
  const enemy = baseEnemy("splitter", x, y, SPLITTER_SIZES[generation], SPLITTER_HEALTH[generation])
  enemy.generation = generation
  return enemy
}

export const createEnemy = (type: EnemyType, x: number, y: number): Enemy => {
  switch (type) {
    case "hopper":
      return createHopper(x, y)
    case "shooter":
      return createShooter(x, y)
    case "bouncer":
      return createBouncer(x, y)
    case "splitter":
      return createSplitter(x, y, 0)
    case "chaser":
    default:
      return createChaser(x, y)
  }
}

// ─── TUNING ───

const CHASER_SPEED = 82
const CHASER_TURN = 0.06
const SPLITTER_SPEED = 58
const SPLITTER_TURN = 0.05
const HOP_SPEED = 215
const HOP_LEAP_TICKS = 20
const HOP_REST_TICKS = 40
const SHOOTER_SPEED = 74
const SHOOTER_DESIRED = 210
const SHOOTER_SHOT_INTERVAL = 82
const SHOOTER_SHOT_SPEED = 178
const BOUNCER_SPEED = 132

// ─── UPDATE ───

export const updateEnemy = (
  enemy: Enemy,
  player: Player,
  context: EnemyContext,
  deltaSeconds: number,
): void => {
  rememberPreviousPosition(enemy.transform)
  if (enemy.hitFlashTicks > 0) enemy.hitFlashTicks -= 1

  // The bouncer owns its whole movement (reflection, not clamping).
  if (enemy.type === "bouncer") {
    updateBouncer(enemy, context, deltaSeconds)
    return
  }

  switch (enemy.type) {
    case "chaser":
      steerToward(enemy, player, CHASER_SPEED, CHASER_TURN)
      break
    case "splitter":
      steerToward(enemy, player, SPLITTER_SPEED, SPLITTER_TURN)
      break
    case "hopper":
      updateHopper(enemy, player)
      break
    case "shooter":
      updateShooter(enemy, player, context)
      break
  }

  const { transform, body } = enemy
  transform.x += transform.velocityX * deltaSeconds
  transform.y += transform.velocityY * deltaSeconds
  transform.x = clamp(transform.x, ROOM_LEFT + body.radius, ROOM_RIGHT - body.radius)
  transform.y = clamp(transform.y, ROOM_TOP + body.radius, ROOM_BOTTOM - body.radius)
}

const steerToward = (enemy: Enemy, player: Player, speed: number, response: number): void => {
  const direction = normalize(
    player.transform.x - enemy.transform.x,
    player.transform.y - enemy.transform.y,
  )
  enemy.transform.velocityX = approach(enemy.transform.velocityX, direction.x * speed, response)
  enemy.transform.velocityY = approach(enemy.transform.velocityY, direction.y * speed, response)
}

const updateHopper = (enemy: Enemy, player: Player): void => {
  if (enemy.mode === 0) {
    // Resting: bleed off any residual velocity, then commit to a leap.
    enemy.transform.velocityX = approach(enemy.transform.velocityX, 0, 0.2)
    enemy.transform.velocityY = approach(enemy.transform.velocityY, 0, 0.2)
    enemy.timerTicks -= 1
    if (enemy.timerTicks <= 0) {
      const direction = normalize(
        player.transform.x - enemy.transform.x,
        player.transform.y - enemy.transform.y,
      )
      enemy.transform.velocityX = direction.x * HOP_SPEED
      enemy.transform.velocityY = direction.y * HOP_SPEED
      enemy.mode = 1
      enemy.timerTicks = HOP_LEAP_TICKS
    }
    return
  }

  // Leaping: hold the committed velocity until the leap runs out.
  enemy.timerTicks -= 1
  if (enemy.timerTicks <= 0) {
    enemy.mode = 0
    enemy.timerTicks = HOP_REST_TICKS
  }
}

const updateShooter = (enemy: Enemy, player: Player, context: EnemyContext): void => {
  const toPlayerX = player.transform.x - enemy.transform.x
  const toPlayerY = player.transform.y - enemy.transform.y
  const distance = Math.hypot(toPlayerX, toPlayerY) || 1
  const dirX = toPlayerX / distance
  const dirY = toPlayerY / distance

  let targetVX: number
  let targetVY: number
  if (distance < SHOOTER_DESIRED * 0.8) {
    targetVX = -dirX * SHOOTER_SPEED
    targetVY = -dirY * SHOOTER_SPEED
  } else if (distance > SHOOTER_DESIRED * 1.25) {
    targetVX = dirX * SHOOTER_SPEED
    targetVY = dirY * SHOOTER_SPEED
  } else {
    // Circle-strafe at the preferred range.
    targetVX = -dirY * SHOOTER_SPEED * 0.6
    targetVY = dirX * SHOOTER_SPEED * 0.6
  }
  enemy.transform.velocityX = approach(enemy.transform.velocityX, targetVX, 0.08)
  enemy.transform.velocityY = approach(enemy.transform.velocityY, targetVY, 0.08)

  enemy.timerTicks -= 1
  if (enemy.timerTicks <= 0) {
    context.spawnEnemyProjectile(
      enemy.transform.x,
      enemy.transform.y,
      dirX * SHOOTER_SHOT_SPEED,
      dirY * SHOOTER_SHOT_SPEED,
      enemy.contactDamage,
    )
    enemy.timerTicks = SHOOTER_SHOT_INTERVAL
  }
}

const updateBouncer = (enemy: Enemy, context: EnemyContext, deltaSeconds: number): void => {
  const { transform, body } = enemy
  if (transform.velocityX === 0 && transform.velocityY === 0) {
    transform.velocityX = enemy.moveDirX * BOUNCER_SPEED
    transform.velocityY = enemy.moveDirY * BOUNCER_SPEED
  }

  transform.x += transform.velocityX * deltaSeconds
  transform.y += transform.velocityY * deltaSeconds

  const left = ROOM_LEFT + body.radius
  const right = ROOM_RIGHT - body.radius
  const top = ROOM_TOP + body.radius
  const bottom = ROOM_BOTTOM - body.radius
  if (transform.x < left) {
    transform.x = left
    transform.velocityX = Math.abs(transform.velocityX)
  } else if (transform.x > right) {
    transform.x = right
    transform.velocityX = -Math.abs(transform.velocityX)
  }
  if (transform.y < top) {
    transform.y = top
    transform.velocityY = Math.abs(transform.velocityY)
  } else if (transform.y > bottom) {
    transform.y = bottom
    transform.velocityY = -Math.abs(transform.velocityY)
  }

  reflectBouncerOffObstacles(enemy, context.obstacles)
}

const reflectBouncerOffObstacles = (enemy: Enemy, obstacles: readonly Obstacle[]): void => {
  const { transform, body } = enemy
  for (const obstacle of obstacles) {
    if (obstacle.destroyed) continue
    const nearestX = clamp(transform.x, obstacle.left, obstacle.right)
    const nearestY = clamp(transform.y, obstacle.top, obstacle.bottom)
    const deltaX = transform.x - nearestX
    const deltaY = transform.y - nearestY
    const distanceSquared = deltaX * deltaX + deltaY * deltaY
    if (distanceSquared >= body.radius * body.radius || distanceSquared === 0) continue

    const distance = Math.sqrt(distanceSquared)
    const normalX = deltaX / distance
    const normalY = deltaY / distance
    // Push out, then reflect velocity about the contact normal.
    transform.x += normalX * (body.radius - distance)
    transform.y += normalY * (body.radius - distance)
    const dot = transform.velocityX * normalX + transform.velocityY * normalY
    transform.velocityX -= 2 * dot * normalX
    transform.velocityY -= 2 * dot * normalY
  }
}

// Applies damage and returns true if this hit was fatal.
export const damageEnemy = (enemy: Enemy, amount: number): boolean => {
  enemy.health -= amount
  enemy.hitFlashTicks = 5
  return enemy.health <= 0
}

export const canSplit = (enemy: Enemy): boolean =>
  enemy.type === "splitter" && enemy.generation < SPLITTER_SIZES.length - 1

// ─── RENDER ───
// Cold, glowing creatures — never as bright as the player, never the danger
// hue (only their shots are). Each silhouette carries the type; colour carries
// the family. Colours come from theme tokens only.

const ENEMY_TOKEN: Record<EnemyType, string> = {
  chaser: COLOR.hunter,
  hopper: COLOR.leaper,
  shooter: COLOR.caster,
  bouncer: COLOR.shard,
  splitter: COLOR.brood,
}

export const enemyColor = (enemy: Enemy): string => ENEMY_TOKEN[enemy.type]

const EYE = COLOR.ink

export const renderEnemy = (renderer: Renderer, enemy: Enemy, interpolation: number): void => {
  const { transform, body } = enemy
  const x = lerp(transform.previousX, transform.x, interpolation)
  const y = lerp(transform.previousY, transform.y, interpolation)
  const context = renderer.context
  const flashing = enemy.hitFlashTicks > 0
  const base = ENEMY_TOKEN[enemy.type]
  const fill = flashing ? COLOR.flash : base
  const edge = flashing ? COLOR.flash : shade(base, -0.45)

  // Cold self-glow — subtle so it never competes with the player.
  renderer.additive(() => renderer.glowCircle(x, y, body.radius + 1, base, 10))
  // A poisoned creature seeps green.
  if (enemy.poisonTicks > 0) {
    renderer.additive(() => renderer.glowCircle(x, y, body.radius + 2, COLOR.leaper, 12))
  }

  if (enemy.type === "bouncer") {
    // A slowly-spinning crystal shard: a built guardian, not a creature.
    const radius = body.radius
    const spin = enemy.timerTicks * 0.05 + Math.atan2(transform.velocityY, transform.velocityX) * 0.2
    context.save()
    context.translate(x, y)
    context.rotate(Math.PI / 4 + spin)
    renderer.fillRect(-radius, -radius, radius * 2, radius * 2, fill)
    context.strokeStyle = edge
    context.lineWidth = 2
    context.strokeRect(-radius, -radius, radius * 2, radius * 2)
    if (!flashing) {
      renderer.fillRect(-radius * 0.45, -radius * 0.45, radius * 0.9, radius * 0.9, shade(base, 0.35))
    }
    context.restore()
    return
  }

  // Hoppers squash while resting and stretch along their leap (the attack tell).
  let radiusX = body.radius
  let radiusY = body.radius
  if (enemy.type === "hopper") {
    radiusX = enemy.mode === 1 ? body.radius * 0.82 : body.radius * 1.12
    radiusY = enemy.mode === 1 ? body.radius * 1.2 : body.radius * 0.86
  }

  context.fillStyle = fill
  context.beginPath()
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = edge
  context.lineWidth = 2
  context.stroke()

  if (flashing) return

  // Shooter tell: a focus ring that tightens as it winds up to fire.
  if (enemy.type === "shooter") {
    const windup = Math.max(0, Math.min(1, enemy.timerTicks / 82))
    renderer.strokeCircle(x, y, body.radius + 3 + windup * 8, rgba(base, 0.6), 2)
  }

  // Splitter seam.
  if (enemy.type === "splitter" && enemy.generation < SPLITTER_SIZES.length - 1) {
    context.strokeStyle = shade(base, -0.4)
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(x, y - radiusY)
    context.lineTo(x, y + radiusY)
    context.stroke()
  }

  // Eyes — one big for the chaser (a single stare), two otherwise.
  if (enemy.type === "chaser") {
    renderer.fillCircle(x, y - body.radius * 0.1, 4, EYE)
    renderer.fillCircle(x + 1.5, y - body.radius * 0.1 - 1, 1.6, COLOR.flash)
  } else {
    const eyeOffsetX = body.radius * 0.4
    const eyeOffsetY = body.radius * 0.12
    renderer.fillCircle(x - eyeOffsetX, y - eyeOffsetY, 2.6, EYE)
    renderer.fillCircle(x + eyeOffsetX, y - eyeOffsetY, 2.6, EYE)
  }
}
