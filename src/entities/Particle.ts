import type { Renderer } from "../core/Renderer"
import { lerp } from "../core/math"
import { COLOR } from "../theme"

// ─── PARTICLES ───
// Pooled, allocation-free eye-candy: sparks for hits and deaths, directional
// impact sprays, footstep dust, and expanding shockwave rings. Colours are
// always passed in (from theme tokens by the caller) — this module owns motion
// and drawing, never palette.

type ParticleKind = "spark" | "ring"

interface Particle {
  active: boolean
  kind: ParticleKind
  x: number
  y: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
  lifeTicks: number
  maxLifeTicks: number
  size: number
  ringMaxRadius: number
  color: string
}

const createInactiveParticle = (): Particle => ({
  active: false,
  kind: "spark",
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  velocityX: 0,
  velocityY: 0,
  lifeTicks: 0,
  maxLifeTicks: 1,
  size: 3,
  ringMaxRadius: 0,
  color: COLOR.flash,
})

const DRAG = 0.9

export class ParticlePool {
  private readonly items: Particle[]

  constructor(capacity: number) {
    this.items = Array.from({ length: capacity }, createInactiveParticle)
  }

  private take(): Particle | null {
    return this.items.find((candidate) => !candidate.active) ?? null
  }

  // Omnidirectional spark burst.
  burst(x: number, y: number, count: number, color: string, speed: number, lifeTicks: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = this.take()
      if (!particle) return
      const angle = Math.random() * Math.PI * 2
      const magnitude = speed * (0.4 + Math.random() * 0.6)
      this.arm(particle, x, y, Math.cos(angle) * magnitude, Math.sin(angle) * magnitude, color, lifeTicks)
    }
  }

  // Impact spray: sparks fan back out of a surface, away from the travel
  // direction (velocityX/Y is the incoming projectile velocity).
  impact(x: number, y: number, velocityX: number, velocityY: number, color: string): void {
    const speed = Math.hypot(velocityX, velocityY) || 1
    const backX = -velocityX / speed
    const backY = -velocityY / speed
    for (let index = 0; index < 5; index += 1) {
      const particle = this.take()
      if (!particle) return
      const spread = (Math.random() - 0.5) * 1.6
      const cos = Math.cos(spread)
      const sin = Math.sin(spread)
      const magnitude = 90 + Math.random() * 90
      this.arm(
        particle,
        x,
        y,
        (backX * cos - backY * sin) * magnitude,
        (backX * sin + backY * cos) * magnitude,
        color,
        12,
      )
    }
  }

  // Soft footstep dust, drifting opposite the movement.
  dust(x: number, y: number, velocityX: number, velocityY: number, color: string): void {
    const particle = this.take()
    if (!particle) return
    this.arm(particle, x, y, -velocityX * 0.15, -velocityY * 0.15, color, 26)
    particle.size = 3 + Math.random() * 2
  }

  // A single expanding ring — the punch of an explosion or a boss death.
  shockwave(x: number, y: number, maxRadius: number, color: string): void {
    const particle = this.take()
    if (!particle) return
    particle.active = true
    particle.kind = "ring"
    particle.x = x
    particle.y = y
    particle.velocityX = 0
    particle.velocityY = 0
    particle.lifeTicks = 20
    particle.maxLifeTicks = 20
    particle.ringMaxRadius = maxRadius
    particle.color = color
  }

  private arm(
    particle: Particle,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    color: string,
    lifeTicks: number,
  ): void {
    particle.active = true
    particle.kind = "spark"
    particle.x = x
    particle.y = y
    particle.previousX = x
    particle.previousY = y
    particle.velocityX = velocityX
    particle.velocityY = velocityY
    particle.lifeTicks = lifeTicks
    particle.maxLifeTicks = lifeTicks
    particle.size = 2 + Math.random() * 2.5
    particle.color = color
  }

  update(deltaSeconds: number): void {
    for (const particle of this.items) {
      if (!particle.active) continue
      particle.previousX = particle.x
      particle.previousY = particle.y
      particle.x += particle.velocityX * deltaSeconds
      particle.y += particle.velocityY * deltaSeconds
      particle.velocityX *= DRAG
      particle.velocityY *= DRAG
      particle.lifeTicks -= 1
      if (particle.lifeTicks <= 0) particle.active = false
    }
  }

  render(renderer: Renderer, interpolation: number): void {
    const context = renderer.context
    renderer.additive(() => {
      for (const particle of this.items) {
        if (!particle.active) continue
        const fade = particle.lifeTicks / particle.maxLifeTicks

        if (particle.kind === "ring") {
          const radius = particle.ringMaxRadius * (1 - fade)
          context.globalAlpha = fade
          renderer.strokeCircle(particle.x, particle.y, radius, particle.color, 3 * fade + 0.5)
          continue
        }

        const x = lerp(particle.previousX, particle.x, interpolation)
        const y = lerp(particle.previousY, particle.y, interpolation)
        context.globalAlpha = Math.max(0, fade)
        context.shadowColor = particle.color
        context.shadowBlur = 8
        renderer.fillCircle(x, y, particle.size * fade + 0.5, particle.color)
      }
      context.shadowBlur = 0
      context.globalAlpha = 1
    })
  }
}
