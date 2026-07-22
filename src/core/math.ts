// ─── SMALL MATH TOOLBOX ───
// Deliberately tiny and allocation-light. Vector helpers that run in the hot
// path return primitives or write into caller-owned objects rather than
// allocating; the convenience `normalize` is only used on cold paths (input).

export interface Vector2 {
  x: number
  y: number
}

export const clamp = (value: number, minimum: number, maximum: number): number => {
  if (value < minimum) return minimum
  if (value > maximum) return maximum
  return value
}

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount

export const length = (x: number, y: number): number => Math.hypot(x, y)

export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(bx - ax, by - ay)

export const normalize = (x: number, y: number): Vector2 => {
  const magnitude = Math.hypot(x, y)
  if (magnitude === 0) return { x: 0, y: 0 }
  return { x: x / magnitude, y: y / magnitude }
}

export const approach = (value: number, target: number, response: number): number =>
  value + (target - value) * response
