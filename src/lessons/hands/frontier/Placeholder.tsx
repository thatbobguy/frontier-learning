import { useEffect } from 'react'
import { C, SERIF } from '../../../cine/palette'
import type { Chapter, ChapterProps } from '../../../flow/types'
import { Blueprint } from '../shared/kit'

/** Stands in for the film until its chapters are built. Remove once chapters exist. */
function Scene({ onAnimDone }: ChapterProps) {
  useEffect(() => onAnimDone(), [onAnimDone])
  return (
    <g>
      <Blueprint />
      <text x={800} y={460} textAnchor="middle" fill={C.mist} fontFamily={SERIF} fontSize={56}>
        This film is being made.
      </text>
    </g>
  )
}

export const placeholder: Chapter = {
  id: 'soon',
  title: 'Coming soon',
  cues: [{ id: 'soon', say: '' }],
  Scene,
}
