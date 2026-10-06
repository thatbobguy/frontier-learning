/**
 * Pip's relay: a tiny Cloudflare Worker that holds the site's Anthropic key, so Pip can
 * answer every visitor without anyone pasting a key. It only passes on tutor requests
 * from the site itself, always to Pip's model, with a cap on reply length.
 *
 * Set up (once):
 *   npx wrangler deploy worker/pip-relay.js --name pip-relay --compatibility-date 2026-10-01
 *   npx wrangler secret put ANTHROPIC_API_KEY --name pip-relay
 * Then set the repository variable VITE_PIP_RELAY to the worker's address
 * (e.g. https://pip-relay.<you>.workers.dev) and push to main to rebuild the site.
 *
 * Put a monthly spend limit on the key's workspace in the Anthropic console: the site is public.
 */
const ALLOWED_ORIGINS = ['https://thatbobguy.github.io', 'http://localhost:5173', 'http://localhost:4173']
const MODEL = 'claude-opus-5-5'
const MAX_TOKENS = 2000
const MAX_BODY = 2_000_000

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') ?? ''
    const allowed = ALLOWED_ORIGINS.includes(origin)
    const cors = {
      'access-control-allow-origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '*',
      'access-control-max-age': '86400',
      vary: 'origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors })
    const url = new URL(request.url)
    if (!allowed || request.method !== 'POST' || !url.pathname.endsWith('/v1/messages')) {
      return new Response('Not allowed', { status: 403, headers: cors })
    }
    const text = await request.text()
    if (text.length > MAX_BODY) return new Response('Too large', { status: 413, headers: cors })
    let body
    try {
      body = JSON.parse(text)
    } catch {
      return new Response('Bad request', { status: 400, headers: cors })
    }
    body.model = MODEL
    body.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS)
    delete body.stream
    const headers = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': request.headers.get('anthropic-version') ?? '2023-06-01',
    }
    const beta = request.headers.get('anthropic-beta')
    if (beta) headers['anthropic-beta'] = beta
    const res = await fetch(`https://api.anthropic.com/v1/messages${url.search}`, { method: 'POST', headers, body: JSON.stringify(body) })
    return new Response(res.body, { status: res.status, headers: { ...cors, 'content-type': res.headers.get('content-type') ?? 'application/json' } })
  },
}
