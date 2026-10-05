import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'library', say: 'Across the city stood the House of Wisdom, a giant library where scholars gathered books from all over the world.' },
  { id: 'scholar', say: 'One of them was Muhammad al-Khwarizmi. He noticed that merchants, builders and judges all got stuck on the same kind of puzzle.' },
  { id: 'forward', say: 'Ordinary arithmetic runs forward. Put eight into a machine that adds three, and out comes eleven.' },
  { id: 'backward', say: 'But their puzzles ran backwards. Eleven came out. What went in? Pull the lever to run the machine backwards.', play: true, quick: true },
  { id: 'book', say: 'Around the year 820, al-Khwarizmi wrote a book that showed, step by step, how to run puzzles like this backwards. He called his main move al-jabr, which means restoring.' },
  { id: 'name', say: 'The idea spread around the world, and its name came with it. Al-jabr became algebra.' },
]

export const ch2: Chapter = {
  id: 'wisdom',
  title: 'The House of Wisdom',
  cues: CUES,
  Scene: placeholderScene('The House of Wisdom', CUES),
  enter: { type: 'zoom', x: 1180, y: 380 },
}
