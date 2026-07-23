import type { Renderer } from "../core/Renderer"
import type { Floor, RoomNode } from "./Floor"
import { DIRECTIONS, DIRECTION_DELTA, type Direction } from "./directions"
import { renderObstacle } from "../entities/Obstacle"
import { COLOR, shade, mix, rgba } from "../theme"
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
  FLOOR_COLUMNS,
  DOOR_HALF_SPAN,
} from "../constants"

// ─── ROOM RENDERING ───
// Draws the current room with depth: an abyssal backdrop, a floor lit by a soft
// central pool, raised stone walls, obstacles with a top-face, and doorways
// whose state and destination read at a glance. Every colour is a theme token
// or a mix/shade of one; floors tint the same palette per depth.

// Each floor blends the base toward an accent so depths feel distinct while
// staying in-palette. Cycles, darkening deeper.
const FLOOR_ACCENTS = [COLOR.bio, COLOR.brood, COLOR.caster]

interface FloorTheme {
  floor: string
  floorEdge: string
  mist: string
  wall: string
  wallEdge: string
}

const floorTheme = (level: number): FloorTheme => {
  const accent = FLOOR_ACCENTS[(level - 1) % FLOOR_ACCENTS.length]
  const depth = Math.min(0.4, ((level - 1) / FLOOR_ACCENTS.length | 0) * 0.12)
  const floorBase = shade(mix(COLOR.bgDeep, accent, 0.14), -depth)
  return {
    floor: floorBase,
    floorEdge: shade(floorBase, 0.12),
    mist: mix(COLOR.bgMist, accent, 0.35),
    wall: shade(mix(COLOR.bgStone, accent, 0.06), -depth),
    wallEdge: mix(COLOR.bgStone, accent, 0.2),
  }
}

// Kind of the room a door leads to, so its arch can be colour-coded.
const neighborKind = (floor: Floor, room: RoomNode, direction: Direction): RoomNode["kind"] | null => {
  const nx = room.gridX + DIRECTION_DELTA[direction].x
  const ny = room.gridY + DIRECTION_DELTA[direction].y
  return floor.rooms.get(ny * FLOOR_COLUMNS + nx)?.kind ?? null
}

export const renderRoom = (renderer: Renderer, room: RoomNode, floor: Floor): void => {
  const context = renderer.context
  const theme = floorTheme(floor.level)

  // Abyss backdrop, oversized so a camera nudge never reveals the void.
  renderer.fillRect(-80, -80, VIEW_WIDTH + 160, VIEW_HEIGHT + 160, COLOR.bgAbyss)

  // Raised wall band around the play area.
  renderer.fillRect(
    ROOM_LEFT - TILE,
    ROOM_TOP - TILE,
    ROOM_INNER_WIDTH + TILE * 2,
    ROOM_INNER_HEIGHT + TILE * 2,
    theme.wall,
  )

  // Floor.
  renderer.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_INNER_WIDTH, ROOM_INNER_HEIGHT, theme.floor)

  // Faint tile grid, darker than the floor so it reads as grout.
  context.strokeStyle = shade(theme.floor, -0.25)
  context.lineWidth = 1
  context.beginPath()
  for (let col = 1; col < ROOM_COLS; col += 1) {
    context.moveTo(ROOM_LEFT + col * TILE, ROOM_TOP)
    context.lineTo(ROOM_LEFT + col * TILE, ROOM_BOTTOM)
  }
  for (let row = 1; row < ROOM_ROWS; row += 1) {
    context.moveTo(ROOM_LEFT, ROOM_TOP + row * TILE)
    context.lineTo(ROOM_RIGHT, ROOM_TOP + row * TILE)
  }
  context.stroke()

  // Soft central light pool — bioluminescence welling up through the floor.
  const pool = context.createRadialGradient(
    ROOM_CENTER_X,
    ROOM_CENTER_Y,
    20,
    ROOM_CENTER_X,
    ROOM_CENTER_Y,
    ROOM_INNER_WIDTH * 0.55,
  )
  pool.addColorStop(0, rgba(theme.mist, 0.16))
  pool.addColorStop(1, rgba(theme.mist, 0))
  context.fillStyle = pool
  context.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_INNER_WIDTH, ROOM_INNER_HEIGHT)

  // Inner wall edge — a lip of lighter stone for depth.
  context.strokeStyle = theme.wallEdge
  context.lineWidth = 3
  context.strokeRect(ROOM_LEFT + 1.5, ROOM_TOP + 1.5, ROOM_INNER_WIDTH - 3, ROOM_INNER_HEIGHT - 3)

  for (const direction of DIRECTIONS) {
    if (room.doors[direction]) {
      drawDoor(renderer, direction, room.cleared, neighborKind(floor, room, direction), theme)
    }
  }

  for (const obstacle of room.obstacles) renderObstacle(renderer, obstacle)
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
      return { x: ROOM_CENTER_X - DOOR_HALF_SPAN, y: ROOM_TOP - TILE, width: span, height: TILE }
    case "south":
      return { x: ROOM_CENTER_X - DOOR_HALF_SPAN, y: ROOM_BOTTOM, width: span, height: TILE }
    case "east":
      return { x: ROOM_RIGHT, y: ROOM_CENTER_Y - DOOR_HALF_SPAN, width: TILE, height: span }
    case "west":
      return { x: ROOM_LEFT - TILE, y: ROOM_CENTER_Y - DOOR_HALF_SPAN, width: TILE, height: span }
  }
}

// Destination-coded arch colour: boss = danger, shop = warm, else bio.
const doorAccent = (kind: RoomNode["kind"] | null): string => {
  if (kind === "boss") return COLOR.danger
  if (kind === "shop") return COLOR.playerGlow
  return COLOR.bio
}

const drawDoor = (
  renderer: Renderer,
  direction: Direction,
  open: boolean,
  kind: RoomNode["kind"] | null,
  theme: FloorTheme,
): void => {
  const rect = doorRect(direction)
  const context = renderer.context
  const accent = doorAccent(kind)
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  // Dark threshold set into the wall.
  renderer.fillRect(rect.x, rect.y, rect.width, rect.height, COLOR.ink)

  if (open) {
    // Glowing arch + open mouth.
    renderer.additive(() => renderer.glowCircle(centerX, centerY, DOOR_HALF_SPAN * 0.7, accent, 16))
    context.strokeStyle = accent
    context.lineWidth = 3
    context.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4)
    return
  }

  // Closed: a barred slab in stone, tinted by the destination so a boss/shop
  // door still reads while locked.
  renderer.fillRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, shade(theme.wall, 0.12))
  context.strokeStyle = shade(accent, -0.2)
  context.lineWidth = 3
  if (direction === "north" || direction === "south") {
    context.beginPath()
    context.moveTo(centerX, rect.y + 4)
    context.lineTo(centerX, rect.y + rect.height - 4)
    context.stroke()
  } else {
    context.beginPath()
    context.moveTo(rect.x + 4, centerY)
    context.lineTo(rect.x + rect.width - 4, centerY)
    context.stroke()
  }
}
