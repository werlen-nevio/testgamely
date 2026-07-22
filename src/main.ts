import "./style.css"
import { Renderer } from "./core/Renderer"
import { Input } from "./core/Input"
import { Loop } from "./core/Loop"
import { Game } from "./Game"
import { generateFloor } from "./world/Floor"

// ─── BOOTSTRAP ───
// Wire the subsystems together and hand the fixed-timestep loop the game's
// update and render entry points.

const canvas = document.querySelector<HTMLCanvasElement>("#game")
if (!canvas) throw new Error("Canvas element #game was not found")

const renderer = new Renderer(canvas)
const input = new Input()
const game = new Game(renderer, input)

const loop = new Loop(
  (deltaSeconds) => game.update(deltaSeconds),
  (interpolation) => game.render(interpolation),
)

loop.start()

// Expose the running game (and a few internals) during development so it can be
// inspected and automated from the console / test harness. Stripped from
// production builds.
if (import.meta.env.DEV) {
  const debugWindow = window as unknown as Record<string, unknown>
  debugWindow.game = game
  debugWindow.generateFloor = generateFloor
}
