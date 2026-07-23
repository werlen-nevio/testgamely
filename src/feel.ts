// ─── GAME-FEEL TOKENS ───
// Mirrors ART_DIRECTION.md §6. Every screenshake amount, hit-stop length and
// camera constant lives here; nothing hardcodes a feel value elsewhere.

export const TRAUMA = {
  decayPerSecond: 1.6,
  maxShake: 15, // px at trauma 1 (shake scales with trauma², so small traumas stay subtle)
  maxAngle: 0.03, // rad
  // Additive amounts per event (clamped to 1).
  shoot: 0.05,
  enemyHit: 0.12,
  enemyKill: 0.18,
  playerHit: 0.4,
  explosion: 0.55,
  bossPhase: 0.5,
  bossDeath: 1.0,
  roomClear: 0.15,
} as const

// Frames of full simulation freeze so a heavy blow "lands".
export const HITSTOP = {
  kill: 2,
  heavyKill: 4,
  playerHit: 3,
  bossPhase: 6,
  bossDeath: 8,
} as const

export const HIT_FLASH_TICKS = 4
export const HIT_KNOCKBACK = 6

export const HURT = {
  pulseTicks: 24,
  pulseAlpha: 0.5,
  slowmoTicks: 10,
  slowmoEvery: 3, // during slow-motion, advance the sim once every N ticks
} as const

export const CAMERA = {
  follow: 0.1,
  maxOffset: 12,
  lookAhead: 10,
  zoomPulse: 0.035,
  zoomDecay: 0.88,
} as const
