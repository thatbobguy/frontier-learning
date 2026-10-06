import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'meet-ama', say: 'Long, long ago, before anyone had numbers, a shepherd named Ama looked after a flock of sheep.' },
  { id: 'morning', say: 'Every morning, Ama let her sheep out of the pen to munch grass on the hills.' },
  { id: 'night', say: 'Every night, she brought them home. But Ama had a problem. How could she tell if a sheep was missing? She had no number words at all.' },
  { id: 'try-guess', say: 'Here is the flock tonight. Is every sheep home? Take a guess!', play: true, quick: true },
  { id: 'idea', say: 'Ama had a clever idea. Each morning, as each sheep walked out the gate, she dropped one pebble into her bag.' },
  { id: 'one-for-one', say: 'One sheep, one pebble. One sheep, one pebble. The bag now holds a pebble for every sheep.' },
  { id: 'coming-home', say: 'At night, as each sheep came home, Ama took one pebble out.' },
  { id: 'left-over', say: 'Look! One pebble is left in the bag. That means one sheep is still out there!' },
  { id: 'matching', say: 'This is the first big idea of math: matching. One thing for one thing. Sheep, pebbles, or marks, they all keep track the same way.' },
  { id: 'history', say: 'People really did this! Long ago, people carved one notch on a bone for each thing. Later they used clay tokens, and then they wrote numbers down.' },
  { id: 'night-watch', say: 'Now you keep watch! The pebbles are from this morning, one for each sheep that went out. Drag one pebble onto each sheep that came home. Then tell me, is every sheep home?', play: true },
]

export const ch1: Chapter = {
  id: 'origin',
  title: 'Why math was born',
  cues: CUES,
  Scene: placeholderScene('Why math was born', CUES),
}
