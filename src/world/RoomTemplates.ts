import templatesData from "./roomTemplates.json"
import { ROOM_COLS, ROOM_ROWS } from "../constants"
import type { EnemyType } from "../entities/Enemy"

// ─── ROOM TEMPLATES ───
// Loads the hand-authored layouts and hands out one that fits a room's door
// count. Door-approach tiles are stripped from the obstacle list so a template
// can never wall off a door, regardless of which sides the room connects on.

export interface TemplateEnemy {
  type: EnemyType
  col: number
  row: number
}

export interface RoomTemplate {
  id: string
  forDoors: number[]
  obstacles: [number, number][]
  enemies: TemplateEnemy[]
}

const templates = (templatesData.templates as RoomTemplate[])

const MIDDLE_COL = Math.floor(ROOM_COLS / 2) // 7 — the north/south door lane
const MIDDLE_ROW = Math.floor(ROOM_ROWS / 2) // 4 — the east/west door lane
const LAST_COL = ROOM_COLS - 1
const LAST_ROW = ROOM_ROWS - 1

// A tile that sits in a door's approach path and must stay walkable.
const isDoorApproach = (col: number, row: number): boolean => {
  const nearNorth = col === MIDDLE_COL && row <= 1
  const nearSouth = col === MIDDLE_COL && row >= LAST_ROW - 1
  const nearWest = row === MIDDLE_ROW && col <= 1
  const nearEast = row === MIDDLE_ROW && col >= LAST_COL - 1
  return nearNorth || nearSouth || nearWest || nearEast
}

export const pickTemplate = (doorCount: number): RoomTemplate => {
  const candidates = templates.filter((template) => template.forDoors.includes(doorCount))
  const pool = candidates.length > 0 ? candidates : templates
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  return {
    ...chosen,
    obstacles: chosen.obstacles.filter(([col, row]) => !isDoorApproach(col, row)),
  }
}
