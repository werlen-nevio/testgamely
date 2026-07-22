// ─── SHARED ENTITY COMPONENTS ───
// Entities are plain objects assembled from these components — no inheritance,
// no base class. A system needs only the components it touches, so a collision
// routine can accept `{ transform, body }` regardless of what kind of entity it
// belongs to.

export interface Transform {
  x: number
  y: number
  // Position at the start of the current tick, kept so rendering can
  // interpolate toward the new position between fixed updates.
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
}

export interface Body {
  radius: number
}

export const createTransform = (x: number, y: number): Transform => ({
  x,
  y,
  previousX: x,
  previousY: y,
  velocityX: 0,
  velocityY: 0,
})

// Copies the current position into the previous-position fields. Call once at
// the very top of an entity's per-tick update, before integrating movement.
export const rememberPreviousPosition = (transform: Transform): void => {
  transform.previousX = transform.x
  transform.previousY = transform.y
}
