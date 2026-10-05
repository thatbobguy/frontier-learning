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
      <At x={800} y={450}><Label text="Bundling by ten" size={64} /></At>
    </g>
  )
}

export const stop4: Stop = {
  id: 'bundles',
  title: 'Bundling by ten',
  branch: 'howMany',

  beats: BEATS,
  Scene,
}
