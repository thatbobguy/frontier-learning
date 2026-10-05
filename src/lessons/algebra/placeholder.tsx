import { useEffect } from 'react'
import { Backdrop, Stars } from '../../art2/fx'
import { Title } from '../../art2/props'
import type { ChapterProps, Cue } from '../../flow/types'

/** Stands in for a chapter that is still being drawn: shows the line and lets the flow carry on. */
export function placeholderScene(title: string, cues: Cue[]) {
  return function Placeholder({ cueIndex, onAnimDone, onPlayDone }: ChapterProps) {
    useEffect(() => {
      const t = window.setTimeout(() => {
        onAnimDone()
        if (cues[cueIndex]?.play) onPlayDone()
      }, 600)
      return () => window.clearTimeout(t)
    }, [cueIndex, onAnimDone, onPlayDone])
    return (
      <g>
        <Backdrop kind="deep">
          <Stars />
        </Backdrop>
        <Title y={400} size={64}>
          {title}
        </Title>
        <Title y={480} size={32} color="#a9b1e0" weight={700}>
          {`Cue ${cueIndex + 1} of ${cues.length}`}
        </Title>
      </g>
    )
  }
}
