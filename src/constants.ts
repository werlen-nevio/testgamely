// ─── ROOM & VIEW DIMENSIONS ───
// A single room is exactly one screen. There is no scrolling, so the view
// size is derived directly from the room grid. Everything is measured in
// logical pixels; the renderer scales the backing store for high-DPI displays.

export const TILE = 48

export const ROOM_COLS = 15 // interior, playable tiles horizontally
export const ROOM_ROWS = 9 // interior, playable tiles vertically
export const WALL_TILES = 1 // border-wall thickness, in tiles

export const ROOM_INNER_WIDTH = ROOM_COLS * TILE
export const ROOM_INNER_HEIGHT = ROOM_ROWS * TILE

export const VIEW_WIDTH = (ROOM_COLS + WALL_TILES * 2) * TILE
export const VIEW_HEIGHT = (ROOM_ROWS + WALL_TILES * 2) * TILE

// Interior bounds in pixels — the walkable rectangle inside the walls.
export const ROOM_LEFT = WALL_TILES * TILE
export const ROOM_TOP = WALL_TILES * TILE
export const ROOM_RIGHT = ROOM_LEFT + ROOM_INNER_WIDTH
export const ROOM_BOTTOM = ROOM_TOP + ROOM_INNER_HEIGHT

export const ROOM_CENTER_X = ROOM_LEFT + ROOM_INNER_WIDTH / 2
export const ROOM_CENTER_Y = ROOM_TOP + ROOM_INNER_HEIGHT / 2

// ─── FIXED TIMESTEP ───
// The simulation always advances in whole ticks of this length. Rendering is
// decoupled and interpolates between the previous and current tick.

export const TICKS_PER_SECOND = 60
export const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND
export const MAX_FRAME_SECONDS = 0.25 // clamp to avoid the spiral of death
