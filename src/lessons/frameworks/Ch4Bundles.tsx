import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'pile', say: 'Counting one by one gets slow when there are lots of things. Look at this big pile of sticks.' },
  { id: 'guess', say: 'Your turn! About how many sticks are here? Take a guess.', play: true, quick: true },
  { id: 'bundle', say: 'Here is the trick. Count ten sticks and tie them into a bundle. Then do it again, and again.' },
  { id: 'why-ten', say: 'Why ten? Look at your hands! Ten fingers made ten an easy number to count to.' },
  {
    id: 'tens-ones',
    say: 'Now the messy pile is three bundles and four loose sticks. We write that as 34. The 3 tells how many bundles of ten. The 4 tells how many loose ones.',
  },
  { id: 'place-matters', say: 'Where a digit sits changes what it means. 34 and 43 use the same digits, but 43 has four bundles. That is more!' },
  { id: 'number-line', say: 'On a number line, 34 is three big jumps of ten, then four small steps of one.' },
  {
    id: 'bundle-builder',
    say: 'Now you try! Pay the shopkeeper using bundles of ten and loose sticks. Use as few pieces as you can.',
    play: true,
  },
]

export const ch4: Chapter = {
  id: 'bundles',
  title: 'Bundling by ten',
  cues: CUES,
  Scene: placeholderScene('Bundling by ten', CUES),
  enter: { type: 'pan', dir: 'left' },
}
