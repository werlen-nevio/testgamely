import { VIEW_WIDTH, VIEW_HEIGHT } from "../constants"

// ─── RENDERER ───
// A thin wrapper around a single Canvas 2D context. The backing store is sized
// to the device pixel ratio for crisp edges, while CSS scales the canvas to fit
// the window preserving aspect ratio (letterboxed by the flex-centered body).
// All drawing happens in logical coordinates (VIEW_WIDTH x VIEW_HEIGHT).

export class Renderer {
  readonly context: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas 2D context is not available")
    this.canvas = canvas
    this.context = context
    this.applyResolution()
    window.addEventListener("resize", this.applyResolution)
  }

  clear(color: string): void {
    this.context.fillStyle = color
    this.context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  fillCircle(x: number, y: number, radius: number, color: string): void {
    const context = this.context
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.fillStyle = color
    this.context.fillRect(x, y, width, height)
  }

  // ─── RESOLUTION & FIT ───

  private readonly applyResolution = (): void => {
    const pixelRatio = window.devicePixelRatio || 1
    this.canvas.width = Math.round(VIEW_WIDTH * pixelRatio)
    this.canvas.height = Math.round(VIEW_HEIGHT * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.context.imageSmoothingEnabled = false

    const scale = Math.min(
      window.innerWidth / VIEW_WIDTH,
      window.innerHeight / VIEW_HEIGHT,
    )
    this.canvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`
    this.canvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`
  }
}
