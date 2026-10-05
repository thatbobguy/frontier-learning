import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'equals', say: 'The equals sign is the heart of it. It means both sides weigh exactly the same.' },
  { id: 'tip', say: "Add a weight to one side only, and the scale tips. The equation isn't true anymore." },
  { id: 'rule', say: 'So algebra has one golden rule: whatever you do to one side, do the same to the other.' },
  { id: 'both', say: 'Take a weight off both sides, and it stays level. Add one to both sides, and it stays level.' },
  { id: 'solve', say: 'Your turn. Take weights off until the sack is alone on its side. Keep the scale level, so the equation stays true.', play: true },
  { id: 'eight', say: "Eight! The sack weighs the same as eight weights. You took three from both sides, and that is exactly al-Khwarizmi's move." },
  { id: 'guess', say: "Remember your guess at the market? Here's how close you were." },
]

export const ch4: Chapter = {
  id: 'balance',
  title: 'Keep it balanced',
  cues: CUES,
  Scene: placeholderScene('Keep it balanced', CUES),
  enter: { type: 'zoom', x: 800, y: 450 },
}
