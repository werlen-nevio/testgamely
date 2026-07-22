import type { Renderer } from "../core/Renderer"
import { lerp } from "../core/math"

// ─── PARTICLES ───
// Pure eye-candy: short-lived sparks for hits, deaths and explosions. Pooled so
// spraying dozens per frame never allocates.

interface Particle {
  active: boolean
  x: number
  y: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
  lifeTicks: number
  maxLifeTicks: number
  size: number
  color: string
}

const createInactiveParticle = (): Particle => ({
  active: false,
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  velocityX: 0,
  velocityY: 0,
  lifeTicks: 0,
  maxLifeTicks: 1,
  size: 3,
  color: "#ffffff",
})

const DRAG = 0.9

export class ParticlePool {
  private readonly items: Particle[]

  constructor(capacity: number) {
    this.items = Array.from({ length: capacity }, createInactiveParticle)
  }

  // Sprays `count` sparks outward from a point.
  burst(x: number, y: number, count: number, color: string, speed: number, lifeTicks: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = this.items.find((candidate) => !candidate.active)
      if (!particle) return
      const angle = Math.random() * Math.PI * 2
      const magnitude = speed * (0.4 + Math.random() * 0.6)
      particle.active = true
      particle.x = x
      particle.y = y
      particle.previousX = x
      particle.previousY = y
      particle.velocityX = Math.cos(angle) * magnitude
      particle.velocityY = Math.sin(angle) * magnitude
      particle.lifeTicks = lifeTicks
      particle.maxLifeTicks = lifeTicks
      particle.size = 2 + Math.random() * 2.5
      particle.color = color
    }
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
    for (const particle of this.items) {
      if (!particle.active) continue
      const x = lerp(particle.previousX, particle.x, interpolation)
      const y = lerp(particle.previousY, particle.y, interpolation)
      const fade = particle.lifeTicks / particle.maxLifeTicks
      context.globalAlpha = Math.max(0, fade)
      renderer.fillCircle(x, y, particle.size * fade + 0.5, particle.color)
    }
    context.globalAlpha = 1
  }
}
