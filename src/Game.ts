import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { Run } from "./Run"
import { renderPauseMenu } from "./ui/PauseMenu"
import { ROOM_LEFT, ROOM_CENTER_X, ROOM_CENTER_Y, ROOM_INNER_WIDTH } from "./constants"

// ─── GAME ───
// The scene manager. It owns the renderer and input and switches between the
// title screen, an active run, and the game-over screen. All in-run logic lives
// in Run; death drops the run and returns here.

type Scene = "title" | "playing" | "gameover"

export class Game {
  private readonly renderer: Renderer
  private readonly input: Input
  private scene: Scene = "title"
  private run: Run | null = null
  private paused = false

  constructor(renderer: Renderer, input: Input) {
    this.renderer = renderer
    this.input = input
  }

  update(deltaSeconds: number): void {
    switch (this.scene) {
      case "title":
        if (this.startPressed()) this.startRun()
        break
      case "playing":
        this.updatePlaying(deltaSeconds)
        break
      case "gameover":
        if (this.startPressed()) this.scene = "title"
        break
    }
    this.input.endTick()
  }

  private updatePlaying(deltaSeconds: number): void {
    const run = this.run
    if (!run) return
    if (this.input.wasJustPressed("Escape") || this.input.wasJustPressed("KeyP")) {
      this.paused = !this.paused
    }
    if (this.paused) return
    run.update(this.input, deltaSeconds)
    if (run.playerDead) this.scene = "gameover"
  }

  private startPressed(): boolean {
    return this.input.wasJustPressed("Space") || this.input.wasJustPressed("Enter")
  }

  private startRun(): void {
    this.run = new Run()
    this.scene = "playing"
    this.paused = false
  }

  // ─── RENDER ───

  render(interpolation: number): void {
    switch (this.scene) {
      case "title":
        this.renderTitle()
        break
      case "playing":
        this.run?.render(this.renderer, interpolation)
        if (this.paused && this.run) renderPauseMenu(this.renderer, this.run.player, this.run.level)
        break
      case "gameover":
        this.run?.render(this.renderer, interpolation)
        this.renderCenterBanner("Gestorben", "Leertaste  ·  zurück zum Menü")
        break
    }
  }

  private renderTitle(): void {
    const context = this.renderer.context
    this.renderer.clear("#0e0b0a")

    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#f0e6cf"
    context.font = "bold 54px monospace"
    context.fillText("HOLLOWDEEP", ROOM_CENTER_X, ROOM_CENTER_Y - 40)

    context.fillStyle = "#b9ab9a"
    context.font = "16px monospace"
    context.fillText("Ein Twin-Stick-Roguelike", ROOM_CENTER_X, ROOM_CENTER_Y + 6)
    context.fillStyle = "#8c8079"
    context.font = "14px monospace"
    context.fillText("Leertaste / Enter  ·  Run starten", ROOM_CENTER_X, ROOM_CENTER_Y + 44)
    context.fillText("WASD bewegen  ·  Pfeiltasten schiessen", ROOM_CENTER_X, ROOM_CENTER_Y + 68)
    context.fillText("E Bombe  ·  Esc/P Pause", ROOM_CENTER_X, ROOM_CENTER_Y + 90)
    context.textAlign = "left"
  }

  private renderCenterBanner(title: string, subtitle: string): void {
    const context = this.renderer.context
    context.fillStyle = "rgba(12, 10, 9, 0.66)"
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

  // Exposes the active run for the dev/test harness (see main.ts).
  get activeRun(): Run | null {
    return this.run
  }

  get sceneName(): Scene {
    return this.scene
  }
}
