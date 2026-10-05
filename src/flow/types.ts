import type { ComponentType } from 'react'
import type { LessonEvent } from '../engine/types'

/**
 * One narrated moment of a chapter. Cues play back to back with no gaps: the next
 * one starts as soon as this line has been said and its animation has played.
 */
export interface Cue {
  id: string
  /** Narration, spoken aloud and shown as a caption. */
  say: string
  /**
   * The learner's turn. The same picture becomes playable; nothing pops up. The
   * narration is the instruction, the world keeps moving, and the flow carries on
   * the moment the scene calls onPlayDone (after its own reaction line is heard).
   */
  play?: boolean
  /** A small, low-stakes turn (a guess, a tap): no "how did you figure it out?" from Pip after. */
  quick?: boolean
}

/** How a chapter arrives from the one before it. */
export type Enter =
  /** The camera flies into the point (x, y) of the previous chapter, and this chapter opens out of it. */
  | { type: 'zoom'; x: number; y: number }
  /** The camera glides sideways or up/down from the previous chapter to this one. */
  | { type: 'pan'; dir: 'left' | 'right' | 'up' | 'down' }
  /** The previous picture melts into this one. */
  | { type: 'dissolve' }

export interface ChapterProps {
  /** The cue to show. Scenes animate into the state for this cue. */
  cueIndex: number
  /** False while paused, so animations hold still. */
  playing: boolean
  /** Call when the current cue's animation has finished. */
  onAnimDone: () => void
  /** Call when the learner has finished the current play cue. The flow moves on after any line you are saying. */
  onPlayDone: () => void
  /** Say a short line in the narrator's voice, shown as the caption. Resolves when it has been said. */
  say: (text: string) => Promise<void>
  /** Report attempts and progress so Pip can tell when the learner is stuck. */
  emit: (event: LessonEvent) => void
  /** What is on screen and what the learner has done, with the correct answer and the likely mix-up. Only Pip sees it. */
  reportState: (description: string) => void
  /** Hints, gentlest first, that Pip falls back on. Never the answer itself. */
  setHints: (hints: string[]) => void
  /** Shared across the lesson's chapters, e.g. a guess made early that a later chapter brings back. */
  memory: Record<string, unknown>
}

export interface Chapter {
  id: string
  /** Short title, shown on the progress bar. */
  title: string
  cues: Cue[]
  Scene: ComponentType<ChapterProps>
  /** How this chapter arrives from the previous one. Defaults to a dissolve. */
  enter?: Enter
}

export interface FlowLesson {
  id: string
  title: string
  /** One line for the library card and the start screen. */
  tagline: string
  /** Who it is for, e.g. "Ages 10 to 12". */
  age: string
  minutes: number
  chapters: Chapter[]
  /** A still picture for the start screen and the library card (stage coordinates, 1600 x 900). */
  Poster: ComponentType
  /** Where the learner could go next, shown at the end. */
  next?: { title: string; blurb: string }[]
}
