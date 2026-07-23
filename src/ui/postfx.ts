import type { Renderer } from "../core/Renderer"
import { VIEW_WIDTH, VIEW_HEIGHT, ROOM_CENTER_X, ROOM_CENTER_Y } from "../constants"
import { COLOR, rgba } from "../theme"

// ─── POST-PROCESSING ───
// Screen-space finishing passes drawn on top of the world (never shaken by the
// camera): a vignette that pulls the edges into the abyss, and a fine animated
// film grain for texture. Both are pure mood, no gameplay meaning.

let vignette: CanvasGradient | null = null

export const renderVignette = (renderer: Renderer): void => {
  const context = renderer.context
  if (!vignette) {
    vignette = context.createRadialGradient(
      ROOM_CENTER_X,
      ROOM_CENTER_Y,
      VIEW_HEIGHT * 0.35,
      ROOM_CENTER_X,
      ROOM_CENTER_Y,
      VIEW_WIDTH * 0.72,
    )
    vignette.addColorStop(0, rgba(COLOR.ink, 0))
    vignette.addColorStop(1, rgba(COLOR.ink, 0.72))
  }
  context.fillStyle = vignette
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
}

// ─── FILM GRAIN ───
// A small noise tile is generated once, then blitted over the screen each frame
// with a jittered offset and low alpha. Cheap, and no per-frame allocation.

export class Grain {
  private readonly tile: HTMLCanvasElement
  private readonly size = 128

  constructor() {
    this.tile = document.createElement("canvas")
    this.tile.width = this.size
    this.tile.height = this.size
    const context = this.tile.getContext("2d")
    if (!context) return
    const image = context.createImageData(this.size, this.size)
    for (let index = 0; index < image.data.length; index += 4) {
      const value = 120 + Math.floor(Math.random() * 135)
      image.data[index] = value
      image.data[index + 1] = value
      image.data[index + 2] = value
      image.data[index + 3] = 255
    }
    context.putImageData(image, 0, 0)
  }

  render(renderer: Renderer, offsetX: number, offsetY: number): void {
    const context = renderer.context
    context.save()
    context.globalAlpha = 0.035
    context.globalCompositeOperation = "overlay"
    const pattern = context.createPattern(this.tile, "repeat")
    if (pattern) {
      context.translate(offsetX, offsetY)
      context.fillStyle = pattern
      context.fillRect(-offsetX, -offsetY, VIEW_WIDTH, VIEW_HEIGHT)
    }
    context.restore()
  }
}
