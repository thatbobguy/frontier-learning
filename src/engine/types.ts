/** Something that happened in a play cue, used to notice when a learner is stuck. */
export type LessonEvent =
  | { type: 'attempt'; correct: boolean; detail?: string }
  | { type: 'progress'; detail?: string }
