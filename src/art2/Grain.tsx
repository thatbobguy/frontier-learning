import { rng } from './fx'

let cached: string | null = null

/**
 * A tile of watercolour paper, made once in a canvas: big soft blotches where the paint
 * pooled, plus fine tooth.
 */
function paperTile(): string {
  if (cached) return cached
  const size = 384
  const r = rng(42)
  // low-frequency blotches: smooth value noise on a 12x12 lattice that wraps at the edges
  const G = 12
  const lattice = Array.from({ length: G * G }, () => (r() - 0.5) * 70)
  const at = (gx: number, gy: number) => lattice[((gy + G) % G) * G + ((gx + G) % G)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const fx = (px / size) * G
      const fy = (py / size) * G
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = smooth(fx - x0)
      const ty = smooth(fy - y0)
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
      const bot = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
      const i = (py * size + px) * 4
      d[i] = 128 + top * (1 - ty) + bot * ty
      d[i + 3] = 255
    }
  }
  for (let i = 0; i < size * size; i++) {
    const fine = (r() - 0.5) * 64 + (r() - 0.5) * 30
    // light grains become see-through white, dark ones see-through ink, so the layer can be
    // laid over the stage with plain alpha (a blend mode would cost a repaint every frame)
    const v = Math.max(0, Math.min(255, d[i * 4] + fine)) - 128
    const ink = v < 0
    d[i * 4] = ink ? 10 : 255
    d[i * 4 + 1] = ink ? 8 : 250
    d[i * 4 + 2] = ink ? 40 : 235
    d[i * 4 + 3] = Math.min(255, Math.abs(v) * 2)
  }
  ctx.putImageData(img, 0, 0)
  cached = c.toDataURL('image/png')
  return cached
}

/** A paper-grain layer laid over a stage (place it after the svg, inside a positioned box). */
export function Grain({ strength = 0.16 }: { strength?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `url(${paperTile()})`,
        backgroundSize: '384px 384px',
        opacity: strength,
        willChange: 'transform',
        borderRadius: 'inherit',
      }}
    />
  )
}
