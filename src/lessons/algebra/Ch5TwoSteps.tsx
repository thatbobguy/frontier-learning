import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'harder', say: "Let's make it harder. Two identical sacks and one weight balance nine weights." },
  { id: 'undo-one', say: 'First, undo the plus one. Take one weight off each side.', play: true },
  { id: 'share', say: 'Now two sacks balance eight weights. Two equal sacks must share those eight equally.' },
  { id: 'split', say: 'Split both sides into two matching halves. Drag the glowing line down through the scale.', play: true },
  { id: 'four', say: 'One sack balances four weights. x equals 4.' },
  { id: 'order', say: "Notice the order. You put on socks, then shoes, but you take off shoes first, then socks. Algebra undoes things in reverse order, too." },
]

export const ch5: Chapter = {
  id: 'two-steps',
  title: 'Two steps back',
  cues: CUES,
  Scene: placeholderScene('Two steps back', CUES),
  enter: { type: 'pan', dir: 'left' },
}
