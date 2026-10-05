/**
 * Shared by the player and the voice recording script (scripts/voice), so a line
 * recorded ahead of time can be found again when the lesson speaks it.
 */

export type VoiceName = 'narrator' | 'tutor'

export function normalizeLine(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Splits a line into sentences, keeping each sentence's end punctuation. */
export function splitSentences(text: string) {
  return normalizeLine(text)
    .split(/(?<=[.!?…]["”’)]?)\s+(?=\S)/)
    .filter(Boolean)
}

/** A short, stable id for a voice and line (cyrb53), used as the clip's file name. */
export function voiceKey(voice: VoiceName, text: string) {
  const str = `${voice}|${normalizeLine(text)}`
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** One recorded line: its audio file and when each word starts, for caption highlighting. */
export interface Clip {
  /** File name inside public/voice/. */
  file: string
  /** [character index in the line, start time in ms] for each word. */
  words: [number, number][]
  /** Length of the audio in ms. */
  ms: number
}

export interface VoiceManifest {
  /** ElevenLabs voice ids the clips were recorded with, so live lines can match them. */
  voices: Record<VoiceName, string>
  model: string
  clips: Record<string, Clip>
}

/**
 * ElevenLabs voices to use, by name, tried in order until one is in the account.
 * The narrator is warm and clear; Pip is brighter and younger.
 */
export const VOICE_CHOICES: Record<VoiceName, string[]> = {
  narrator: ['Matilda', 'Alice', 'Sarah', 'Rachel'],
  tutor: ['Jessica', 'Lily', 'Laura', 'Charlie'],
}
