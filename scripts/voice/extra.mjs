// Sentences the scenes build at runtime from numbers or names, so the line collector
// can't see them. Keep these in step with the scene code they mirror.

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const numberWord = (n) => (n < 20 ? WORDS[n] : n % 10 ? `${TENS_WORDS[Math.floor(n / 10)]}-${WORDS[n % 10]}` : TENS_WORDS[n / 10])
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

export function extraLines() {
  const narrator = [
    // Stop 4 shop (judge): what the keeper counts after a payment.
    ...range(1, 60).map((n) => `The shopkeeper counts ${n}.`),
    ...range(1, 40).map((n) => `Zorp counts ${numberWord(n)}.`),
    'Four loose sticks can be tied into one bundle.',
    'Ten loose sticks can be tied into one bundle.',
    'Try tying four loose sticks into a bundle.',
    'Try tying ten loose sticks into a bundle.',
    // Stop 3 Zorp market: a basket that matches a different symbol.
    ...['big swirl', 'eye', 'little bolt'].flatMap((name) => [`Hmm, that is how many the ${name} means.`, `Zorp is holding up the ${name}.`]),
    // Stop 5 seesaw rounds: 8 + 7 = 15, 40 − 8 = 32, 19 + 7 = 26.
    'Round 2.',
    'Round 3.',
    ...[15, 32, 26].map((n) => `Both sides make ${n}.`),
    '8 and 7 more makes 15.',
    '40 take away 8 leaves 32.',
    '19 and 7 more makes 26.',
  ]
  return narrator.map((text) => ({ voice: 'narrator', text }))
}
