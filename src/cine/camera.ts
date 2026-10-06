/**
 * A film camera for a scene's GSAP timeline.
 *
 * Put the world inside layers marked with a depth: `<g data-depth="0.4">` for far things,
 * `1` for the main plane, `1.6` for things right in front of the lens. The camera looks at a
 * point of the main plane (stage coordinates) with a zoom and a roll, and each layer moves
 * by its depth, so a pan slides the background slower and the foreground faster (parallax),
 * and a push-in grows the foreground faster than the background.
 *
 *   const cam = camera(root.current, { x: 800, y: 450, zoom: 1 })
 *   cam.to(tl, { x: 600, y: 500, zoom: 2.2 }, 'b1', 2.4, 'power2.inOut')
 *   cam.shake(tl, 'b1+=1', 0.5)
 *
 * Every move is a fromTo from wherever the camera was, so seeking to any beat redraws
 * correctly. Layers inside the scope are found at build time; there can be several
 * independent cameras if each has its own scope element.
 */
import gsap from 'gsap'

export interface Shot {
  x: number
  y: number
  zoom: number
  /** Roll, in degrees. */
  rot: number
  /** Small offsets added by shake; not meant to be set by hand. */
  jx: number
  jy: number
}

export interface Camera {
  /** Move the camera to a new shot. */
  to: (tl: gsap.core.Timeline, shot: Partial<Omit<Shot, 'jx' | 'jy'>>, at: gsap.Position, dur?: number, ease?: string) => void
  /** Cut straight to a new shot (no move). */
  cut: (tl: gsap.core.Timeline, shot: Partial<Omit<Shot, 'jx' | 'jy'>>, at: gsap.Position) => void
  /** A short handheld shake (a hit, a bang, a robot stomping). */
  shake: (tl: gsap.core.Timeline, at: gsap.Position, strength?: number, dur?: number) => void
  /** Apply the current shot to the layers (call after setting `state` by hand). */
  apply: () => void
  /** The live shot the layers show. */
  state: Shot
}

const CX = 800
const CY = 450

export function camera(scope: Element | null, start: Partial<Shot> = {}): Camera {
  const state: Shot = { x: CX, y: CY, zoom: 1, rot: 0, jx: 0, jy: 0, ...start }
  // What the camera will be doing at the end of the moves added so far (build time only).
  let planned: Shot = { ...state }
  const layers = scope ? ([...scope.querySelectorAll('[data-depth]')] as SVGGElement[]) : []
  const depths = layers.map((l) => parseFloat(l.getAttribute('data-depth') ?? '1') || 1)

  const apply = () => {
    for (let i = 0; i < layers.length; i++) {
      const d = depths[i]
      // Far layers react less to both zoom and pan; near ones more.
      const z = Math.pow(state.zoom, d)
      const px = CX + (state.x - CX) * d + state.jx * d
      const py = CY + (state.y - CY) * d + state.jy * d
      layers[i].setAttribute('transform', `translate(${CX} ${CY}) rotate(${state.rot}) scale(${z}) translate(${-px} ${-py})`)
    }
  }
  apply()

  const to: Camera['to'] = (tl, shot, at, dur = 2, ease = 'power2.inOut') => {
    const from = { ...planned }
    const next = { ...planned, ...shot }
    planned = next
    tl.fromTo(state, { x: from.x, y: from.y, zoom: from.zoom, rot: from.rot }, { x: next.x, y: next.y, zoom: next.zoom, rot: next.rot, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
  }

  const cut: Camera['cut'] = (tl, shot, at) => {
    // A very short move rather than a set, so seeking back across it redraws too.
    to(tl, shot, at, 0.001, 'none')
  }

  const shake: Camera['shake'] = (tl, at, strength = 1, dur = 0.5) => {
    const steps = Math.max(3, Math.round(dur / 0.05))
    const t = gsap.timeline()
    for (let i = 0; i < steps; i++) {
      const k = (1 - i / steps) * 14 * strength
      t.to(state, { jx: (Math.random() - 0.5) * k, jy: (Math.random() - 0.5) * k, duration: dur / steps, ease: 'none', onUpdate: apply })
    }
    t.to(state, { jx: 0, jy: 0, duration: 0.05, onUpdate: apply })
    tl.add(t, at)
  }

  return { to, cut, shake, apply, state }
}
