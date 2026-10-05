import type { FC } from 'react'

/** One narrated step of a scene. The player waits for the narration and the beat's animation to finish. */
export interface Beat {
  id: string
  /** Narration, spoken aloud and shown as a caption. */
  say: string
  /**
   * An interactive "Now you try" pause. The player does not advance until the scene
   * calls onChallengeDone. The narration is the challenge's instructions.
   */
  challenge?: boolean
  /**
   * A quick "Your turn" moment inside a watch segment (predict, point or tap), rather
   * than a full game. Shown with a lighter banner and no "how did you know?" prompt.
   */
  quick?: boolean
}

/** Something that happened in a challenge, used to notice when a student is stuck. */
export type LessonEvent =
  | { type: 'attempt'; correct: boolean; detail?: string }
  | { type: 'progress'; detail?: string }

export interface SceneProps {
  /** The beat to show. Scenes animate into the state for this beat. */
  beatIndex: number
  /** False while the lesson is paused, so animations hold still. */
  playing: boolean
  /** Call when the current beat's animation has finished. */
  onAnimDone: () => void
  /** Call when the student finishes the current challenge. */
  onChallengeDone: () => void
  /** Speak a short line in the narrator's voice and show it as a caption (feedback during a challenge). */
  say: (text: string) => void
  /** Report attempts and progress so the tutor can tell when the student is stuck. */
  emit: (event: LessonEvent) => void
  /**
   * Describe what the student currently sees and has done, in plain words, for the tutor.
   * Include the correct answer and the likely mix-up: only Pip sees this, and research on
   * AI tutors shows hints work best when the tutor knows the solution.
   */
  reportState: (description: string) => void
  /** Hints, gentlest first, that the tutor can fall back on when it has no API key. */
  setHints: (hints: string[]) => void
}

export type BranchId = 'origin' | 'map' | 'howMany' | 'change' | 'next' | 'shape'

export interface Stop {
  id: string
  /** Short label for the knowledge path, e.g. "Why math was born". */
  title: string
  branch: BranchId
  /** True for teaser stops that are not built in full yet. */
  teaser?: boolean
  beats: Beat[]
  Scene: FC<SceneProps>
}
