import type { ComponentType } from 'react'
import '../art2/art2.css'
import { Pip2 } from '../art2/characters'
import { Defs } from '../art2/fx'
import { CineDefs } from '../cine/defs'
import { robotHands } from '../courses'
import { Grain } from '../art2/Grain'
import { algebra } from '../lessons/algebra'
import { frameworks } from '../lessons/frameworks'
import './library.css'

interface Card {
  href: string
  title: string
  tagline: string
  meta: string
  Poster: ComponentType
  badge: string
}

const PATH: Card[] = [
  {
    href: '#/lesson/frameworks',
    title: frameworks.title,
    tagline: frameworks.tagline,
    meta: `${frameworks.age} · about ${frameworks.minutes} minutes`,
    Poster: frameworks.Poster,
    badge: 'Lesson 1',
  },
  {
    href: '#/lesson/algebra',
    title: algebra.title,
    tagline: algebra.tagline,
    meta: `${algebra.age} · about ${algebra.minutes} minutes`,
    Poster: algebra.Poster,
    badge: 'New · Lesson 2',
  },
]

const SOON = algebra.next ?? []
const HandsPoster = robotHands.nodes[0]?.lesson?.Poster

/** The home page: every lesson as a stop on one path, with the branches still growing. */
export function Library() {
  return (
    <div className="lib">
      <header className="lib-hero">
        <svg viewBox="-90 -100 180 180" className="lib-pip" aria-hidden>
          <Pip2 mood="idle" />
        </svg>
        <div>
          <p className="lib-eyebrow">Frontier Learning</p>
          <h1>Big ideas, told like a story. Then you get to play with them.</h1>
          <p className="lib-lede">Each lesson plays like a short animated film. When it's your turn, the picture itself becomes the game. Pip the owl rides along if you get stuck or curious.</p>
        </div>
      </header>

      <section className="lib-path lib-course" aria-label="Courses">
        <h2>New: a course for teens and adults</h2>
        <a className="lib-card lib-course-card" href={`#/course/${robotHands.id}`}>
          <div className="lib-thumb">
            <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <CineDefs />
              {HandsPoster && <HandsPoster />}
            </svg>
            <Grain />
            <span className="lib-play" aria-hidden>
              <svg viewBox="0 0 40 40">
                <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
              </svg>
            </span>
            <span className="lib-badge new">New · 10 films</span>
          </div>
          <div className="lib-card-body">
            <h3>{robotHands.title}</h3>
            <p>{robotHands.tagline}</p>
            <span className="lib-meta">Teens and adults · a main path of six films, plus a branch on robot data</span>
          </div>
        </a>
      </section>

      <section className="lib-path" aria-label="Lessons">
        <h2>The path so far</h2>
        <ol className="lib-cards">
          {PATH.map((c, i) => (
            <li key={c.href}>
              <a className="lib-card" href={c.href}>
                <div className="lib-thumb">
                  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
                    <Defs />
                    <c.Poster />
                  </svg>
                  <Grain />
                  <span className="lib-play" aria-hidden>
                    <svg viewBox="0 0 40 40">
                      <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className={i === PATH.length - 1 ? 'lib-badge new' : 'lib-badge'}>{c.badge}</span>
                </div>
                <div className="lib-card-body">
                  <h3>{c.title}</h3>
                  <p>{c.tagline}</p>
                  <span className="lib-meta">{c.meta}</span>
                </div>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="lib-soon" aria-label="Coming soon">
        <h2>Growing next on the algebra branch</h2>
        <ul>
          {SOON.map((n) => (
            <li key={n.title}>
              <strong>{n.title}</strong>
              <span>{n.blurb}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
