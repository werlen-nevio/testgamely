import type { Renderer } from "../core/Renderer"
import type { Player } from "../entities/Player"
import { itemColor } from "../items/Item"
import { COLOR, shade } from "../theme"
import { FONT_UI } from "./fonts"

// ─── HUD ───
// Top-left status: warm hearts (life belongs to the player's warm family), the
// coin/bomb/key counters, and a glowing row of held-item chips. Colours are
// tokens only; the deliberate UI font carries the mood.

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
    if (filled) {
      renderer.additive(() =>
        renderer.glowCircle(x + HEART_SIZE / 2, MARGIN + HEART_SIZE / 2, 8, COLOR.playerGlow, 10),
      )
    }
    drawHeart(
      renderer,
      x,
      MARGIN,
      HEART_SIZE,
      filled ? COLOR.playerCore : shade(COLOR.bgStone, 0.05),
      filled ? shade(COLOR.playerGlow, -0.2) : shade(COLOR.bgStone, -0.2),
    )
  }
}

const renderCounters = (renderer: Renderer, counts: HudCounts): void => {
  const context = renderer.context
  const y = MARGIN + HEART_SIZE + 12
  context.font = `700 14px ${FONT_UI}`
  context.textBaseline = "middle"
  context.textAlign = "left"

  renderer.fillCircle(MARGIN + 7, y + 8, 7, COLOR.bio)
  renderer.fillCircle(MARGIN + 7, y + 8, 3, COLOR.flash)
  context.fillStyle = shade(COLOR.bio, 0.5)
  context.fillText(String(counts.coins), MARGIN + 20, y + 9)

  renderer.fillCircle(MARGIN + 64, y + 8, 7, shade(COLOR.bgStone, 0.1))
  renderer.strokeCircle(MARGIN + 64, y + 8, 7, COLOR.bio, 1.5)
  context.fillStyle = shade(COLOR.bio, 0.5)
  context.fillText(String(counts.bombs), MARGIN + 78, y + 9)

  renderer.strokeCircle(MARGIN + 116, y + 6, 4, COLOR.bio, 2)
  renderer.fillRect(MARGIN + 118, y + 7, 2, 8, COLOR.bio)
  context.fillStyle = shade(COLOR.bio, 0.5)
  context.fillText(String(counts.keys), MARGIN + 128, y + 9)
}

const ITEM_ICON_SIZE = 20
const ITEM_ICON_GAP = 5

const renderItemRow = (renderer: Renderer, player: Player): void => {
  if (player.items.length === 0) return
  const context = renderer.context
  const y = MARGIN + HEART_SIZE + 34
  for (let index = 0; index < player.items.length; index += 1) {
    const item = player.items[index]
    const color = itemColor(item)
    const x = MARGIN + index * (ITEM_ICON_SIZE + ITEM_ICON_GAP)
    renderer.fillRect(x, y, ITEM_ICON_SIZE, ITEM_ICON_SIZE, color)
    context.strokeStyle = COLOR.ink
    context.lineWidth = 2
    context.strokeRect(x, y, ITEM_ICON_SIZE, ITEM_ICON_SIZE)
    context.fillStyle = COLOR.ink
    context.font = `700 12px ${FONT_UI}`
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
