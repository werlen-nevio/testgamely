import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { SpatialGrid } from "./core/SpatialGrid"
import { circlesOverlap } from "./core/collision"
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
import { createPlayer, updatePlayer, renderPlayer, damagePlayer, type Player } from "./entities/Player"
import { createEnemy, updateEnemy, renderEnemy, damageEnemy, type Enemy } from "./entities/Enemy"
import { ProjectilePool } from "./entities/Projectile"
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

// ─── RUN ───
// A single playthrough: the player, the current floor, and the room they are
// standing in. Owns the combat loop and the room-to-room transitions. The scene
// manager (Game) creates a Run on start and drops it on death.

const PROJECTILE_CAPACITY = 512
const COLLISION_CELL_SIZE = 48
const BROAD_PHASE_PADDING = 32
const SHOT_IMPULSE_CARRY = 0.2
const SHOT_RADIUS = 6
const TRANSITION_TICKS = 12
const DOOR_ENTRY_INSET = TILE * 0.8

export class Run {
  readonly player: Player
  floor: Floor
  currentRoom: RoomNode
  level = 1
  enemies: Enemy[] = []
  readonly projectiles = new ProjectilePool(PROJECTILE_CAPACITY)
  transitionTicks = 0
  playerDead = false

  private readonly grid = new SpatialGrid(VIEW_WIDTH, VIEW_HEIGHT, COLLISION_CELL_SIZE)

  constructor() {
    this.player = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y)
    this.floor = generateFloor(this.level)
    this.currentRoom = this.floor.rooms.get(this.floor.startIndex) as RoomNode
    this.enterRoom(this.currentRoom, null)
  }

  // ─── UPDATE ───

  update(input: Input, deltaSeconds: number): void {
    if (this.transitionTicks > 0) {
      this.transitionTicks -= 1
      return
    }

    updatePlayer(this.player, input, deltaSeconds)
    resolveCircleAgainstObstacles(this.player.transform, this.player.body.radius, this.currentRoom.obstacles)
    this.handleShooting(input)

    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      updateEnemy(enemy, this.player, deltaSeconds)
      resolveCircleAgainstObstacles(enemy.transform, enemy.body.radius, this.currentRoom.obstacles)
    }

    this.projectiles.update(deltaSeconds)
    this.resolveProjectilesHittingObstacles()
    this.resolvePlayerShotsHittingEnemies()
    this.resolveEnemiesTouchingPlayer()
    this.compactEnemies()

    if (!this.currentRoom.cleared && this.enemies.length === 0) {
      this.currentRoom.cleared = true
    }

    if (this.player.stats.hearts <= 0) {
      this.playerDead = true
      return
    }

    if (this.currentRoom.cleared) this.tryRoomTransition()
  }

  // ─── SHOOTING ───

  private handleShooting(input: Input): void {
    const player = this.player
    if (player.shootCooldownTicks > 0) return

    const aim = input.aimVector()
    if (aim.x === 0 && aim.y === 0) return

    const stats = player.stats
    const transform = player.transform
    const muzzleDistance = player.body.radius + 4

    this.projectiles.spawn({
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
        if (died) enemy.active = false

        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1
          continue
        }
        projectile.active = false
        break
      }
    }
  }

  private resolveEnemiesTouchingPlayer(): void {
    const player = this.player
    if (player.invulnerableTicks > 0) return
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
        damagePlayer(player, enemy.contactDamage)
        return
      }
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

  // entrySide is the door of the new room the player walks in through, or null
  // for the initial room (spawn dead centre).
  private enterRoom(node: RoomNode, entrySide: Direction | null): void {
    node.visited = true
    this.currentRoom = node
    this.enemies = []
    this.projectiles.deactivateAll()

    if (!node.instantiated) {
      node.instantiated = true
      if (node.kind === "normal") {
        const template = pickTemplate(node.doorCount)
        node.obstacles = template.obstacles.map(([col, row]) => createObstacle(col, row))
        for (const spawn of template.enemies) {
          this.enemies.push(createEnemy(spawn.type, tileCenterX(spawn.col), tileCenterY(spawn.row)))
        }
      }
      if (this.enemies.length === 0) node.cleared = true
    }

    this.placePlayerAtEntry(entrySide)
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
    renderRoom(renderer, this.currentRoom)

    for (const enemy of this.enemies) {
      if (enemy.active) renderEnemy(renderer, enemy, interpolation)
    }
    this.projectiles.render(renderer, interpolation)
    renderPlayer(renderer, this.player, interpolation)

    renderHud(renderer, this.player)
    renderMinimap(renderer, this.floor, this.currentRoom.index)

    if (this.transitionTicks > 0) this.renderTransitionFade(renderer)
  }

  private renderTransitionFade(renderer: Renderer): void {
    const alpha = (this.transitionTicks / TRANSITION_TICKS) * 0.8
    renderer.context.fillStyle = `rgba(8, 6, 5, ${alpha})`
    renderer.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
}
