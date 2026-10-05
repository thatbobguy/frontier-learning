import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'name', say: "Here is the first trick. Give the thing you don't know a name." },
  { id: 'x', say: "Al-Khwarizmi called it 'the thing'. Today we usually use a letter, like x." },
  { id: 'one', say: "x isn't a mystery forever. It stands for one exact number. We just don't know which one yet." },
  { id: 'write', say: 'Now the whole scale fits in one short line. The sack is x. Three weights is 3. The level beam means equals. Eleven weights is 11.' },
  { id: 'equation', say: 'x plus 3 equals 11. That is an equation: a balance scale, written small.' },
]

export const ch3: Chapter = {
  id: 'unknown',
  title: 'Naming the unknown',
  cues: CUES,
  Scene: placeholderScene('Naming the unknown', CUES),
  enter: { type: 'pan', dir: 'left' },
}
