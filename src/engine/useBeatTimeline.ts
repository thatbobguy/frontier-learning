import gsap from 'gsap'
import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Drives a scene's animation one beat at a time.
 *
 * `build` adds tweens to a paused GSAP timeline and marks where each beat starts with
 * `tl.addLabel('b0')`, `tl.addLabel('b1')`, ... (one label per beat, in order). Use
 * `fromTo` or `set` + `to` so jumping back to an earlier beat redraws correctly.
 *
 * When the beat changes, the timeline plays from that beat's label to the next one and
 * then calls onAnimDone. Jumping to any beat seeks straight to its label first.
 */
export function useBeatTimeline(
  scope: RefObject<Element | null>,
  build: (tl: gsap.core.Timeline) => void,
  beatIndex: number,
  playing: boolean,
  onAnimDone: () => void,
) {
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const ctxRef = useRef<gsap.Context | null>(null)
  const doneRef = useRef(onAnimDone)
  doneRef.current = onAnimDone

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true })
      build(tl)
      tlRef.current = tl
    }, scope.current ?? undefined)
    ctxRef.current = ctx
    return () => {
      tweenRef.current?.kill()
      ctx.revert()
    }
    // The timeline is built once per scene mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    const tl = tlRef.current
    if (!tl) return
    const start = tl.labels[`b${beatIndex}`] ?? 0
    const end = tl.labels[`b${beatIndex + 1}`] ?? tl.duration()
    tweenRef.current?.kill()
    tl.pause()
    tl.seek(start, false)
    if (end - start < 0.01) {
      tweenRef.current = null
      doneRef.current()
      return
    }
    const tween = tl.tweenFromTo(start, end, {
      ease: 'none',
      onComplete: () => doneRef.current(),
    })
    tweenRef.current = tween
    if (!playing) tween.pause()
    // `playing` is applied by the effect below; only the beat restarts the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIndex])

  useLayoutEffect(() => {
    const tween = tweenRef.current
    if (!tween) return
    if (playing) tween.resume()
    else tween.pause()
  }, [playing])
}
