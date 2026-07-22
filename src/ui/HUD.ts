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

export interface HudCounts {
  coins: number
  bombs: number
  keys: number
}

export const renderHud = (renderer: Renderer, player: Player, counts: HudCounts): void => {
  renderHearts(renderer, player)
  renderCounters(renderer, counts)
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

const renderCounters = (renderer: Renderer, counts: HudCounts): void => {
  const context = renderer.context
  const y = MARGIN + HEART_SIZE + 10
  context.font = "bold 14px monospace"
  context.textBaseline = "middle"
  context.textAlign = "left"

  // Coin.
  renderer.fillCircle(MARGIN + 7, y + 8, 7, "#e7c14a")
  context.fillStyle = "#e7e0cf"
  context.fillText(String(counts.coins), MARGIN + 18, y + 9)

  // Bomb.
  renderer.fillCircle(MARGIN + 62, y + 8, 7, "#2c2c30")
  context.fillStyle = "#e7e0cf"
  context.fillText(String(counts.bombs), MARGIN + 74, y + 9)

  // Key.
  renderer.fillCircle(MARGIN + 116, y + 6, 4, "#d8c65a")
  renderer.fillRect(MARGIN + 115, y + 7, 2, 8, "#d8c65a")
  context.fillStyle = "#e7e0cf"
  context.fillText(String(counts.keys), MARGIN + 128, y + 9)
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
