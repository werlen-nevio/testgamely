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
import { COLOR, shade, rgba } from "../theme"
import { FONT_TITLE, FONT_UI } from "./fonts"

// ─── PAUSE MENU ───
// A frozen-frame overlay listing the current stat block, so the player can read
// exactly what their build has become.

export const renderPauseMenu = (renderer: Renderer, player: Player, level: number): void => {
  const context = renderer.context
  context.fillStyle = rgba(COLOR.bgAbyss, 0.72)
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  const panelX = ROOM_LEFT + 40
  const panelY = ROOM_TOP + 30
  const panelWidth = ROOM_INNER_WIDTH - 80
  const panelHeight = ROOM_INNER_HEIGHT - 60
  renderer.fillRect(panelX, panelY, panelWidth, panelHeight, rgba(COLOR.bgStone, 0.95))
  context.strokeStyle = COLOR.bio
  context.lineWidth = 2
  context.strokeRect(panelX, panelY, panelWidth, panelHeight)

  context.textAlign = "center"
  context.textBaseline = "top"
  context.fillStyle = COLOR.playerCore
  context.font = `700 30px ${FONT_TITLE}`
  context.fillText("PAUSE", ROOM_CENTER_X, panelY + 18)

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

  context.font = `400 15px ${FONT_UI}`
  const startY = panelY + 62
  const lineHeight = 26
  for (let index = 0; index < rows.length; index += 1) {
    const [label, value] = rows[index]
    const y = startY + index * lineHeight
    context.textAlign = "left"
    context.fillStyle = shade(COLOR.bgMist, 0.4)
    context.fillText(label, panelX + 40, y)
    context.textAlign = "right"
    context.fillStyle = COLOR.bio
    context.fillText(value, panelX + panelWidth - 40, y)
  }

  context.textAlign = "center"
  context.fillStyle = shade(COLOR.bgMist, 0.2)
  context.font = `400 13px ${FONT_UI}`
  context.fillText("ESC / P  ·  WEITER", ROOM_CENTER_X, panelY + panelHeight - 26)
  context.textAlign = "left"
}
