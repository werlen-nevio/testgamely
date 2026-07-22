import type { Renderer } from "../core/Renderer"
import type { Player } from "./Player"
import type { EnemyContext } from "./Enemy"
import { clamp, lerp } from "../core/math"
import {
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_RIGHT,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
} from "../constants"
import { createTransform, rememberPreviousPosition, type Body, type Transform } from "./components"

// ─── BOSS ───
// One boss per floor. It cycles three attack patterns; under 50% HP it enters
// phase 2 — attacks come faster and denser and it moves quicker. Beaten, it
// clears the room and opens the way down.

export interface Boss {
  transform: Transform
  body: Body
  health: number
  maxHealth: number
  contactDamage: number
  hitFlashTicks: number
  phase: 1 | 2
  attackTimer: number
  pattern: number
  spinAngle: number
  moveTimer: number
  targetX: number
  targetY: number
}

const PHASE1_INTERVAL = 84
const PHASE2_INTERVAL = 52
const MOVE_INTERVAL = 110
const MOVE_SPEED_PHASE1 = 46
const MOVE_SPEED_PHASE2 = 74
const RING_SPEED = 118
const SPREAD_SPEED = 190
const SPIRAL_SPEED = 150

export const createBoss = (level: number): Boss => {
  const health = 180 + level * 70
  return {
    transform: createTransform(ROOM_CENTER_X, ROOM_TOP + 110),
    body: { radius: 34 },
    health,
    maxHealth: health,
    contactDamage: 1,
    hitFlashTicks: 0,
    phase: 1,
    attackTimer: 70,
    pattern: 0,
    spinAngle: 0,
    moveTimer: 0,
    targetX: ROOM_CENTER_X,
    targetY: ROOM_TOP + 110,
  }
}

export const damageBoss = (boss: Boss, amount: number): boolean => {
  boss.health -= amount
  boss.hitFlashTicks = 4
  if (boss.phase === 1 && boss.health <= boss.maxHealth * 0.5) {
    boss.phase = 2
    boss.attackTimer = 24 // brief beat before the harder phase opens up
  }
  return boss.health <= 0
}

export const updateBoss = (
  boss: Boss,
  player: Player,
  context: EnemyContext,
  deltaSeconds: number,
): void => {
  rememberPreviousPosition(boss.transform)
  if (boss.hitFlashTicks > 0) boss.hitFlashTicks -= 1

  moveBoss(boss, deltaSeconds)

  boss.attackTimer -= 1
  if (boss.attackTimer <= 0) {
    executePattern(boss, player, context)
    boss.pattern = (boss.pattern + 1) % 3
    boss.attackTimer = boss.phase === 2 ? PHASE2_INTERVAL : PHASE1_INTERVAL
  }
}

const moveBoss = (boss: Boss, deltaSeconds: number): void => {
  boss.moveTimer -= 1
  if (boss.moveTimer <= 0) {
    // Wander within the upper two-thirds of the room.
    boss.targetX = ROOM_LEFT + 60 + Math.random() * (ROOM_RIGHT - ROOM_LEFT - 120)
    boss.targetY = ROOM_TOP + 60 + Math.random() * (ROOM_BOTTOM - ROOM_TOP - 200)
    boss.moveTimer = MOVE_INTERVAL
  }
  const speed = boss.phase === 2 ? MOVE_SPEED_PHASE2 : MOVE_SPEED_PHASE1
  const deltaX = boss.targetX - boss.transform.x
  const deltaY = boss.targetY - boss.transform.y
  const distance = Math.hypot(deltaX, deltaY) || 1
  boss.transform.velocityX = (deltaX / distance) * speed
  boss.transform.velocityY = (deltaY / distance) * speed
  boss.transform.x += boss.transform.velocityX * deltaSeconds
  boss.transform.y += boss.transform.velocityY * deltaSeconds
  boss.transform.x = clamp(boss.transform.x, ROOM_LEFT + boss.body.radius, ROOM_RIGHT - boss.body.radius)
  boss.transform.y = clamp(boss.transform.y, ROOM_TOP + boss.body.radius, ROOM_BOTTOM - boss.body.radius)
}

const executePattern = (boss: Boss, player: Player, context: EnemyContext): void => {
  if (boss.pattern === 0) fireRing(boss, context)
  else if (boss.pattern === 1) fireAimedSpread(boss, player, context)
  else fireSpiral(boss, context)
}

// Pattern 1 — even ring of bullets in every direction.
const fireRing = (boss: Boss, context: EnemyContext): void => {
  const count = boss.phase === 2 ? 18 : 12
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    context.spawnEnemyProjectile(
      boss.transform.x,
      boss.transform.y,
      Math.cos(angle) * RING_SPEED,
      Math.sin(angle) * RING_SPEED,
      boss.contactDamage,
    )
  }
}

// Pattern 2 — tight fan aimed at the player.
const fireAimedSpread = (boss: Boss, player: Player, context: EnemyContext): void => {
  const baseAngle = Math.atan2(
    player.transform.y - boss.transform.y,
    player.transform.x - boss.transform.x,
  )
  const count = boss.phase === 2 ? 5 : 3
  const spread = 0.32
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spread
    const angle = baseAngle + offset
    context.spawnEnemyProjectile(
      boss.transform.x,
      boss.transform.y,
      Math.cos(angle) * SPREAD_SPEED,
      Math.sin(angle) * SPREAD_SPEED,
      boss.contactDamage,
    )
  }
}

// Pattern 3 — rotating arms that sweep as the pattern repeats.
const fireSpiral = (boss: Boss, context: EnemyContext): void => {
  const arms = boss.phase === 2 ? 4 : 3
  boss.spinAngle += 0.5
  for (let index = 0; index < arms; index += 1) {
    const angle = boss.spinAngle + (index / arms) * Math.PI * 2
    context.spawnEnemyProjectile(
      boss.transform.x,
      boss.transform.y,
      Math.cos(angle) * SPIRAL_SPEED,
      Math.sin(angle) * SPIRAL_SPEED,
      boss.contactDamage,
    )
  }
}

// ─── RENDER ───

const PHASE1_FILL = "#7a2f6d"
const PHASE2_FILL = "#a83030"
const BOSS_EDGE = "#2a1020"
const FLASH_COLOR = "#ffffff"
const CORE_COLOR = "#f4e2c4"

export const renderBoss = (renderer: Renderer, boss: Boss, interpolation: number): void => {
  const x = lerp(boss.transform.previousX, boss.transform.x, interpolation)
  const y = lerp(boss.transform.previousY, boss.transform.y, interpolation)
  const context = renderer.context
  const flashing = boss.hitFlashTicks > 0
  const fill = flashing ? FLASH_COLOR : boss.phase === 2 ? PHASE2_FILL : PHASE1_FILL

  renderer.fillCircle(x, y, boss.body.radius, fill)
  context.lineWidth = 3
  context.strokeStyle = flashing ? FLASH_COLOR : BOSS_EDGE
  context.stroke()

  if (!flashing) {
    renderer.fillCircle(x - 11, y - 6, 5, CORE_COLOR)
    renderer.fillCircle(x + 11, y - 6, 5, CORE_COLOR)
    renderer.fillCircle(x - 11, y - 6, 2, "#2a1020")
    renderer.fillCircle(x + 11, y - 6, 2, "#2a1020")
  }

  renderBossHealthBar(renderer, boss)
}

const renderBossHealthBar = (renderer: Renderer, boss: Boss): void => {
  const width = ROOM_RIGHT - ROOM_LEFT - 120
  const x = ROOM_LEFT + 60
  const y = ROOM_BOTTOM - 22
  const fraction = Math.max(0, boss.health / boss.maxHealth)
  renderer.fillRect(x - 2, y - 2, width + 4, 14, "#1a1210")
  renderer.fillRect(x, y, width, 10, "#3a2a2a")
  renderer.fillRect(x, y, width * fraction, 10, boss.phase === 2 ? "#d84a4a" : "#c25aa8")
}
