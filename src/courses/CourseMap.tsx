import { useMemo } from 'react'
import { Grain } from '../art2/Grain'
import { CineDefs } from '../cine/defs'
import { C, MONO, SANS, SERIF } from '../cine/palette'
import { courses } from '.'
import { playStop } from './CourseNext'
import { finished, type Course, type CourseNode } from './types'
import './course.css'

/** Map units to the picture: the trunk stands at x = 0, each step up is one film. */
const X0 = 470
const DX = 330
const Y0 = 1160
const DY = 186
const at = (n: CourseNode) => ({ x: X0 + n.at[0] * DX, y: Y0 - n.at[1] * DY })

const TW = 192
const TH = 108

/** A curved limb from a parent stop to a child, bending outward like a branch. */
function limb(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (Math.abs(a.x - b.x) < 2) return `M${a.x} ${a.y} L${b.x} ${b.y}`
  const mx = a.x + (b.x - a.x) * 0.15
  return `M${a.x} ${a.y} C ${mx} ${a.y - (a.y - b.y) * 0.75}, ${b.x - (b.x - a.x) * 0.5} ${b.y + 40}, ${b.x} ${b.y}`
}

function Stop({ course, node, done, next }: { course: Course; node: CourseNode; done: boolean; next: boolean }) {
  const p = at(node)
  const branch = course.branches.find((b) => b.id === node.branch)
  const color = branch?.color ?? C.paper
  const title = node.lesson?.title ?? node.title
  const ready = !!node.lesson
  const Poster = node.lesson?.Poster
  const right = node.branch !== 'trunk'
  const tx = right ? p.x + 24 : p.x - 24
  return (
    <g
      className={`cm-stop${next ? ' next' : ''}${ready ? '' : ' soon'}`}
      role={ready ? 'link' : undefined}
      tabIndex={ready ? 0 : -1}
      aria-label={ready ? `Play ${title}` : `${title} (coming soon)`}
      onClick={() => ready && playStop(node.id)}
      onKeyDown={(e) => {
        if (ready && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          playStop(node.id)
        }
      }}
    >
      {/* the thumbnail hangs beside the stop, like a leaf */}
      <g transform={`translate(${right ? tx : tx - TW} ${p.y - TH / 2 - 26})`}>
        <clipPath id={`cm-clip-${node.id}`}>
          <rect width={TW} height={TH} rx={12} />
        </clipPath>
        <g clipPath={`url(#cm-clip-${node.id})`}>
          <rect width={TW} height={TH} fill={C.ink2} />
          {Poster && (
            <svg width={TW} height={TH} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
              <Poster />
            </svg>
          )}
        </g>
        <rect className="cm-frame" width={TW} height={TH} rx={12} fill="none" stroke={color} strokeWidth={next ? 3 : 1.5} strokeOpacity={next ? 1 : 0.5} />
        <text x={right ? 0 : TW} y={TH + 28} textAnchor={right ? 'start' : 'end'} fill={C.paper} fontFamily={SERIF} fontSize={22} fontWeight={600}>
          {title}
        </text>
        <text x={right ? 0 : TW} y={TH + 50} textAnchor={right ? 'start' : 'end'} fill={done ? color : C.mist} fontFamily={MONO} fontSize={14}>
          {done ? 'watched ✓' : next ? 'up next ▸' : ready ? `${node.lesson?.minutes} min` : 'coming soon'}
        </text>
      </g>
      {next && <circle cx={p.x} cy={p.y} r={30} fill="none" stroke={color} strokeWidth={2} className="cm-ping" />}
      <circle cx={p.x} cy={p.y} r={16} fill={C.ink} stroke={color} strokeWidth={4} />
      <circle cx={p.x} cy={p.y} r={done ? 9 : 5} fill={color} filter="url(#cn-bloom)" />
    </g>
  )
}

/** The whole course as a knowledge tree: the trunk of films, branches growing off it. */
export function CourseMap({ id }: { id: string }) {
  const course = courses[id]
  const done = useMemo(() => finished(), [])
  if (!course) {
    return (
      <div className="cm">
        <p>No course called “{id}”.</p>
        <a href="#/">Back to the library</a>
      </div>
    )
  }
  const next = course.nodes.find((n) => n.lesson && !done.has(n.id) && n.branch === 'trunk') ?? course.nodes.find((n) => n.lesson && !done.has(n.id))
  const first = course.nodes.find((n) => !n.parent)
  return (
    <div className="cm">
      <header className="cm-head">
        <a className="cm-back" href="#/">
          ← Library
        </a>
        <p className="cm-eyebrow">A course in ten films</p>
        <h1>{course.title}</h1>
        <p className="cm-lede">{course.tagline}</p>
        <div className="cm-actions">
          {next && (
            <button className="cm-go" onClick={() => playStop(next.id)}>
              {next === first ? 'Start the first film' : `Continue: ${next.lesson?.title}`}
            </button>
          )}
        </div>
      </header>
      <div className="cm-tree">
        <svg viewBox="0 0 1600 1260" role="group" aria-label="The knowledge tree">
          <CineDefs />
          <defs>
            <radialGradient id="cm-glow">
              <stop offset="0" stopColor={C.key} stopOpacity={0.35} />
              <stop offset="1" stopColor={C.key} stopOpacity={0} />
            </radialGradient>
          </defs>
          <rect width={1600} height={1260} fill={C.ink} />
          <rect width={1600} height={1260} fill="url(#cn-grid-big)" opacity={0.5} />
          <circle cx={X0} cy={1240} r={760} fill="url(#cm-glow)" />
          {/* roots */}
          <path d={`M${X0} ${Y0} q -60 60 -160 80 M${X0} ${Y0} q 40 70 150 90 M${X0} ${Y0} l 0 100`} stroke={C.amberDark} strokeWidth={3} fill="none" opacity={0.5} />
          {/* limbs */}
          {course.nodes
            .filter((n) => n.parent)
            .map((n) => {
              const parent = course.nodes.find((m) => m.id === n.parent)
              if (!parent) return null
              const color = course.branches.find((b) => b.id === n.branch)?.color ?? C.paper
              const d = limb(at(parent), at(n))
              return (
                <g key={n.id}>
                  <path d={d} stroke={color} strokeWidth={n.branch === 'trunk' ? 10 : 6} strokeLinecap="round" fill="none" opacity={0.25} />
                  <path d={d} stroke={color} strokeWidth={n.branch === 'trunk' ? 3 : 2} strokeLinecap="round" fill="none" className="cm-sap" />
                </g>
              )
            })}
          {course.nodes.map((n) => (
            <Stop key={n.id} course={course} node={n} done={done.has(n.id)} next={n === next} />
          ))}
          {/* branch names */}
          {course.branches.map((b) => {
            const top = course.nodes.filter((n) => n.branch === b.id).sort((p, q) => q.at[1] - p.at[1])[0]
            if (!top) return null
            const p = at(top)
            return (
              <g key={b.id}>
                <text x={p.x + (b.id === 'trunk' ? 0 : 0)} y={p.y - 110} textAnchor="middle" fill={b.color} fontFamily={SANS} fontSize={20} fontWeight={600} letterSpacing={4}>
                  {b.title.toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>
        <Grain strength={0.1} />
      </div>
      <section className="cm-branches">
        {course.branches.map((b) => (
          <div key={b.id} className="cm-branch">
            <h2 style={{ color: b.color }}>{b.title}</h2>
            <p>{b.blurb}</p>
            <ol>
              {course.nodes
                .filter((n) => n.branch === b.id)
                .map((n) => (
                  <li key={n.id}>
                    {n.lesson ? (
                      <a
                        href={`#/lesson/${n.id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          playStop(n.id)
                        }}
                      >
                        {n.lesson.title}
                      </a>
                    ) : (
                      <span>{n.title}</span>
                    )}
                    {done.has(n.id) && <span className="cm-done"> ✓</span>}
                    <small>{n.lesson?.tagline ?? n.blurb}</small>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  )
}
