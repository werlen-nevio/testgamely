import type { Renderer } from "../core/Renderer"
import type { Player } from "../entities/Player"

// ─── HUD ───
// Top-left status overlay: the heart row, a coin counter, and a row of item
// icons so the player can read their build at a glance.

const HEART_FULL_COLOR = "#d8434a"
const HEART_FULL_EDGE = "#7a1f24"
const HEART_EMPTY_COLOR = "#3a2a2b"
const HEART_EMPTY_EDGE = "#251b1c"

const HEART_SIZE = 22
const HEART_GAP = 6
const MARGIN = 14

export const renderHud = (renderer: Renderer, player: Player, coins: number): void => {
  renderHearts(renderer, player)
  renderCoins(renderer, coins)
  renderItemRow(renderer, player)
}

const renderHearts = (renderer: Renderer, player: Player): void => {
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

const renderCoins = (renderer: Renderer, coins: number): void => {
  const context = renderer.context
  const y = MARGIN + HEART_SIZE + 10
  renderer.fillCircle(MARGIN + 8, y + 8, 8, "#e7c14a")
  context.strokeStyle = "#8a6f1f"
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = "#e7e0cf"
  context.font = "bold 15px monospace"
  context.textBaseline = "middle"
  context.textAlign = "left"
  context.fillText(`x ${coins}`, MARGIN + 22, y + 9)
}

const ITEM_ICON_SIZE = 20
const ITEM_ICON_GAP = 5

const renderItemRow = (renderer: Renderer, player: Player): void => {
  if (player.items.length === 0) return
  const context = renderer.context
  const y = MARGIN + HEART_SIZE + 30
  for (let index = 0; index < player.items.length; index += 1) {
    const item = player.items[index]
    const x = MARGIN + index * (ITEM_ICON_SIZE + ITEM_ICON_GAP)
    renderer.fillRect(x, y, ITEM_ICON_SIZE, ITEM_ICON_SIZE, item.color)
    context.strokeStyle = "#1c1512"
    context.lineWidth = 2
    context.strokeRect(x, y, ITEM_ICON_SIZE, ITEM_ICON_SIZE)
    context.fillStyle = "#1c1512"
    context.font = "bold 13px monospace"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(item.glyph, x + ITEM_ICON_SIZE / 2, y + ITEM_ICON_SIZE / 2 + 1)
  }
  context.textAlign = "left"
}

// A blocky, unmistakable heart built from two arcs and a point.
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
