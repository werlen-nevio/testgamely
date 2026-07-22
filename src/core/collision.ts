// ─── COLLISION PRIMITIVES ───
// Narrow-phase tests. All entities are circles, so this stays a single squared-
// distance comparison — no square roots in the hot path.

export const circlesOverlap = (
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
): boolean => {
  const deltaX = bx - ax
  const deltaY = by - ay
  const combinedRadius = aRadius + bRadius
  return deltaX * deltaX + deltaY * deltaY <= combinedRadius * combinedRadius
}
