// ─── DIRECTIONS ───
// The four orthogonal directions rooms connect along. Kept in one place so the
// floor graph, doors and room transitions all agree on deltas and opposites.

export type Direction = "north" | "east" | "south" | "west"

export const DIRECTIONS: readonly Direction[] = ["north", "east", "south", "west"]

export const DIRECTION_DELTA: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
}
