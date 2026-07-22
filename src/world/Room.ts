import type { Renderer } from "../core/Renderer"
import {
  TILE,
  ROOM_COLS,
  ROOM_ROWS,
  ROOM_LEFT,
  ROOM_TOP,
  ROOM_INNER_WIDTH,
  ROOM_INNER_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "../constants"

// ─── ROOM ───
// Stage 1: a single static room — floor, a faint checker so movement reads, and
// the surrounding wall. This module grows into a full room data structure
// (doors, obstacles, spawns) in later stages.

const WALL_COLOR = "#1a1513"
const FLOOR_COLOR = "#39312e"
const FLOOR_CHECKER_COLOR = "#403633"
const FLOOR_EDGE_COLOR = "#4b3d37"

export const renderRoom = (renderer: Renderer): void => {
  const context = renderer.context

  // Wall backdrop behind everything.
  renderer.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, WALL_COLOR)

  // Floor.
  renderer.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_INNER_WIDTH, ROOM_INNER_HEIGHT, FLOOR_COLOR)

  // Faint checkerboard for a readable sense of speed.
  context.fillStyle = FLOOR_CHECKER_COLOR
  for (let row = 0; row < ROOM_ROWS; row += 1) {
    for (let col = 0; col < ROOM_COLS; col += 1) {
      if ((row + col) % 2 === 0) continue
      context.fillRect(ROOM_LEFT + col * TILE, ROOM_TOP + row * TILE, TILE, TILE)
    }
  }

  // Inner edge so the play boundary is unmistakable.
  context.strokeStyle = FLOOR_EDGE_COLOR
  context.lineWidth = 4
  context.strokeRect(ROOM_LEFT + 2, ROOM_TOP + 2, ROOM_INNER_WIDTH - 4, ROOM_INNER_HEIGHT - 4)
}
