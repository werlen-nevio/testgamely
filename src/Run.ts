import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { SpatialGrid } from "./core/SpatialGrid"
import { circlesOverlap } from "./core/collision"
import { approach, lerp, clamp } from "./core/math"
import { Camera } from "./core/Camera"
import { TRAUMA, HITSTOP, HURT, CAMERA, HIT_KNOCKBACK } from "./feel"
import { COLOR, shade, rgba } from "./theme"
import { itemColor } from "./items/Item"
import {
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_RIGHT,
  ROOM_BOTTOM,
  DOOR_HALF_SPAN,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  TILE,
  TICKS_PER_SECOND,
  FLOOR_COLUMNS,
  tileCenterX,
  tileCenterY,
} from "./constants"
import {
  createPlayer,
  updatePlayer,
  renderPlayer,
  damagePlayer,
  recomputePlayerStats,
  type Player,
} from "./entities/Player"
import {
  createEnemy,
  createSplitter,
  updateEnemy,
  renderEnemy,
  damageEnemy,
  canSplit,
  tickPoison,
  applyPoison,
  applyChill,
  enemyColor,
  isChargerExposed,
  SENTINEL_SHIELD_ARC,
  type Enemy,
  type EnemyContext,
} from "./entities/Enemy"
import {
  createBoss,
  updateBoss,
  renderBoss,
  damageBoss,
  bossContactsPlayer,
  type Boss,
} from "./entities/Boss"
import {
  ProjectilePool,
  copyShotModifiers,
  type Projectile,
  type ProjectileSpawn,
} from "./entities/Projectile"
import {
  createObstacle,
  resolveCircleAgainstObstacles,
  pointHitsObstacle,
} from "./entities/Obstacle"
import { createPickup, updatePickup, renderPickup, type Pickup, type PickupType } from "./entities/Pickup"
import { ParticlePool } from "./entities/Particle"
import { generateFloor, type Floor, type RoomNode, type ShopEntry } from "./world/Floor"
import { pickTemplate } from "./world/RoomTemplates"
import { DIRECTIONS, DIRECTION_DELTA, OPPOSITE_DIRECTION, type Direction } from "./world/directions"
import { renderRoom } from "./world/Room"
import { renderHud } from "./ui/HUD"
import { renderMinimap } from "./ui/Minimap"
import { Grain, renderVignette } from "./ui/postfx"
import { FONT_UI } from "./ui/fonts"
import { itemById, randomItemId } from "./items/registry"
import type { Item, RunApi } from "./items/Item"

// ─── RUN ───
// A single playthrough. Owns the player, the current floor, the combat loop and
// the item hooks. Implements RunApi so item hooks can spawn shots, heal, etc.
// without importing the Run class.

const PROJECTILE_CAPACITY = 512
const COLLISION_CELL_SIZE = 48
const BROAD_PHASE_PADDING = 32
const SHOT_IMPULSE_CARRY = 0.2
const SHOT_RADIUS = 6
const TRANSITION_TICKS = 12
const DOOR_ENTRY_INSET = TILE * 0.8
const HOMING_RESPONSE = 0.09
const PEDESTAL_RADIUS = 18
const TRAPDOOR_RADIUS = 22
const PICKUP_TOAST_TICKS = 150
const BOMB_FUSE_TICKS = 90
const BOMB_RADIUS = 82
const BOMB_DAMAGE = 40
const SHOP_SLOT_OFFSET = 150

interface ActiveBomb {
  x: number
  y: number
  fuseTicks: number
}

// Floor hazards spawned by enemies: a lingering "field" (weaver trail) that
// slows and stings, or a one-shot "burst" (diver slam).
interface Hazard {
  kind: "field" | "burst"
  x: number
  y: number
  radius: number
  ticks: number
  maxTicks: number
  damage: number
  hitPlayer: boolean
}

const FIELD_SLOW_SCALE = 0.55

export class Run implements RunApi {
  readonly player: Player
  floor: Floor
  currentRoom: RoomNode
  level = 1
  coins = 0
  bombs = 1
  keys = 1
  enemies: Enemy[] = []
  boss: Boss | null = null
  pickups: Pickup[] = []
  readonly projectiles = new ProjectilePool(PROJECTILE_CAPACITY)
  readonly particles = new ParticlePool(320)
  transitionTicks = 0
  playerDead = false

  private readonly grid = new SpatialGrid(VIEW_WIDTH, VIEW_HEIGHT, COLLISION_CELL_SIZE)
  // Reused each tick so enemies can shoot / read obstacles without allocation.
  private readonly enemyContext: EnemyContext = {
    obstacles: [],
    enemies: [],
    spawnEnemyProjectile: (x, y, velocityX, velocityY, damage) =>
      this.spawnEnemyProjectile(x, y, velocityX, velocityY, damage),
    spawnField: (x, y, radius, ticks) => this.spawnField(x, y, radius, ticks),
    spawnBurst: (x, y, radius, damage) => this.spawnBurst(x, y, radius, damage),
    spawnEnemy: (type, x, y) => {
      if (this.enemies.length < 40) this.enemies.push(createEnemy(type, x, y))
    },
  }
  private readonly hazards: Hazard[] = []
  // Projectiles spawned during the shot currently being fired, so extra shots
  // inherit the primary's final flags.
  private readonly shotBuffer: Projectile[] = []
  private readonly activeBombs: ActiveBomb[] = []
  readonly camera = new Camera()
  private readonly grain = new Grain()
  private hitstopTicks = 0
  private slowmoTicks = 0
  private slowmoPhase = 0
  private hurtPulseTicks = 0
  private grainPhase = 0
  private shieldCharges = 0
  private trapdoorArmTicks = 0
  private pickupToastText = ""
  private pickupToastTicks = 0

  constructor() {
    this.player = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y)
    this.floor = generateFloor(this.level)
    this.currentRoom = this.floor.rooms.get(this.floor.startIndex) as RoomNode
    this.enterRoom(this.currentRoom, null)
  }

  // ─── UPDATE ───

  update(input: Input, deltaSeconds: number): void {
    // Camera advances every frame — even while the sim is frozen — so shake and
    // follow stay smooth through hit-stop.
    const aim = input.aimVector()
    const followX = (this.player.transform.x - ROOM_CENTER_X) * 0.06 + aim.x * CAMERA.lookAhead
    const followY = (this.player.transform.y - ROOM_CENTER_Y) * 0.06 + aim.y * CAMERA.lookAhead
    this.camera.update(deltaSeconds, followX, followY)

    if (this.pickupToastTicks > 0) this.pickupToastTicks -= 1
    if (this.hurtPulseTicks > 0) this.hurtPulseTicks -= 1

    if (this.transitionTicks > 0) {
      this.transitionTicks -= 1
      return
    }

    // Hit-stop: a few frames of total freeze so a heavy blow lands.
    if (this.hitstopTicks > 0) {
      this.hitstopTicks -= 1
      return
    }

    // Slow-motion (after a player hit): advance the sim only every Nth tick.
    if (this.slowmoTicks > 0) {
      this.slowmoTicks -= 1
      this.slowmoPhase = (this.slowmoPhase + 1) % HURT.slowmoEvery
      if (this.slowmoPhase !== 0) return
    }

    // Standing in a weaver's hazard field slows the player.
    const speedScale = this.playerInField() ? FIELD_SLOW_SCALE : 1
    updatePlayer(this.player, input, deltaSeconds, speedScale)
    resolveCircleAgainstObstacles(this.player.transform, this.player.body.radius, this.currentRoom.obstacles)
    this.handleShooting(input)
    if (input.wasJustPressed("KeyE")) this.placeBomb()
    this.handleActiveItem(input, deltaSeconds)

    // Footstep dust when moving with some pace.
    const speed = Math.hypot(this.player.transform.velocityX, this.player.transform.velocityY)
    if (speed > 120 && this.player.animTicks % 6 === 0) {
      this.particles.dust(
        this.player.transform.x,
        this.player.transform.y + this.player.body.radius * 0.6,
        this.player.transform.velocityX,
        this.player.transform.velocityY,
        shade(COLOR.bgMist, 0.2),
      )
    }

    // Shields are recomputed every tick; wardens re-apply them below.
    for (const enemy of this.enemies) enemy.shielded = false

    this.enemyContext.obstacles = this.currentRoom.obstacles
    this.enemyContext.enemies = this.enemies
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      updateEnemy(enemy, this.player, this.enemyContext, deltaSeconds)
      // The bouncer resolves its own reflection; intangible divers pass through.
      if (enemy.type !== "bouncer" && !enemy.intangible) {
        resolveCircleAgainstObstacles(enemy.transform, enemy.body.radius, this.currentRoom.obstacles)
      }
      if (tickPoison(enemy)) this.killEnemy(enemy)
    }
    if (this.boss) updateBoss(this.boss, this.player, this.enemyContext, deltaSeconds)

    this.steerHomingShots()
    this.steerBoomerangShots()
    this.projectiles.update(deltaSeconds)
    this.particles.update(deltaSeconds)
    this.updateBombs()
    this.updateHazards()
    this.updatePickups(deltaSeconds)
    this.resolveProjectilesHittingObstacles()
    this.resolvePlayerShotsHittingEnemies()
    this.resolvePlayerShotsHittingBoss()
    this.resolveEnemiesTouchingPlayer()
    this.resolveEnemyShotsHittingPlayer()
    this.compactEnemies()

    // Boss rooms clear on the boss's death (handled there); every other room
    // clears when the last enemy falls.
    if (this.currentRoom.kind !== "boss" && !this.currentRoom.cleared && this.enemies.length === 0) {
      this.currentRoom.cleared = true
      this.runRoomClearHooks()
      this.dropRoomClearReward()
      this.celebrateRoomClear()
      this.chargeActiveOnRoomClear()
    }

    this.handleItemPedestal()
    this.handleShop()

    if (this.player.stats.hearts <= 0) {
      this.playerDead = true
      return
    }

    this.handleTrapdoor()
    if (this.currentRoom.cleared) this.tryRoomTransition()
  }

  // ─── RUN API (used by item hooks) ───

  spawnShot(spawn: ProjectileSpawn): Projectile | null {
    const projectile = this.projectiles.spawn(spawn)
    if (projectile) this.shotBuffer.push(projectile)
    return projectile
  }

  spawnProjectile(spawn: ProjectileSpawn): Projectile | null {
    return this.projectiles.spawn(spawn)
  }

  private spawnEnemyProjectile(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    damage: number,
  ): void {
    this.projectiles.spawn({
      faction: "enemy",
      x,
      y,
      velocityX,
      velocityY,
      radius: 7,
      damage,
      lifeTicks: 200,
    })
  }

  heal(hearts: number): void {
    const stats = this.player.stats
    stats.hearts = Math.min(stats.maxHearts, stats.hearts + hearts)
  }

  addCoins(amount: number): void {
    this.coins += amount
  }

  nearestEnemyTo(x: number, y: number): Enemy | null {
    let best: Enemy | null = null
    let bestDistance = Infinity
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const distance = (enemy.transform.x - x) ** 2 + (enemy.transform.y - y) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        best = enemy
      }
    }
    return best
  }

  spawnPickupDrop(x: number, y: number): void {
    this.pickups.push(createPickup("coin", x, y))
  }

  damageAllEnemies(amount: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      if (damageEnemy(enemy, amount)) this.killEnemy(enemy)
    }
    if (this.boss && damageBoss(this.boss, amount)) this.defeatBoss()
  }

  // Item-facing: adds camera trauma (0..1). Screenshake scales with trauma².
  shake(amount: number): void {
    this.camera.addTrauma(amount)
  }

  // Charges the active item over time (if it trickles) and fires it on Space.
  private handleActiveItem(input: Input, deltaSeconds: number): void {
    const player = this.player
    const item = player.activeItem
    if (!item || !item.active) return
    if (item.active.chargeSeconds && player.activeCharge < 1) {
      player.activeCharge = Math.min(1, player.activeCharge + deltaSeconds / item.active.chargeSeconds)
    }
    if (input.wasJustPressed("Space") && player.activeCharge >= 1) {
      item.onActivate?.({ run: this, player })
      player.activeCharge = 0
    }
  }

  // Room-based active items gain a fraction of a charge per cleared room.
  private chargeActiveOnRoomClear(): void {
    const item = this.player.activeItem
    if (!item || !item.active || !item.active.chargeRooms) return
    this.player.activeCharge = Math.min(1, this.player.activeCharge + 1 / item.active.chargeRooms)
  }

  // ─── ACTIVE-ITEM VERBS ───

  nova(damage: number): void {
    this.particles.shockwave(this.player.transform.x, this.player.transform.y, 260, COLOR.playerGlow)
    this.camera.addTrauma(TRAUMA.explosion)
    this.damageAllEnemies(damage)
    this.clearEnemyShots()
  }

  pullEnemies(strength: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const dx = this.player.transform.x - enemy.transform.x
      const dy = this.player.transform.y - enemy.transform.y
      const distance = Math.hypot(dx, dy) || 1
      enemy.transform.velocityX += (dx / distance) * strength
      enemy.transform.velocityY += (dy / distance) * strength
    }
  }

  blink(distance: number): void {
    const transform = this.player.transform
    transform.x = clamp(transform.x + this.player.facingX * distance, ROOM_LEFT + this.player.body.radius, ROOM_RIGHT - this.player.body.radius)
    transform.y = clamp(transform.y + this.player.facingY * distance, ROOM_TOP + this.player.body.radius, ROOM_BOTTOM - this.player.body.radius)
    transform.previousX = transform.x
    transform.previousY = transform.y
    this.player.invulnerableTicks = Math.max(this.player.invulnerableTicks, 24)
    this.particles.burst(transform.x, transform.y, 10, COLOR.bio, 140, 18)
  }

  grantShield(): void {
    this.shieldCharges = 1
  }

  slowTime(ticks: number): void {
    for (const enemy of this.enemies) if (enemy.active) applyChill(enemy, ticks)
    for (const projectile of this.projectiles.items) {
      if (projectile.active && projectile.faction === "enemy") {
        projectile.transform.velocityX *= 0.4
        projectile.transform.velocityY *= 0.4
      }
    }
  }

  clearEnemyShots(): void {
    for (const projectile of this.projectiles.items) {
      if (projectile.active && projectile.faction === "enemy") projectile.active = false
    }
  }

  // ─── SHOOTING & ITEM HOOKS ───

  private handleShooting(input: Input): void {
    const player = this.player
    if (player.shootCooldownTicks > 0) return

    const aim = input.aimVector()
    if (aim.x === 0 && aim.y === 0) return

    const stats = player.stats
    const transform = player.transform
    const muzzleDistance = player.body.radius + 4

    this.shotBuffer.length = 0
    const primary = this.projectiles.spawn({
      faction: "player",
      x: transform.x + aim.x * muzzleDistance,
      y: transform.y + aim.y * muzzleDistance,
      velocityX: aim.x * stats.shotSpeed + transform.velocityX * SHOT_IMPULSE_CARRY,
      velocityY: aim.y * stats.shotSpeed + transform.velocityY * SHOT_IMPULSE_CARRY,
      radius: SHOT_RADIUS,
      damage: stats.damage,
      lifeTicks: Math.round((stats.range / stats.shotSpeed) * TICKS_PER_SECOND),
    })
    player.shootCooldownTicks = Math.max(1, Math.round(TICKS_PER_SECOND / stats.fireRate))
    if (!primary) return

    // Muzzle flash + a touch of trauma so every shot has a small kick.
    this.particles.burst(primary.transform.x, primary.transform.y, 3, COLOR.bio, 70, 8)
    this.camera.addTrauma(TRAUMA.shoot)

    this.shotBuffer.push(primary)
    for (const item of player.items) {
      item.onShoot?.({ run: this, player, projectile: primary, aimX: aim.x, aimY: aim.y })
    }

    // Give every extra shot the primary's final modifiers, so item order never
    // decides which shots pierce / home / bounce.
    for (const shot of this.shotBuffer) {
      if (shot !== primary) copyShotModifiers(primary, shot)
    }
  }

  private steerHomingShots(): void {
    for (const projectile of this.projectiles.items) {
      if (!projectile.active || projectile.faction !== "player" || !projectile.flags.homing) continue
      const target = this.nearestEnemyTo(projectile.transform.x, projectile.transform.y)
      if (!target) continue

      const deltaX = target.transform.x - projectile.transform.x
      const deltaY = target.transform.y - projectile.transform.y
      const distance = Math.hypot(deltaX, deltaY)
      if (distance < 1) continue

      const speed = Math.hypot(projectile.transform.velocityX, projectile.transform.velocityY)
      let steeredX = approach(projectile.transform.velocityX, (deltaX / distance) * speed, HOMING_RESPONSE)
      let steeredY = approach(projectile.transform.velocityY, (deltaY / distance) * speed, HOMING_RESPONSE)
      const steeredSpeed = Math.hypot(steeredX, steeredY) || 1
      // Renormalise so homing turns the shot without changing its speed.
      steeredX = (steeredX / steeredSpeed) * speed
      steeredY = (steeredY / steeredSpeed) * speed
      projectile.transform.velocityX = steeredX
      projectile.transform.velocityY = steeredY
    }
  }

  // Boomerang shots curve back toward the player — they accelerate homeward, so
  // they slow, stop, and return (hitting twice with piercing).
  private steerBoomerangShots(): void {
    const player = this.player
    for (const projectile of this.projectiles.items) {
      if (!projectile.active || projectile.faction !== "player" || !projectile.flags.boomerang) continue
      const deltaX = player.transform.x - projectile.transform.x
      const deltaY = player.transform.y - projectile.transform.y
      const distance = Math.hypot(deltaX, deltaY) || 1
      projectile.transform.velocityX += (deltaX / distance) * 26
      projectile.transform.velocityY += (deltaY / distance) * 26
    }
  }

  // Chain lightning: arc a diminished hit to the nearest *other* enemy.
  private chainTo(fromEnemy: Enemy, damage: number): void {
    let best: Enemy | null = null
    let bestDistance = 160 * 160
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy === fromEnemy || enemy.shielded || enemy.intangible) continue
      const distanceSquared =
        (enemy.transform.x - fromEnemy.transform.x) ** 2 + (enemy.transform.y - fromEnemy.transform.y) ** 2
      if (distanceSquared < bestDistance) {
        bestDistance = distanceSquared
        best = enemy
      }
    }
    if (!best) return
    this.particles.burst(best.transform.x, best.transform.y, 4, COLOR.bio, 90, 10)
    if (damageEnemy(best, damage)) this.killEnemy(best)
  }

  // Fork burst: a killing fork shot sprays fragments outward.
  private spawnForkFragments(x: number, y: number, damage: number): void {
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2 + 0.4
      this.projectiles.spawn({
        faction: "player",
        x,
        y,
        velocityX: Math.cos(angle) * 280,
        velocityY: Math.sin(angle) * 280,
        radius: 4,
        damage,
        lifeTicks: 24,
      })
    }
  }

  // ─── COLLISION ───

  private resolveProjectilesHittingObstacles(): void {
    const obstacles = this.currentRoom.obstacles
    if (obstacles.length === 0) return
    for (const projectile of this.projectiles.items) {
      if (!projectile.active) continue
      if (!pointHitsObstacle(projectile.transform.x, projectile.transform.y, obstacles)) continue
      if (projectile.flags.explosive) {
        this.explodeAt(projectile.transform.x, projectile.transform.y, projectile.damage * 2 + 8, 62)
      }
      projectile.active = false
    }
  }

  private resolvePlayerShotsHittingEnemies(): void {
    this.grid.clear()
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index]
      if (enemy.active) this.grid.insert(index, enemy.transform.x, enemy.transform.y)
    }

    for (const projectile of this.projectiles.items) {
      if (!projectile.active || projectile.faction !== "player") continue

      const found = this.grid.query(
        projectile.transform.x,
        projectile.transform.y,
        projectile.radius + BROAD_PHASE_PADDING,
      )
      for (let resultIndex = 0; resultIndex < found; resultIndex += 1) {
        const enemy = this.enemies[this.grid.result[resultIndex]]
        if (!enemy.active) continue
        // The diver is intangible mid-dive — shots pass clean through it.
        if (enemy.intangible) continue
        if (
          !circlesOverlap(
            projectile.transform.x,
            projectile.transform.y,
            projectile.radius,
            enemy.transform.x,
            enemy.transform.y,
            enemy.body.radius,
          )
        ) {
          continue
        }

        // A warden shield or a sentinel's front arc deflects the shot — no
        // damage. The shot is spent (unless piercing) and sparks off the shield.
        if (this.shotDeflected(enemy, projectile.transform.x, projectile.transform.y)) {
          this.particles.impact(
            projectile.transform.x,
            projectile.transform.y,
            projectile.transform.velocityX,
            projectile.transform.velocityY,
            COLOR.bio,
          )
          if (projectile.pierceRemaining > 0) {
            projectile.pierceRemaining -= 1
            continue
          }
          projectile.active = false
          break
        }

        // Chargers are wide open during their post-dash recovery.
        const damage = isChargerExposed(enemy) ? projectile.damage * 1.5 : projectile.damage
        const died = damageEnemy(enemy, damage)
        if (projectile.flags.poison) applyPoison(enemy, 90)
        if (projectile.flags.chill) applyChill(enemy, 100)
        if (projectile.flags.chain && projectile.chainRemaining > 0) {
          this.chainTo(enemy, projectile.damage * 0.6)
          projectile.chainRemaining -= 1
        }
        this.knockback(enemy, projectile.transform.velocityX, projectile.transform.velocityY)
        this.particles.impact(
          projectile.transform.x,
          projectile.transform.y,
          projectile.transform.velocityX,
          projectile.transform.velocityY,
          COLOR.bio,
        )
        this.camera.addTrauma(TRAUMA.enemyHit)
        this.runHitHooks(projectile, enemy)
        if (died) {
          if (projectile.flags.fork) this.spawnForkFragments(enemy.transform.x, enemy.transform.y, projectile.damage * 0.5)
          this.killEnemy(enemy)
        }

        if (projectile.flags.explosive) {
          this.explodeAt(projectile.transform.x, projectile.transform.y, projectile.damage * 2 + 8, 62)
          projectile.active = false
          break
        }
        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1
          continue
        }
        projectile.active = false
        break
      }
    }
  }

  // True if a shot arriving at (x,y) is blocked: a warden-shielded enemy is
  // immune everywhere; a sentinel only blocks from within its front arc.
  private shotDeflected(enemy: Enemy, x: number, y: number): boolean {
    if (enemy.shielded) return true
    if (enemy.type !== "sentinel") return false
    const toShotX = x - enemy.transform.x
    const toShotY = y - enemy.transform.y
    const distance = Math.hypot(toShotX, toShotY) || 1
    const dot = (toShotX / distance) * enemy.facingX + (toShotY / distance) * enemy.facingY
    return dot >= Math.cos(SENTINEL_SHIELD_ARC)
  }

  // Nudges an enemy along a hit direction so a shot visibly connects.
  private knockback(enemy: Enemy, velocityX: number, velocityY: number): void {
    const speed = Math.hypot(velocityX, velocityY) || 1
    enemy.transform.x += (velocityX / speed) * HIT_KNOCKBACK
    enemy.transform.y += (velocityY / speed) * HIT_KNOCKBACK
  }

  // Shared enemy-death path (projectile, poison, explosion, thorns all funnel
  // here) so effects, splitting and drops stay consistent.
  private killEnemy(enemy: Enemy): void {
    enemy.active = false
    this.particles.burst(enemy.transform.x, enemy.transform.y, 14, enemyColor(enemy), 130, 24)
    this.camera.addTrauma(TRAUMA.enemyKill)
    this.hitstopTicks = Math.max(this.hitstopTicks, HITSTOP.kill)
    this.runKillHooks(enemy)
    if (canSplit(enemy)) {
      this.splitEnemy(enemy)
    } else if (Math.random() < 0.12) {
      this.pickups.push(createPickup("coin", enemy.transform.x, enemy.transform.y))
    }
  }

  private resolvePlayerShotsHittingBoss(): void {
    const boss = this.boss
    if (!boss) return
    for (const projectile of this.projectiles.items) {
      if (!projectile.active || projectile.faction !== "player") continue
      if (
        !circlesOverlap(
          projectile.transform.x,
          projectile.transform.y,
          projectile.radius,
          boss.transform.x,
          boss.transform.y,
          boss.body.radius,
        )
      ) {
        continue
      }
      const phaseBefore = boss.phase
      const died = damageBoss(boss, projectile.damage)
      this.particles.impact(
        projectile.transform.x,
        projectile.transform.y,
        projectile.transform.velocityX,
        projectile.transform.velocityY,
        COLOR.bio,
      )
      this.camera.addTrauma(TRAUMA.enemyHit)
      if (boss.phase !== phaseBefore) this.onBossPhaseChange()
      if (died) {
        this.defeatBoss()
        return
      }
      if (projectile.flags.explosive) {
        this.explodeAt(projectile.transform.x, projectile.transform.y, projectile.damage * 2 + 8, 62)
        projectile.active = false
        continue
      }
      if (projectile.pierceRemaining > 0) {
        projectile.pierceRemaining -= 1
        continue
      }
      projectile.active = false
    }
  }

  private resolveEnemiesTouchingPlayer(): void {
    const player = this.player
    if (player.invulnerableTicks > 0) return

    const boss = this.boss
    if (boss && bossContactsPlayer(boss, player.transform.x, player.transform.y, player.body.radius)) {
      this.hurtPlayer(boss.contactDamage)
      return
    }

    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.intangible) continue
      if (
        circlesOverlap(
          player.transform.x,
          player.transform.y,
          player.body.radius,
          enemy.transform.x,
          enemy.transform.y,
          enemy.body.radius,
        )
      ) {
        this.hurtPlayer(enemy.contactDamage)
        return
      }
    }
  }

  private resolveEnemyShotsHittingPlayer(): void {
    const player = this.player
    if (player.invulnerableTicks > 0) return
    for (const projectile of this.projectiles.items) {
      if (!projectile.active || projectile.faction !== "enemy") continue
      if (
        circlesOverlap(
          projectile.transform.x,
          projectile.transform.y,
          projectile.radius,
          player.transform.x,
          player.transform.y,
          player.body.radius,
        )
      ) {
        projectile.active = false
        this.hurtPlayer(projectile.damage)
        return
      }
    }
  }

  private hurtPlayer(amount: number): void {
    const player = this.player
    if (player.invulnerableTicks > 0) return
    // A shield absorbs the hit entirely (no damage, brief i-frames + flash).
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1
      player.invulnerableTicks = 30
      this.particles.burst(player.transform.x, player.transform.y, 12, COLOR.bio, 150, 20)
      this.camera.addTrauma(0.2)
      return
    }
    const wasInvulnerable = player.invulnerableTicks > 0
    damagePlayer(player, amount)
    if (wasInvulnerable) return
    // The full hit reaction: trauma, a freeze, a beat of slow-mo and a red pulse.
    this.camera.addTrauma(TRAUMA.playerHit)
    this.hitstopTicks = Math.max(this.hitstopTicks, HITSTOP.playerHit)
    this.slowmoTicks = HURT.slowmoTicks
    this.slowmoPhase = 0
    this.hurtPulseTicks = HURT.pulseTicks
    this.particles.burst(player.transform.x, player.transform.y, 10, COLOR.hurt, 150, 20)
    for (const item of player.items) {
      item.onDamageTaken?.({ run: this, player, amount })
    }
  }

  private splitEnemy(parent: Enemy): void {
    const nextGeneration = parent.generation + 1
    for (const offset of [-18, 18]) {
      const child = createSplitter(
        parent.transform.x + offset,
        parent.transform.y,
        nextGeneration,
      )
      child.transform.velocityX = offset * 3
      this.enemies.push(child)
    }
  }

  private runHitHooks(projectile: Projectile, enemy: Enemy): void {
    for (const item of this.player.items) {
      item.onHit?.({ run: this, player: this.player, projectile, enemy })
    }
  }

  private runKillHooks(enemy: Enemy): void {
    for (const item of this.player.items) {
      item.onKill?.({ run: this, player: this.player, enemy, x: enemy.transform.x, y: enemy.transform.y })
    }
  }

  private runRoomClearHooks(): void {
    for (const item of this.player.items) {
      item.onRoomClear?.({ run: this, player: this.player })
    }
  }

  private compactEnemies(): void {
    let writeIndex = 0
    for (let readIndex = 0; readIndex < this.enemies.length; readIndex += 1) {
      const enemy = this.enemies[readIndex]
      if (!enemy.active) continue
      this.enemies[writeIndex] = enemy
      writeIndex += 1
    }
    this.enemies.length = writeIndex
  }

  // ─── BOMBS & EXPLOSIONS ───

  private placeBomb(): void {
    if (this.bombs <= 0) return
    this.bombs -= 1
    this.activeBombs.push({
      x: this.player.transform.x,
      y: this.player.transform.y,
      fuseTicks: BOMB_FUSE_TICKS,
    })
  }

  private updateBombs(): void {
    for (let index = this.activeBombs.length - 1; index >= 0; index -= 1) {
      const bomb = this.activeBombs[index]
      bomb.fuseTicks -= 1
      if (bomb.fuseTicks > 0) continue
      this.explodeAt(bomb.x, bomb.y, BOMB_DAMAGE, BOMB_RADIUS)
      this.activeBombs.splice(index, 1)
    }
  }

  // ─── HAZARDS (enemy fields & slams) ───

  private spawnField(x: number, y: number, radius: number, ticks: number): void {
    this.hazards.push({ kind: "field", x, y, radius, ticks, maxTicks: ticks, damage: 1, hitPlayer: false })
  }

  private spawnBurst(x: number, y: number, radius: number, damage: number): void {
    this.hazards.push({ kind: "burst", x, y, radius, ticks: 14, maxTicks: 14, damage, hitPlayer: false })
    this.particles.shockwave(x, y, radius, COLOR.danger)
  }

  private playerInField(): boolean {
    const player = this.player
    for (const hazard of this.hazards) {
      if (hazard.kind !== "field") continue
      if (circlesOverlap(hazard.x, hazard.y, hazard.radius, player.transform.x, player.transform.y, player.body.radius)) {
        return true
      }
    }
    return false
  }

  private updateHazards(): void {
    const player = this.player
    let writeIndex = 0
    for (let readIndex = 0; readIndex < this.hazards.length; readIndex += 1) {
      const hazard = this.hazards[readIndex]
      hazard.ticks -= 1

      const touching = circlesOverlap(
        hazard.x,
        hazard.y,
        hazard.radius,
        player.transform.x,
        player.transform.y,
        player.body.radius,
      )
      // Fields sting on contact (i-frames pace it); bursts hit once.
      if (touching && !hazard.hitPlayer && player.invulnerableTicks === 0) {
        this.hurtPlayer(hazard.damage)
        if (hazard.kind === "burst") hazard.hitPlayer = true
      }

      if (hazard.ticks > 0) {
        this.hazards[writeIndex] = hazard
        writeIndex += 1
      }
    }
    this.hazards.length = writeIndex
  }

  private explodeAt(x: number, y: number, damage: number, radius: number): void {
    this.particles.burst(x, y, 26, COLOR.playerGlow, 240, 26)
    this.particles.burst(x, y, 14, COLOR.danger, 200, 20)
    this.particles.shockwave(x, y, radius, COLOR.playerGlow)
    this.camera.addTrauma(TRAUMA.explosion)
    this.hitstopTicks = Math.max(this.hitstopTicks, HITSTOP.heavyKill)

    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      if (circlesOverlap(x, y, radius, enemy.transform.x, enemy.transform.y, enemy.body.radius)) {
        if (damageEnemy(enemy, damage)) this.killEnemy(enemy)
      }
    }
    if (
      this.boss &&
      circlesOverlap(x, y, radius, this.boss.transform.x, this.boss.transform.y, this.boss.body.radius)
    ) {
      if (damageBoss(this.boss, damage)) this.defeatBoss()
    }

    // Blast open the reachable player if standing on it.
    if (circlesOverlap(x, y, radius, this.player.transform.x, this.player.transform.y, this.player.body.radius)) {
      this.hurtPlayer(1)
    }

    for (const obstacle of this.currentRoom.obstacles) {
      if (obstacle.destroyed || !obstacle.destructible) continue
      if (circlesOverlap(x, y, radius, obstacle.centerX, obstacle.centerY, 4)) {
        obstacle.destroyed = true
        this.particles.burst(obstacle.centerX, obstacle.centerY, 8, COLOR.bgMist, 120, 20)
        if (Math.random() < 0.35) this.pickups.push(createPickup("coin", obstacle.centerX, obstacle.centerY))
      }
    }

    this.tryRevealSecret(x, y)
  }

  // A blast near a wall that borders a hidden room opens the passage.
  private tryRevealSecret(x: number, y: number): void {
    const room = this.currentRoom
    for (const direction of DIRECTIONS) {
      if (room.doors[direction]) continue
      const nx = room.gridX + DIRECTION_DELTA[direction].x
      const ny = room.gridY + DIRECTION_DELTA[direction].y
      const neighbor = this.floor.rooms.get(ny * FLOOR_COLUMNS + nx)
      if (!neighbor || neighbor.kind !== "secret" || neighbor.revealed) continue
      if (!this.blastNearWall(direction, x, y)) continue
      room.doors[direction] = true
      room.doorCount += 1
      neighbor.revealed = true
      this.camera.addTrauma(0.28)
      this.particles.burst(x, y, 16, COLOR.bio, 160, 24)
      return
    }
  }

  private blastNearWall(direction: Direction, x: number, y: number): boolean {
    const nearEdge = 70
    const nearCentre = TILE * 2
    switch (direction) {
      case "north":
        return y - ROOM_TOP < nearEdge && Math.abs(x - ROOM_CENTER_X) < nearCentre
      case "south":
        return ROOM_BOTTOM - y < nearEdge && Math.abs(x - ROOM_CENTER_X) < nearCentre
      case "east":
        return ROOM_RIGHT - x < nearEdge && Math.abs(y - ROOM_CENTER_Y) < nearCentre
      case "west":
        return x - ROOM_LEFT < nearEdge && Math.abs(y - ROOM_CENTER_Y) < nearCentre
    }
  }

  // ─── PICKUPS ───

  private updatePickups(deltaSeconds: number): void {
    let writeIndex = 0
    for (let readIndex = 0; readIndex < this.pickups.length; readIndex += 1) {
      const pickup = this.pickups[readIndex]
      if (!pickup.active) continue
      updatePickup(pickup, this.player, deltaSeconds)
      if (
        circlesOverlap(
          pickup.transform.x,
          pickup.transform.y,
          pickup.radius,
          this.player.transform.x,
          this.player.transform.y,
          this.player.body.radius,
        )
      ) {
        this.collectPickup(pickup.type)
        continue
      }
      this.pickups[writeIndex] = pickup
      writeIndex += 1
    }
    this.pickups.length = writeIndex
  }

  private collectPickup(type: PickupType): void {
    switch (type) {
      case "heart":
        this.heal(1)
        this.particles.burst(this.player.transform.x, this.player.transform.y, 6, COLOR.playerGlow, 90, 16)
        break
      case "coin":
        this.coins += 1
        break
      case "bomb":
        this.bombs += 1
        break
      case "key":
        this.keys += 1
        break
    }
  }

  private dropRoomClearReward(): void {
    const roll = Math.random()
    const luckBonus = this.player.stats.luck * 0.01
    if (roll < 0.12 + luckBonus) {
      this.pickups.push(createPickup("heart", ROOM_CENTER_X, ROOM_CENTER_Y))
    } else if (roll < 0.5 + luckBonus) {
      const count = 1 + Math.floor(Math.random() * 2)
      for (let index = 0; index < count; index += 1) {
        this.pickups.push(createPickup("coin", ROOM_CENTER_X + (index - 0.5) * 26, ROOM_CENTER_Y))
      }
    } else if (roll < 0.58) {
      this.pickups.push(createPickup("bomb", ROOM_CENTER_X, ROOM_CENTER_Y))
    } else if (roll < 0.64) {
      this.pickups.push(createPickup("key", ROOM_CENTER_X, ROOM_CENTER_Y))
    }
  }

  // The room-cleared beat: a soft zoom-pulse and a bio bloom at each opening
  // door so the doors "unlock" with a flourish.
  private celebrateRoomClear(): void {
    this.camera.addTrauma(TRAUMA.roomClear)
    this.camera.pulseZoom(CAMERA.zoomPulse)
    const doorPoints: Record<Direction, [number, number]> = {
      north: [ROOM_CENTER_X, ROOM_TOP],
      south: [ROOM_CENTER_X, ROOM_BOTTOM],
      east: [ROOM_RIGHT, ROOM_CENTER_Y],
      west: [ROOM_LEFT, ROOM_CENTER_Y],
    }
    for (const direction of DIRECTIONS) {
      if (!this.currentRoom.doors[direction]) continue
      const [x, y] = doorPoints[direction]
      this.particles.burst(x, y, 10, COLOR.bio, 130, 22)
    }
  }

  // ─── SHOP ───

  private handleShop(): void {
    const stock = this.currentRoom.shopStock
    if (!stock) return
    const player = this.player
    for (const entry of stock) {
      if (entry.taken || this.coins < entry.price) continue
      if (
        !circlesOverlap(
          player.transform.x,
          player.transform.y,
          player.body.radius,
          entry.slotX,
          ROOM_CENTER_Y,
          PEDESTAL_RADIUS,
        )
      ) {
        continue
      }
      this.coins -= entry.price
      entry.taken = true
      this.buyShopEntry(entry)
    }
  }

  private buyShopEntry(entry: ShopEntry): void {
    if (entry.kind === "item" && entry.itemId) {
      const item = itemById(entry.itemId)
      if (item) this.grantItem(item)
      return
    }
    if (entry.kind === "heart") {
      this.heal(1)
      return
    }
    if (entry.kind === "bomb") {
      this.bombs += 1
    }
  }

  // ─── ITEMS ───

  // Pedestals sit centre in item rooms; in boss rooms the reward sits above the
  // trapdoor so the two don't overlap.
  private pedestalY(): number {
    return this.currentRoom.kind === "boss" ? ROOM_CENTER_Y - 84 : ROOM_CENTER_Y
  }

  private handleItemPedestal(): void {
    const room = this.currentRoom
    if (!room.pedestalItemId || room.pedestalTaken) return
    const player = this.player
    if (
      circlesOverlap(
        player.transform.x,
        player.transform.y,
        player.body.radius,
        ROOM_CENTER_X,
        this.pedestalY(),
        PEDESTAL_RADIUS,
      )
    ) {
      const item = itemById(room.pedestalItemId)
      if (item) this.grantItem(item)
      room.pedestalTaken = true
    }
  }

  private grantItem(item: Item): void {
    if (item.tag === "active") {
      // Active items live in a single slot, not the passive stack.
      this.player.activeItem = item
      this.player.activeCharge = 0
    } else {
      this.player.items.push(item)
      recomputePlayerStats(this.player)
    }
    item.onPickup?.({ run: this, player: this.player })
    this.pickupToastText = item.name
    this.pickupToastTicks = PICKUP_TOAST_TICKS
  }

  // ─── ROOMS ───

  private tryRoomTransition(): void {
    const transform = this.player.transform
    const radius = this.player.body.radius
    for (const direction of DIRECTIONS) {
      if (!this.currentRoom.doors[direction]) continue
      if (this.playerAtDoor(direction, transform.x, transform.y, radius)) {
        this.changeRoom(direction)
        return
      }
    }
  }

  private playerAtDoor(direction: Direction, x: number, y: number, radius: number): boolean {
    const threshold = 4
    switch (direction) {
      case "north":
        return y <= ROOM_TOP + radius + threshold && Math.abs(x - ROOM_CENTER_X) <= DOOR_HALF_SPAN
      case "south":
        return y >= ROOM_BOTTOM - radius - threshold && Math.abs(x - ROOM_CENTER_X) <= DOOR_HALF_SPAN
      case "east":
        return x >= ROOM_RIGHT - radius - threshold && Math.abs(y - ROOM_CENTER_Y) <= DOOR_HALF_SPAN
      case "west":
        return x <= ROOM_LEFT + radius + threshold && Math.abs(y - ROOM_CENTER_Y) <= DOOR_HALF_SPAN
    }
  }

  private changeRoom(travelDirection: Direction): void {
    const nextX = this.currentRoom.gridX + DIRECTION_DELTA[travelDirection].x
    const nextY = this.currentRoom.gridY + DIRECTION_DELTA[travelDirection].y
    const neighbor = this.floor.rooms.get(nextY * FLOOR_COLUMNS + nextX)
    if (!neighbor) return
    this.enterRoom(neighbor, OPPOSITE_DIRECTION[travelDirection])
    this.transitionTicks = TRANSITION_TICKS
  }

  private enterRoom(node: RoomNode, entrySide: Direction | null): void {
    node.visited = true
    this.currentRoom = node
    this.enemies = []
    this.boss = null
    this.pickups = []
    this.activeBombs.length = 0
    this.hazards.length = 0
    this.trapdoorArmTicks = 0
    this.projectiles.deactivateAll()

    if (!node.instantiated) {
      node.instantiated = true
      if (node.kind === "normal") {
        const template = pickTemplate(node.doorCount)
        node.obstacles = template.obstacles.map(([col, row]) => createObstacle(col, row))
        for (const spawn of template.enemies) {
          this.enemies.push(createEnemy(spawn.type, tileCenterX(spawn.col), tileCenterY(spawn.row)))
        }
      } else if (node.kind === "item") {
        node.pedestalItemId = randomItemId("treasure", this.heldItemIds(), this.player.stats.luck)
      } else if (node.kind === "boss") {
        this.boss = createBoss(this.level)
      } else if (node.kind === "shop") {
        node.shopStock = this.buildShopStock()
      } else if (node.kind === "secret") {
        this.stockSecretRoom()
      }
      // Every room but the boss room clears the moment it holds no enemies.
      if (node.kind !== "boss" && this.enemies.length === 0) node.cleared = true
    }

    this.placePlayerAtEntry(entrySide)
  }

  private buildShopStock(): ShopEntry[] {
    const held = this.heldItemIds()
    const luck = this.player.stats.luck
    const first = randomItemId("shop", held, luck)
    return [
      { kind: "item", itemId: first, price: 15, taken: false, slotX: ROOM_CENTER_X - SHOP_SLOT_OFFSET },
      { kind: "item", itemId: randomItemId("shop", [...held, first], luck), price: 15, taken: false, slotX: ROOM_CENTER_X },
      { kind: "heart", itemId: null, price: 5, taken: false, slotX: ROOM_CENTER_X + SHOP_SLOT_OFFSET },
    ]
  }

  private stockSecretRoom(): void {
    this.pickups.push(createPickup("heart", ROOM_CENTER_X, ROOM_CENTER_Y - 24))
    for (let index = 0; index < 3; index += 1) {
      this.pickups.push(createPickup("coin", ROOM_CENTER_X + (index - 1) * 34, ROOM_CENTER_Y + 24))
    }
  }

  // ─── BOSS / FLOOR PROGRESSION ───

  private onBossPhaseChange(): void {
    const boss = this.boss
    if (!boss) return
    this.camera.addTrauma(TRAUMA.bossPhase)
    this.hitstopTicks = Math.max(this.hitstopTicks, HITSTOP.bossPhase)
    this.particles.burst(boss.transform.x, boss.transform.y, 22, COLOR.bossHot, 180, 26)
  }

  private defeatBoss(): void {
    const boss = this.boss
    this.boss = null
    this.currentRoom.cleared = true
    this.trapdoorArmTicks = 45 // brief beat before the exit is walkable
    this.camera.addTrauma(TRAUMA.bossDeath)
    this.camera.pulseZoom(0.06)
    this.hitstopTicks = Math.max(this.hitstopTicks, HITSTOP.bossDeath)
    if (boss) {
      this.particles.burst(boss.transform.x, boss.transform.y, 40, COLOR.bossHot, 300, 34)
      this.particles.shockwave(boss.transform.x, boss.transform.y, 120, COLOR.bossHot)
    }
    // Boss reward: an item from the boss pool, offered on a pedestal.
    this.currentRoom.pedestalItemId = randomItemId("boss", this.heldItemIds(), this.player.stats.luck)
    this.currentRoom.pedestalTaken = false
    this.runRoomClearHooks()
    this.chargeActiveOnRoomClear()
  }

  private heldItemIds(): string[] {
    const ids = this.player.items.map((item) => item.id)
    if (this.player.activeItem) ids.push(this.player.activeItem.id)
    return ids
  }

  private handleTrapdoor(): void {
    if (this.currentRoom.kind !== "boss" || !this.currentRoom.cleared) return
    if (this.trapdoorArmTicks > 0) {
      this.trapdoorArmTicks -= 1
      return
    }
    const player = this.player
    if (
      circlesOverlap(
        player.transform.x,
        player.transform.y,
        player.body.radius,
        ROOM_CENTER_X,
        ROOM_CENTER_Y,
        TRAPDOOR_RADIUS,
      )
    ) {
      this.descendToNextFloor()
    }
  }

  private descendToNextFloor(): void {
    this.level += 1
    this.floor = generateFloor(this.level)
    this.currentRoom = this.floor.rooms.get(this.floor.startIndex) as RoomNode
    this.enterRoom(this.currentRoom, null)
    this.transitionTicks = TRANSITION_TICKS * 2
  }

  private placePlayerAtEntry(entrySide: Direction | null): void {
    const transform = this.player.transform
    transform.velocityX = 0
    transform.velocityY = 0

    if (!entrySide) {
      transform.x = ROOM_CENTER_X
      transform.y = ROOM_CENTER_Y
    } else if (entrySide === "north") {
      transform.x = ROOM_CENTER_X
      transform.y = ROOM_TOP + this.player.body.radius + DOOR_ENTRY_INSET
    } else if (entrySide === "south") {
      transform.x = ROOM_CENTER_X
      transform.y = ROOM_BOTTOM - this.player.body.radius - DOOR_ENTRY_INSET
    } else if (entrySide === "east") {
      transform.x = ROOM_RIGHT - this.player.body.radius - DOOR_ENTRY_INSET
      transform.y = ROOM_CENTER_Y
    } else {
      transform.x = ROOM_LEFT + this.player.body.radius + DOOR_ENTRY_INSET
      transform.y = ROOM_CENTER_Y
    }
    transform.previousX = transform.x
    transform.previousY = transform.y
  }

  // ─── RENDER ───

  render(renderer: Renderer, interpolation: number): void {
    const context = renderer.context
    renderer.clear(COLOR.bgAbyss)

    // ─── WORLD (moves with the camera) ───
    this.camera.begin(context)

    renderRoom(renderer, this.currentRoom, this.floor)
    this.renderHazards(renderer)
    if (this.currentRoom.pedestalItemId && !this.currentRoom.pedestalTaken) this.renderPedestal(renderer)
    if (this.currentRoom.kind === "shop") this.renderShop(renderer)
    if (this.currentRoom.kind === "boss" && this.currentRoom.cleared) this.renderTrapdoor(renderer)
    for (const pickup of this.pickups) {
      if (pickup.active) renderPickup(renderer, pickup, interpolation)
    }
    this.renderBombs(renderer)
    for (const enemy of this.enemies) {
      if (enemy.active) renderEnemy(renderer, enemy, interpolation)
    }
    if (this.boss) renderBoss(renderer, this.boss, interpolation)
    this.projectiles.render(renderer, interpolation)

    // The player is the light in the room: darken everything away from them,
    // then draw the player and particles on top at full brightness.
    this.renderPlayerLight(renderer, interpolation)
    renderPlayer(renderer, this.player, interpolation)
    this.particles.render(renderer, interpolation)

    this.camera.end(context)

    // ─── SCREEN-SPACE OVERLAYS (never shaken) ───
    renderVignette(renderer)
    this.grain.render(renderer, (this.grainPhase % 5) * 7, ((this.grainPhase * 3) % 5) * 7)
    this.grainPhase += 1

    renderHud(renderer, this.player, {
      coins: this.coins,
      bombs: this.bombs,
      keys: this.keys,
      shield: this.shieldCharges > 0,
    })
    renderMinimap(renderer, this.floor, this.currentRoom.index)
    this.renderFloorLabel(renderer)
    if (this.pickupToastTicks > 0) this.renderPickupToast(renderer)
    if (this.hurtPulseTicks > 0) this.renderHurtPulse(renderer)
    if (this.transitionTicks > 0) this.renderTransitionFade(renderer)
  }

  // A soft radial that keeps the player's surroundings lit and lets the room
  // fall into darkness at the edges — the core of the abyssal mood.
  private renderPlayerLight(renderer: Renderer, interpolation: number): void {
    const x = lerp(this.player.transform.previousX, this.player.transform.x, interpolation)
    const y = lerp(this.player.transform.previousY, this.player.transform.y, interpolation)
    const context = renderer.context
    const gradient = context.createRadialGradient(x, y, 60, x, y, 340)
    gradient.addColorStop(0, rgba(COLOR.ink, 0))
    gradient.addColorStop(1, rgba(COLOR.ink, 0.55))
    context.fillStyle = gradient
    context.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_RIGHT - ROOM_LEFT, ROOM_BOTTOM - ROOM_TOP)
  }

  private renderHurtPulse(renderer: Renderer): void {
    const alpha = (this.hurtPulseTicks / HURT.pulseTicks) * HURT.pulseAlpha
    renderer.context.fillStyle = rgba(COLOR.hurt, alpha)
    renderer.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  private renderHazards(renderer: Renderer): void {
    const context = renderer.context
    for (const hazard of this.hazards) {
      const life = hazard.ticks / hazard.maxTicks
      if (hazard.kind === "field") {
        // A lingering danger pool — translucent fill + pulsing rim.
        const fade = Math.min(1, life * 2)
        context.fillStyle = rgba(COLOR.danger, 0.14 * fade)
        renderer.fillCircle(hazard.x, hazard.y, hazard.radius, rgba(COLOR.danger, 0.12 * fade))
        renderer.strokeCircle(hazard.x, hazard.y, hazard.radius, rgba(COLOR.danger, 0.4 * fade), 2)
      } else {
        // A slam flash, brightest at impact.
        renderer.additive(() =>
          renderer.glowCircle(hazard.x, hazard.y, hazard.radius * (1.1 - life), COLOR.danger, 16),
        )
      }
    }
  }

  private renderBombs(renderer: Renderer): void {
    for (const bomb of this.activeBombs) {
      // Flash toward the danger colour faster as the fuse burns down.
      const blink = bomb.fuseTicks % 12 < 6 || bomb.fuseTicks < 20
      renderer.fillCircle(bomb.x, bomb.y, 10, shade(COLOR.bgStone, 0.1))
      if (blink) renderer.glowCircle(bomb.x, bomb.y, 5, COLOR.danger, 14)
      renderer.strokeCircle(bomb.x, bomb.y, 10, COLOR.ink, 2)
    }
  }

  // A glowing pedestal chip — item rooms, shops and boss rewards share the look.
  private renderChip(renderer: Renderer, x: number, centerY: number, color: string, glyph: string, bob: number): void {
    const context = renderer.context
    renderer.fillRect(x - 16, centerY + 10, 32, 9, shade(COLOR.bgStone, 0.05))
    renderer.additive(() => renderer.glowCircle(x, centerY - 4 + bob, PEDESTAL_RADIUS + 3, color, 18))
    renderer.fillCircle(x, centerY - 4 + bob, PEDESTAL_RADIUS, color)
    renderer.strokeCircle(x, centerY - 4 + bob, PEDESTAL_RADIUS, COLOR.ink, 2)
    context.fillStyle = COLOR.ink
    context.font = `700 15px ${FONT_UI}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(glyph, x, centerY - 3 + bob)
    context.textAlign = "left"
  }

  private renderShop(renderer: Renderer): void {
    const stock = this.currentRoom.shopStock
    if (!stock) return
    const context = renderer.context
    const bob = Math.sin(this.grainPhase * 0.06) * 2
    for (const entry of stock) {
      if (entry.taken) continue
      const item = entry.kind === "item" && entry.itemId ? itemById(entry.itemId) : undefined
      const color = item ? itemColor(item) : entry.kind === "heart" ? COLOR.playerGlow : COLOR.bio
      const glyph = item ? item.glyph : entry.kind === "heart" ? "+" : "B"
      this.renderChip(renderer, entry.slotX, ROOM_CENTER_Y, color, glyph, bob)
      context.fillStyle = COLOR.playerGlow
      context.font = `700 13px ${FONT_UI}`
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(`${entry.price}`, entry.slotX, ROOM_CENTER_Y + 32)
      context.textAlign = "left"
    }
  }

  private renderPedestal(renderer: Renderer): void {
    const room = this.currentRoom
    if (room.pedestalTaken || !room.pedestalItemId) return
    const item = itemById(room.pedestalItemId)
    if (!item) return
    const bob = Math.sin(this.grainPhase * 0.06) * 2.5
    this.renderChip(renderer, ROOM_CENTER_X, this.pedestalY(), itemColor(item), item.glyph, bob)
  }

  private renderFloorLabel(renderer: Renderer): void {
    const context = renderer.context
    context.font = `400 12px ${FONT_UI}`
    context.textBaseline = "bottom"
    context.textAlign = "left"
    context.fillStyle = shade(COLOR.bgMist, 0.3)
    context.fillText(`EBENE ${this.level}`, 16, VIEW_HEIGHT - 14)
  }

  private renderTrapdoor(renderer: Renderer): void {
    const context = renderer.context
    const pulse = 0.5 + Math.sin(this.grainPhase * 0.08) * 0.5
    renderer.additive(() =>
      renderer.glowCircle(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS + 6, COLOR.bio, 12 + pulse * 12),
    )
    renderer.fillCircle(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS + 4, COLOR.ink)
    renderer.fillCircle(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS, shade(COLOR.bgDeep, 0.1))
    context.strokeStyle = COLOR.bio
    context.lineWidth = 2
    context.beginPath()
    context.arc(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS, 0, Math.PI * 2)
    context.stroke()
  }

  private renderPickupToast(renderer: Renderer): void {
    const context = renderer.context
    const alpha = Math.min(1, this.pickupToastTicks / 30)
    context.globalAlpha = alpha
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = COLOR.playerCore
    context.font = `700 18px ${FONT_UI}`
    context.fillText(this.pickupToastText.toUpperCase(), ROOM_CENTER_X, ROOM_BOTTOM - 30)
    context.globalAlpha = 1
    context.textAlign = "left"
  }

  private renderTransitionFade(renderer: Renderer): void {
    const alpha = (this.transitionTicks / TRANSITION_TICKS) * 0.85
    renderer.context.fillStyle = rgba(COLOR.bgAbyss, alpha)
    renderer.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
}
