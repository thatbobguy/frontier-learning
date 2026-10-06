import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Pip2 as Pip, type PipMood } from '../art2/characters'
import { loadLiveVoiceKey, setLiveVoiceKey, speak, stop as stopSpeech } from '../engine/narrator'
import { askPip, buildSystemPrompt, canThink, describeError, loadKey, PIP_RELAY, saveKey, type TutorReply, type TutorTurn } from './claude'
import { canListen, listen } from './listen'

export interface LessonContext {
  stopNumber: number
  stopTitle: string
  beatNumber: number
  beatCount: number
  narration: string
  inChallenge: boolean
  sceneState: string
  hints: string[]
  recentEvents: string[]
  targets: string[]
  /** True while the film is paused. */
  paused: boolean
  /** True on the end screen. */
  ended: boolean
  /** The lines of this chapter the learner has already heard, in order. */
  heardSoFar: string[]
  /** The "go deeper" reading open on screen, as text, if any. */
  reading: string
  /** What earlier chapters remembered about the learner (guesses, choices). */
  memory: string
  /** Every attempt and step the learner has made in this film so far. */
  journal: string[]
  /** Where this film sits in its course, if it is part of one. */
  course: string
}

/** What the tutor can see and do in the lesson. */
export interface LessonApi {
  lessonTitle: string
  script: string
  /** Who the learner is, for lessons not made for young children. */
  audience?: string
  context: () => LessonContext
  snapshot: () => Promise<string | null>
  pause: () => void
  resume: () => void
  replay: () => void
  pointAt: (target: string) => boolean
  isPlaying: () => boolean
}

export interface TutorHandle {
  nudge: (reason: string) => void
  /** Ask the student to explain how they solved a game. Calls `done` when the lesson can move on. */
  askToExplain: (done: () => void) => void
  /** Show a line in Pip's bubble without speaking or pausing, e.g. an invitation to explain. It closes by itself. */
  invite: (text: string) => void
}

function situationText(c: LessonContext, extra?: string) {
  return [
    c.course,
    c.ended
      ? 'The student has finished the whole film and is on the end screen.'
      : `The student is in chapter ${c.stopNumber} ("${c.stopTitle}"), at line ${c.beatNumber} of ${c.beatCount}. Everything in the script before this line has been heard; nothing after it has, so do not spoil what is coming.`,
    c.heardSoFar.length ? `Earlier in this chapter they heard:\n${c.heardSoFar.map((l) => `- ${l}`).join('\n')}` : '',
    `The narrator ${c.paused ? 'was saying when the film paused' : 'is saying now'}: "${c.narration}"`,
    c.paused ? 'The film is paused while you talk.' : 'The film is still playing.',
    c.inChallenge ? 'This line is a "your turn" challenge the student is working on right now. Do not give away the answer.' : 'This line is part of the explainer film.',
    c.sceneState ? `What is on screen and what the student has done: ${c.sceneState}` : '',
    c.journal.length ? `Everything the student has tried in this film so far, oldest first:\n${c.journal.map((l) => `- ${l}`).join('\n')}` : '',
    c.memory ? `What the lesson remembered about the student from earlier chapters: ${c.memory}` : '',
    c.reading ? `The student has a "go deeper" reading open. Its text:\n<reading>\n${c.reading}\n</reading>` : '',
    c.targets.length ? `Things you can point at: ${c.targets.join(', ')}.` : 'There is nothing to point at right now.',
    c.hints.length ? `Hints the lesson designers wrote for this challenge, gentlest first (use them as inspiration, in your own words): ${c.hints.join(' | ')}` : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function TutorPanel({ lesson, ref }: { lesson: LessonApi; ref?: Ref<TutorHandle> }) {
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<PipMood>('idle')
  const [bubble, setBubble] = useState('Hi, I’m Pip! Tap me any time to ask a question.')
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const [waitingToResume, setWaitingToResume] = useState(false)
  const [settings, setSettings] = useState(false)
  const [key, setKey] = useState(loadKey)
  const [voiceKey, setVoiceKey] = useState(loadLiveVoiceKey)
  const history = useRef<TutorTurn[]>([])
  const [log, setLog] = useState<TutorTurn[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const live = canThink(key)
  const remember = (turn: TutorTurn) => {
    history.current = [...history.current.slice(-15), turn]
    setLog(history.current.slice())
    window.setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 0)
  }
  const stopListening = useRef<(() => void) | null>(null)
  const hintStep = useRef(0)
  const busy = useRef(false)
  const pipToken = useRef(0)
  const pipTalking = useRef(false)
  const explainDone = useRef<(() => void) | null>(null)
  const invited = useRef(0)

  const finishExplaining = () => {
    const done = explainDone.current
    explainDone.current = null
    setWaitingToResume(false)
    done?.()
    if (!lesson.isPlaying()) lesson.resume()
  }

  const pipSays = async (text: string, reply?: TutorReply) => {
    const mine = ++pipToken.current
    pipTalking.current = true
    setBubble(text)
    setMood('talking')
    remember({ who: 'pip', text })
    if (reply?.action === 'point' && reply.target) lesson.pointAt(reply.target)
    // Pip and the narrator share one voice, so hold the film rather than talk over it (a game stays live).
    if (lesson.isPlaying() && !lesson.context().inChallenge) {
      lesson.pause()
      setWaitingToResume(true)
    }
    const said = await speak(text, { voice: 'tutor' })
    // A newer answer (or the learner) cut this one off: leave the rest to that.
    if (mine !== pipToken.current) return
    pipTalking.current = false
    setMood('idle')
    if (!said) return
    if (reply?.action === 'replay') {
      setWaitingToResume(false)
      lesson.replay()
    } else if (reply?.action === 'resume') {
      setWaitingToResume(false)
      if (explainDone.current) finishExplaining()
      else lesson.resume()
    }
  }

  const offlineReply = (c: LessonContext): TutorReply => {
    if (c.inChallenge && c.hints.length) {
      const hint = c.hints[Math.min(hintStep.current, c.hints.length - 1)]
      hintStep.current++
      return { say: hint, action: 'none', target: '' }
    }
    return {
      say: 'I can only chat once a grown-up gives me my key, using the gear button. For now, tap Again to hear that part one more time!',
      action: 'none',
      target: '',
    }
  }

  const respond = async (studentSaid: string, extraSituation?: string) => {
    // Only one question is thought about at a time; a new one may cut Pip off mid-sentence.
    if (busy.current) return
    const c = lesson.context()
    if (studentSaid) remember({ who: 'student', text: studentSaid })
    const explaining = !!explainDone.current
    try {
      if (!live && explaining) {
        await pipSays('I love how you thought about that. Explaining your thinking makes your brain stronger!', { say: '', action: 'resume', target: '' })
        return
      }
      if (!live) {
        const r = offlineReply(c)
        await pipSays(r.say, r)
        return
      }
      setMood('thinking')
      setBubble('Hmm, let me think…')
      busy.current = true
      const reply = await askPip({
        apiKey: key,
        system: buildSystemPrompt(lesson.lessonTitle, lesson.script, lesson.audience),
        situation: situationText(
          c,
          explaining
            ? 'The student just solved this game, and you asked how they figured it out. Respond warmly to their explanation in one or two sentences. If it shows a gap or a lucky guess, gently add the key idea in one sentence. Then use resume.'
            : extraSituation,
        ),
        history: history.current.slice(0, studentSaid ? -1 : undefined),
        studentSaid: studentSaid ? `The student says: "${studentSaid}"` : 'The student has not said anything. Speak up gently on your own.',
        snapshot: await lesson.snapshot(),
      })
      busy.current = false
      await pipSays(reply.say, reply)
    } catch (err) {
      busy.current = false
      await pipSays(describeError(err))
    } finally {
      busy.current = false
    }
  }

  useImperativeHandle(ref, () => ({
    askToExplain: (done: () => void) => {
      explainDone.current = done
      hintStep.current = 0
      setOpen(true)
      setWaitingToResume(true)
      void pipSays('You did it! How did you figure that out? Tap the mic and tell me.')
    },
    nudge: (reason: string) => {
      // Never talk over Pip's own answer or a question being thought about.
      if (busy.current || pipTalking.current || stopListening.current) return
      setOpen(true)
      void respond('', `${reason} Offer one small, encouraging nudge toward the idea they need, without giving the answer.`)
    },
    invite: (text: string) => {
      setBubble(text)
      setOpen(true)
      invited.current = window.setTimeout(() => {
        if (!busy.current && !stopListening.current) setOpen(false)
      }, 9000)
    },
  }))

  /** Pauses the video while the student talks to Pip. A game stays live so they can keep playing. */
  const holdLesson = () => {
    if (lesson.isPlaying() && !lesson.context().inChallenge) {
      lesson.pause()
      setWaitingToResume(true)
    }
  }

  const startTalking = () => {
    window.clearTimeout(invited.current)
    setOpen(true)
    holdLesson()
    stopSpeech()
    if (!canListen()) {
      setBubble('Type your question below and press Ask.')
      return
    }
    setHeard('')
    setMood('listening')
    setBubble('I’m listening…')
    stopListening.current = listen(setHeard, (text, error) => {
      stopListening.current = null
      setMood('idle')
      if (text) void respond(text)
      else if (error === 'not-allowed') setBubble('I need permission to use the microphone. You can also type below.')
      else setBubble('I didn’t catch that. Tap the mic and try again, or type below.')
    })
  }

  const finishTalking = () => stopListening.current?.()

  const sendTyped = () => {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    holdLesson()
    void respond(text)
  }

  const listening = mood === 'listening'
  // The chat so far, minus the line already in Pip's bubble.
  const earlier = log.at(-1)?.who === 'pip' && log.at(-1)?.text === bubble ? log.slice(0, -1) : log

  return (
    <aside className={open ? 'tutor open' : 'tutor'} aria-label="Pip, your tutor">
      {open && (
        <div className="tutor-card">
          <div className="tutor-top">
            <strong>Pip</strong>
            <span className="tutor-status">{mood === 'thinking' ? 'thinking' : mood === 'listening' ? 'listening' : mood === 'talking' ? 'talking' : live ? 'ready' : 'hints only'}</span>
            <button className="icon" onClick={() => setSettings((v) => !v)} aria-label="Pip settings" title="Settings">⚙</button>
            <button className="icon" onClick={() => setOpen(false)} aria-label="Close Pip">✕</button>
          </div>
          {settings ? (
            <div className="tutor-settings">
              <label>
                Anthropic API key
                <input
                  type="password"
                  value={key}
                  placeholder="sk-ant-…"
                  onChange={(e) => {
                    setKey(e.target.value.trim())
                    saveKey(e.target.value.trim())
                  }}
                />
              </label>
              <p>
                {PIP_RELAY
                  ? 'Optional: Pip already works without one. A key of your own is used instead of the site’s, stays in this browser only and is sent straight to Anthropic.'
                  : 'The key stays in this browser only and is sent straight to Anthropic. Without it, Pip still gives the lesson’s built-in hints.'}
              </p>
              <label>
                ElevenLabs API key (optional)
                <input
                  type="password"
                  value={voiceKey}
                  placeholder="for Pip's live voice"
                  onChange={(e) => {
                    setVoiceKey(e.target.value.trim())
                    setLiveVoiceKey(e.target.value.trim())
                  }}
                />
              </label>
              <p>The lesson's own lines are already recorded. This key lets Pip answer your questions in the same voice instead of the browser's.</p>
              <button onClick={() => setSettings(false)}>Done</button>
            </div>
          ) : (
            <>
              {earlier.length > 0 && (
                <div className="tutor-log" ref={logRef} aria-label="Earlier in your chat with Pip">
                  {earlier.map((t, i) => (
                    <p key={i} className={t.who === 'pip' ? 'from-pip' : 'from-you'}>
                      {t.text}
                    </p>
                  ))}
                </div>
              )}
              <p className="tutor-bubble">{bubble}</p>
              {heard && listening && <p className="tutor-heard">&ldquo;{heard}&rdquo;</p>}
              <div className="tutor-actions">
                <button className={listening ? 'mic on' : 'mic'} onClick={listening ? finishTalking : startTalking} disabled={mood === 'thinking'}>
                  {listening ? 'Done talking' : '🎤 Ask Pip'}
                </button>
                {waitingToResume && !listening && mood !== 'thinking' && (
                  <button
                    className="resume"
                    onClick={() => {
                      stopSpeech()
                      setWaitingToResume(false)
                      if (explainDone.current) finishExplaining()
                      else lesson.resume()
                    }}
                  >
                    Keep going ▶
                  </button>
                )}
              </div>
              <form
                className="tutor-type"
                onSubmit={(e) => {
                  e.preventDefault()
                  sendTyped()
                }}
              >
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a question" aria-label="Type a question for Pip" />
                <button type="submit" disabled={!typed.trim() || mood === 'thinking'}>Ask</button>
              </form>
            </>
          )}
        </div>
      )}
      <button className="tutor-pip" onClick={() => (open ? startTalking() : setOpen(true))} aria-label="Talk to Pip">
        <svg viewBox="-70 -90 140 170">
          <Pip mood={mood} />
        </svg>
        {!open && <span className="tutor-chip">Ask me!</span>}
      </button>
    </aside>
  )
}
