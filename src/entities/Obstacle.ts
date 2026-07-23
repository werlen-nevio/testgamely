import type { Renderer } from "../core/Renderer"
import { clamp } from "../core/math"
import { COLOR, shade } from "../theme"
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

// Built, not living: dark angular stone that swallows light. A raised top-face
// gives pseudo-height; no glow (ART_DIRECTION §3).
export const renderObstacle = (renderer: Renderer, obstacle: Obstacle): void => {
  if (obstacle.destroyed) return
  const context = renderer.context
  const inset = 3
  const size = TILE - inset * 2
  const left = obstacle.left + inset
  const top = obstacle.top + inset

  // Drop shadow into the floor.
  renderer.fillRect(left + 2, top + 4, size, size, COLOR.ink)
  // Front face.
  renderer.fillRect(left, top + 5, size, size - 5, shade(COLOR.bgStone, -0.25))
  // Top face, catching a sliver of the ambient.
  renderer.fillRect(left, top, size, 7, shade(COLOR.bgStone, 0.18))
  context.strokeStyle = COLOR.ink
  context.lineWidth = 1.5
  context.strokeRect(left, top, size, size)
}
