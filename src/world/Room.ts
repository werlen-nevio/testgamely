import type { Renderer } from "../core/Renderer"
import type { RoomNode } from "./Floor"
import { DIRECTIONS, type Direction } from "./directions"
import { renderObstacle } from "../entities/Obstacle"
import {
  TILE,
  ROOM_COLS,
  ROOM_ROWS,
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_RIGHT,
  ROOM_BOTTOM,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  ROOM_INNER_WIDTH,
  ROOM_INNER_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  DOOR_HALF_SPAN,
} from "../constants"

// ─── ROOM RENDERING ───
// Draws the current room: walls, a kind-tinted floor with a faint checker, the
// obstacles, and the doorways (barred while the room is uncleared, open once it
// is). Room graph/state lives in Floor.ts — this module only paints it.

const WALL_COLOR = "#1a1513"

interface FloorPalette {
  base: string
  checker: string
  edge: string
}

const FLOOR_PALETTES: Record<RoomNode["kind"], FloorPalette> = {
  start: { base: "#39312e", checker: "#403633", edge: "#4b3d37" },
  normal: { base: "#39312e", checker: "#403633", edge: "#4b3d37" },
  boss: { base: "#3b2a2a", checker: "#472f2f", edge: "#5c3636" },
  item: { base: "#2c3340", checker: "#333c4d", edge: "#3f4a5e" },
  shop: { base: "#3a3526", checker: "#45402d", edge: "#524a34" },
}

interface DoorRect {
  x: number
  y: number
  width: number
  height: number
}

const doorRect = (direction: Direction): DoorRect => {
  const span = DOOR_HALF_SPAN * 2
  switch (direction) {
    case "north":
      return { x: ROOM_CENTER_X - DOOR_HALF_SPAN, y: 0, width: span, height: ROOM_TOP }
    case "south":
      return { x: ROOM_CENTER_X - DOOR_HALF_SPAN, y: ROOM_BOTTOM, width: span, height: VIEW_HEIGHT - ROOM_BOTTOM }
    case "east":
      return { x: ROOM_RIGHT, y: ROOM_CENTER_Y - DOOR_HALF_SPAN, width: VIEW_WIDTH - ROOM_RIGHT, height: span }
    case "west":
      return { x: 0, y: ROOM_CENTER_Y - DOOR_HALF_SPAN, width: ROOM_LEFT, height: span }
  }
}

export const renderRoom = (renderer: Renderer, room: RoomNode): void => {
  const context = renderer.context
  const palette = FLOOR_PALETTES[room.kind]

  renderer.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, WALL_COLOR)
  renderer.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_INNER_WIDTH, ROOM_INNER_HEIGHT, palette.base)

  context.fillStyle = palette.checker
  for (let row = 0; row < ROOM_ROWS; row += 1) {
    for (let col = 0; col < ROOM_COLS; col += 1) {
      if ((row + col) % 2 === 0) continue
      context.fillRect(ROOM_LEFT + col * TILE, ROOM_TOP + row * TILE, TILE, TILE)
    }
  }

  for (const direction of DIRECTIONS) {
    if (room.doors[direction]) drawDoor(renderer, direction, room.cleared, palette)
  }

  context.strokeStyle = palette.edge
  context.lineWidth = 4
  context.strokeRect(ROOM_LEFT + 2, ROOM_TOP + 2, ROOM_INNER_WIDTH - 4, ROOM_INNER_HEIGHT - 4)

  for (const obstacle of room.obstacles) renderObstacle(renderer, obstacle)
}

const DOOR_OPEN_COLOR = "#120f0e"
const DOOR_FRAME_COLOR = "#6a564a"
const DOOR_CLOSED_COLOR = "#7c6252"
const DOOR_CLOSED_BAR = "#4a382e"

const drawDoor = (
  renderer: Renderer,
  direction: Direction,
  open: boolean,
  palette: FloorPalette,
): void => {
  const rect = doorRect(direction)
  const context = renderer.context

  // Frame around the opening.
  renderer.fillRect(rect.x - 3, rect.y - 3, rect.width + 6, rect.height + 6, DOOR_FRAME_COLOR)

  if (open) {
    // Carry the floor into the threshold and leave a dark mouth beyond it.
    renderer.fillRect(rect.x, rect.y, rect.width, rect.height, palette.base)
    const mouthInset = 6
    renderer.fillRect(
      rect.x + (direction === "east" || direction === "west" ? rect.width - mouthInset : mouthInset),
      rect.y + (direction === "north" || direction === "south" ? rect.height - mouthInset : mouthInset),
      direction === "east" || direction === "west" ? mouthInset : rect.width - mouthInset * 2,
      direction === "north" || direction === "south" ? mouthInset : rect.height - mouthInset * 2,
      DOOR_OPEN_COLOR,
    )
    return
  }

  // Closed: a barred slab.
  renderer.fillRect(rect.x, rect.y, rect.width, rect.height, DOOR_CLOSED_COLOR)
  context.strokeStyle = DOOR_CLOSED_BAR
  context.lineWidth = 3
  if (direction === "north" || direction === "south") {
    const midX = rect.x + rect.width / 2
    context.beginPath()
    context.moveTo(midX, rect.y + 2)
    context.lineTo(midX, rect.y + rect.height - 2)
    context.stroke()
  } else {
    const midY = rect.y + rect.height / 2
    context.beginPath()
    context.moveTo(rect.x + 2, midY)
    context.lineTo(rect.x + rect.width - 2, midY)
    context.stroke()
  }
}
