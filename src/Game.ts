import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { Run } from "./Run"
import { renderPauseMenu } from "./ui/PauseMenu"
import { renderVignette } from "./ui/postfx"
import { FONT_TITLE, FONT_UI } from "./ui/fonts"
import { COLOR, shade, rgba } from "./theme"
import {
  ROOM_LEFT,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_INNER_WIDTH,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "./constants"

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
    const renderer = this.renderer

    // Abyssal backdrop with a light welling up from the deep.
    renderer.clear(COLOR.bgAbyss)
    const glow = context.createRadialGradient(
      ROOM_CENTER_X,
      VIEW_HEIGHT,
      40,
      ROOM_CENTER_X,
      VIEW_HEIGHT,
      VIEW_HEIGHT,
    )
    glow.addColorStop(0, rgba(COLOR.bio, 0.14))
    glow.addColorStop(1, rgba(COLOR.bio, 0))
    context.fillStyle = glow
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

    context.textAlign = "center"
    context.textBaseline = "middle"
    renderer.additive(() => {
      context.shadowColor = COLOR.playerGlow
      context.shadowBlur = 26
      context.fillStyle = COLOR.playerCore
      context.font = `700 56px ${FONT_TITLE}`
      context.fillText("HOLLOWDEEP", ROOM_CENTER_X, ROOM_CENTER_Y - 44)
      context.shadowBlur = 0
    })

    context.fillStyle = COLOR.bio
    context.font = `400 15px ${FONT_UI}`
    context.fillText("DER ERTRUNKENE TEMPEL", ROOM_CENTER_X, ROOM_CENTER_Y + 4)

    context.fillStyle = shade(COLOR.bgMist, 0.35)
    context.font = `400 13px ${FONT_UI}`
    context.fillText("LEERTASTE / ENTER  ·  RUN STARTEN", ROOM_CENTER_X, ROOM_CENTER_Y + 44)
    context.fillStyle = shade(COLOR.bgMist, 0.2)
    context.fillText("WASD BEWEGEN   ·   PFEILTASTEN SCHIESSEN", ROOM_CENTER_X, ROOM_CENTER_Y + 68)
    context.fillText("E BOMBE   ·   ESC / P PAUSE", ROOM_CENTER_X, ROOM_CENTER_Y + 88)
    context.textAlign = "left"

    renderVignette(renderer)
  }

  private renderCenterBanner(title: string, subtitle: string): void {
    const context = this.renderer.context
    context.fillStyle = rgba(COLOR.bgAbyss, 0.68)
    context.fillRect(ROOM_LEFT, ROOM_CENTER_Y - 52, ROOM_INNER_WIDTH, 104)

    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = COLOR.playerCore
    context.font = `700 32px ${FONT_TITLE}`
    context.fillText(title, ROOM_CENTER_X, ROOM_CENTER_Y - 10)
    context.fillStyle = shade(COLOR.bgMist, 0.35)
    context.font = `400 14px ${FONT_UI}`
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
