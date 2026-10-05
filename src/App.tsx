import { useEffect, useState } from 'react'
import { Gallery } from './art2/Gallery'
import { Player } from './engine/Player'
import { FlowPlayer } from './flow/FlowPlayer'
import { STOPS } from './lesson'
import { algebra } from './lessons/algebra'
import { Library } from './library/Library'
import './library/library.css'

/** The part of the address after #, e.g. "/lesson/algebra". */
function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, ''))
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash.replace(/^#/, ''))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

const toLibrary = () => {
  // Drop lesson links like ?chapter=2 when leaving a lesson.
  window.history.replaceState(null, '', window.location.pathname)
  window.location.hash = '/'
}

function App() {
  const route = useRoute()
  // Old links to the first lesson (?stop=3) still open it.
  const oldLink = new URLSearchParams(window.location.search).has('stop')
  if (route.startsWith('/kit')) return <Gallery page={Number(route.split('/')[2] ?? 0)} />
  if (route === '/lesson/algebra') return <FlowPlayer key="algebra" lesson={algebra} onExit={toLibrary} />
  if (route === '/lesson/frameworks' || (oldLink && !route.startsWith('/lesson'))) {
    return (
      <>
        <Player stops={STOPS} lessonTitle="The Frameworks of Mathematics" />
        <a className="back-to-library" href="#/" onClick={(e) => (e.preventDefault(), toLibrary())}>
          ← All lessons
        </a>
      </>
    )
  }
  return <Library />
}

export default App
