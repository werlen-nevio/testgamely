import type { Renderer } from "../core/Renderer"
import type { Player } from "./Player"
import type { EnemyContext } from "./Enemy"
import { clamp, lerp, normalize } from "../core/math"
import { COLOR, shade, rgba } from "../theme"
import {
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_RIGHT,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
} from "../constants"
import { createTransform, rememberPreviousPosition, type Body, type Transform } from "./components"

// ─── BOSSES ───
// Six bosses, dispatched by `type` (composition, no inheritance). Each owns a
// distinct core pattern (see DESIGN_BOSSES.md); every damaging attack telegraphs
// through a windup before it fires, and phase 2 changes behaviour, not just HP.
// Look bound to ART_DIRECTION.md — bodies cold/built, all danger in `--danger`.

export type BossType =
  | "tidewarden"
  | "lantern"
  | "chargerlord"
  | "broodmother"
  | "idol"
  | "serpent"

interface Segment {
  x: number
  y: number
}

export interface Boss {
  type: BossType
  transform: Transform
  body: Body
  health: number
  maxHealth: number
  contactDamage: number
  hitFlashTicks: number
  phase: 1 | 2
  // Generic scratch — meaning is per-boss.
  attackTimer: number
  windupTicks: number
  windupMax: number
  activeAttack: number // which attack is charging (-1 = none)
  spinAngle: number
  moveTimer: number
  targetX: number
  targetY: number
  facingX: number
  facingY: number
  mode: number
  data: number
  data2: number
  segments: Segment[]
}

const BOSS_TIER: Record<BossType, number> = {
  tidewarden: 1,
  lantern: 1,
  chargerlord: 2,
  broodmother: 2,
  idol: 3,
  serpent: 3,
}

const ALL_BOSSES = Object.keys(BOSS_TIER) as BossType[]

// Floor n draws from bosses with tier ≤ ceil(n/2), so early floors stay tame.
export const pickBossType = (level: number): BossType => {
  const maxTier = Math.ceil(level / 2)
  const eligible = ALL_BOSSES.filter((type) => BOSS_TIER[type] <= maxTier)
  return eligible[Math.floor(Math.random() * eligible.length)]
}

const RADIUS: Record<BossType, number> = {
  tidewarden: 36,
  lantern: 32,
  chargerlord: 30,
  broodmother: 40,
  idol: 34,
  serpent: 22,
}

export const createBoss = (level: number): Boss => createBossOfType(pickBossType(level), level)

export const createBossOfType = (type: BossType, level: number): Boss => {
  const health = Math.round((190 + level * 70) * (type === "idol" ? 1.15 : 1))
  const boss: Boss = {
    type,
    transform: createTransform(ROOM_CENTER_X, ROOM_TOP + 110),
    body: { radius: RADIUS[type] },
    health,
    maxHealth: health,
    contactDamage: 1,
    hitFlashTicks: 0,
    phase: 1,
    attackTimer: 70,
    windupTicks: 0,
    windupMax: 1,
    activeAttack: -1,
    spinAngle: 0,
    moveTimer: 0,
    targetX: ROOM_CENTER_X,
    targetY: ROOM_TOP + 110,
    facingX: 0,
    facingY: 1,
    mode: 0,
    data: 0,
    data2: 0,
    segments: [],
  }
  if (type === "idol") {
    boss.transform.x = ROOM_CENTER_X
    boss.transform.y = ROOM_CENTER_Y
    boss.targetX = boss.transform.x
    boss.targetY = boss.transform.y
  }
  if (type === "serpent") {
    for (let index = 0; index < 9; index += 1) {
      boss.segments.push({ x: boss.transform.x, y: boss.transform.y })
    }
  }
  return boss
}

export const damageBoss = (boss: Boss, amount: number): boolean => {
  boss.health -= amount
  boss.hitFlashTicks = 4
  if (boss.phase === 1 && boss.health <= boss.maxHealth * 0.5) {
    boss.phase = 2
    boss.attackTimer = 24
    boss.windupTicks = 0
    boss.activeAttack = -1
  }
  return boss.health <= 0
}

// Contact damage covers the head plus (for the serpent) every body segment.
export const bossContactsPlayer = (boss: Boss, px: number, py: number, pr: number): boolean => {
  if (overlap(px, py, pr, boss.transform.x, boss.transform.y, boss.body.radius)) return true
  for (const segment of boss.segments) {
    if (overlap(px, py, pr, segment.x, segment.y, boss.body.radius * 0.7)) return true
  }
  return false
}

// ─── SHARED HELPERS ───

const overlap = (ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean => {
  const dx = bx - ax
  const dy = by - ay
  const r = ar + br
  return dx * dx + dy * dy <= r * r
}

const clampToArena = (boss: Boss): void => {
  boss.transform.x = clamp(boss.transform.x, ROOM_LEFT + boss.body.radius, ROOM_RIGHT - boss.body.radius)
  boss.transform.y = clamp(boss.transform.y, ROOM_TOP + boss.body.radius, ROOM_BOTTOM - boss.body.radius)
}

const stepToTarget = (boss: Boss, speed: number, deltaSeconds: number): void => {
  const dx = boss.targetX - boss.transform.x
  const dy = boss.targetY - boss.transform.y
  const distance = Math.hypot(dx, dy) || 1
  boss.transform.velocityX = (dx / distance) * speed
  boss.transform.velocityY = (dy / distance) * speed
  boss.transform.x += boss.transform.velocityX * deltaSeconds
  boss.transform.y += boss.transform.velocityY * deltaSeconds
}

const fireRing = (boss: Boss, context: EnemyContext, count: number, speed: number, offset = 0): void => {
  for (let index = 0; index < count; index += 1) {
    const angle = offset + (index / count) * Math.PI * 2
    context.spawnEnemyProjectile(
      boss.transform.x,
      boss.transform.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      boss.contactDamage,
    )
  }
}

const fireFan = (boss: Boss, player: Player, context: EnemyContext, count: number, spread: number, speed: number): void => {
  const base = Math.atan2(player.transform.y - boss.transform.y, player.transform.x - boss.transform.x)
  for (let index = 0; index < count; index += 1) {
    const angle = base + (index - (count - 1) / 2) * spread
    context.spawnEnemyProjectile(
      boss.transform.x,
      boss.transform.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      boss.contactDamage,
    )
  }
}

// Starts a telegraphed attack: `ticks` of windup, then fire in the updater.
const beginWindup = (boss: Boss, attack: number, ticks: number): void => {
  boss.activeAttack = attack
  boss.windupTicks = ticks
  boss.windupMax = ticks
}

// ─── UPDATE (dispatch) ───

export const updateBoss = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  rememberPreviousPosition(boss.transform)
  if (boss.hitFlashTicks > 0) boss.hitFlashTicks -= 1
  boss.spinAngle += 0.03

  switch (boss.type) {
    case "tidewarden":
      updateTidewarden(boss, player, context, deltaSeconds)
      break
    case "lantern":
      updateLantern(boss, player, context, deltaSeconds)
      break
    case "chargerlord":
      updateChargerLord(boss, player, context, deltaSeconds)
      break
    case "broodmother":
      updateBroodmother(boss, player, context, deltaSeconds)
      break
    case "idol":
      updateIdol(boss, player, context)
      break
    case "serpent":
      updateSerpent(boss, player, context, deltaSeconds)
      break
  }
  clampToArena(boss)
}

// ─── TIDEWARDEN — melee charger + radial stomp ───

const updateTidewarden = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  // mode 0 approach, 1 charge-windup, 2 charging, 3 exhausted, 4 stomp-windup
  if (boss.mode === 0) {
    boss.targetX = player.transform.x
    boss.targetY = player.transform.y
    stepToTarget(boss, 42, deltaSeconds)
    boss.attackTimer -= 1
    if (boss.attackTimer <= 0) {
      if (boss.data % 2 === 0) {
        boss.facingX = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y).x
        boss.facingY = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y).y
        boss.mode = 1
        boss.windupTicks = 38
        boss.windupMax = 38
      } else {
        boss.mode = 4
        boss.windupTicks = 40
        boss.windupMax = 40
      }
      boss.data += 1
    }
    return
  }
  if (boss.mode === 1) {
    boss.transform.velocityX *= 0.8
    boss.transform.velocityY *= 0.8
    boss.windupTicks -= 1
    if (boss.windupTicks <= 0) {
      boss.mode = 2
      boss.data2 = boss.phase === 2 ? 2 : 1 // remaining wall bounces (own counter)
      boss.transform.velocityX = boss.facingX * 360
      boss.transform.velocityY = boss.facingY * 360
    }
    return
  }
  if (boss.mode === 2) {
    boss.transform.x += boss.transform.velocityX * deltaSeconds
    boss.transform.y += boss.transform.velocityY * deltaSeconds
    if (boss.phase === 2 && Math.random() < 0.5) {
      context.spawnField(boss.transform.x, boss.transform.y, 30, 90)
    }
    const left = ROOM_LEFT + boss.body.radius
    const right = ROOM_RIGHT - boss.body.radius
    const top = ROOM_TOP + boss.body.radius
    const bottom = ROOM_BOTTOM - boss.body.radius
    let bounced = false
    if (boss.transform.x <= left || boss.transform.x >= right) {
      boss.transform.velocityX *= -1
      bounced = true
    }
    if (boss.transform.y <= top || boss.transform.y >= bottom) {
      boss.transform.velocityY *= -1
      bounced = true
    }
    if (bounced) {
      boss.data2 -= 1
      if (boss.data2 <= 0) {
        boss.mode = 3
        boss.windupTicks = 80
      }
    }
    return
  }
  if (boss.mode === 3) {
    boss.transform.velocityX *= 0.85
    boss.transform.velocityY *= 0.85
    boss.windupTicks -= 1
    if (boss.windupTicks <= 0) {
      boss.mode = 0
      boss.attackTimer = 60
    }
    return
  }
  // mode 4 stomp windup → radial ring with a gap
  boss.transform.velocityX *= 0.8
  boss.transform.velocityY *= 0.8
  boss.windupTicks -= 1
  if (boss.windupTicks <= 0) {
    const count = boss.phase === 2 ? 20 : 14
    const gapAt = Math.floor(Math.random() * count)
    for (let index = 0; index < count; index += 1) {
      if (index === gapAt || (boss.phase === 1 && index === (gapAt + 1) % count)) continue
      const angle = (index / count) * Math.PI * 2
      context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, Math.cos(angle) * 150, Math.sin(angle) * 150, 1)
    }
    boss.mode = 0
    boss.attackTimer = 56
  }
}

// ─── LANTERN-CHOIR — bullet patterns ───

const updateLantern = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  boss.moveTimer -= 1
  if (boss.moveTimer <= 0) {
    boss.targetX = ROOM_LEFT + 80 + Math.random() * (ROOM_RIGHT - ROOM_LEFT - 160)
    boss.targetY = ROOM_TOP + 70 + Math.random() * (ROOM_BOTTOM - ROOM_TOP - 220)
    boss.moveTimer = 120
  }
  stepToTarget(boss, boss.phase === 2 ? 60 : 44, deltaSeconds)

  if (boss.windupTicks > 0) {
    boss.windupTicks -= 1
    if (boss.windupTicks === 0) fireLantern(boss, player, context)
    return
  }
  boss.attackTimer -= 1
  if (boss.attackTimer <= 0) {
    beginWindup(boss, boss.data % 3, 26)
    boss.data += 1
    boss.attackTimer = boss.phase === 2 ? 60 : 92
  }
}

const fireLantern = (boss: Boss, player: Player, context: EnemyContext): void => {
  if (boss.activeAttack === 0) {
    // Ring — a second offset ring in phase 2 (moving gaps).
    fireRing(boss, context, boss.phase === 2 ? 16 : 12, 120)
    if (boss.phase === 2) fireRing(boss, context, 16, 150, Math.PI / 16)
  } else if (boss.activeAttack === 1) {
    fireFan(boss, player, context, boss.phase === 2 ? 5 : 3, 0.3, 190)
  } else {
    // Spiral — both directions in phase 2.
    const arms = boss.phase === 2 ? 4 : 3
    for (let index = 0; index < arms; index += 1) {
      const angle = boss.spinAngle * 3 + (index / arms) * Math.PI * 2
      context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, Math.cos(angle) * 150, Math.sin(angle) * 150, 1)
      if (boss.phase === 2) {
        const back = -boss.spinAngle * 3 + (index / arms) * Math.PI * 2
        context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, Math.cos(back) * 150, Math.sin(back) * 150, 1)
      }
    }
  }
  boss.activeAttack = -1
}

// ─── CHARGER-LORD — dash duel + charger adds ───

const updateChargerLord = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  if (boss.mode === 0) {
    boss.targetX = player.transform.x
    boss.targetY = player.transform.y
    stepToTarget(boss, 40, deltaSeconds)
    boss.attackTimer -= 1
    if (boss.attackTimer <= 0) {
      if (boss.data % 3 === 2) {
        // Ruf der Brut — spawn charger adds.
        context.spawnEnemy("charger", boss.transform.x - 40, boss.transform.y + 30)
        context.spawnEnemy("charger", boss.transform.x + 40, boss.transform.y + 30)
        boss.attackTimer = 90
      } else {
        const direction = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y)
        boss.facingX = direction.x
        boss.facingY = direction.y
        boss.mode = 1
        boss.windupTicks = 34
        boss.windupMax = 34
        boss.data2 = boss.phase === 2 ? 3 : 1 // remaining dashes
      }
      boss.data += 1
    }
    return
  }
  if (boss.mode === 1) {
    boss.transform.velocityX *= 0.8
    boss.transform.velocityY *= 0.8
    boss.windupTicks -= 1
    if (boss.windupTicks <= 0) {
      boss.mode = 2
      boss.transform.velocityX = boss.facingX * 480
      boss.transform.velocityY = boss.facingY * 480
      boss.moveTimer = 22
    }
    return
  }
  if (boss.mode === 2) {
    boss.transform.x += boss.transform.velocityX * deltaSeconds
    boss.transform.y += boss.transform.velocityY * deltaSeconds
    boss.moveTimer -= 1
    if (boss.moveTimer <= 0) {
      boss.data2 -= 1
      if (boss.data2 > 0 && boss.phase === 2) {
        // Re-aim and dash again (triple dash in phase 2).
        const direction = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y)
        boss.facingX = direction.x
        boss.facingY = direction.y
        boss.mode = 1
        boss.windupTicks = 12
      } else {
        boss.mode = 3
        boss.windupTicks = boss.phase === 2 ? 36 : 52
      }
    }
    return
  }
  // recover
  boss.transform.velocityX *= 0.85
  boss.transform.velocityY *= 0.85
  boss.windupTicks -= 1
  if (boss.windupTicks <= 0) {
    boss.mode = 0
    boss.attackTimer = 46
  }
}

// ─── BROODMOTHER — adds + poison spit ───

const updateBroodmother = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  boss.moveTimer -= 1
  if (boss.moveTimer <= 0) {
    boss.targetX = ROOM_LEFT + 100 + Math.random() * (ROOM_RIGHT - ROOM_LEFT - 200)
    boss.targetY = ROOM_TOP + 70 + Math.random() * 90
    boss.moveTimer = 140
  }
  stepToTarget(boss, 30, deltaSeconds)

  if (boss.windupTicks > 0) {
    boss.windupTicks -= 1
    if (boss.windupTicks === 0) {
      if (boss.activeAttack === 0) {
        const count = boss.phase === 2 ? 4 : 2
        for (let index = 0; index < count; index += 1) {
          const type = Math.random() < 0.5 ? "swarm" : "chaser"
          context.spawnEnemy(type, boss.transform.x + (index - count / 2) * 30, boss.transform.y + 30)
        }
      } else {
        // Slow heavy poison glob.
        const direction = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y)
        context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, direction.x * 120, direction.y * 120, 1)
      }
      boss.activeAttack = -1
    }
    return
  }
  boss.attackTimer -= 1
  if (boss.attackTimer <= 0) {
    beginWindup(boss, boss.data % 2, 34)
    boss.data += 1
    boss.attackTimer = boss.phase === 2 ? 66 : 104
  }
}

// ─── SUNKEN IDOL — arena flooder + sweeping beam ───

const updateIdol = (boss: Boss, player: Player, context: EnemyContext): void => {
  boss.transform.velocityX = 0
  boss.transform.velocityY = 0
  if (boss.windupTicks > 0) {
    boss.windupTicks -= 1
    if (boss.windupTicks === 0) fireIdol(boss, player, context)
    return
  }
  boss.attackTimer -= 1
  if (boss.attackTimer <= 0) {
    // Alternate flood (attack 0, needs the telegraph) and beam (attack 1).
    beginWindup(boss, boss.data % 2, boss.data % 2 === 0 ? 72 : 30)
    if (boss.data % 2 === 0) {
      // Pick which half/quadrant floods; store in `mode`.
      boss.mode = Math.floor(Math.random() * 4)
    } else {
      boss.facingX = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y).x
      boss.facingY = normalize(player.transform.x - boss.transform.x, player.transform.y - boss.transform.y).y
    }
    boss.data += 1
    boss.attackTimer = boss.phase === 2 ? 70 : 104
  }
}

const idolQuadrant = (index: number): { x: number; y: number; w: number; h: number } => {
  const halfW = (ROOM_RIGHT - ROOM_LEFT) / 2
  const halfH = (ROOM_BOTTOM - ROOM_TOP) / 2
  const col = index % 2
  const row = index < 2 ? 0 : 1
  return { x: ROOM_LEFT + col * halfW, y: ROOM_TOP + row * halfH, w: halfW, h: halfH }
}

const fireIdol = (boss: Boss, player: Player, context: EnemyContext): void => {
  if (boss.activeAttack === 0) {
    // Flood the telegraphed quadrant(s) with overlapping short-lived fields.
    const floodQuadrant = (index: number): void => {
      const quad = idolQuadrant(index)
      for (let column = 0; column < 4; column += 1) {
        for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
          context.spawnField(quad.x + (column + 0.5) * (quad.w / 4), quad.y + (rowIndex + 0.5) * (quad.h / 3), 38, 60)
        }
      }
    }
    floodQuadrant(boss.mode)
    if (boss.phase === 2) floodQuadrant((boss.mode + 2) % 4)
  } else {
    // Sweeping beam — a dense fan; a second opposite arm in phase 2.
    const base = Math.atan2(boss.facingY, boss.facingX)
    const count = 7
    for (let index = 0; index < count; index += 1) {
      const angle = base + (index - (count - 1) / 2) * 0.16
      context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, Math.cos(angle) * 170, Math.sin(angle) * 170, 1)
      if (boss.phase === 2) {
        context.spawnEnemyProjectile(boss.transform.x, boss.transform.y, -Math.cos(angle) * 170, -Math.sin(angle) * 170, 1)
      }
    }
    void player
  }
  boss.activeAttack = -1
}

// ─── CURRENT-SERPENT — moving body, head weakpoint ───

const updateSerpent = (boss: Boss, player: Player, context: EnemyContext, deltaSeconds: number): void => {
  boss.moveTimer -= 1
  if (boss.moveTimer <= 0) {
    // Patrol to a point on the far side of the room, in a curve.
    boss.targetX = ROOM_LEFT + 60 + Math.random() * (ROOM_RIGHT - ROOM_LEFT - 120)
    boss.targetY = ROOM_TOP + 60 + Math.random() * (ROOM_BOTTOM - ROOM_TOP - 120)
    boss.moveTimer = 70
  }
  const speed = boss.phase === 2 ? 190 : 140
  stepToTarget(boss, speed, deltaSeconds)

  // Body segments follow the head at a fixed spacing.
  const spacing = boss.body.radius * 1.1
  let leadX = boss.transform.x
  let leadY = boss.transform.y
  for (const segment of boss.segments) {
    const dx = leadX - segment.x
    const dy = leadY - segment.y
    const distance = Math.hypot(dx, dy) || 1
    const pull = Math.max(0, distance - spacing)
    segment.x += (dx / distance) * pull
    segment.y += (dy / distance) * pull
    leadX = segment.x
    leadY = segment.y
  }

  // Bite-spit: the maw flares (windup telegraph), then fires an aimed fan.
  if (boss.windupTicks > 0) {
    boss.windupTicks -= 1
    if (boss.windupTicks === 0) fireFan(boss, player, context, boss.phase === 2 ? 5 : 3, 0.26, 200)
    return
  }
  boss.attackTimer -= 1
  if (boss.attackTimer <= 0) {
    beginWindup(boss, 0, 18)
    boss.attackTimer = boss.phase === 2 ? 54 : 84
  }
}

// ─── RENDER (dispatch) ───

export const renderBoss = (renderer: Renderer, boss: Boss, interpolation: number): void => {
  const x = lerp(boss.transform.previousX, boss.transform.x, interpolation)
  const y = lerp(boss.transform.previousY, boss.transform.y, interpolation)
  const base = boss.phase === 2 ? COLOR.bossHot : COLOR.bossBody
  const flashing = boss.hitFlashTicks > 0
  const fill = flashing ? COLOR.flash : base

  renderTelegraph(renderer, boss, x, y)

  switch (boss.type) {
    case "serpent":
      renderSerpent(renderer, boss, x, y, fill, base)
      break
    case "idol":
      renderIdol(renderer, boss, x, y, fill, base)
      break
    default:
      renderBlobBoss(renderer, boss, x, y, fill, base)
      break
  }

  renderBossHealthBar(renderer, boss)
}

// Per-attack windup telegraphs — all in `--danger` so "it's about to hurt" reads.
const renderTelegraph = (renderer: Renderer, boss: Boss, x: number, y: number): void => {
  const context = renderer.context
  const charging = boss.windupTicks > 0
  const intensity = charging ? 1 - boss.windupTicks / boss.windupMax : 0

  if ((boss.type === "tidewarden" && boss.mode === 1) || (boss.type === "chargerlord" && boss.mode === 1)) {
    // Dash line.
    context.strokeStyle = rgba(COLOR.danger, 0.4 + intensity * 0.4)
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + boss.facingX * 320, y + boss.facingY * 320)
    context.stroke()
  }
  if (boss.type === "tidewarden" && boss.mode === 4 && charging) {
    renderer.strokeCircle(x, y, boss.body.radius + 10 + intensity * 30, rgba(COLOR.danger, 0.5), 3)
  }
  if (boss.type === "idol" && boss.activeAttack === 0 && charging) {
    const quad = idolQuadrant(boss.mode)
    context.fillStyle = rgba(COLOR.danger, 0.1 + intensity * 0.14)
    context.fillRect(quad.x, quad.y, quad.w, quad.h)
    context.strokeStyle = rgba(COLOR.danger, 0.5)
    context.lineWidth = 2
    context.strokeRect(quad.x + 2, quad.y + 2, quad.w - 4, quad.h - 4)
  }
  if (boss.type === "idol" && boss.activeAttack === 1 && charging) {
    context.strokeStyle = rgba(COLOR.danger, 0.4 + intensity * 0.4)
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + boss.facingX * 400, y + boss.facingY * 400)
    context.stroke()
  }
  if ((boss.type === "lantern" || boss.type === "broodmother") && charging) {
    renderer.additive(() => renderer.glowCircle(x, y, boss.body.radius + intensity * 12, COLOR.danger, 14 * intensity))
  }
}

const renderBlobBoss = (renderer: Renderer, boss: Boss, x: number, y: number, fill: string, base: string): void => {
  const context = renderer.context
  const pulse = 0.5 + Math.sin(boss.spinAngle * 2) * 0.5
  renderer.additive(() => renderer.glowCircle(x, y, boss.body.radius + 4, base, 22 + pulse * 10))
  drawSpines(context, x, y, boss.body.radius + 8, boss.phase === 2 ? 12 : 8, boss.spinAngle, rgba(base, 0.5))
  if (boss.phase === 2) drawSpines(context, x, y, boss.body.radius + 16, 12, -boss.spinAngle * 1.4, rgba(COLOR.danger, 0.55))
  renderer.fillCircle(x, y, boss.body.radius, fill)
  renderer.strokeCircle(x, y, boss.body.radius, shade(base, -0.4), 3)
  if (boss.hitFlashTicks <= 0) drawEyes(renderer, x, y)
}

const renderIdol = (renderer: Renderer, boss: Boss, x: number, y: number, fill: string, base: string): void => {
  const context = renderer.context
  const r = boss.body.radius
  renderer.additive(() => renderer.glowCircle(x, y, r + 3, base, 16))
  // A built, angular idol (register "gebautes").
  context.save()
  context.translate(x, y)
  context.rotate(Math.PI / 4)
  renderer.fillRect(-r, -r, r * 2, r * 2, shade(COLOR.bgStone, 0.05))
  context.strokeStyle = shade(base, -0.2)
  context.lineWidth = 3
  context.strokeRect(-r, -r, r * 2, r * 2)
  context.restore()
  // Glowing carved eyes.
  renderer.fillCircle(x - 10, y - 4, 5, boss.hitFlashTicks > 0 ? COLOR.flash : COLOR.danger)
  renderer.fillCircle(x + 10, y - 4, 5, boss.hitFlashTicks > 0 ? COLOR.flash : COLOR.danger)
  void fill
}

const renderSerpent = (renderer: Renderer, boss: Boss, x: number, y: number, fill: string, base: string): void => {
  // Segments back-to-front so the head sits on top.
  for (let index = boss.segments.length - 1; index >= 0; index -= 1) {
    const segment = boss.segments[index]
    const radius = boss.body.radius * (0.85 - index * 0.05)
    renderer.additive(() => renderer.glowCircle(segment.x, segment.y, radius, base, 8))
    renderer.fillCircle(segment.x, segment.y, radius, shade(base, -0.1))
    renderer.strokeCircle(segment.x, segment.y, radius, shade(base, -0.4), 2)
  }
  renderer.additive(() => renderer.glowCircle(x, y, boss.body.radius + 3, base, 16))
  renderer.fillCircle(x, y, boss.body.radius, fill)
  renderer.strokeCircle(x, y, boss.body.radius, shade(base, -0.4), 3)
  // Danger maw + eyes on the head; the maw flares while the bite winds up.
  if (boss.windupTicks > 0) {
    renderer.additive(() => renderer.glowCircle(x, y + boss.body.radius * 0.3, 8, COLOR.danger, 14))
  }
  renderer.fillCircle(x, y + boss.body.radius * 0.3, 4, COLOR.danger)
  if (boss.hitFlashTicks <= 0) drawEyes(renderer, x, y - 3)
}

const drawEyes = (renderer: Renderer, x: number, y: number): void => {
  renderer.fillCircle(x - 11, y - 6, 5, COLOR.flash)
  renderer.fillCircle(x + 11, y - 6, 5, COLOR.flash)
  renderer.fillCircle(x - 11, y - 6, 2.5, COLOR.ink)
  renderer.fillCircle(x + 11, y - 6, 2.5, COLOR.ink)
}

const drawSpines = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  count: number,
  angle: number,
  color: string,
): void => {
  context.strokeStyle = color
  context.lineWidth = 3
  context.lineCap = "round"
  for (let index = 0; index < count; index += 1) {
    const spineAngle = angle + (index / count) * Math.PI * 2
    const cos = Math.cos(spineAngle)
    const sin = Math.sin(spineAngle)
    context.beginPath()
    context.moveTo(x + cos * radius, y + sin * radius)
    context.lineTo(x + cos * (radius + 8), y + sin * (radius + 8))
    context.stroke()
  }
}

const renderBossHealthBar = (renderer: Renderer, boss: Boss): void => {
  const width = ROOM_RIGHT - ROOM_LEFT - 120
  const x = ROOM_LEFT + 60
  const y = ROOM_BOTTOM - 22
  const fraction = Math.max(0, boss.health / boss.maxHealth)
  renderer.fillRect(x - 2, y - 2, width + 4, 14, COLOR.ink)
  renderer.fillRect(x, y, width, 10, shade(COLOR.bgStone, 0.05))
  const fillColor = boss.phase === 2 ? COLOR.danger : COLOR.bossBody
  renderer.fillRect(x, y, width * fraction, 10, fillColor)
  renderer.additive(() => renderer.fillRect(x, y, width * fraction, 3, shade(fillColor, 0.4)))
}
