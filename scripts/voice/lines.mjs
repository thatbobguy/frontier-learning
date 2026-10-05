// Collects every fixed line the lesson speaks, so it can be recorded ahead of time.
//
// It starts from the places speech happens: a beat's `say`, a scene's `say(...)`,
// `setHints(...)`, and Pip's `pipSays(...)`. From there it follows the names those
// use (a constant, a local variable, a property such as `card.right`) back to the
// strings they hold. Hints and Pip's own lines are Pip's voice; the rest is the
// narrator's. Lines built at runtime from numbers can't be known here, and the
// player falls back to another voice for those.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { normalizeLine, splitSentences } from '../../src/engine/voiceKey.ts'

const ROOT = new URL('../../', import.meta.url).pathname

function isSentence(s) {
  const t = s.trim()
  return /[a-z]/i.test(t) && t.split(/\s+/).length >= 2 && /[.!?…]["”’)]?$/.test(t)
}

function calleeName(call) {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return ''
}

function collectFile(path, { beatVoice, sayVoice, sayCalls }) {
  const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const variables = new Map() // name -> initializers
  const properties = new Map() // property name -> initializers
  const add = (map, name, node) => map.set(name, [...(map.get(name) ?? []), node])
  const starts = [] // [node, voice]

  const index = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) add(variables, node.name.text, node.initializer)
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      add(properties, node.name.text, node.initializer)
      if (node.name.text === 'say') starts.push([node.initializer, beatVoice])
    }
    if (ts.isCallExpression(node)) {
      const voice = sayCalls[calleeName(node)]
      if (voice) node.arguments.forEach((a) => starts.push([a, voice]))
    }
    ts.forEachChild(node, index)
  }
  index(src)

  const found = []
  const keep = (voice, text) => {
    const t = normalizeLine(text)
    if (isSentence(t)) found.push({ voice, text: t })
  }
  const seen = { narrator: new Set(), tutor: new Set() }
  const follow = (node, voice) => {
    if (!node || seen[voice].has(node)) return
    seen[voice].add(node)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return keep(voice, node.text)
    if (ts.isTemplateExpression(node)) {
      // Whole sentences inside a template, e.g. "You sorted every card onto the map!"
      const pieces = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
      for (const piece of pieces) {
        const parts = splitSentences(piece)
        parts.forEach((s, i) => {
          const whole = (i > 0 || /^\s*$/.test(piece.slice(0, piece.indexOf(s)))) && /^[A-Z]/.test(s)
          if (whole && (i < parts.length - 1 || /[.!?…]["”’)]?\s*$/.test(piece))) keep(voice, s)
        })
      }
      node.templateSpans.forEach((s) => follow(s.expression, voice))
      return
    }
    if (ts.isIdentifier(node)) return (variables.get(node.text) ?? []).forEach((n) => follow(n, voice))
    if (ts.isPropertyAccessExpression(node)) return (properties.get(node.name.text) ?? []).forEach((n) => follow(n, voice))
    if (ts.isElementAccessExpression(node)) return follow(node.expression, voice)
    if (ts.isCallExpression(node)) {
      // e.g. lines.join(' '): follow what the method is called on. Other calls are not followed.
      if (ts.isPropertyAccessExpression(node.expression)) follow(node.expression.expression, voice)
      return
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return follow(node.body, voice)
    if (ts.isReturnStatement(node)) return follow(node.expression, voice)
    if (ts.isPropertyAssignment(node)) return follow(node.initializer, voice)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
      // a ?? b, a || b: either side can be spoken. Comparisons hold no speech but are harmless.
      follow(node.left, voice)
      return follow(node.right, voice)
    }
    ts.forEachChild(node, (child) => follow(child, voice))
  }
  for (const [node, voice] of starts) follow(node, voice)
  return found
}

function tsxFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? tsxFiles(p) : f.endsWith('.tsx') ? [p] : []
    })
}

/** Every line to record: `{ voice: 'narrator' | 'tutor', text }`, de-duplicated. */
export function collectLines() {
  const lines = []
  // The first lesson's scenes, and every chapter of the newer lessons.
  for (const file of ['src/scenes', 'src/lessons'].flatMap((d) => tsxFiles(join(ROOT, d)))) {
    lines.push(...collectFile(file, { beatVoice: 'narrator', sayCalls: { say: 'narrator', setHints: 'tutor' } }))
  }
  lines.push(...collectFile(join(ROOT, 'src/tutor/TutorPanel.tsx'), { beatVoice: 'tutor', sayCalls: { pipSays: 'tutor' } }))
  const seen = new Set()
  return lines.filter((l) => {
    const k = `${l.voice}|${l.text}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = collectLines()
  for (const l of lines) console.log(`${l.voice === 'tutor' ? 'PIP ' : 'NARR'} ${l.text}`)
  const chars = lines.reduce((n, l) => n + l.text.length, 0)
  console.log(`\n${lines.length} lines, ${chars} characters`)
}
