// Records the lesson's spoken lines with ElevenLabs into public/voice/, one clip per
// sentence, plus manifest.json with each clip's word timings for the captions.
// Only new or changed sentences are recorded; clips nothing uses any more are removed.
//
//   ELEVENLABS_API_KEY=... node scripts/voice/render.mjs
//   node scripts/voice/render.mjs --dry-run      (no key needed: shows what would be recorded)
//
// Optional: NARRATOR_VOICE / PIP_VOICE (an ElevenLabs voice id or name), ELEVENLABS_MODEL,
// HANDS_MODEL (the model for the robot hands course, which is recorded with Flash by default).
//
// Each clip remembers the model that recorded it, so changing a model only affects new lines.
// Lines are recorded in course order (the first films first, the narrator before Pip), and the
// run stops before it would overspend the account's remaining credits; whatever is left over
// plays in the browser voice until the next run.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { VOICE_CHOICES, splitSentences, voiceKey } from '../../src/engine/voiceKey.ts'
import { extraLines } from './extra.mjs'
import { collectLines } from './lines.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = process.env.VOICE_OUT || join(ROOT, 'public/voice')
const MANIFEST = join(OUT, 'manifest.json')
const API = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io'
const KEY = process.env.ELEVENLABS_API_KEY
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const HANDS_MODEL = process.env.HANDS_MODEL || 'eleven_flash_v2_5'
/** Credits per character: Flash and Turbo cost half of the multilingual model. */
const COST = (model) => (/flash|turbo/.test(model) ? 0.5 : 1)
/** Credits to leave unspent, so a run never empties the account. */
const RESERVE = Number(process.env.VOICE_RESERVE ?? 300)
/** Films in the order their lines should be recorded when credits are short. */
const ORDER = ['hands/why', 'hands/joints', 'hands/muscle', 'hands/touch', 'hands/factory', 'hands/frontier', 'hands/data-gap', 'hands/data-collect', 'hands/data-learn', 'hands/data-home']

function modelFor(file = '') {
  return file.includes('/lessons/hands/') ? HANDS_MODEL : MODEL
}

function priorityOf(file = '', voice) {
  const i = ORDER.findIndex((f) => file.includes(`/lessons/${f}/`))
  return (i < 0 ? 0 : i + 1) * 2 + (voice === 'tutor' ? 1 : 0)
}
const FORMAT = 'mp3_44100_64'
const DRY = process.argv.includes('--dry-run')

/** Every sentence to record, with the sentences around it so the reading flows. */
function wantedClips() {
  const wanted = new Map()
  for (const { voice, text, file } of [...collectLines(), ...extraLines()]) {
    const parts = splitSentences(text)
    parts.forEach((sentence, i) => {
      const key = voiceKey(voice, sentence)
      const clip = { key, voice, text: sentence, previous: parts.slice(0, i).join(' '), next: parts.slice(i + 1).join(' '), model: modelFor(file), priority: priorityOf(file, voice) }
      const had = wanted.get(key)
      // A sentence used in several places is recorded once, at its earliest priority.
      if (!had || clip.priority < had.priority) wanted.set(key, had ? { ...clip, model: had.model } : clip)
    })
  }
  return wanted
}

async function api(path, init = {}, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': KEY, 'content-type': 'application/json', ...init.headers } })
    if (res.ok) return res.json()
    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }
    throw new Error(`ElevenLabs ${res.status} on ${path.split('?')[0]}: ${body.slice(0, 300)}`)
  }
}

/** Credits left this month, or null when the key can't read the subscription. */
async function remainingCredits() {
  try {
    const sub = await api('/v1/user/subscription', {}, 2)
    return Math.max(0, (sub.character_limit ?? 0) - (sub.character_count ?? 0))
  } catch {
    return null
  }
}

async function resolveVoices() {
  const { voices } = await api('/v1/voices')
  const pick = (role, override) => {
    if (override) {
      const v = voices.find((x) => x.voice_id === override || x.name.toLowerCase() === override.toLowerCase())
      if (v) return v
      console.warn(`No voice called "${override}" in this account; using the default ${role} voice.`)
    }
    for (const name of VOICE_CHOICES[role]) {
      const v = voices.find((x) => x.name.toLowerCase() === name.toLowerCase() || x.name.toLowerCase().startsWith(`${name.toLowerCase()} `))
      if (v) return v
    }
    return voices.find((x) => x.category === 'premade') ?? voices[0]
  }
  const narrator = pick('narrator', process.env.NARRATOR_VOICE)
  const tutor = pick('tutor', process.env.PIP_VOICE)
  if (!narrator || !tutor) throw new Error('This ElevenLabs account has no voices to use.')
  console.log(`Narrator voice: ${narrator.name} (${narrator.voice_id})`)
  console.log(`Pip voice: ${tutor.name} (${tutor.voice_id})`)
  return { narrator: narrator.voice_id, tutor: tutor.voice_id }
}

/** Word start times from ElevenLabs' per-character alignment. */
function wordTimes(text, alignment) {
  const chars = alignment?.characters ?? []
  const starts = alignment?.character_start_times_seconds ?? []
  const ends = alignment?.character_end_times_seconds ?? []
  const ms = Math.round((ends[ends.length - 1] ?? 0) * 1000)
  const exact = chars.join('') === text
  const words = [...text.matchAll(/\S+/g)].map((m) => {
    const i = m.index
    // If the alignment text differs, place the word proportionally instead.
    const t = exact ? starts[i] * 1000 : (i / text.length) * ms
    return [i, Math.round(t)]
  })
  return { words, ms }
}

async function record(clip, voiceId) {
  const res = await api(`/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${FORMAT}`, {
    method: 'POST',
    body: JSON.stringify({
      text: clip.text,
      model_id: clip.model,
      previous_text: clip.previous || undefined,
      next_text: clip.next || undefined,
    }),
  })
  const file = `${clip.key}.mp3`
  writeFileSync(join(OUT, file), Buffer.from(res.audio_base64, 'base64'))
  return { file, model: clip.model, ...wordTimes(clip.text, res.alignment) }
}

async function main() {
  const wanted = wantedClips()
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { voices: {}, model: MODEL, clips: {} }

  if (DRY || !KEY) {
    const todo = [...wanted.values()].filter((c) => !old.clips[c.key])
    const chars = todo.reduce((n, c) => n + c.text.length, 0)
    const credits = todo.reduce((n, c) => n + c.text.length * COST(c.model), 0)
    console.log(`${wanted.size} sentences in the lesson, ${todo.length} not recorded yet (${chars} characters, about ${Math.ceil(credits)} credits).`)
    if (!KEY && !DRY) console.log('Set ELEVENLABS_API_KEY to record them.')
    return
  }

  const voices = await resolveVoices()
  mkdirSync(OUT, { recursive: true })
  const clips = {}
  for (const [key, clip] of Object.entries(old.clips)) {
    const w = wanted.get(key)
    // Clips from before models were tracked per clip carry the manifest's model.
    const model = clip.model ?? old.model
    const sameVoice = w && old.voices?.[w.voice] === voices[w.voice] && (model === w.model || !clip.model)
    if (sameVoice && existsSync(join(OUT, clip.file))) clips[key] = { ...clip, model }
  }
  const todo = [...wanted.values()].filter((c) => !clips[c.key]).sort((a, b) => a.priority - b.priority)
  let budget = await remainingCredits()
  console.log(`${wanted.size} sentences, ${todo.length} to record.${budget == null ? '' : ` ${budget} credits left on the account.`}`)
  if (budget != null) budget -= RESERVE

  let done = 0
  let chars = 0
  let skipped = 0
  const failed = []
  const queue = [...todo]
  // One clip per line keeps the file small and its diffs readable.
  const save = () => {
    const rows = Object.entries(clips)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    writeFileSync(MANIFEST, `{"voices": ${JSON.stringify(voices)}, "model": ${JSON.stringify(MODEL)}, "clips": {\n${rows.join(',\n')}\n}}\n`)
  }
  await Promise.all(
    // Two at a time: the free and cheapest ElevenLabs plans refuse more parallel requests.
    Array.from({ length: 2 }, async () => {
      while (queue.length) {
        const clip = queue.shift()
        const cost = clip.text.length * COST(clip.model)
        if (budget != null) {
          // Out of credits: leave this line (and every later one) for the browser voice.
          if (cost > budget) {
            skipped += queue.length + 1
            queue.length = 0
            break
          }
          budget -= cost
        }
        try {
          clips[clip.key] = await record(clip, voices[clip.voice])
          chars += clip.text.length
          if (++done % 20 === 0) {
            console.log(`  recorded ${done} of ${todo.length}`)
            save()
          }
        } catch (err) {
          failed.push(`${clip.text}: ${err.message}`)
          if (/ 40[13] /.test(err.message)) queue.length = 0 // bad key or out of credits: stop early
        }
      }
    }),
  )

  // Remove clips nothing says any more.
  const keep = new Set(Object.values(clips).map((c) => c.file))
  let removed = 0
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.mp3') && !keep.has(f)) {
      rmSync(join(OUT, f))
      removed++
    }
  }
  save()
  console.log(`Recorded ${done} sentences (${chars} characters). ${Object.keys(clips).length} clips in total; removed ${removed} unused.`)
  if (skipped) console.log(`${skipped} sentences left for the next run: not enough credits.`)
  // A short note on how the run went, saved with the clips so it can be read without the Actions log.
  writeFileSync(
    join(OUT, 'last-run.json'),
    JSON.stringify({ at: new Date().toISOString(), wanted: wanted.size, recorded: done, characters: chars, clips: Object.keys(clips).length, skipped, creditsLeft: await remainingCredits(), failed: failed.length, errors: [...new Set(failed.map((f) => f.slice(f.indexOf(': ElevenLabs') + 2, f.indexOf(': ElevenLabs') + 260)))].slice(0, 5) }, null, 2) + '\n',
  )
  if (failed.length) {
    console.error(`${failed.length} sentences could not be recorded:\n${failed.slice(0, 10).join('\n')}`)
    process.exitCode = 1
  }
}

await main()
