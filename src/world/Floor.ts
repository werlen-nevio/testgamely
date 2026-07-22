import { FLOOR_COLUMNS, FLOOR_ROWS } from "../constants"
import { DIRECTIONS, DIRECTION_DELTA, type Direction } from "./directions"
import type { Obstacle } from "../entities/Obstacle"

// ─── FLOOR ───
// A floor is a connected set of rooms placed on a 9×8 slot grid. Generation is
// the classic organic random walk: grow outward from the centre, but only into
// a cell that would touch at most one existing room, so the layout stays a
// sprawling tree rather than a blob. The two deepest dead ends become the boss
// and item rooms; another dead end becomes the shop.

export type RoomKind = "start" | "normal" | "boss" | "item" | "shop"

export interface RoomNode {
  index: number
  gridX: number
  gridY: number
  kind: RoomKind
  doors: Record<Direction, boolean>
  doorCount: number
  distance: number
  visited: boolean
  cleared: boolean
  // Lazily filled the first time the room is entered; persists afterwards so a
  // cleared room keeps its rocks when revisited.
  instantiated: boolean
  obstacles: Obstacle[]
}

export interface Floor {
  level: number
  rooms: Map<number, RoomNode>
  startIndex: number
}

export const roomCountForLevel = (level: number): number => Math.min(20, 5 + level * 2)

const indexOf = (gridX: number, gridY: number): number => gridY * FLOOR_COLUMNS + gridX

const inBounds = (gridX: number, gridY: number): boolean =>
  gridX >= 0 && gridX < FLOOR_COLUMNS && gridY >= 0 && gridY < FLOOR_ROWS

const createNode = (gridX: number, gridY: number, kind: RoomKind): RoomNode => ({
  index: indexOf(gridX, gridY),
  gridX,
  gridY,
  kind,
  doors: { north: false, east: false, south: false, west: false },
  doorCount: 0,
  distance: 0,
  visited: false,
  cleared: false,
  instantiated: false,
  obstacles: [],
})

const shuffled = <T>(values: readonly T[]): T[] => {
  const copy = values.slice()
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

const countOccupiedNeighbors = (rooms: Map<number, RoomNode>, gridX: number, gridY: number): number => {
  let count = 0
  for (const direction of DIRECTIONS) {
    const nx = gridX + DIRECTION_DELTA[direction].x
    const ny = gridY + DIRECTION_DELTA[direction].y
    if (inBounds(nx, ny) && rooms.has(indexOf(nx, ny))) count += 1
  }
  return count
}

// ─── GENERATION ───

export const generateFloor = (level: number): Floor => {
  const target = roomCountForLevel(level)
  for (let attempt = 0; attempt < 400; attempt += 1) {
    // The last stretch of attempts drops the random skip so placement always
    // reaches the target even on an unlucky seed.
    const skipChance = attempt < 320 ? 0.5 : 0
    const floor = tryGenerate(level, target, skipChance)
    if (floor) return floor
  }
  // Guaranteed to succeed with skipChance 0; kept as an explicit final attempt.
  return tryGenerate(level, target, 0) as Floor
}

const tryGenerate = (level: number, target: number, skipChance: number): Floor | null => {
  const rooms = new Map<number, RoomNode>()
  const startX = Math.floor(FLOOR_COLUMNS / 2)
  const startY = Math.floor(FLOOR_ROWS / 2)
  const startIndex = indexOf(startX, startY)
  const start = createNode(startX, startY, "start")
  rooms.set(startIndex, start)

  const queue: RoomNode[] = [start]
  let placed = 1

  while (placed < target && queue.length > 0) {
    const current = queue.shift() as RoomNode
    for (const direction of shuffled(DIRECTIONS)) {
      if (placed >= target) break
      const nx = current.gridX + DIRECTION_DELTA[direction].x
      const ny = current.gridY + DIRECTION_DELTA[direction].y
      if (!inBounds(nx, ny)) continue
      const neighborIndex = indexOf(nx, ny)
      if (rooms.has(neighborIndex)) continue
      // The neighbour must not already touch another room (besides `current`).
      if (countOccupiedNeighbors(rooms, nx, ny) > 1) continue
      if (Math.random() < skipChance) continue

      const node = createNode(nx, ny, "normal")
      rooms.set(neighborIndex, node)
      queue.push(node)
      placed += 1
    }
  }

  if (placed < target) return null

  connectDoors(rooms)
  computeDistances(rooms, startIndex)
  if (!assignSpecialRooms(rooms)) return null

  return { level, rooms, startIndex }
}

const connectDoors = (rooms: Map<number, RoomNode>): void => {
  for (const room of rooms.values()) {
    let doorCount = 0
    for (const direction of DIRECTIONS) {
      const nx = room.gridX + DIRECTION_DELTA[direction].x
      const ny = room.gridY + DIRECTION_DELTA[direction].y
      if (inBounds(nx, ny) && rooms.has(indexOf(nx, ny))) {
        room.doors[direction] = true
        doorCount += 1
      }
    }
    room.doorCount = doorCount
  }
}

const computeDistances = (rooms: Map<number, RoomNode>, startIndex: number): void => {
  for (const room of rooms.values()) room.distance = Number.POSITIVE_INFINITY
  const start = rooms.get(startIndex) as RoomNode
  start.distance = 0
  const queue: RoomNode[] = [start]
  while (queue.length > 0) {
    const current = queue.shift() as RoomNode
    for (const direction of DIRECTIONS) {
      if (!current.doors[direction]) continue
      const nx = current.gridX + DIRECTION_DELTA[direction].x
      const ny = current.gridY + DIRECTION_DELTA[direction].y
      const neighbor = rooms.get(indexOf(nx, ny))
      if (!neighbor) continue
      if (neighbor.distance <= current.distance + 1) continue
      neighbor.distance = current.distance + 1
      queue.push(neighbor)
    }
  }
}

// Assigns boss/item/shop to dead ends. Returns false if there are too few dead
// ends, signalling the caller to regenerate.
const assignSpecialRooms = (rooms: Map<number, RoomNode>): boolean => {
  const deadEnds = [...rooms.values()]
    .filter((room) => room.kind === "normal" && room.doorCount === 1)
    .sort((a, b) => b.distance - a.distance)

  if (deadEnds.length < 3) return false

  const boss = deadEnds[0]
  const item = deadEnds[1]
  boss.kind = "boss"
  item.kind = "item"

  const shopCandidates = deadEnds.slice(2)
  const shop = shopCandidates[Math.floor(Math.random() * shopCandidates.length)]
  shop.kind = "shop"
  return true
}
