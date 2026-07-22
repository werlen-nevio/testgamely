import type { Renderer } from "./core/Renderer"
import type { Input } from "./core/Input"
import { ROOM_CENTER_X, ROOM_CENTER_Y, VIEW_HEIGHT } from "./constants"
import { createPlayer, updatePlayer, renderPlayer, type Player } from "./entities/Player"
import { renderRoom } from "./world/Room"

// ─── GAME ───
// Owns the mutable world state and routes the loop's update/render calls into
// it. Kept separate from main.ts (pure bootstrap) so the game can grow scenes,
// floors and menus without turning the entry point into a dumping ground.

export class Game {
  private readonly renderer: Renderer
  private readonly input: Input
  private readonly player: Player

  constructor(renderer: Renderer, input: Input) {
    this.renderer = renderer
    this.input = input
    this.player = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y)
  }

  update(deltaSeconds: number): void {
    updatePlayer(this.player, this.input, deltaSeconds)
    this.input.endTick()
  }

  render(interpolation: number): void {
    renderRoom(this.renderer)
    renderPlayer(this.renderer, this.player, interpolation)
    this.renderStageHint()
  }

  private renderStageHint(): void {
    const context = this.renderer.context
    context.font = "13px monospace"
    context.textBaseline = "bottom"
    context.textAlign = "left"
    context.fillStyle = "#8c8079"
    context.fillText("Etappe 1  ·  WASD = bewegen", 14, VIEW_HEIGHT - 12)
    context.textAlign = "start"
  }
}
