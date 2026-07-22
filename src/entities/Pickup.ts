import type { Renderer } from "../core/Renderer"
import type { Player } from "./Player"
import { lerp } from "../core/math"
import { createTransform, rememberPreviousPosition, type Transform } from "./components"

// ─── GROUND PICKUPS ───
// Hearts, coins, bombs and keys lie on the floor. They drift toward a nearby
// player (a gentle magnet) and are collected on contact. What collection does
// is decided by the Run, keeping this file about presentation and motion.

export type PickupType = "heart" | "coin" | "bomb" | "key"

export interface Pickup {
  active: boolean
  type: PickupType
  transform: Transform
  radius: number
  bobTicks: number
}

export const createPickup = (type: PickupType, x: number, y: number): Pickup => ({
  active: true,
  type,
  transform: createTransform(x, y),
  radius: 10,
  bobTicks: Math.floor(Math.random() * 60),
})

const MAGNET_RANGE = 62
const MAGNET_PULL = 0.22

export const updatePickup = (pickup: Pickup, player: Player, deltaSeconds: number): void => {
  rememberPreviousPosition(pickup.transform)
  pickup.bobTicks += 1

  const deltaX = player.transform.x - pickup.transform.x
  const deltaY = player.transform.y - pickup.transform.y
  const distance = Math.hypot(deltaX, deltaY)
  if (distance < MAGNET_RANGE && distance > 0.01) {
    pickup.transform.velocityX = (deltaX / distance) * (MAGNET_RANGE - distance) * MAGNET_PULL * 3
    pickup.transform.velocityY = (deltaY / distance) * (MAGNET_RANGE - distance) * MAGNET_PULL * 3
  } else {
    pickup.transform.velocityX *= 0.8
    pickup.transform.velocityY *= 0.8
  }

  pickup.transform.x += pickup.transform.velocityX * deltaSeconds
  pickup.transform.y += pickup.transform.velocityY * deltaSeconds
}

export const renderPickup = (renderer: Renderer, pickup: Pickup, interpolation: number): void => {
  const x = lerp(pickup.transform.previousX, pickup.transform.x, interpolation)
  const bob = Math.sin(pickup.bobTicks * 0.12) * 2
  const y = lerp(pickup.transform.previousY, pickup.transform.y, interpolation) + bob
  const context = renderer.context

  switch (pickup.type) {
    case "heart":
      drawHeart(renderer, x, y)
      break
    case "coin":
      renderer.fillCircle(x, y, 8, "#e7c14a")
      context.strokeStyle = "#8a6f1f"
      context.lineWidth = 2
      context.stroke()
      break
    case "bomb":
      renderer.fillCircle(x, y, 9, "#2c2c30")
      context.strokeStyle = "#0f0f12"
      context.lineWidth = 2
      context.stroke()
      renderer.fillRect(x - 1, y - 13, 2, 5, "#c8843a")
      break
    case "key":
      renderer.fillCircle(x - 3, y - 3, 5, "#d8c65a")
      renderer.fillRect(x - 1, y - 1, 3, 10, "#d8c65a")
      break
  }
}

const drawHeart = (renderer: Renderer, x: number, y: number): void => {
  const context = renderer.context
  context.fillStyle = "#d8434a"
  context.strokeStyle = "#7a1f24"
  context.lineWidth = 2
  context.beginPath()
  context.arc(x - 4, y - 2, 4, Math.PI, 0)
  context.arc(x + 4, y - 2, 4, Math.PI, 0)
  context.lineTo(x, y + 8)
  context.closePath()
  context.fill()
  context.stroke()
}
