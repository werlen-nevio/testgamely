import { clamp } from "./math"

// ─── SPATIAL GRID ───
// A uniform bucket grid for broad-phase collision. Insert every candidate once
// per tick, then query a small circular region instead of testing every pair
// (n² → roughly linear). Query results are written into a reused `result`
// buffer so the hot path allocates nothing after warmup.

export class SpatialGrid {
  private readonly cellSize: number
  private readonly columns: number
  private readonly rows: number
  private readonly buckets: number[][]

  readonly result: number[] = []

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize
    this.columns = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    this.buckets = Array.from({ length: this.columns * this.rows }, () => [])
  }

  clear(): void {
    for (const bucket of this.buckets) bucket.length = 0
  }

  insert(id: number, x: number, y: number): void {
    const column = this.columnOf(x)
    const row = this.rowOf(y)
    this.buckets[row * this.columns + column].push(id)
  }

  // Fills `result` with every id in the cells overlapping the query circle and
  // returns how many were found. This is broad-phase only — the caller still
  // does a precise overlap test on each candidate.
  query(x: number, y: number, radius: number): number {
    this.result.length = 0
    const minColumn = this.columnOf(x - radius)
    const maxColumn = this.columnOf(x + radius)
    const minRow = this.rowOf(y - radius)
    const maxRow = this.rowOf(y + radius)

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const bucket = this.buckets[row * this.columns + column]
        for (const id of bucket) this.result.push(id)
      }
    }
    return this.result.length
  }

  private columnOf(x: number): number {
    return clamp(Math.floor(x / this.cellSize), 0, this.columns - 1)
  }

  private rowOf(y: number): number {
    return clamp(Math.floor(y / this.cellSize), 0, this.rows - 1)
  }
}
