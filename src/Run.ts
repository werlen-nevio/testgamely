import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { SpatialGrid } from "./core/SpatialGrid"
import { circlesOverlap } from "./core/collision"
import { approach } from "./core/math"
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
  type Enemy,
  type EnemyContext,
} from "./entities/Enemy"
import { createBoss, updateBoss, renderBoss, damageBoss, type Boss } from "./entities/Boss"
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
import { generateFloor, type Floor, type RoomNode } from "./world/Floor"
import { pickTemplate } from "./world/RoomTemplates"
import { DIRECTIONS, DIRECTION_DELTA, OPPOSITE_DIRECTION, type Direction } from "./world/directions"
import { renderRoom } from "./world/Room"
import { renderHud } from "./ui/HUD"
import { renderMinimap } from "./ui/Minimap"
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

export class Run implements RunApi {
  readonly player: Player
  floor: Floor
  currentRoom: RoomNode
  level = 1
  coins = 0
  enemies: Enemy[] = []
  boss: Boss | null = null
  readonly projectiles = new ProjectilePool(PROJECTILE_CAPACITY)
  transitionTicks = 0
  playerDead = false

  private readonly grid = new SpatialGrid(VIEW_WIDTH, VIEW_HEIGHT, COLLISION_CELL_SIZE)
  // Reused each tick so enemies can shoot / read obstacles without allocation.
  private readonly enemyContext: EnemyContext = {
    obstacles: [],
    spawnEnemyProjectile: (x, y, velocityX, velocityY, damage) =>
      this.spawnEnemyProjectile(x, y, velocityX, velocityY, damage),
  }
  // Projectiles spawned during the shot currently being fired, so extra shots
  // inherit the primary's final flags.
  private readonly shotBuffer: Projectile[] = []
  private shakeStrength = 0
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
    if (this.pickupToastTicks > 0) this.pickupToastTicks -= 1
    if (this.shakeStrength > 0.1) this.shakeStrength *= 0.85
    else this.shakeStrength = 0

    if (this.transitionTicks > 0) {
      this.transitionTicks -= 1
      return
    }

    updatePlayer(this.player, input, deltaSeconds)
    resolveCircleAgainstObstacles(this.player.transform, this.player.body.radius, this.currentRoom.obstacles)
    this.handleShooting(input)

    this.enemyContext.obstacles = this.currentRoom.obstacles
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      updateEnemy(enemy, this.player, this.enemyContext, deltaSeconds)
      // The bouncer resolves its own wall/obstacle reflection; the rest slide.
      if (enemy.type !== "bouncer") {
        resolveCircleAgainstObstacles(enemy.transform, enemy.body.radius, this.currentRoom.obstacles)
      }
    }
    if (this.boss) updateBoss(this.boss, this.player, this.enemyContext, deltaSeconds)

    this.steerHomingShots()
    this.projectiles.update(deltaSeconds)
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
    }

    this.handleItemPedestal()

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

  spawnPickupDrop(_x: number, _y: number): void {
    // Ground pickups arrive in a later stage; the hook exists so item data can
    // already reference it.
  }

  shake(strength: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength)
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

  // ─── COLLISION ───

  private resolveProjectilesHittingObstacles(): void {
    const obstacles = this.currentRoom.obstacles
    if (obstacles.length === 0) return
    for (const projectile of this.projectiles.items) {
      if (!projectile.active) continue
      if (pointHitsObstacle(projectile.transform.x, projectile.transform.y, obstacles)) {
        projectile.active = false
      }
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

        const died = damageEnemy(enemy, projectile.damage)
        this.runHitHooks(projectile, enemy)
        if (died) {
          enemy.active = false
          this.runKillHooks(enemy)
          if (canSplit(enemy)) this.splitEnemy(enemy)
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
      const died = damageBoss(boss, projectile.damage)
      if (died) {
        this.defeatBoss()
        return
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
    if (
      boss &&
      circlesOverlap(
        player.transform.x,
        player.transform.y,
        player.body.radius,
        boss.transform.x,
        boss.transform.y,
        boss.body.radius,
      )
    ) {
      this.hurtPlayer(boss.contactDamage)
      return
    }

    for (const enemy of this.enemies) {
      if (!enemy.active) continue
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
    damagePlayer(player, amount)
    this.shake(6)
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

  // ─── ITEMS ───

  private handleItemPedestal(): void {
    const room = this.currentRoom
    if (room.kind !== "item" || !room.pedestalItemId || room.pedestalTaken) return
    const player = this.player
    if (
      circlesOverlap(
        player.transform.x,
        player.transform.y,
        player.body.radius,
        ROOM_CENTER_X,
        ROOM_CENTER_Y,
        PEDESTAL_RADIUS,
      )
    ) {
      const item = itemById(room.pedestalItemId)
      if (item) this.grantItem(item)
      room.pedestalTaken = true
    }
  }

  private grantItem(item: Item): void {
    this.player.items.push(item)
    item.onPickup?.({ run: this, player: this.player })
    recomputePlayerStats(this.player)
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
        node.pedestalItemId = randomItemId(this.player.items.map((item) => item.id))
      } else if (node.kind === "boss") {
        this.boss = createBoss(this.level)
      }
      // Every room but the boss room clears the moment it holds no enemies.
      if (node.kind !== "boss" && this.enemies.length === 0) node.cleared = true
    }

    this.placePlayerAtEntry(entrySide)
  }

  // ─── BOSS / FLOOR PROGRESSION ───

  private defeatBoss(): void {
    this.boss = null
    this.currentRoom.cleared = true
    this.trapdoorArmTicks = 45 // brief beat before the exit is walkable
    this.shake(16)
    this.runRoomClearHooks()
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

    context.save()
    if (this.shakeStrength > 0) {
      const offsetX = (Math.random() * 2 - 1) * this.shakeStrength
      const offsetY = (Math.random() * 2 - 1) * this.shakeStrength
      context.translate(offsetX, offsetY)
    }

    renderRoom(renderer, this.currentRoom)
    if (this.currentRoom.kind === "item") this.renderPedestal(renderer)
    if (this.currentRoom.kind === "boss" && this.currentRoom.cleared) this.renderTrapdoor(renderer)
    for (const enemy of this.enemies) {
      if (enemy.active) renderEnemy(renderer, enemy, interpolation)
    }
    if (this.boss) renderBoss(renderer, this.boss, interpolation)
    this.projectiles.render(renderer, interpolation)
    renderPlayer(renderer, this.player, interpolation)

    context.restore()

    renderHud(renderer, this.player, this.coins)
    renderMinimap(renderer, this.floor, this.currentRoom.index)
    this.renderFloorLabel(renderer)
    if (this.pickupToastTicks > 0) this.renderPickupToast(renderer)
    if (this.transitionTicks > 0) this.renderTransitionFade(renderer)
  }

  private renderFloorLabel(renderer: Renderer): void {
    const context = renderer.context
    context.font = "13px monospace"
    context.textBaseline = "bottom"
    context.textAlign = "left"
    context.fillStyle = "#8c8079"
    context.fillText(`Ebene ${this.level}`, 14, VIEW_HEIGHT - 12)
  }

  private renderPedestal(renderer: Renderer): void {
    const room = this.currentRoom
    if (room.pedestalTaken || !room.pedestalItemId) return
    const item = itemById(room.pedestalItemId)
    if (!item) return
    const context = renderer.context

    // Base.
    renderer.fillRect(ROOM_CENTER_X - 16, ROOM_CENTER_Y + 8, 32, 10, "#2a2320")
    // Floating item chip.
    renderer.fillCircle(ROOM_CENTER_X, ROOM_CENTER_Y - 4, PEDESTAL_RADIUS, item.color)
    context.lineWidth = 2
    context.strokeStyle = "#1c1512"
    context.stroke()
    context.fillStyle = "#1c1512"
    context.font = "bold 16px monospace"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(item.glyph, ROOM_CENTER_X, ROOM_CENTER_Y - 3)
    context.textAlign = "left"
  }

  private renderTrapdoor(renderer: Renderer): void {
    const context = renderer.context
    renderer.fillCircle(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS + 4, "#0a0807")
    renderer.fillCircle(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS, "#151b24")
    context.strokeStyle = "#3a4658"
    context.lineWidth = 3
    context.beginPath()
    context.arc(ROOM_CENTER_X, ROOM_CENTER_Y, TRAPDOOR_RADIUS, 0, Math.PI * 2)
    context.stroke()
  }

  private renderPickupToast(renderer: Renderer): void {
    const context = renderer.context
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#f0e6cf"
    context.font = "bold 18px monospace"
    context.fillText(this.pickupToastText, ROOM_CENTER_X, ROOM_BOTTOM - 26)
    context.textAlign = "left"
  }

  private renderTransitionFade(renderer: Renderer): void {
    const alpha = (this.transitionTicks / TRANSITION_TICKS) * 0.8
    renderer.context.fillStyle = `rgba(8, 6, 5, ${alpha})`
    renderer.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
}
