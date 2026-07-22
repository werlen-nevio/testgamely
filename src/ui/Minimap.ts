import type { Renderer } from "../core/Renderer"
import type { Floor, RoomNode } from "../world/Floor"
import { DIRECTIONS, DIRECTION_DELTA } from "../world/directions"
import { FLOOR_COLUMNS, VIEW_WIDTH } from "../constants"

// ─── MINIMAP ───
// Top-right overview of the floor. Three visibility states are distinguishable:
// visited rooms show their kind colour, rooms adjacent to a visited room show
// as dim "known" cells, and everything else stays hidden. The current room gets
// a bright outline.

const CELL = 12
const GAP = 3
const MARGIN = 12
const PAD = 8

const KIND_COLOR: Record<RoomNode["kind"], string> = {
  start: "#9ec6a0",
  normal: "#b6a48f",
  boss: "#cf5750",
  item: "#5f86c8",
  shop: "#d0ad4b",
  secret: "#8a7fd0",
}

const KNOWN_COLOR = "#4b4038"
const PANEL_COLOR = "rgba(12, 10, 9, 0.55)"
const CURRENT_OUTLINE = "#f4ead0"

export const renderMinimap = (renderer: Renderer, floor: Floor, currentIndex: number): void => {
  const rooms = floor.rooms
  const known = collectKnown(rooms)

  // Bounding box of everything we will draw, so the panel hugs the content.
  let minColumn = FLOOR_COLUMNS
  let minRow = Infinity
  let maxColumn = 0
  let maxRow = 0
  for (const room of rooms.values()) {
    if (!room.visited && !known.has(room.index)) continue
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
    const isVisited = room.visited
    const isKnown = known.has(room.index)
    if (!isVisited && !isKnown) continue

    const x = originX + PAD + (room.gridX - minColumn) * (CELL + GAP)
    const y = originY + PAD + (room.gridY - minRow) * (CELL + GAP)

    renderer.fillRect(x, y, CELL, CELL, isVisited ? KIND_COLOR[room.kind] : KNOWN_COLOR)

    if (room.index === currentIndex) {
      context.strokeStyle = CURRENT_OUTLINE
      context.lineWidth = 2
      context.strokeRect(x - 1, y - 1, CELL + 2, CELL + 2)
    }
  }
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
