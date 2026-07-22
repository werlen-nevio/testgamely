import type { Renderer } from "../core/Renderer"
import { clamp } from "../core/math"
import { TILE, ROOM_LEFT, ROOM_TOP } from "../constants"
import type { Transform } from "./components"

// ─── OBSTACLE ───
// A tile-aligned rock. Blocks movement and stops projectiles; destructible so
// bombs can clear it (and open secret walls) later. Stored as an axis-aligned
// box for cheap circle-vs-box resolution.

export interface Obstacle {
  col: number
  row: number
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
  destructible: boolean
  destroyed: boolean
}

export const createObstacle = (col: number, row: number, destructible = true): Obstacle => {
  const left = ROOM_LEFT + col * TILE
  const top = ROOM_TOP + row * TILE
  return {
    col,
    row,
    left,
    top,
    right: left + TILE,
    bottom: top + TILE,
    centerX: left + TILE / 2,
    centerY: top + TILE / 2,
    destructible,
    destroyed: false,
  }
}

// Pushes a circular body out of any obstacle it overlaps and cancels the sliver
// of velocity aimed into the wall, so bodies slide along rocks instead of
// sticking. Mutates the transform in place.
export const resolveCircleAgainstObstacles = (
  transform: Transform,
  radius: number,
  obstacles: readonly Obstacle[],
): void => {
  for (const obstacle of obstacles) {
    if (obstacle.destroyed) continue

    const nearestX = clamp(transform.x, obstacle.left, obstacle.right)
    const nearestY = clamp(transform.y, obstacle.top, obstacle.bottom)
    let deltaX = transform.x - nearestX
    let deltaY = transform.y - nearestY
    let distanceSquared = deltaX * deltaX + deltaY * deltaY
    if (distanceSquared >= radius * radius) continue

    // Center sits inside the box: push out along the shallowest axis instead.
    if (distanceSquared === 0) {
      const toLeft = transform.x - obstacle.left
      const toRight = obstacle.right - transform.x
      const toTop = transform.y - obstacle.top
      const toBottom = obstacle.bottom - transform.y
      const minimum = Math.min(toLeft, toRight, toTop, toBottom)
      if (minimum === toLeft) deltaX = -1
      else if (minimum === toRight) deltaX = 1
      else if (minimum === toTop) deltaY = -1
      else deltaY = 1
      distanceSquared = 1
    }

    const distance = Math.sqrt(distanceSquared)
    const normalX = deltaX / distance
    const normalY = deltaY / distance
    const penetration = radius - distance
    transform.x += normalX * penetration
    transform.y += normalY * penetration

    // Remove velocity component pointing into the obstacle.
    const intoWall = transform.velocityX * normalX + transform.velocityY * normalY
    if (intoWall < 0) {
      transform.velocityX -= intoWall * normalX
      transform.velocityY -= intoWall * normalY
    }
  }
}

// True if a point (a projectile centre) sits inside a live obstacle.
export const pointHitsObstacle = (x: number, y: number, obstacles: readonly Obstacle[]): boolean => {
  for (const obstacle of obstacles) {
    if (obstacle.destroyed) continue
    if (x >= obstacle.left && x <= obstacle.right && y >= obstacle.top && y <= obstacle.bottom) {
      return true
    }
  }
  return false
}

const ROCK_FACE = "#5a4b42"
const ROCK_TOP = "#6f5d51"
const ROCK_EDGE = "#33291f"

export const renderObstacle = (renderer: Renderer, obstacle: Obstacle): void => {
  if (obstacle.destroyed) return
  const context = renderer.context
  const inset = 3
  renderer.fillRect(
    obstacle.left + inset,
    obstacle.top + inset,
    TILE - inset * 2,
    TILE - inset * 2,
    ROCK_FACE,
  )
  renderer.fillRect(obstacle.left + inset, obstacle.top + inset, TILE - inset * 2, 6, ROCK_TOP)
  context.lineWidth = 2
  context.strokeStyle = ROCK_EDGE
  context.strokeRect(obstacle.left + inset, obstacle.top + inset, TILE - inset * 2, TILE - inset * 2)
}
