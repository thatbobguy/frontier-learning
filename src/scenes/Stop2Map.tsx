import { useRef } from 'react'
import { At, Label, Sky } from '../art/kit'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import type { SceneProps, Stop } from '../engine/types'

// Placeholder until this stop is built.
const BEATS = [{ id: 'soon', say: 'This part of the lesson is being built.' }]

function Scene({ beatIndex, playing, onAnimDone }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  useBeatTimeline(root, (tl) => { tl.addLabel('b0', 0); tl.to({}, { duration: 1 }) }, beatIndex, playing, onAnimDone)
  return (
    <g ref={root}>
      <Sky />
      <At x={800} y={450}><Label text="The map of math" size={64} /></At>
    </g>
  )
}

export const stop2: Stop = {
  id: 'map',
  title: 'The map of math',
  branch: 'map',

  beats: BEATS,
  Scene,
}
