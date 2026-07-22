import { SECONDS_PER_TICK, MAX_FRAME_SECONDS } from "../constants"

// ─── FIXED TIMESTEP GAME LOOP ───
// The update callback is invoked a whole number of times per frame, each with
// the exact same delta. Left-over time carries in the accumulator. The render
// callback receives an interpolation factor (0..1) describing how far the
// current frame sits between the last two simulated ticks, so movement stays
// smooth even though physics is locked to 60 Hz.

type UpdateCallback = (deltaSeconds: number) => void
type RenderCallback = (interpolation: number) => void

export class Loop {
  private readonly update: UpdateCallback
  private readonly render: RenderCallback

  private accumulator = 0
  private previousTimestamp = 0
  private running = false
  private frameHandle = 0

  constructor(update: UpdateCallback, render: RenderCallback) {
    this.update = update
    this.render = render
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.previousTimestamp = performance.now()
    this.frameHandle = requestAnimationFrame(this.onFrame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameHandle)
  }

  private readonly onFrame = (timestamp: number): void => {
    if (!this.running) return
    this.frameHandle = requestAnimationFrame(this.onFrame)

    let frameSeconds = (timestamp - this.previousTimestamp) / 1000
    this.previousTimestamp = timestamp
    if (frameSeconds > MAX_FRAME_SECONDS) frameSeconds = MAX_FRAME_SECONDS

    this.accumulator += frameSeconds
    while (this.accumulator >= SECONDS_PER_TICK) {
      this.update(SECONDS_PER_TICK)
      this.accumulator -= SECONDS_PER_TICK
    }

    const interpolation = this.accumulator / SECONDS_PER_TICK
    this.render(interpolation)
  }
}
