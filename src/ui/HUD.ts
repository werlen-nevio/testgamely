import type { Renderer } from "../core/Renderer"
import type { Player } from "../entities/Player"

// ─── HUD ───
// Top-left status overlay. Stage 2 shows hearts; coin/bomb/key counters and the
// item icon row are added alongside those systems in later stages.

const HEART_FULL_COLOR = "#d8434a"
const HEART_FULL_EDGE = "#7a1f24"
const HEART_EMPTY_COLOR = "#3a2a2b"
const HEART_EMPTY_EDGE = "#251b1c"

const HEART_SIZE = 22
const HEART_GAP = 6
const MARGIN = 14

export const renderHud = (renderer: Renderer, player: Player): void => {
  const { hearts, maxHearts } = player.stats
  for (let index = 0; index < maxHearts; index += 1) {
    const filled = index < hearts
    const x = MARGIN + index * (HEART_SIZE + HEART_GAP)
    drawHeart(
      renderer,
      x,
      MARGIN,
      HEART_SIZE,
      filled ? HEART_FULL_COLOR : HEART_EMPTY_COLOR,
      filled ? HEART_FULL_EDGE : HEART_EMPTY_EDGE,
    )
  }
}

// A blocky, unmistakable heart built from two circles and a triangle.
const drawHeart = (
  renderer: Renderer,
  x: number,
  y: number,
  size: number,
  fill: string,
  edge: string,
): void => {
  const context = renderer.context
  const half = size / 2
  const quarter = size / 4

  context.fillStyle = fill
  context.strokeStyle = edge
  context.lineWidth = 2

  context.beginPath()
  context.arc(x + quarter, y + quarter, quarter, Math.PI, 0)
  context.arc(x + half + quarter, y + quarter, quarter, Math.PI, 0)
  context.lineTo(x + half, y + size)
  context.closePath()
  context.fill()
  context.stroke()
}
