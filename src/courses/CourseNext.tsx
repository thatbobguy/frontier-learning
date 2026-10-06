import { useEffect, useState } from 'react'
import { courses } from '.'
import { finished, nextStops } from './types'

/** Opens a film in the course and starts it playing straight away. */
export function playStop(lessonId: string) {
  window.history.replaceState(null, '', `${window.location.pathname}?start=1`)
  window.location.hash = `/lesson/${lessonId}`
}

const AUTO_S = 12

/**
 * The end of a film on a course: where the tree grows next. The next stop on the same
 * branch starts by itself after a few seconds, so the flow keeps going; branches are
 * offered beside it.
 */
export function CourseNext({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const course = courses[courseId]
  const stops = course ? nextStops(course, lessonId) : []
  const done = finished()
  const here = course?.nodes.find((n) => n.id === lessonId)
  const main = stops.find((s) => s.branch === here?.branch && s.lesson)
  const [left, setLeft] = useState(AUTO_S)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!main || held) return
    if (left <= 0) {
      playStop(main.id)
      return
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [main, left, held])

  if (!course) return null
  return (
    <div className="course-next" onPointerDown={() => setHeld(true)}>
      <p>{stops.length ? 'Where the tree grows from here:' : 'You have reached the top of this branch.'}</p>
      <div className="course-next-row">
        {stops.map((s) => {
          const b = course.branches.find((x) => x.id === s.branch)
          const title = s.lesson?.title ?? s.title
          const blurb = s.lesson?.tagline ?? s.blurb
          const isMain = s === main
          return s.lesson ? (
            <a
              key={s.id}
              className={isMain ? 'course-next-card main' : 'course-next-card'}
              href={`#/lesson/${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                playStop(s.id)
              }}
            >
              <small style={{ color: b?.color }}>{s.branch === here?.branch ? 'Next: ' : 'Branch off to '}{b?.title}</small>
              <strong>{title}</strong>
              <span>{blurb}</span>
              {done.has(s.id) && <span>Watched ✓</span>}
              {isMain && !held && <span className="bar" style={{ width: `${(1 - left / AUTO_S) * 100}%`, transition: 'width 1s linear' }} />}
            </a>
          ) : (
            <div key={s.id} className="course-next-card soon">
              <small style={{ color: b?.color }}>{b?.title}</small>
              <strong>{title}</strong>
              <span>{blurb}</span>
              <span>Coming soon</span>
            </div>
          )
        })}
      </div>
      {main && !held && <p>Playing “{main.lesson?.title}” in {left}s</p>}
      <a className="course-map-link" href={`#/course/${course.id}`}>
        See the whole knowledge tree
      </a>
    </div>
  )
}
