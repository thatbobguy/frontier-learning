import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'change', say: 'Now that amounts have names, we can see how they change. Putting amounts together is called adding.' },
  { id: 'add', say: 'Two bundles and five sticks, plus one bundle and three sticks. Bundles go with bundles. Sticks go with sticks. That makes three bundles and eight sticks: 38.' },
  { id: 'overflow', say: 'Sometimes the loose sticks overflow. Seven sticks plus five sticks is twelve loose sticks. Ten of them get tied into a brand new bundle! That makes 32.' },
  { id: 'predict', say: 'Your turn! Two bundles and five sticks. Take away three sticks. How many are left? Tap your guess.', play: true, quick: true },
  { id: 'take-apart', say: 'Taking away is adding run backwards. To take seven from 32, there are only two loose sticks. So we untie a bundle into ten loose sticks. Now there are twelve. Take away seven, and 25 are left.' },
  { id: 'number-line', say: 'On a number line, adding is jumping forward, and taking away is jumping back. 25 plus 13 is one big jump of ten, then three small jumps, to 38. 32 take away 7 is seven small jumps back, to 25.' },
  { id: 'balance', say: 'Now you try! The seesaw only balances when both sides have the same amount. Add or take away bundles and sticks on the right side until it balances.', play: true },
]

export const ch5: Chapter = {
  id: 'change',
  title: 'Together and apart',
  cues: CUES,
  Scene: placeholderScene('Together and apart', CUES),
  enter: { type: 'pan', dir: 'left' },
}
