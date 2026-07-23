import type { Renderer } from "../core/Renderer"
import type { Floor, RoomNode } from "../world/Floor"
import { DIRECTIONS, DIRECTION_DELTA } from "../world/directions"
import { FLOOR_COLUMNS, VIEW_WIDTH } from "../constants"
import { COLOR, shade, rgba } from "../theme"

// ─── MINIMAP ───
// Top-right overview of the floor. Room type reads by icon + colour, never text.
// Visibility is legible in three states: visited rooms are full-bright, rooms
// adjacent to a visited one (known/seen) are dimmed, everything else hidden.
// Special rooms show their icon as soon as they are known, so the player can
// orient toward the boss; secret rooms only appear once revealed. The current
// room gets a bright pulsing outline.

const CELL = 13
const GAP = 3
const MARGIN = 12
const PAD = 8

// Base cell tint per kind (normal/start neutral; specials faintly tinted).
const CELL_COLOR: Record<RoomNode["kind"], string> = {
  start: shade(COLOR.bgMist, 0.2),
  normal: shade(COLOR.bgMist, 0.15),
  boss: shade(COLOR.danger, -0.35),
  item: shade(COLOR.bio, -0.35),
  shop: shade(COLOR.playerGlow, -0.35),
  secret: shade(COLOR.brood, -0.3),
}

const PANEL_COLOR = rgba(COLOR.ink, 0.58)

let pulsePhase = 0

export const renderMinimap = (renderer: Renderer, floor: Floor, currentIndex: number): void => {
  pulsePhase += 1
  const rooms = floor.rooms
  const known = collectKnown(rooms)

  // Bounding box of everything we will draw, so the panel hugs the content.
  let minColumn = FLOOR_COLUMNS
  let minRow = Infinity
  let maxColumn = 0
  let maxRow = 0
  for (const room of rooms.values()) {
    if (!isShown(room, known)) continue
    minColumn = Math.min(minColumn, room.gridX)
    maxColumn = Math.max(maxColumn, room.gridX)
    minRow = Math.min(minRow, room.gridY)
    maxRow = Math.max(maxRow, room.gridY)
  }
  if (minRow === Infinity) return

  const columns = maxColumn - minColumn + 1
  const rowsSpan = maxRow - minRow + 1
  const width = columns * CELL + (columns - 1) * GAP + PAD * 2
  const height = rowsSpan * CELL + (rowsSpan - 1) * GAP + PAD * 2
  const originX = VIEW_WIDTH - MARGIN - width
  const originY = MARGIN

  renderer.fillRect(originX, originY, width, height, PANEL_COLOR)

  const context = renderer.context
  for (const room of rooms.values()) {
    if (!isShown(room, known)) continue

    const x = originX + PAD + (room.gridX - minColumn) * (CELL + GAP)
    const y = originY + PAD + (room.gridY - minRow) * (CELL + GAP)
    const centerX = x + CELL / 2
    const centerY = y + CELL / 2
    // Seen-but-not-visited rooms are dimmed; visited rooms are full-bright.
    context.globalAlpha = room.visited ? 1 : 0.42

    // The boss cell glows so it is the most prominent mark on the map.
    if (room.kind === "boss") {
      renderer.additive(() => renderer.glowCircle(centerX, centerY, CELL * 0.5, COLOR.danger, 10))
    }
    renderer.fillRect(x, y, CELL, CELL, CELL_COLOR[room.kind])
    drawRoomIcon(renderer, room.kind, centerX, centerY)

    context.globalAlpha = 1
    if (room.index === currentIndex) {
      const pulse = 0.6 + Math.sin(pulsePhase * 0.12) * 0.4
      context.strokeStyle = COLOR.flash
      context.lineWidth = 2
      context.globalAlpha = pulse
      context.strokeRect(x - 1.5, y - 1.5, CELL + 3, CELL + 3)
      context.globalAlpha = 1
    }
  }
}

// Special-room icons — pure shape + colour, no text. Boss = a bold spiked star
// (the loudest mark), item = a gem, shop = a coin ring, secret = a rune dot.
const drawRoomIcon = (renderer: Renderer, kind: RoomNode["kind"], cx: number, cy: number): void => {
  const context = renderer.context
  switch (kind) {
    case "boss": {
      context.save()
      context.translate(cx, cy)
      context.fillStyle = COLOR.flash
      for (let point = 0; point < 4; point += 1) {
        context.rotate(Math.PI / 2)
        context.beginPath()
        context.moveTo(0, -5)
        context.lineTo(1.6, -1.6)
        context.lineTo(0, 0)
        context.lineTo(-1.6, -1.6)
        context.closePath()
        context.fill()
      }
      context.restore()
      break
    }
    case "item": {
      // Upward gem/diamond.
      context.fillStyle = COLOR.bio
      context.beginPath()
      context.moveTo(cx, cy - 4)
      context.lineTo(cx + 4, cy)
      context.lineTo(cx, cy + 4)
      context.lineTo(cx - 4, cy)
      context.closePath()
      context.fill()
      break
    }
    case "shop": {
      renderer.strokeCircle(cx, cy, 3.5, COLOR.playerGlow, 2)
      break
    }
    case "secret": {
      renderer.fillCircle(cx, cy, 2, COLOR.brood)
      renderer.strokeCircle(cx, cy, 4, COLOR.brood, 1)
      break
    }
    default:
      break
  }
}

// Shown on the map: visited or known. Secret rooms only after they are revealed.
const isShown = (room: RoomNode, known: Set<number>): boolean => {
  if (room.kind === "secret" && !room.revealed) return false
  return room.visited || known.has(room.index)
}

// A room is "known" if it is visited or sits next to a visited room.
const collectKnown = (rooms: Map<number, RoomNode>): Set<number> => {
  const known = new Set<number>()
  for (const room of rooms.values()) {
    if (!room.visited) continue
    known.add(room.index)
    for (const direction of DIRECTIONS) {
      if (!room.doors[direction]) continue
      const nx = room.gridX + DIRECTION_DELTA[direction].x
      const ny = room.gridY + DIRECTION_DELTA[direction].y
      const neighbor = rooms.get(ny * FLOOR_COLUMNS + nx)
      if (neighbor) known.add(neighbor.index)
    }
  }
  return known
}
