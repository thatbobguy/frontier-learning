import type { FlowLesson } from '../flow/types'

/** One stop on a course's knowledge tree: a film, on the trunk or out on a branch. */
export interface CourseNode {
  /** The film's lesson id (its address is #/lesson/<id>). */
  id: string
  /** Which branch it grows on. The trunk is the main path; other branches dive deeper into one topic. */
  branch: string
  /** The stop it grows out of (none for the root). */
  parent?: string
  /** The film. Missing while it is still being made. */
  lesson?: FlowLesson
  /** Shown while there is no film yet. */
  title?: string
  blurb?: string
  /** Other stops worth suggesting at the end of this one (e.g. a branch that grows from earlier on the trunk). */
  see?: string[]
  /** Where the node sits on the tree map, in map units (x right, y up, trunk at x = 0). */
  at: [number, number]
}

export interface CourseBranch {
  id: string
  title: string
  /** What this branch is for, in one line. */
  blurb: string
  color: string
}

export interface Course {
  id: string
  title: string
  tagline: string
  /** Who it is for. */
  audience: string
  branches: CourseBranch[]
  nodes: CourseNode[]
}

const DONE_KEY = 'frontier-learning.done'

/** Films the learner has finished, remembered in this browser. */
export function finished(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markFinished(lessonId: string) {
  try {
    const s = finished()
    s.add(lessonId)
    localStorage.setItem(DONE_KEY, JSON.stringify([...s]))
  } catch {
    // Private windows can refuse storage; progress just isn't remembered.
  }
}

/** The stops that grow straight out of this one, trunk first. */
export function nextStops(course: Course, nodeId: string): CourseNode[] {
  const here0 = course.nodes.find((n) => n.id === nodeId)
  const seen = new Set<string>()
  const kids = [...course.nodes.filter((n) => n.parent === nodeId), ...course.nodes.filter((n) => here0?.see?.includes(n.id))].filter((n) => !seen.has(n.id) && !!seen.add(n.id))
  const here = course.nodes.find((n) => n.id === nodeId)
  return kids.sort((a, b) => (a.branch === here?.branch ? -1 : 0) - (b.branch === here?.branch ? -1 : 0))
}
