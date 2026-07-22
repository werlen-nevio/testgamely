import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { SpatialGrid } from "./core/SpatialGrid"
import { circlesOverlap } from "./core/collision"
import {
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_LEFT,
  ROOM_INNER_WIDTH,
  ROOM_INNER_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  TICKS_PER_SECOND,
} from "./constants"
import {
  createPlayer,
  updatePlayer,
  renderPlayer,
  damagePlayer,
  type Player,
} from "./entities/Player"
import {
  createChaser,
  updateEnemy,
  renderEnemy,
  damageEnemy,
  type Enemy,
} from "./entities/Enemy"
import { ProjectilePool } from "./entities/Projectile"
import { renderRoom } from "./world/Room"
import { renderHud } from "./ui/HUD"

// ─── GAME ───
// Owns world state and drives it from the fixed-timestep loop. Stage 2 wires up
// the combat core: firing, one enemy type, spatial-grid collision, enemy death
// and player death. A lightweight state machine handles the game-over and
// wave-cleared moments until real rooms arrive in Stage 3.

type GameState = "playing" | "cleared" | "dead"

const PROJECTILE_CAPACITY = 512
const COLLISION_CELL_SIZE = 48
const BROAD_PHASE_PADDING = 32 // generous enough to cover the largest enemy body
const SHOT_IMPULSE_CARRY = 0.2 // player velocity that bleeds into the shot
const SHOT_RADIUS = 6

export class Game {
  private readonly renderer: Renderer
  private readonly input: Input
  private readonly projectiles = new ProjectilePool(PROJECTILE_CAPACITY)
  private readonly grid = new SpatialGrid(VIEW_WIDTH, VIEW_HEIGHT, COLLISION_CELL_SIZE)

  private player: Player
  private enemies: Enemy[] = []
  private state: GameState = "playing"

  constructor(renderer: Renderer, input: Input) {
    this.renderer = renderer
    this.input = input
    this.player = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y)
    this.spawnWave()
  }

  // ─── UPDATE ───

  update(deltaSeconds: number): void {
    switch (this.state) {
      case "playing":
        this.updatePlaying(deltaSeconds)
        break
      case "cleared":
        if (this.input.wasJustPressed("Space")) this.spawnWave()
        break
      case "dead":
        if (this.input.wasJustPressed("KeyR")) this.restart()
        break
    }
    this.input.endTick()
  }

  private updatePlaying(deltaSeconds: number): void {
    updatePlayer(this.player, this.input, deltaSeconds)
    this.handleShooting()

    for (const enemy of this.enemies) {
      if (enemy.active) updateEnemy(enemy, this.player, deltaSeconds)
    }
    this.projectiles.update(deltaSeconds)

    this.resolvePlayerShotsHittingEnemies()
    this.resolveEnemiesTouchingPlayer()
    this.compactEnemies()

    if (this.player.stats.hearts <= 0) {
      this.state = "dead"
      return
    }
    if (this.enemies.length === 0) this.state = "cleared"
  }

  // ─── SHOOTING ───

  private handleShooting(): void {
    const player = this.player
    if (player.shootCooldownTicks > 0) return

    const aim = this.input.aimVector()
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
        !circlesOverlap(
          player.transform.x,
          player.transform.y,
          player.body.radius,
          enemy.transform.x,
          enemy.transform.y,
          enemy.body.radius,
        )
      ) {
        continue
      }
      damagePlayer(player, enemy.contactDamage)
      return
    }
  }

  // Removes dead enemies in place (swap-free stable compaction, no allocation).
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

  // ─── WAVES / RESET (temporary until rooms exist in Stage 3) ───

  private spawnWave(): void {
    this.enemies = []
    const count = 4
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      const x = ROOM_CENTER_X + Math.cos(angle) * (ROOM_INNER_WIDTH * 0.32)
      const y = ROOM_CENTER_Y + Math.sin(angle) * (ROOM_INNER_HEIGHT * 0.32)
      this.enemies.push(createChaser(x, y))
    }
    this.state = "playing"
  }

  private restart(): void {
    this.player = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y)
    this.projectiles.deactivateAll()
    this.spawnWave()
  }

  // ─── RENDER ───

  render(interpolation: number): void {
    renderRoom(this.renderer)

    for (const enemy of this.enemies) {
      if (enemy.active) renderEnemy(this.renderer, enemy, interpolation)
    }
    this.projectiles.render(this.renderer, interpolation)
    renderPlayer(this.renderer, this.player, interpolation)
    renderHud(this.renderer, this.player)

    this.renderStageHint()
    if (this.state === "cleared") this.renderCenterBanner("Raum sauber", "Leertaste  ·  neue Welle")
    if (this.state === "dead") this.renderCenterBanner("Gestorben", "R  ·  neu starten")
  }

  private renderStageHint(): void {
    const context = this.renderer.context
    context.font = "13px monospace"
    context.textBaseline = "bottom"
    context.textAlign = "left"
    context.fillStyle = "#8c8079"
    context.fillText("Etappe 2  ·  WASD bewegen  ·  Pfeiltasten schiessen", 14, VIEW_HEIGHT - 12)
  }

  private renderCenterBanner(title: string, subtitle: string): void {
    const context = this.renderer.context
    context.fillStyle = "rgba(12, 10, 9, 0.62)"
    context.fillRect(ROOM_LEFT, ROOM_CENTER_Y - 52, ROOM_INNER_WIDTH, 104)

    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#f0e6cf"
    context.font = "bold 30px monospace"
    context.fillText(title, ROOM_CENTER_X, ROOM_CENTER_Y - 10)
    context.fillStyle = "#b9ab9a"
    context.font = "15px monospace"
    context.fillText(subtitle, ROOM_CENTER_X, ROOM_CENTER_Y + 24)
    context.textAlign = "left"
  }
}
