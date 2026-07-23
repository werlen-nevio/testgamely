import { clamp, lerp } from "./math"
import { TRAUMA, CAMERA } from "../feel"
import { ROOM_CENTER_X, ROOM_CENTER_Y } from "../constants"

// ─── CAMERA ───
// A single trauma value drives all screenshake (offset + a slight rotation),
// scaled quadratically so tiny traumas are imperceptible and big ones punch.
// On top of shake sits a soft follow toward the player plus a look-ahead in the
// aim direction, and a short zoom-pulse for moments like a room clearing. The
// room is one screen, so offsets are clamped small and the backdrop is drawn
// oversized (see Room) so a nudge never reveals the void.

export class Camera {
  trauma = 0
  private offsetX = 0
  private offsetY = 0
  private zoom = 1
  private zoomPulse = 0
  private shakeX = 0
  private shakeY = 0
  private shakeAngle = 0

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  pulseZoom(amount: number = CAMERA.zoomPulse): void {
    this.zoomPulse = amount
  }

  update(deltaSeconds: number, targetOffsetX: number, targetOffsetY: number): void {
    this.trauma = Math.max(0, this.trauma - TRAUMA.decayPerSecond * deltaSeconds)
    const shake = this.trauma * this.trauma
    this.shakeX = (Math.random() * 2 - 1) * TRAUMA.maxShake * shake
    this.shakeY = (Math.random() * 2 - 1) * TRAUMA.maxShake * shake
    this.shakeAngle = (Math.random() * 2 - 1) * TRAUMA.maxAngle * shake

    this.offsetX = lerp(this.offsetX, clamp(targetOffsetX, -CAMERA.maxOffset, CAMERA.maxOffset), CAMERA.follow)
    this.offsetY = lerp(this.offsetY, clamp(targetOffsetY, -CAMERA.maxOffset, CAMERA.maxOffset), CAMERA.follow)

    this.zoomPulse *= CAMERA.zoomDecay
    this.zoom = 1 + this.zoomPulse
  }

  begin(context: CanvasRenderingContext2D): void {
    context.save()
    context.translate(ROOM_CENTER_X, ROOM_CENTER_Y)
    context.rotate(this.shakeAngle)
    context.scale(this.zoom, this.zoom)
    context.translate(-ROOM_CENTER_X, -ROOM_CENTER_Y)
    context.translate(this.shakeX - this.offsetX, this.shakeY - this.offsetY)
  }

  end(context: CanvasRenderingContext2D): void {
    context.restore()
  }
}
