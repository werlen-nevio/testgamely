import { normalize, type Vector2 } from "./math"

// ─── INPUT ───
// Keyboard is the primary device: WASD moves, the arrow keys shoot. A gamepad,
// if present, layers on top — left stick moves, right stick aims. Everything is
// exposed as two intent vectors plus edge-triggered button queries, so the rest
// of the game never touches raw key codes.

const MOVE_KEYS_LEFT = "KeyA"
const MOVE_KEYS_RIGHT = "KeyD"
const MOVE_KEYS_UP = "KeyW"
const MOVE_KEYS_DOWN = "KeyS"

const AIM_KEYS_LEFT = "ArrowLeft"
const AIM_KEYS_RIGHT = "ArrowRight"
const AIM_KEYS_UP = "ArrowUp"
const AIM_KEYS_DOWN = "ArrowDown"

// Keys whose browser default (scrolling) we must suppress while playing.
const SWALLOWED_CODES = new Set<string>([
  AIM_KEYS_LEFT,
  AIM_KEYS_RIGHT,
  AIM_KEYS_UP,
  AIM_KEYS_DOWN,
  "Space",
])

const STICK_DEADZONE = 0.28

export class Input {
  private readonly heldCodes = new Set<string>()
  private readonly pressedThisTick = new Set<string>()

  constructor() {
    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)
    window.addEventListener("blur", this.onBlur)
  }

  // ─── QUERIES ───

  isDown(code: string): boolean {
    return this.heldCodes.has(code)
  }

  wasJustPressed(code: string): boolean {
    return this.pressedThisTick.has(code)
  }

  moveVector(): Vector2 {
    let x = 0
    let y = 0
    if (this.isDown(MOVE_KEYS_LEFT)) x -= 1
    if (this.isDown(MOVE_KEYS_RIGHT)) x += 1
    if (this.isDown(MOVE_KEYS_UP)) y -= 1
    if (this.isDown(MOVE_KEYS_DOWN)) y += 1

    const stick = this.readGamepadStick(0, 1)
    if (stick) return stick

    return normalize(x, y)
  }

  aimVector(): Vector2 {
    let x = 0
    let y = 0
    if (this.isDown(AIM_KEYS_LEFT)) x -= 1
    if (this.isDown(AIM_KEYS_RIGHT)) x += 1
    if (this.isDown(AIM_KEYS_UP)) y -= 1
    if (this.isDown(AIM_KEYS_DOWN)) y += 1
    if (x !== 0 || y !== 0) return normalize(x, y)

    const stick = this.readGamepadStick(2, 3)
    if (stick) return stick

    return { x: 0, y: 0 }
  }

  // Must be called once at the end of every tick so edge queries only fire for
  // a single simulation step.
  endTick(): void {
    this.pressedThisTick.clear()
  }

  // ─── GAMEPAD (BONUS) ───

  private readGamepadStick(axisX: number, axisY: number): Vector2 | null {
    const pads = navigator.getGamepads?.()
    if (!pads) return null
    for (const pad of pads) {
      if (!pad) continue
      const rawX = pad.axes[axisX] ?? 0
      const rawY = pad.axes[axisY] ?? 0
      if (Math.hypot(rawX, rawY) < STICK_DEADZONE) continue
      return { x: rawX, y: rawY }
    }
    return null
  }

  // ─── EVENT HANDLERS ───

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (SWALLOWED_CODES.has(event.code)) event.preventDefault()
    if (!this.heldCodes.has(event.code)) this.pressedThisTick.add(event.code)
    this.heldCodes.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.heldCodes.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.heldCodes.clear()
    this.pressedThisTick.clear()
  }
}
