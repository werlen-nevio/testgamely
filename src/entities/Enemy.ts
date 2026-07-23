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

export type EnemyType =
  | "chaser"
  | "hopper"
  | "shooter"
  | "bouncer"
  | "splitter"
  | "weaver"
  | "sentinel"
  | "warden"
  | "diver"
  | "charger"
  | "swarm"

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
  mode: number // hopper: 0 rest / 1 leap · charger/diver: attack phase
  moveDirX: number
  moveDirY: number
  generation: number // splitter: 0 big, 1 medium, 2 small (no more splitting)
  poisonTicks: number // remaining poison duration
  poisonTimer: number // ticks until the next poison tick of damage
  // Facing (sentinel front shield, charger dash line).
  facingX: number
  facingY: number
  // Diver/charger dash target.
  targetX: number
  targetY: number
  // Set by a nearby warden each tick — a shielded enemy takes no damage.
  shielded: boolean
  // Diver is intangible (no contact, cannot be hit) during its dive windup.
  intangible: boolean
}

export interface EnemyContext {
  obstacles: readonly Obstacle[]
  enemies: readonly Enemy[]
  spawnEnemyProjectile: (
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    damage: number,
  ) => void
  // A lingering hazard field on the floor (weaver trail).
  spawnField: (x: number, y: number, radius: number, ticks: number) => void
  // A one-shot area strike (diver slam).
  spawnBurst: (x: number, y: number, radius: number, damage: number) => void
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
  facingX: 0,
  facingY: 1,
  targetX: 0,
  targetY: 0,
  shielded: false,
  intangible: false,
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

export const createWeaver = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("weaver", x, y, 15, 6)
  enemy.timerTicks = 8
  return enemy
}

export const createSentinel = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("sentinel", x, y, 17, 9)
  enemy.timerTicks = 60 + Math.floor(Math.random() * 40)
  return enemy
}

export const createWarden = (x: number, y: number): Enemy => baseEnemy("warden", x, y, 13, 5)

export const createDiver = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("diver", x, y, 14, 6)
  enemy.timerTicks = 40 + Math.floor(Math.random() * 40)
  return enemy
}

export const createCharger = (x: number, y: number): Enemy => {
  const enemy = baseEnemy("charger", x, y, 15, 7)
  enemy.timerTicks = 40 + Math.floor(Math.random() * 40)
  return enemy
}

export const createSwarm = (x: number, y: number): Enemy => baseEnemy("swarm", x, y, 8, 1)

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
    case "weaver":
      return createWeaver(x, y)
    case "sentinel":
      return createSentinel(x, y)
    case "warden":
      return createWarden(x, y)
    case "diver":
      return createDiver(x, y)
    case "charger":
      return createCharger(x, y)
    case "swarm":
      return createSwarm(x, y)
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

const WEAVER_SPEED = 66
const WEAVER_DESIRED = 190
const WEAVER_FIELD_INTERVAL = 26
const WEAVER_FIELD_RADIUS = 34
const WEAVER_FIELD_TICKS = 150
const SENTINEL_TURN = 0.028 // slow facing → gives a flanking window
const SENTINEL_SHOT_INTERVAL = 96
const SENTINEL_SHOT_SPEED = 150
export const SENTINEL_SHIELD_ARC = 1.15 // half-angle of the front shield, radians
const WARDEN_SPEED = 58
const WARDEN_DESIRED = 250
export const WARDEN_SHIELD_RADIUS = 120
const DIVER_HOVER_SPEED = 70
const DIVER_WINDUP_TICKS = 46
const DIVER_COOLDOWN_TICKS = 66
const DIVER_SLAM_RADIUS = 46
const CHARGER_APPROACH_SPEED = 58
const CHARGER_WINDUP_TICKS = 42
const CHARGER_DASH_TICKS = 26
const CHARGER_DASH_SPEED = 430
const CHARGER_RECOVER_TICKS = 48
const SWARM_SPEED = 104
const SWARM_TURN = 0.09

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
    case "swarm":
      steerToward(enemy, player, SWARM_SPEED, SWARM_TURN)
      break
    case "hopper":
      updateHopper(enemy, player)
      break
    case "shooter":
      updateShooter(enemy, player, context)
      break
    case "weaver":
      updateWeaver(enemy, player, context)
      break
    case "sentinel":
      updateSentinel(enemy, player, context)
      break
    case "warden":
      updateWarden(enemy, player, context)
      break
    case "diver":
      updateDiver(enemy, player, context)
      break
    case "charger":
      updateCharger(enemy, player)
      break
  }

  const { transform, body } = enemy
  transform.x += transform.velocityX * deltaSeconds
  transform.y += transform.velocityY * deltaSeconds
  transform.x = clamp(transform.x, ROOM_LEFT + body.radius, ROOM_RIGHT - body.radius)
  transform.y = clamp(transform.y, ROOM_TOP + body.radius, ROOM_BOTTOM - body.radius)
}

// Keeps a preferred distance from the player: back off if too close, close in if
// too far, otherwise circle-strafe. Shared by weaver-style spacers.
const steerAtRange = (enemy: Enemy, player: Player, speed: number, desired: number): void => {
  const toPlayerX = player.transform.x - enemy.transform.x
  const toPlayerY = player.transform.y - enemy.transform.y
  const distance = Math.hypot(toPlayerX, toPlayerY) || 1
  const dirX = toPlayerX / distance
  const dirY = toPlayerY / distance
  let targetX: number
  let targetY: number
  if (distance < desired * 0.8) {
    targetX = -dirX * speed
    targetY = -dirY * speed
  } else if (distance > desired * 1.25) {
    targetX = dirX * speed
    targetY = dirY * speed
  } else {
    targetX = -dirY * speed * 0.7
    targetY = dirX * speed * 0.7
  }
  enemy.transform.velocityX = approach(enemy.transform.velocityX, targetX, 0.08)
  enemy.transform.velocityY = approach(enemy.transform.velocityY, targetY, 0.08)
}

const faceToward = (enemy: Enemy, player: Player, response: number): void => {
  const direction = normalize(
    player.transform.x - enemy.transform.x,
    player.transform.y - enemy.transform.y,
  )
  const facing = normalize(
    approach(enemy.facingX, direction.x, response),
    approach(enemy.facingY, direction.y, response),
  )
  enemy.facingX = facing.x
  enemy.facingY = facing.y
}

// Netzweber — drops lingering hazard fields along its path, shrinking the room.
const updateWeaver = (enemy: Enemy, player: Player, context: EnemyContext): void => {
  steerAtRange(enemy, player, WEAVER_SPEED, WEAVER_DESIRED)
  enemy.timerTicks -= 1
  if (enemy.timerTicks <= 0) {
    context.spawnField(enemy.transform.x, enemy.transform.y, WEAVER_FIELD_RADIUS, WEAVER_FIELD_TICKS)
    enemy.timerTicks = WEAVER_FIELD_INTERVAL
  }
}

// Wächteraug — near-stationary, turns to face the player slowly (a flanking
// window), fires a heavy aimed shot. Its front shield is resolved in Run.
const updateSentinel = (enemy: Enemy, player: Player, context: EnemyContext): void => {
  enemy.transform.velocityX = approach(enemy.transform.velocityX, 0, 0.2)
  enemy.transform.velocityY = approach(enemy.transform.velocityY, 0, 0.2)
  faceToward(enemy, player, SENTINEL_TURN)
  enemy.timerTicks -= 1
  if (enemy.timerTicks <= 0) {
    context.spawnEnemyProjectile(
      enemy.transform.x + enemy.facingX * enemy.body.radius,
      enemy.transform.y + enemy.facingY * enemy.body.radius,
      enemy.facingX * SENTINEL_SHOT_SPEED,
      enemy.facingY * SENTINEL_SHOT_SPEED,
      enemy.contactDamage,
    )
    enemy.timerTicks = SENTINEL_SHOT_INTERVAL
  }
}

// Bannkugel — hangs back and shields every nearby non-warden enemy each tick.
const updateWarden = (enemy: Enemy, player: Player, context: EnemyContext): void => {
  steerAtRange(enemy, player, WARDEN_SPEED, WARDEN_DESIRED)
  for (const other of context.enemies) {
    if (other === enemy || !other.active || other.type === "warden") continue
    const distance = Math.hypot(
      other.transform.x - enemy.transform.x,
      other.transform.y - enemy.transform.y,
    )
    if (distance <= WARDEN_SHIELD_RADIUS) other.shielded = true
  }
}

// Sturztaucher — locks onto the player's position, goes intangible, then slams
// it. Only hits where the player *was*, so standing still is punished.
const updateDiver = (enemy: Enemy, player: Player, context: EnemyContext): void => {
  if (enemy.mode === 0) {
    // Hover toward the player, tangible.
    steerToward(enemy, player, DIVER_HOVER_SPEED, 0.06)
    enemy.timerTicks -= 1
    if (enemy.timerTicks <= 0) {
      enemy.mode = 1
      enemy.timerTicks = DIVER_WINDUP_TICKS
      enemy.targetX = player.transform.x
      enemy.targetY = player.transform.y
      enemy.intangible = true
      enemy.transform.velocityX = 0
      enemy.transform.velocityY = 0
    }
    return
  }
  // Windup: hang above the marked spot, cannot be hit, then slam it.
  enemy.transform.velocityX = 0
  enemy.transform.velocityY = 0
  enemy.timerTicks -= 1
  if (enemy.timerTicks <= 0) {
    context.spawnBurst(enemy.targetX, enemy.targetY, DIVER_SLAM_RADIUS, enemy.contactDamage)
    enemy.transform.x = enemy.targetX
    enemy.transform.y = enemy.targetY
    enemy.intangible = false
    enemy.mode = 0
    enemy.timerTicks = DIVER_COOLDOWN_TICKS
  }
}

// Rammhorn — approach, wind up (telegraphed line), dash straight, overshoot,
// then stick in a recovery window where it is easy to punish.
const updateCharger = (enemy: Enemy, player: Player): void => {
  switch (enemy.mode) {
    case 0: // approach
      steerToward(enemy, player, CHARGER_APPROACH_SPEED, 0.05)
      faceToward(enemy, player, 0.1)
      enemy.timerTicks -= 1
      if (enemy.timerTicks <= 0) {
        const direction = normalize(
          player.transform.x - enemy.transform.x,
          player.transform.y - enemy.transform.y,
        )
        enemy.facingX = direction.x
        enemy.facingY = direction.y
        enemy.mode = 1
        enemy.timerTicks = CHARGER_WINDUP_TICKS
      }
      break
    case 1: // windup (telegraph)
      enemy.transform.velocityX = approach(enemy.transform.velocityX, 0, 0.3)
      enemy.transform.velocityY = approach(enemy.transform.velocityY, 0, 0.3)
      enemy.timerTicks -= 1
      if (enemy.timerTicks <= 0) {
        enemy.transform.velocityX = enemy.facingX * CHARGER_DASH_SPEED
        enemy.transform.velocityY = enemy.facingY * CHARGER_DASH_SPEED
        enemy.mode = 2
        enemy.timerTicks = CHARGER_DASH_TICKS
      }
      break
    case 2: // dash
      enemy.timerTicks -= 1
      if (enemy.timerTicks <= 0) {
        enemy.mode = 3
        enemy.timerTicks = CHARGER_RECOVER_TICKS
      }
      break
    default: // recover (vulnerable)
      enemy.transform.velocityX = approach(enemy.transform.velocityX, 0, 0.2)
      enemy.transform.velocityY = approach(enemy.transform.velocityY, 0, 0.2)
      enemy.timerTicks -= 1
      if (enemy.timerTicks <= 0) {
        enemy.mode = 0
        enemy.timerTicks = 30
      }
      break
  }
}

// True while a charger sits in its post-dash recovery — the punish window.
export const isChargerExposed = (enemy: Enemy): boolean =>
  enemy.type === "charger" && enemy.mode === 3

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
  weaver: shade(COLOR.brood, -0.12),
  sentinel: COLOR.caster,
  warden: COLOR.bio,
  diver: shade(COLOR.caster, 0.2),
  charger: shade(COLOR.hunter, 0.15),
  swarm: COLOR.leaper,
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

  // Diver windup: intangible above a growing danger target — draw that instead.
  if (enemy.type === "diver" && enemy.intangible) {
    const progress = 1 - enemy.timerTicks / DIVER_WINDUP_TICKS
    renderer.additive(() =>
      renderer.glowCircle(enemy.targetX, enemy.targetY, DIVER_SLAM_RADIUS * (0.4 + progress * 0.6), COLOR.danger, 10),
    )
    renderer.strokeCircle(enemy.targetX, enemy.targetY, DIVER_SLAM_RADIUS, rgba(COLOR.danger, 0.7), 2)
    renderer.strokeCircle(enemy.targetX, enemy.targetY, DIVER_SLAM_RADIUS * progress, COLOR.danger, 2)
    context.globalAlpha = 0.4
    renderer.fillCircle(x, y - 8, body.radius * 0.8, base)
    context.globalAlpha = 1
    return
  }

  // Cold self-glow — subtle so it never competes with the player.
  renderer.additive(() => renderer.glowCircle(x, y, body.radius + 1, base, 10))
  // A poisoned creature seeps green.
  if (enemy.poisonTicks > 0) {
    renderer.additive(() => renderer.glowCircle(x, y, body.radius + 2, COLOR.leaper, 12))
  }
  // A warden-shielded enemy wears an unmistakable bubble (it takes no damage).
  if (enemy.shielded) {
    const pulse = 0.6 + Math.sin(enemy.timerTicks * 0.2 + x * 0.05) * 0.4
    renderer.strokeCircle(x, y, body.radius + 5, rgba(COLOR.bio, pulse), 2)
  }
  // Warden aura — shows its protection radius.
  if (enemy.type === "warden") {
    renderer.strokeCircle(x, y, WARDEN_SHIELD_RADIUS, rgba(COLOR.bio, 0.12), 1)
  }
  // Charger telegraph: a danger line down its locked dash path during windup.
  if (enemy.type === "charger" && enemy.mode === 1) {
    context.strokeStyle = rgba(COLOR.danger, 0.55)
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + enemy.facingX * 260, y + enemy.facingY * 260)
    context.stroke()
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

  // Sentinel: a bright front shield arc (blocks shots), plus an eye that flares
  // just before it fires. The arc points where it faces — flank the back.
  if (enemy.type === "sentinel") {
    const angle = Math.atan2(enemy.facingY, enemy.facingX)
    context.strokeStyle = COLOR.caster
    context.lineWidth = 4
    context.beginPath()
    context.arc(x, y, body.radius + 4, angle - SENTINEL_SHIELD_ARC, angle + SENTINEL_SHIELD_ARC)
    context.stroke()
    const charging = enemy.timerTicks < 24
    renderer.fillCircle(x + enemy.facingX * 5, y + enemy.facingY * 5, 3.5, charging ? COLOR.danger : EYE)
  }

  // Charger: a forward horn; dims and shows an exposed mark while recovering.
  if (enemy.type === "charger") {
    const hornColor = enemy.mode === 1 ? COLOR.danger : shade(base, 0.4)
    context.fillStyle = hornColor
    context.beginPath()
    context.moveTo(x + enemy.facingX * (body.radius + 8), y + enemy.facingY * (body.radius + 8))
    context.lineTo(x + enemy.facingY * 5, y - enemy.facingX * 5)
    context.lineTo(x - enemy.facingY * 5, y + enemy.facingX * 5)
    context.closePath()
    context.fill()
    if (enemy.mode === 3) renderer.strokeCircle(x, y, body.radius + 3, rgba(COLOR.flash, 0.5), 1.5)
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

  // Eyes — one big for the chaser (a single stare); swarm motes are too small.
  if (enemy.type === "swarm") {
    renderer.fillCircle(x, y, 2, COLOR.flash)
  } else if (enemy.type === "chaser") {
    renderer.fillCircle(x, y - body.radius * 0.1, 4, EYE)
    renderer.fillCircle(x + 1.5, y - body.radius * 0.1 - 1, 1.6, COLOR.flash)
  } else {
    const eyeOffsetX = body.radius * 0.4
    const eyeOffsetY = body.radius * 0.12
    renderer.fillCircle(x - eyeOffsetX, y - eyeOffsetY, 2.6, EYE)
    renderer.fillCircle(x + eyeOffsetX, y - eyeOffsetY, 2.6, EYE)
  }
}
