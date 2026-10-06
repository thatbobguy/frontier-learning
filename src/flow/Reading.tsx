/**
 * Building blocks for "go deeper" readings: an article that opens beside the film.
 * Write a reading's Body with these so every reading looks the same:
 *
 *   export function TendonsBody() {
 *     return (
 *       <>
 *         <Lede>Why tendons lose force at every bend.</Lede>
 *         <P>...</P>
 *         <Figure caption="..."><svg viewBox="0 0 600 240">...</svg></Figure>
 *         <Numbers items={[['e^(μθ)', 'the capstan equation'], ...]} />
 *         <Sources items={[['Shadow Hand spec', 'https://...']]} />
 *       </>
 *     )
 *   }
 */
import type { ReactNode } from 'react'

export const Lede = ({ children }: { children: ReactNode }) => <p className="rd-lede">{children}</p>
export const P = ({ children }: { children: ReactNode }) => <p className="rd-p">{children}</p>
export const H = ({ children }: { children: ReactNode }) => <h3 className="rd-h">{children}</h3>
export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="rd-list">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
)
/** A side note: a caveat, a story, a "try this". */
export const Note = ({ title, children }: { title?: string; children: ReactNode }) => (
  <aside className="rd-note">
    {title && <strong>{title}</strong>}
    <div>{children}</div>
  </aside>
)
/** A formula, shown big, with what each symbol means. */
export const Formula = ({ tex, children }: { tex: string; children?: ReactNode }) => (
  <div className="rd-formula">
    <code>{tex}</code>
    {children && <div className="rd-formula-key">{children}</div>}
  </div>
)
/** A picture: put an <svg> (drawn for a dark page) inside. */
export const Figure = ({ caption, children }: { caption?: string; children: ReactNode }) => (
  <figure className="rd-fig">
    {children}
    {caption && <figcaption>{caption}</figcaption>}
  </figure>
)
/** Big numbers worth remembering: [number, what it means]. */
export const Numbers = ({ items }: { items: [string, string][] }) => (
  <div className="rd-nums">
    {items.map(([n, what]) => (
      <div key={n + what}>
        <b>{n}</b>
        <span>{what}</span>
      </div>
    ))}
  </div>
)
/** A comparison table: first row is the header. */
export const Table = ({ rows }: { rows: ReactNode[][] }) => (
  <div className="rd-table-wrap">
    <table className="rd-table">
      <thead>
        <tr>
          {rows[0].map((c, i) => (
            <th key={i}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(1).map((r, i) => (
          <tr key={i}>
            {r.map((c, k) => (
              <td key={k}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
/** Where to read more: [title, url]. */
export const Sources = ({ items }: { items: [string, string][] }) => (
  <div className="rd-sources">
    <h4>Read the originals</h4>
    <ul>
      {items.map(([t, u]) => (
        <li key={u}>
          <a href={u} target="_blank" rel="noreferrer">
            {t}
          </a>
        </li>
      ))}
    </ul>
  </div>
)
/** A question to chew on, with a hidden answer. */
export const Think = ({ q, children }: { q: string; children: ReactNode }) => (
  <details className="rd-think">
    <summary>{q}</summary>
    <div>{children}</div>
  </details>
)
