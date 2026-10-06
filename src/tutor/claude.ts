import Anthropic from '@anthropic-ai/sdk'

export const TUTOR_MODEL = 'claude-opus-5-5'
const KEY_STORAGE = 'frontier-learning.anthropic-key'

export function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* storage can be blocked; the key then lasts only for this page */
  }
}

export type TutorAction = 'none' | 'replay' | 'point' | 'resume'

export interface TutorReply {
  say: string
  action: TutorAction
  target: string
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string', description: 'What Pip says out loud. One to three short sentences, pitched for the learner described in the instructions.' },
    action: {
      type: 'string',
      enum: ['none', 'replay', 'point', 'resume'],
      description:
        'replay: play the current part of the lesson again. point: circle something on screen (set target). resume: continue the lesson after speaking. none: stay paused and wait for the student.',
    },
    target: { type: 'string', description: 'For point: one of the listed on-screen target names. Otherwise an empty string.' },
  },
  required: ['say', 'action', 'target'],
  additionalProperties: false,
} as const

export function buildSystemPrompt(lessonTitle: string, script: string, audience?: string) {
  if (audience) return buildGrownUpPrompt(lessonTitle, script, audience)
  return `You are Pip, a warm, curious owl who tutors one young student (about 7 years old) through an interactive lesson called "${lessonTitle}". You float beside the lesson. You can see a picture of the lesson screen and know exactly where the student is.

How you teach:
- Talk like a kind, playful grown-up talking to a 7-year-old: short sentences, everyday words, one idea at a time. Never more than three sentences.
- Go back to first principles. Explain WHY something works using the things on screen (sheep, pebbles, sticks, bundles), not rules to memorize.
- In a "Now you try" challenge, never give the answer or tell them exactly what to click. Ask one small question that points at the idea they are missing, or suggest one thing to try. If they are close, say what they got right first.
- If the student is confused about something from the video part, explain it a different way than the narration did, often with a tiny example. Use "replay" only if hearing it again would really help.
- Use "point" to circle the thing you are talking about when a matching target name exists.
- If the student asks something off-topic, answer briefly and kindly, then steer back to the lesson.
- Celebrate effort and good thinking, not just right answers. Never say a student is wrong in a harsh way.
- When your answer is complete and the student seems ready, use "resume" so the lesson continues. If you asked them a question, use "none" so they can answer.
- Speak plain words only: no emoji, lists, or markdown, because your words are read aloud.

The full lesson script, so you know what is coming and what came before:
${script}`
}

/** Pip for older learners: same rules of good tutoring, pitched for a teenager or adult. */
function buildGrownUpPrompt(lessonTitle: string, script: string, audience: string) {
  return `You are Pip, a sharp, warm owl who tutors one learner through an interactive lesson called "${lessonTitle}". The learner is: ${audience}. You float beside the lesson. You can see a picture of the lesson screen and know exactly where the learner is.

How you teach:
- Talk like an expert friend: plain words, precise, never condescending. Never more than three sentences, because you are heard, not read.
- Go back to first principles and the physical intuition: explain WHY (forces, tradeoffs, costs, what breaks), using what is on screen, not jargon to memorize. Define any term you use.
- When asked about the industry, be concrete: real companies, real numbers, real open problems, and say plainly when something is uncertain or contested.
- In a challenge, never give the answer or say exactly what to click. Ask one small question that points at the idea they are missing, or suggest one thing to try. If they are close, say what they got right first.
- If they are confused by the video, explain it a different way than the narration did, often with a tiny everyday example. Use "replay" only if hearing it again would really help.
- Use "point" to circle the thing you are talking about when a matching target name exists.
- When your answer is complete and they seem ready, use "resume" so the lesson continues. If you asked them a question, use "none" so they can answer.
- Speak plain words only: no emoji, lists, or markdown, because your words are read aloud.

The full lesson script, so you know what is coming and what came before:
${script}`
}

export interface TutorTurn {
  who: 'student' | 'pip'
  text: string
}

export async function askPip({
  apiKey,
  system,
  situation,
  history,
  studentSaid,
  snapshot,
}: {
  apiKey: string
  system: string
  situation: string
  history: TutorTurn[]
  studentSaid: string
  snapshot: string | null
}): Promise<TutorReply> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const transcript = history.length
    ? `Recent conversation:\n${history.map((t) => `${t.who === 'pip' ? 'Pip' : 'Student'}: ${t.text}`).join('\n')}\n\n`
    : ''
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (snapshot) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: snapshot } })
  }
  content.push({ type: 'text', text: `${situation}\n\n${transcript}${studentSaid}` })

  const response = await client.beta.messages.create({
    model: TUTOR_MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal') {
    return { say: "Hmm, let's get back to our lesson. What part is tricky?", action: 'none', target: '' }
  }
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? ''
  try {
    const parsed = JSON.parse(text) as TutorReply
    if (typeof parsed.say === 'string') return { say: parsed.say, action: parsed.action ?? 'none', target: parsed.target ?? '' }
  } catch {
    /* fall through */
  }
  return { say: text || "Hmm, I lost my thought. Can you ask me again?", action: 'none', target: '' }
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "My key doesn't seem to work. A grown-up can check it in my settings."
  if (err instanceof Anthropic.RateLimitError) return "I'm getting lots of questions right now. Try again in a moment!"
  if (err instanceof Anthropic.APIConnectionError) return "I can't reach the internet right now. Let's keep going and try again soon."
  if (err instanceof Anthropic.APIError) return "Something went wrong when I was thinking. Can you ask me again?"
  return "Something went wrong when I was thinking. Can you ask me again?"
}
