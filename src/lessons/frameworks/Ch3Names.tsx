import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'heavy', say: 'Matching works. But imagine carrying a pebble for every sheep, every fish, and every jar of grain. That gets heavy!' },
  { id: 'names', say: 'So people gave each amount a name. This many is one. This many is two. This many is three.' },
  { id: 'same-seven', say: 'Seven pebbles, seven fingers, seven marks. They look different, but it is the same amount. That amount has a name: seven.' },
  { id: 'symbols', say: 'The squiggle 7 is just a symbol, a way to write that amount. People in different places wrote seven in different ways.' },
  { id: 'find-seven', say: 'Your turn! Tap the pile that has seven.', play: true, quick: true },
  { id: 'number-line', say: 'Numbers have an order too. Line up one more pebble each time, and you get a number line. Each step to the right is one more.' },
  { id: 'further-is-more', say: 'The further along the line, the bigger the number. Seven is further than three, so seven is more.' },
  {
    id: 'alien-market',
    say: "Now you try! Zorp the alien trader writes numbers with Zorp symbols. Use Zorp's chart to fill each basket with the right number of star fruits.",
    play: true,
  },
]

export const ch3: Chapter = {
  id: 'names',
  title: 'Numbers are names',
  cues: CUES,
  Scene: placeholderScene('Numbers are names', CUES),
  enter: { type: 'zoom', x: 420, y: 300 },
}
