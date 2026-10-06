// Sentences the chapters build at runtime from numbers or names, so the line collector
// can't see them. Keep these in step with the chapter code they mirror.

export function extraLines() {
  // None at the moment: every line in the lessons is a fixed string the collector can find.
  const narrator = []
  return narrator.map((text) => ({ voice: 'narrator', text }))
}
