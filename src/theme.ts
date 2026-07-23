import { clamp } from "./core/math"

// ─── THEME ───
// The single source of colour in the code, mirrored 1:1 from ART_DIRECTION.md.
// Nothing renders a colour that is not a token here or a shade()/rgba() of one.
// If a value changes in the document, it changes here — and only here.

export const COLOR = {
  // World & background
  ink: "#03070d",
  bgAbyss: "#050c16",
  bgDeep: "#0a1826",
  bgStone: "#0f2233",
  bgMist: "#173a52",
  // Player — the only warm family in the world
  playerCore: "#ffe7ad",
  playerGlow: "#ff9d3c",
  // Bioluminescence — neutral / friendly / interactive
  bio: "#3fe0d0",
  bioDeep: "#157f79",
  // Danger — reserved signal, enemy fire / traps only
  danger: "#ff2f6a",
  dangerGlow: "#ff86ac",
  // Feedback
  flash: "#ffffff",
  hurt: "#ff1f3a",
  // Creatures (cold; never warm, never the danger hue)
  hunter: "#6f63ff",
  leaper: "#34d98c",
  caster: "#46b6ff",
  shard: "#9fe8ff",
  brood: "#c05ad6",
  bossBody: "#5a2fa0",
  bossHot: "#ff3fa0",
} as const

export type ColorToken = keyof typeof COLOR

// ─── DERIVATION ───
// The only sanctioned way to make a colour that is not a raw token: a defined
// lightening (amount > 0) or darkening (amount < 0) of one. Results are memoised
// so per-frame rendering never allocates strings on the hot path.

const shadeCache = new Map<string, string>()
const rgbaCache = new Map<string, string>()

const toChannels = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const toHex = (r: number, g: number, b: number): string =>
  "#" +
  [r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")

export const shade = (hex: string, amount: number): string => {
  const key = `${hex}:${amount}`
  const cached = shadeCache.get(key)
  if (cached) return cached

  const [r, g, b] = toChannels(hex)
  let result: string
  if (amount >= 0) {
    result = toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
  } else {
    const keep = 1 + amount
    result = toHex(r * keep, g * keep, b * keep)
  }
  shadeCache.set(key, result)
  return result
}

// Blends two tokens (t: 0 → a, 1 → b). Used for floor tints that shift the same
// palette per depth, so every floor stays inside the token set.
const mixCache = new Map<string, string>()
export const mix = (hexA: string, hexB: string, t: number): string => {
  const key = `${hexA}:${hexB}:${t}`
  const cached = mixCache.get(key)
  if (cached) return cached
  const [ar, ag, ab] = toChannels(hexA)
  const [br, bg, bb] = toChannels(hexB)
  const result = toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
  mixCache.set(key, result)
  return result
}

export const rgba = (hex: string, alpha: number): string => {
  const key = `${hex}:${alpha}`
  const cached = rgbaCache.get(key)
  if (cached) return cached
  const [r, g, b] = toChannels(hex)
  const result = `rgba(${r}, ${g}, ${b}, ${alpha})`
  rgbaCache.set(key, result)
  return result
}
