import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'everywhere', say: 'Keep it balanced, then undo, step by step. That one idea is everywhere.' },
  { id: 'game', say: 'A game designer knows how high a jump has to reach, and solves for how fast the character must leap.' },
  { id: 'bridge', say: 'An engineer knows how much weight a bridge must hold, and solves for how thick its beams need to be.' },
  { id: 'mars', say: 'A space agency knows where Mars will be next year, and solves for the day to launch.' },
  { id: 'backwards', say: 'Whenever you know the result but not the cause, algebra lets you run the world backwards.' },
  { id: 'next', say: "And this is just one branch. What happens when x isn't one secret number, but can be any number at all? That's where graphs and functions begin." },
]

export const ch7: Chapter = {
  id: 'world',
  title: 'Running the world backwards',
  cues: CUES,
  Scene: placeholderScene('Running the world backwards', CUES),
  enter: { type: 'pan', dir: 'up' },
}
