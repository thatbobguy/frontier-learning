import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** Converts a pointer position on screen to the stage's 1600 x 900 coordinates. */
export function toStage(el: Element, clientX: number, clientY: number) {
  const svg = (el as SVGElement).ownerSVGElement ?? (el as SVGSVGElement)
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: pt.x, y: pt.y }
}

export interface DragHandlers {
  onStart?: (p: { x: number; y: number }) => void
  onMove: (p: { x: number; y: number }) => void
  onEnd?: (p: { x: number; y: number }) => void
}

/**
 * Pointer dragging for SVG pieces (mouse, touch and pen). Spread the returned
 * handler onto the element: `<g {...drag}>`. Positions are in stage coordinates.
 */
export function useDrag(handlers: DragHandlers) {
  const h = useRef(handlers)
  h.current = handlers
  return {
    onPointerDown: (e: ReactPointerEvent<Element>) => {
      e.preventDefault()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      h.current.onStart?.(toStage(el, e.clientX, e.clientY))
      const move = (ev: PointerEvent) => h.current.onMove(toStage(el, ev.clientX, ev.clientY))
      const up = (ev: PointerEvent) => {
        el.removeEventListener('pointermove', move as EventListener)
        el.removeEventListener('pointerup', up as EventListener)
        el.removeEventListener('pointercancel', up as EventListener)
        h.current.onEnd?.(toStage(el, ev.clientX, ev.clientY))
      }
      el.addEventListener('pointermove', move as EventListener)
      el.addEventListener('pointerup', up as EventListener)
      el.addEventListener('pointercancel', up as EventListener)
    },
    style: { cursor: 'grab', touchAction: 'none' as const },
  }
}

/** Renders the stage SVG to a PNG (base64, no prefix) so the tutor can see what the student sees. */
export async function snapshotStage(svg: SVGSVGElement, width = 800): Promise<string | null> {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String((width * 9) / 16))
    const xml = new XMLSerializer().serializeToString(clone)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('snapshot failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = (width * 9) / 16
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1] ?? null
  } catch {
    return null
  }
}
