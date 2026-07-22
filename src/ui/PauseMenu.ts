import type { Renderer } from "../core/Renderer"
import type { Player } from "../entities/Player"
import {
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_INNER_WIDTH,
  ROOM_INNER_HEIGHT,
  ROOM_CENTER_X,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "../constants"

// ─── PAUSE MENU ───
// A frozen-frame overlay listing the current stat block, so the player can read
// exactly what their build has become.

export const renderPauseMenu = (renderer: Renderer, player: Player, level: number): void => {
  const context = renderer.context
  context.fillStyle = "rgba(8, 6, 5, 0.72)"
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  const panelX = ROOM_LEFT + 40
  const panelY = ROOM_TOP + 30
  const panelWidth = ROOM_INNER_WIDTH - 80
  const panelHeight = ROOM_INNER_HEIGHT - 60
  renderer.fillRect(panelX, panelY, panelWidth, panelHeight, "rgba(26, 21, 19, 0.95)")
  context.strokeStyle = "#4b3d37"
  context.lineWidth = 2
  context.strokeRect(panelX, panelY, panelWidth, panelHeight)

  context.textAlign = "center"
  context.textBaseline = "top"
  context.fillStyle = "#f0e6cf"
  context.font = "bold 26px monospace"
  context.fillText("Pause", ROOM_CENTER_X, panelY + 20)

  const stats = player.stats
  const rows: [string, string][] = [
    ["Ebene", String(level)],
    ["Herzen", `${stats.hearts} / ${stats.maxHearts}`],
    ["Schaden", stats.damage.toFixed(1)],
    ["Feuerrate", stats.fireRate.toFixed(2)],
    ["Schusstempo", String(Math.round(stats.shotSpeed))],
    ["Reichweite", String(Math.round(stats.range))],
    ["Lauftempo", String(Math.round(stats.moveSpeed))],
    ["Glück", String(stats.luck)],
    ["Items", String(player.items.length)],
  ]

  context.font = "16px monospace"
  const startY = panelY + 66
  const lineHeight = 26
  for (let index = 0; index < rows.length; index += 1) {
    const [label, value] = rows[index]
    const y = startY + index * lineHeight
    context.textAlign = "left"
    context.fillStyle = "#b9ab9a"
    context.fillText(label, panelX + 40, y)
    context.textAlign = "right"
    context.fillStyle = "#f0e6cf"
    context.fillText(value, panelX + panelWidth - 40, y)
  }

  context.textAlign = "center"
  context.fillStyle = "#8c8079"
  context.font = "13px monospace"
  context.fillText("Esc / P  ·  weiter", ROOM_CENTER_X, panelY + panelHeight - 28)
  context.textAlign = "left"
}
